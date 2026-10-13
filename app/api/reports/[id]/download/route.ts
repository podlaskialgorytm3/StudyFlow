import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';

interface RouteParams {
  params: { id: string };
}

/**
 * GET /api/reports/[id]/download
 * Securely streams the generated PDF report to its owner.
 */
export async function GET(_req: Request, { params }: RouteParams) {
  const session = await getCurrentUser();
  if (!session) {
    return NextResponse.json({ error: 'Niezalogowany' }, { status: 401 });
  }

  try {
    const report = await prisma.weeklyReport.findUnique({
      where: { id: params.id },
    });

    if (!report || report.userId !== session.userId) {
      return NextResponse.json({ error: 'Raport nie został znaleziony' }, { status: 404 });
    }

    if (report.status !== 'READY' || !report.pdfData) {
      return NextResponse.json(
        { error: 'Raport nie jest jeszcze gotowy do pobrania' },
        { status: 400 }
      );
    }

    const startDateStr = new Date(report.weekStart).toISOString().slice(0, 10);
    const endDateStr = new Date(report.weekEnd).toISOString().slice(0, 10);
    const filename = `StudyFlow_Raport_${startDateStr}_do_${endDateStr}.pdf`;

    return new Response(new Uint8Array(report.pdfData), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': report.pdfData.length.toString(),
        'Cache-Control': 'private, no-cache, no-store, must-revalidate',
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Błąd podczas pobierania pliku PDF' },
      { status: 500 }
    );
  }
}

