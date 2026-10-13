import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
import { disconnectGoogleCalendar, getAuthenticatedCalendarClient } from '@/lib/google/calendarClient';
import { z } from 'zod';

const updateGoogleAccountSchema = z.object({
  selectedCalendarId: z.string().trim().min(1).optional(),
  selectedCalendarName: z.string().trim().optional(),
  syncFrequencyHours: z.number().int().refine((val) => [1, 3, 6].includes(val), {
    message: 'Częstotliwość musi wynosić 1, 3 lub 6 godzin',
  }).optional(),
});

/**
 * GET: Returns user's Google Calendar account status and available calendars list.
 */
export async function GET() {
  const session = await getCurrentUser();
  if (!session) {
    return NextResponse.json({ error: 'Niezalogowany' }, { status: 401 });
  }

  const account = await prisma.googleCalendarAccount.findUnique({
    where: { userId: session.userId },
    select: {
      id: true,
      googleEmail: true,
      selectedCalendarId: true,
      selectedCalendarName: true,
      syncFrequencyHours: true,
      lastSyncAt: true,
      lastSyncStatus: true,
      lastSyncError: true,
      createdAt: true,
      tokenExpiresAt: true,
    },
  });

  const isConfigured = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

  if (!account) {
    return NextResponse.json({
      connected: false,
      isConfigured,
      account: null,
      calendars: [],
    });
  }

  // Fetch available calendars from Google
  let calendars: Array<{ id: string; summary: string; primary?: boolean; description?: string }> = [];
  try {
    const { calendar } = await getAuthenticatedCalendarClient(session.userId);
    const listRes = await calendar.calendarList.list();
    calendars = (listRes.data.items || []).map((item) => ({
      id: item.id || '',
      summary: item.summary || '(Bez nazwy)',
      primary: Boolean(item.primary),
      description: item.description || undefined,
    }));
  } catch {
    // If fetching fails (e.g. token expired and couldn't refresh), return existing selected calendar
    calendars = [{ id: account.selectedCalendarId, summary: account.selectedCalendarName || 'Podstawowy', primary: true }];
  }

  return NextResponse.json({
    connected: true,
    isConfigured,
    account,
    calendars,
  });
}

/**
 * PATCH: Updates calendar preferences (selected calendar, sync frequency).
 */
export async function PATCH(req: Request) {
  const session = await getCurrentUser();
  if (!session) {
    return NextResponse.json({ error: 'Niezalogowany' }, { status: 401 });
  }

  const account = await prisma.googleCalendarAccount.findUnique({
    where: { userId: session.userId },
  });

  if (!account) {
    return NextResponse.json({ error: 'Brak połączonego konta Google' }, { status: 404 });
  }

  try {
    const body = await req.json();
    const parsed = updateGoogleAccountSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || 'Niepoprawne dane' },
        { status: 400 }
      );
    }

    const { selectedCalendarId, selectedCalendarName, syncFrequencyHours } = parsed.data;

    // If changing calendar, reset syncToken and clear cached events for old calendar
    const calendarChanged = selectedCalendarId && selectedCalendarId !== account.selectedCalendarId;

    if (calendarChanged) {
      await prisma.googleCalendarEvent.deleteMany({
        where: { userId: session.userId },
      });
    }

    const updated = await prisma.googleCalendarAccount.update({
      where: { userId: session.userId },
      data: {
        ...(selectedCalendarId !== undefined ? { selectedCalendarId } : {}),
        ...(selectedCalendarName !== undefined ? { selectedCalendarName } : {}),
        ...(syncFrequencyHours !== undefined ? { syncFrequencyHours } : {}),
        ...(calendarChanged ? { syncToken: null, lastSyncStatus: null, lastSyncError: null } : {}),
      },
      select: {
        id: true,
        googleEmail: true,
        selectedCalendarId: true,
        selectedCalendarName: true,
        syncFrequencyHours: true,
        lastSyncAt: true,
        lastSyncStatus: true,
        lastSyncError: true,
      },
    });

    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: 'Błąd aktualizacji ustawień konta Google' }, { status: 500 });
  }
}

/**
 * DELETE: Disconnects Google Calendar account and deletes all synchronized events.
 */
export async function DELETE() {
  const session = await getCurrentUser();
  if (!session) {
    return NextResponse.json({ error: 'Niezalogowany' }, { status: 401 });
  }

  try {
    await disconnectGoogleCalendar(session.userId);
    return NextResponse.json({ success: true, message: 'Odłączono konto Google Calendar' });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Błąd podczas odłączania konta: ${msg}` }, { status: 500 });
  }
}

