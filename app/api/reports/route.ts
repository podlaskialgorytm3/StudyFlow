import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
import { createOrGetWeeklyReport, getWeekRange } from '@/lib/reports/reportService';
import { z } from 'zod';

const createReportSchema = z.object({
  date: z.string().optional(), // Reference date inside the desired week
  forceRegenerate: z.boolean().optional(),
});

/**
 * GET /api/reports
 * Lists all weekly reports for the logged in user (metadata only, excluding binary pdfData).
 */
export async function GET() {
  const session = await getCurrentUser();
  if (!session) {
    return NextResponse.json({ error: 'Niezalogowany' }, { status: 401 });
  }

  try {
    const reports = await prisma.weeklyReport.findMany({
      where: { userId: session.userId },
      select: {
        id: true,
        weekStart: true,
        weekEnd: true,
        generatedAt: true,
        status: true,
        summaryJson: true,
        error: true,
        createdAt: true,
      },
      orderBy: { weekStart: 'desc' },
    });

    const parsedReports = reports.map((r) => {
      let summary = null;
      if (r.summaryJson) {
        try {
          summary = JSON.parse(r.summaryJson);
        } catch {
          // Ignore parse errors
        }
      }
      return {
        id: r.id,
        weekStart: r.weekStart,
        weekEnd: r.weekEnd,
        generatedAt: r.generatedAt,
        status: r.status,
        summary,
        error: r.error,
      };
    });

    return NextResponse.json({ reports: parsedReports });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Błąd podczas pobierania listy raportów' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/reports
 * Generates or regenerates a weekly report for the logged in user.
 */
export async function POST(req: Request) {
  const session = await getCurrentUser();
  if (!session) {
    return NextResponse.json({ error: 'Niezalogowany' }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const parsed = createReportSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || 'Niepoprawne dane' },
        { status: 400 }
      );
    }

    const refDate = parsed.data.date ? new Date(parsed.data.date) : new Date();
    if (isNaN(refDate.getTime())) {
      return NextResponse.json({ error: 'Niepoprawny format daty' }, { status: 400 });
    }

    const { weekStart, weekEnd } = getWeekRange(refDate);
    const forceRegenerate = Boolean(parsed.data.forceRegenerate);

    const report = await createOrGetWeeklyReport(
      session.userId,
      weekStart,
      weekEnd,
      forceRegenerate
    );

    let summary = null;
    if (report.summaryJson) {
      try {
        summary = JSON.parse(report.summaryJson);
      } catch {
        // Ignore
      }
    }

    return NextResponse.json({
      success: true,
      report: {
        id: report.id,
        weekStart: report.weekStart,
        weekEnd: report.weekEnd,
        generatedAt: report.generatedAt,
        status: report.status,
        summary,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Wystąpił błąd podczas generowania raportu' },
      { status: 500 }
    );
  }
}

