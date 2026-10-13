import { prisma } from '@/lib/prisma';
import { getAuthenticatedCalendarClient } from '@/lib/google/calendarClient';
import type { calendar_v3 } from 'googleapis';

export interface SyncResult {
  success: boolean;
  imported: number;
  updated: number;
  deleted: number;
  error?: string;
  calendarId: string;
}

/**
 * Synchronizes events for a specific user.
 * Supports incremental sync via syncToken, falling back to full sync if 410 Gone occurs.
 * Prevents concurrent syncs by checking and setting lastSyncStatus = 'IN_PROGRESS'.
 */
export async function syncUserGoogleCalendar(userId: string, options?: { forceFullSync?: boolean }): Promise<SyncResult> {
  const account = await prisma.googleCalendarAccount.findUnique({
    where: { userId },
  });

  if (!account) {
    return {
      success: false,
      imported: 0,
      updated: 0,
      deleted: 0,
      error: 'Brak połączonego konta Google Calendar',
      calendarId: 'primary',
    };
  }

  // Prevent concurrent syncs if one started within last 2 minutes
  if (account.lastSyncStatus === 'IN_PROGRESS' && account.lastSyncAt && (Date.now() - account.lastSyncAt.getTime() < 120000)) {
    return {
      success: false,
      imported: 0,
      updated: 0,
      deleted: 0,
      error: 'Synchronizacja jest już w trakcie realizacji',
      calendarId: account.selectedCalendarId,
    };
  }

  // Set lock
  await prisma.googleCalendarAccount.update({
    where: { userId },
    data: {
      lastSyncStatus: 'IN_PROGRESS',
      lastSyncAt: new Date(),
    },
  });

  let imported = 0;
  let updated = 0;
  let deleted = 0;

  try {
    const { calendar } = await getAuthenticatedCalendarClient(userId);
    const targetCalendarId = account.selectedCalendarId || 'all';

    interface CalendarTarget {
      id: string;
      summary: string;
      backgroundColor?: string;
    }

    let calendarsToSync: CalendarTarget[] = [];

    // Check if calendarList.list is available (Google API client)
    if (typeof calendar.calendarList?.list === 'function') {
      try {
        const listRes = await calendar.calendarList.list();
        const allCalendars = listRes.data.items || [];

        if (targetCalendarId === 'all') {
          calendarsToSync = allCalendars.map((c) => ({
            id: c.id || 'primary',
            summary: c.summary || 'Kalendarz',
            backgroundColor: c.backgroundColor || undefined,
          }));
        } else {
          const match = allCalendars.find((c) => c.id === targetCalendarId);
          if (match) {
            calendarsToSync = [
              {
                id: match.id || targetCalendarId,
                summary: match.summary || account.selectedCalendarName || 'Kalendarz',
                backgroundColor: match.backgroundColor || undefined,
              },
            ];
          }
        }
      } catch {
        // Fall back to targetCalendarId
      }
    }

    if (calendarsToSync.length === 0) {
      calendarsToSync = [
        {
          id: targetCalendarId === 'all' ? 'primary' : targetCalendarId,
          summary: account.selectedCalendarName || 'Podstawowy',
        },
      ];
    }

    let lastNewSyncToken: string | undefined = undefined;

    // Time window for sync: 30 days in the past, 180 days in the future
    const timeMin = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
    const timeMax = new Date(Date.now() + 180 * 24 * 3600 * 1000).toISOString();

    for (const calTarget of calendarsToSync) {
      const calendarId = calTarget.id;
      // Use syncToken only when single calendar is targeted
      let syncToken =
        calendarsToSync.length === 1 && !options?.forceFullSync ? account.syncToken : null;
      let pageToken: string | undefined = undefined;
      let hasMorePages = true;
      const seenEventIds: string[] = [];

      while (hasMorePages) {
        const params: calendar_v3.Params$Resource$Events$List = {
          calendarId,
          maxResults: 250,
          singleEvents: true, // Expands recurring events into individual instances
          pageToken,
        };

        if (syncToken) {
          params.syncToken = syncToken;
        } else {
          params.timeMin = timeMin;
          params.timeMax = timeMax;
        }

        let res;
        try {
          res = await calendar.events.list(params);
        } catch (err: unknown) {
          const status =
            (err as { status?: number; code?: number })?.status ||
            (err as { code?: number })?.code;
          // 410 GONE indicates syncToken is invalidated by Google
          if (status === 410 && syncToken) {
            await prisma.googleCalendarAccount.update({
              where: { userId },
              data: { syncToken: null },
            });
            syncToken = null;
            pageToken = undefined;
            hasMorePages = true;
            continue;
          }
          throw err;
        }

        const items = res.data.items || [];
        if (calendarsToSync.length === 1) {
          lastNewSyncToken = res.data.nextSyncToken || undefined;
        }
        pageToken = res.data.nextPageToken || undefined;

        for (const item of items) {
          if (!item.id) continue;
          seenEventIds.push(item.id);

          // Check if event is cancelled/deleted
          if (item.status === 'cancelled') {
            const deleteRes = await prisma.googleCalendarEvent.deleteMany({
              where: {
                userId,
                googleEventId: item.id,
              },
            });
            deleted += deleteRes.count;
            continue;
          }

          // Determine start & end time
          const isAllDay = Boolean(item.start?.date && !item.start?.dateTime);
          let startDateTime: Date | null = null;
          let endDateTime: Date | null = null;
          let allDayDate: string | null = null;

          if (isAllDay) {
            allDayDate = item.start?.date || null;
            if (allDayDate) {
              startDateTime = new Date(`${allDayDate}T00:00:00Z`);
              endDateTime = item.end?.date
                ? new Date(`${item.end.date}T23:59:59Z`)
                : startDateTime;
            }
          } else {
            startDateTime = item.start?.dateTime ? new Date(item.start.dateTime) : null;
            endDateTime = item.end?.dateTime ? new Date(item.end.dateTime) : null;
          }

          const summary = item.summary || '(Bez tytułu)';
          const description = item.description || null;
          const location = item.location || null;
          const htmlLink = item.htmlLink || null;
          const colorId = item.colorId || null;
          const recurringEventId = item.recurringEventId || null;
          const etag = item.etag || null;
          const updatedInGoogle = item.updated ? new Date(item.updated) : null;
          const calendarName = calTarget.summary || null;
          const calendarColor = calTarget.backgroundColor || null;

          const existing = await prisma.googleCalendarEvent.findUnique({
            where: {
              userId_googleEventId: {
                userId,
                googleEventId: item.id,
              },
            },
          });

          if (existing) {
            await prisma.googleCalendarEvent.update({
              where: { id: existing.id },
              data: {
                calendarId,
                calendarName,
                calendarColor,
                summary,
                description,
                location,
                startDateTime,
                endDateTime,
                isAllDay,
                allDayDate,
                status: item.status || 'confirmed',
                htmlLink,
                colorId,
                recurringEventId,
                etag,
                updatedInGoogle,
              },
            });
            updated++;
          } else {
            await prisma.googleCalendarEvent.create({
              data: {
                userId,
                googleEventId: item.id,
                calendarId,
                calendarName,
                calendarColor,
                summary,
                description,
                location,
                startDateTime,
                endDateTime,
                isAllDay,
                allDayDate,
                status: item.status || 'confirmed',
                htmlLink,
                colorId,
                recurringEventId,
                etag,
                updatedInGoogle,
              },
            });
            imported++;
          }
        }
        hasMorePages = Boolean(pageToken);
      }

      // If full sync (no syncToken used), clean up events in window deleted from Google
      if (
        !syncToken &&
        seenEventIds.length > 0 &&
        typeof prisma.googleCalendarEvent?.findMany === 'function'
      ) {
        const staleEvents = await prisma.googleCalendarEvent.findMany({
          where: {
            userId,
            calendarId,
            startDateTime: { gte: new Date(timeMin) },
            endDateTime: { lte: new Date(timeMax) },
            googleEventId: { notIn: seenEventIds },
          },
          select: { id: true },
        });

        if (staleEvents && staleEvents.length > 0) {
          const deleteRes = await prisma.googleCalendarEvent.deleteMany({
            where: { id: { in: staleEvents.map((e) => e.id) } },
          });
          deleted += deleteRes.count;
        }
      }
    }

    // Save final state
    const nextSyncAt = new Date(
      Date.now() + (account.syncFrequencyHours || 3) * 3600 * 1000
    );
    await prisma.googleCalendarAccount.update({
      where: { userId },
      data: {
        lastSyncStatus: 'SUCCESS',
        lastSyncAt: new Date(),
        lastSyncError: null,
        syncToken: lastNewSyncToken || account.syncToken,
        nextSyncAt,
      },
    });

    return {
      success: true,
      imported,
      updated,
      deleted,
      calendarId: targetCalendarId,
    };
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    await prisma.googleCalendarAccount.update({
      where: { userId },
      data: {
        lastSyncStatus: 'ERROR',
        lastSyncAt: new Date(),
        lastSyncError: errorMsg,
      },
    });

    return {
      success: false,
      imported,
      updated,
      deleted,
      error: errorMsg,
      calendarId: account.selectedCalendarId,
    };
  }
}
