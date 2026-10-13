import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { syncUserGoogleCalendar } from '@/lib/google/syncService';

/**
 * POST /api/calendar/google/sync
 * Manually triggers immediate synchronization for the logged-in user.
 */
export async function POST(req: Request) {
  const session = await getCurrentUser();
  if (!session) {
    return NextResponse.json({ error: 'Niezalogowany' }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const forceFullSync = Boolean(body.forceFullSync);

    const result = await syncUserGoogleCalendar(session.userId, { forceFullSync });

    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Błąd synchronizacji' }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      imported: result.imported,
      updated: result.updated,
      deleted: result.deleted,
      message: `Zsynchronizowano: dodano ${result.imported}, zaktualizowano ${result.updated}, usunięto ${result.deleted}`,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Błąd serwera podczas synchronizacji: ${msg}` }, { status: 500 });
  }
}
