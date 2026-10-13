import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { syncUserGoogleCalendar } from '@/lib/google/syncService';

/**
 * GET / POST /api/calendar/sync/cron
 * Called by external cron job (e.g. Vercel Cron, GitHub Actions, Linux cron).
 * Protected by CRON_SECRET authorization header.
 */
export async function GET(req: Request) {
  return handleCron(req);
}

export async function POST(req: Request) {
  return handleCron(req);
}

async function handleCron(req: Request) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret) {
    const expectedAuth = `Bearer ${cronSecret}`;
    if (!authHeader || authHeader !== expectedAuth) {
      return NextResponse.json({ error: 'UNAUTHORIZED_CRON' }, { status: 401 });
    }
  }

  // Find all accounts that are due for sync
  const now = new Date();
  const accountsToSync = await prisma.googleCalendarAccount.findMany({
    where: {
      OR: [
        { nextSyncAt: { lte: now } },
        { nextSyncAt: null },
      ],
    },
    take: 25, // batch size to prevent server timeout
  });

  const results: Array<{ userId: string; success: boolean; error?: string }> = [];

  for (const acc of accountsToSync) {
    try {
      const res = await syncUserGoogleCalendar(acc.userId);
      results.push({ userId: acc.userId, success: res.success, error: res.error });
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      results.push({ userId: acc.userId, success: false, error: errorMsg });
    }
  }

  return NextResponse.json({
    timestamp: now.toISOString(),
    processedCount: accountsToSync.length,
    results,
  });
}
