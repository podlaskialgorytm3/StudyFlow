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
    const calendarId = account.selectedCalendarId || 'primary';

    let syncToken = options?.forceFullSync ? null : account.syncToken;
    let pageToken: string | undefined = undefined;
    let newSyncToken: string | undefined = undefined;

    do {
      const params: calendar_v3.Params$Resource$Events$List = {
        calendarId,
        maxResults: 250,
        singleEvents: true, // Expands recurring events into individual instances
        pageToken,
      };

      if (syncToken) {
        params.syncToken = syncToken;
      } else {
        // Fetch 30 days in the past and 180 days in the future for initial/full sync
        const timeMin = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
        const timeMax = new Date(Date.now() + 180 * 24 * 3600 * 1000).toISOString();
        params.timeMin = timeMin;
        params.timeMax = timeMax;
      }

      let res;
      try {
        res = await calendar.events.list(params);
      } catch (err: unknown) {
        const status = (err as { status?: number; code?: number })?.status || (err as { code?: number })?.code;
        // 410 GONE indicates syncToken is invalidated by Google
        if (status === 410 && syncToken) {
          // Clear syncToken and perform full sync from beginning
          await prisma.googleCalendarAccount.update({
            where: { userId },
            data: { syncToken: null },
          });
          syncToken = null;
          pageToken = undefined;
          continue;
        }
        throw err;
      }

      const items = res.data.items || [];
      newSyncToken = res.data.nextSyncToken || undefined;
      pageToken = res.data.nextPageToken || undefined;

      for (const item of items) {
        if (!item.id) continue;

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
            endDateTime = item.end?.date ? new Date(`${item.end.date}T23:59:59Z`) : startDateTime;
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
    } while (pageToken);

    // Save final state
    const nextSyncAt = new Date(Date.now() + (account.syncFrequencyHours || 3) * 3600 * 1000);
    await prisma.googleCalendarAccount.update({
      where: { userId },
      data: {
        lastSyncStatus: 'SUCCESS',
        lastSyncAt: new Date(),
        lastSyncError: null,
        syncToken: newSyncToken || syncToken || account.syncToken,
        nextSyncAt,
      },
    });

    return {
      success: true,
      imported,
      updated,
      deleted,
      calendarId,
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
