import { prisma } from '@/lib/prisma';
import { getAuthenticatedCalendarClient } from '@/lib/google/calendarClient';
import type { calendar_v3 } from 'googleapis';

export interface PushTaskResult {
  success: boolean;
  googleEventId?: string;
  htmlLink?: string;
  error?: string;
  code?: 'INSUFFICIENT_SCOPES' | 'NO_GOOGLE_ACCOUNT' | 'NO_DUE_DATE' | 'TASK_NOT_FOUND' | 'GOOGLE_ERROR';
}

/**
 * Pushes a StudyFlow task to Google Calendar as an event.
 * If already exported, updates the existing event.
 */
export async function pushTaskToGoogleCalendar(
  userId: string,
  taskId: string,
  targetCalendarId?: string
): Promise<PushTaskResult> {
  // 1. Fetch task with subject
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      subject: { select: { id: true, name: true, color: true } },
    },
  });

  if (!task || task.ownerId !== userId) {
    return {
      success: false,
      code: 'TASK_NOT_FOUND',
      error: 'Zadanie nie istnieje lub brak uprawnień',
    };
  }

  if (!task.dueDate) {
    return {
      success: false,
      code: 'NO_DUE_DATE',
      error: 'Zadanie musi mieć określony termin (datę i godzinę), aby mogło pojawić się w kalendarzu',
    };
  }

  // 2. Fetch Google Calendar client
  let calendarClient;
  let account;
  try {
    const res = await getAuthenticatedCalendarClient(userId);
    calendarClient = res.calendar;
    account = res.account;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      code: 'NO_GOOGLE_ACCOUNT',
      error: msg.includes('NO_GOOGLE_ACCOUNT')
        ? 'Brak połączonego konta Google Calendar'
        : `Błąd klienta Google: ${msg}`,
    };
  }

  // Check if current granted scope has write access
  const grantedScopes = (account.scope || '').split(' ');
  const hasWriteScope = grantedScopes.some(
    (s) =>
      s === 'https://www.googleapis.com/auth/calendar.events' ||
      s === 'https://www.googleapis.com/auth/calendar'
  );

  if (account.scope && !hasWriteScope) {
    return {
      success: false,
      code: 'INSUFFICIENT_SCOPES',
      error:
        'Konto Google zostało połączone w trybie tylko do odczytu. Połącz konto ponownie, aby nadać uprawnienia do tworzenia wydarzeń.',
    };
  }

  // Determine calendar ID to export to:
  // If explicitly specified and not 'all', use it; else if account has selectedCalendarId != 'all', use that; else 'primary'
  let calendarId = targetCalendarId || account.selectedCalendarId || 'primary';
  if (calendarId === 'all') {
    calendarId = 'primary';
  }

  // Calculate start & end
  const endDateTime = task.dueDate;
  const durationMs = (task.estimatedMinutes || 60) * 60 * 1000;
  const startDateTime = new Date(endDateTime.getTime() - durationMs);

  const eventRequestBody: calendar_v3.Schema$Event = {
    summary: `[StudyFlow] ${task.title}`,
    description: [
      `Zadanie StudyFlow: ${task.title}`,
      `Przedmiot: ${task.subject?.name || 'Ogólne'}`,
      `Status: ${task.status}`,
      `Story Points: ${task.storyPoints}`,
      task.description ? `\nOpis:\n${task.description}` : '',
    ]
      .filter(Boolean)
      .join('\n'),
    start: {
      dateTime: startDateTime.toISOString(),
    },
    end: {
      dateTime: endDateTime.toISOString(),
    },
  };

  try {
    let googleEventId: string | null = task.googleEventId;
    let htmlLink: string | undefined = undefined;

    if (googleEventId && task.googleCalendarId) {
      try {
        const updateRes = await calendarClient.events.update({
          calendarId: task.googleCalendarId,
          eventId: googleEventId,
          requestBody: eventRequestBody,
        });
        htmlLink = updateRes.data.htmlLink || undefined;
      } catch (updateErr: unknown) {
        const status =
          (updateErr as { status?: number; code?: number })?.status ||
          (updateErr as { code?: number })?.code;
        if (status === 404) {
          // Event was deleted in Google, insert fresh
          const insertRes = await calendarClient.events.insert({
            calendarId,
            requestBody: eventRequestBody,
          });
          googleEventId = insertRes.data.id || null;
          htmlLink = insertRes.data.htmlLink || undefined;
        } else {
          throw updateErr;
        }
      }
    } else {
      const insertRes = await calendarClient.events.insert({
        calendarId,
        requestBody: eventRequestBody,
      });
      googleEventId = insertRes.data.id || null;
      htmlLink = insertRes.data.htmlLink || undefined;
    }

    if (!googleEventId) {
      throw new Error('Google nie zwrócił identyfikatora utworzonego wydarzenia');
    }

    // Save on Task
    await prisma.task.update({
      where: { id: taskId },
      data: {
        googleEventId,
        googleCalendarId: calendarId,
      },
    });

    // Also update/upsert into local GoogleCalendarEvent cache for instant display
    await prisma.googleCalendarEvent.upsert({
      where: {
        userId_googleEventId: {
          userId,
          googleEventId,
        },
      },
      create: {
        userId,
        googleEventId,
        calendarId,
        calendarName: 'StudyFlow (Google)',
        calendarColor: task.subject?.color || '#4285F4',
        summary: `[StudyFlow] ${task.title}`,
        description: task.description || null,
        startDateTime,
        endDateTime,
        isAllDay: false,
        status: 'confirmed',
        htmlLink: htmlLink || null,
      },
      update: {
        calendarId,
        summary: `[StudyFlow] ${task.title}`,
        description: task.description || null,
        startDateTime,
        endDateTime,
        status: 'confirmed',
        htmlLink: htmlLink || null,
      },
    });

    return {
      success: true,
      googleEventId,
      htmlLink,
    };
  } catch (err: unknown) {
    const errorObj = err as { code?: number; message?: string; errors?: Array<{ reason?: string }> };
    if (errorObj?.code === 403 || errorObj?.errors?.some((e) => e.reason === 'insufficientPermissions')) {
      return {
        success: false,
        code: 'INSUFFICIENT_SCOPES',
        error:
          'Konto Google wymaga ponownej autoryzacji z uprawnieniem do zapisu. Kliknij poniżej, aby połączyć konto ponownie.',
      };
    }

    return {
      success: false,
      code: 'GOOGLE_ERROR',
      error: `Błąd podczas komunikacji z Google Calendar: ${errorObj?.message || String(err)}`,
    };
  }
}

/**
 * Removes an exported task from Google Calendar.
 */
export async function removeTaskFromGoogleCalendar(
  userId: string,
  taskId: string
): Promise<{ success: boolean; error?: string }> {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
  });

  if (!task || task.ownerId !== userId) {
    return { success: false, error: 'Zadanie nie zostało znalezione' };
  }

  if (!task.googleEventId) {
    return { success: true }; // Already not on Google
  }

  try {
    const { calendar } = await getAuthenticatedCalendarClient(userId);
    if (task.googleCalendarId && task.googleEventId) {
      try {
        await calendar.events.delete({
          calendarId: task.googleCalendarId,
          eventId: task.googleEventId,
        });
      } catch (delErr: unknown) {
        // Ignore 404 (already deleted in Google)
        const status =
          (delErr as { status?: number; code?: number })?.status ||
          (delErr as { code?: number })?.code;
        if (status !== 404) {
          console.warn('Google event delete warning:', delErr);
        }
      }
    }

    await prisma.task.update({
      where: { id: taskId },
      data: {
        googleEventId: null,
        googleCalendarId: null,
      },
    });

    await prisma.googleCalendarEvent.deleteMany({
      where: {
        userId,
        googleEventId: task.googleEventId,
      },
    });

    return { success: true };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
