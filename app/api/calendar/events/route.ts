import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
import { syncUserGoogleCalendar } from '@/lib/google/syncService';

export interface UnifiedCalendarItem {
  id: string;
  source: 'google' | 'studyflow';
  title: string;
  description?: string | null;
  location?: string | null;
  start: string; // ISO string
  end: string;   // ISO string
  isAllDay: boolean;
  color?: string | null;
  calendarName?: string | null;
  url?: string | null;
  // Specific StudyFlow properties
  studyflowMeta?: {
    taskId: string;
    subjectId: string;
    subjectName: string;
    status: string;
    storyPoints: number;
    estimatedMinutes: number;
    progressPercent: number;
    startDate?: string | null;
    dueDate?: string | null;
    googleEventId?: string | null;
    googleCalendarId?: string | null;
  };
}

/**
 * GET /api/calendar/events
 * Query parameters:
 *  - start: ISO date string (start of timeframe)
 *  - end: ISO date string (end of timeframe)
 * Returns unified list of Google Calendar events and StudyFlow tasks.
 * Automatically performs quick sync if Google account connected and last sync was > syncFrequencyHours ago.
 */
export async function GET(req: Request) {
  const session = await getCurrentUser();
  if (!session) {
    return NextResponse.json({ error: 'Niezalogowany' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const startParam = searchParams.get('start');
  const endParam = searchParams.get('end');

  const startDate = startParam ? new Date(startParam) : new Date(Date.now() - 7 * 24 * 3600 * 1000);
  const endDate = endParam ? new Date(endParam) : new Date(Date.now() + 14 * 24 * 3600 * 1000);

  // 1. Fetch user settings & Google account
  const [userSettings, googleAccount] = await Promise.all([
    prisma.userSettings.findUnique({ where: { userId: session.userId } }),
    prisma.googleCalendarAccount.findUnique({ where: { userId: session.userId } }),
  ]);

  const showGoogle = userSettings?.calendarShowGoogleEvents ?? true;
  const showTasks = userSettings?.calendarShowStudyFlowTasks ?? true;

  // 2. Check if lazy auto-sync is needed (e.g. lastSyncAt is older than sync frequency or never synced)
  if (googleAccount && showGoogle) {
    const hoursSinceSync = googleAccount.lastSyncAt
      ? (Date.now() - googleAccount.lastSyncAt.getTime()) / (3600 * 1000)
      : 9999;

    if (hoursSinceSync >= (googleAccount.syncFrequencyHours || 3)) {
      // Trigger background sync without blocking request
      syncUserGoogleCalendar(session.userId).catch(() => {});
    }
  }

  const items: UnifiedCalendarItem[] = [];

  // 3. Fetch Google Calendar events if enabled
  if (showGoogle) {
    const googleEvents = await prisma.googleCalendarEvent.findMany({
      where: {
        userId: session.userId,
        status: { not: 'cancelled' },
        OR: [
          // Non-all-day and all-day events within range
          {
            startDateTime: { lte: endDate },
            endDateTime: { gte: startDate },
          },
          // All-day events within range (with 1 day buffer for timezones)
          {
            isAllDay: true,
            allDayDate: {
              gte: new Date(startDate.getTime() - 24 * 3600 * 1000).toISOString().slice(0, 10),
              lte: new Date(endDate.getTime() + 24 * 3600 * 1000).toISOString().slice(0, 10),
            },
          },
        ],
      },
      orderBy: { startDateTime: 'asc' },
    });

    for (const gev of googleEvents) {
      let startStr = gev.startDateTime?.toISOString() || '';
      let endStr = gev.endDateTime?.toISOString() || startStr;

      if (gev.isAllDay && gev.allDayDate) {
        startStr = `${gev.allDayDate}T00:00:00Z`;
        endStr = `${gev.allDayDate}T23:59:59Z`;
      }

      items.push({
        id: `google_${gev.id}`,
        source: 'google',
        title: gev.summary,
        description: gev.description,
        location: gev.location,
        start: startStr,
        end: endStr,
        isAllDay: gev.isAllDay,
        color: gev.calendarColor || gev.colorId || '#4285F4',
        calendarName: gev.calendarName,
        url: gev.htmlLink,
      });
    }
  }

  // 4. Fetch StudyFlow tasks scheduled in calendar (only tasks with startDate)
  if (showTasks) {
    const tasks = await prisma.task.findMany({
      where: {
        ownerId: session.userId,
        startDate: {
          not: null,
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        subject: {
          select: {
            id: true,
            name: true,
            color: true,
          },
        },
      },
      orderBy: { startDate: 'asc' },
    });

    for (const t of tasks) {
      if (!t.startDate) continue;

      const durationMs = (t.estimatedMinutes || 60) * 60 * 1000;
      const start = new Date(t.startDate);
      let end = t.dueDate ? new Date(t.dueDate) : new Date(start.getTime() + durationMs);
      if (end.getTime() <= start.getTime()) {
        end = new Date(start.getTime() + durationMs);
      }

      items.push({
        id: `task_${t.id}`,
        source: 'studyflow',
        title: t.title,
        description: t.description,
        location: null,
        start: start.toISOString(),
        end: end.toISOString(),
        isAllDay: false,
        color: t.subject?.color || '#1976d2',
        url: `/tasks/${t.id}`,
        studyflowMeta: {
          taskId: t.id,
          subjectId: t.subjectId,
          subjectName: t.subject?.name || 'Przedmiot',
          status: t.status,
          storyPoints: t.storyPoints,
          estimatedMinutes: t.estimatedMinutes,
          progressPercent: t.progressPercent,
          startDate: t.startDate?.toISOString() || null,
          dueDate: t.dueDate?.toISOString() || null,
          googleEventId: t.googleEventId,
          googleCalendarId: t.googleCalendarId,
        },
      });
    }
  }

  return NextResponse.json({
    items,
    meta: {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      googleConnected: Boolean(googleAccount),
      googleEmail: googleAccount?.googleEmail,
      lastSyncAt: googleAccount?.lastSyncAt,
      lastSyncStatus: googleAccount?.lastSyncStatus,
      showGoogle,
      showTasks,
    },
  });
}

