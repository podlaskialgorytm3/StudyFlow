import { NextResponse } from 'next/server';
import { runWeeklyReportCronForAllUsers } from '@/lib/reports/reportService';

/**
 * GET / POST /api/reports/cron
 * Called by external scheduler (e.g. Linux cron, Vercel cron, GitHub Actions)
 * Scheduled to run every Sunday at 22:00.
 * Protected by CRON_SECRET or REPORTS_CRON_SECRET authorization header.
 */
export async function GET(req: Request) {
  return handleReportsCron(req);
}

export async function POST(req: Request) {
  return handleReportsCron(req);
}

async function handleReportsCron(req: Request) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.REPORTS_CRON_SECRET || process.env.CRON_SECRET;

  if (cronSecret) {
    const expectedAuth = `Bearer ${cronSecret}`;
    const url = new URL(req.url);
    const querySecret = url.searchParams.get('secret');

    if (authHeader !== expectedAuth && querySecret !== cronSecret) {
      return NextResponse.json({ error: 'UNAUTHORIZED_CRON' }, { status: 401 });
    }
  }

  try {
    const result = await runWeeklyReportCronForAllUsers(new Date());
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      ...result,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Błąd podczas wykonywania harmonogramu raportów' },
      { status: 500 }
    );
  }
}

