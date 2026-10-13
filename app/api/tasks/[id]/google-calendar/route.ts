import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { pushTaskToGoogleCalendar, removeTaskFromGoogleCalendar } from '@/lib/google/taskExportService';

/**
 * POST /api/tasks/[id]/google-calendar
 * Pushes/syncs the specified task to Google Calendar.
 */
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getCurrentUser();
  if (!session) {
    return NextResponse.json({ error: 'Niezalogowany' }, { status: 401 });
  }

  const taskId = params.id;
  let targetCalendarId: string | undefined = undefined;

  try {
    const body = await req.json().catch(() => ({}));
    if (body?.targetCalendarId && typeof body.targetCalendarId === 'string') {
      targetCalendarId = body.targetCalendarId;
    }
  } catch {
    // optional body
  }

  const result = await pushTaskToGoogleCalendar(session.userId, taskId, targetCalendarId);

  if (!result.success) {
    return NextResponse.json(
      {
        error: result.error,
        code: result.code,
      },
      { status: result.code === 'TASK_NOT_FOUND' ? 404 : 400 }
    );
  }

  return NextResponse.json({
    success: true,
    message: 'Zadanie zostało pomyślnie przesłane do Google Calendar',
    googleEventId: result.googleEventId,
    htmlLink: result.htmlLink,
  });
}

/**
 * DELETE /api/tasks/[id]/google-calendar
 * Removes the specified task from Google Calendar.
 */
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getCurrentUser();
  if (!session) {
    return NextResponse.json({ error: 'Niezalogowany' }, { status: 401 });
  }

  const taskId = params.id;
  const result = await removeTaskFromGoogleCalendar(session.userId, taskId);

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({
    success: true,
    message: 'Wydarzenie zostało usunięte z Google Calendar',
  });
}

