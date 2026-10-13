import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
import { settingsSchema } from '@/lib/validation/schemas';

export async function GET() {
  const session = await getCurrentUser();
  if (!session) {
    return NextResponse.json({ error: 'Niezalogowany' }, { status: 401 });
  }

  let settings = await prisma.userSettings.findUnique({
    where: { userId: session.userId },
  });

  if (!settings) {
    settings = await prisma.userSettings.create({
      data: {
        userId: session.userId,
        importantStoryPointsThreshold: 6,
        urgentWithinDays: 3,
        taskHorizonDays: 7,
      },
    });
  }

  return NextResponse.json(settings);
}

export async function PATCH(req: Request) {
  const session = await getCurrentUser();
  if (!session) {
    return NextResponse.json({ error: 'Niezalogowany' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const parsed = settingsSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || 'Niepoprawne ustawienia' },
        { status: 400 }
      );
    }

    const {
      importantStoryPointsThreshold,
      urgentWithinDays,
      taskHorizonDays,
      calendarShowGoogleEvents,
      calendarShowStudyFlowTasks,
    } = parsed.data;

    const settings = await prisma.userSettings.upsert({
      where: { userId: session.userId },
      update: {
        importantStoryPointsThreshold,
        urgentWithinDays,
        taskHorizonDays,
        ...(calendarShowGoogleEvents !== undefined ? { calendarShowGoogleEvents } : {}),
        ...(calendarShowStudyFlowTasks !== undefined ? { calendarShowStudyFlowTasks } : {}),
      },
      create: {
        userId: session.userId,
        importantStoryPointsThreshold,
        urgentWithinDays,
        taskHorizonDays: taskHorizonDays ?? 7,
        calendarShowGoogleEvents: calendarShowGoogleEvents ?? true,
        calendarShowStudyFlowTasks: calendarShowStudyFlowTasks ?? true,
      },
    });

    return NextResponse.json(settings);
  } catch (error) {
    console.error('Update settings error:', error);
    return NextResponse.json(
      { error: 'Błąd podczas aktualizacji ustawień' },
      { status: 500 }
    );
  }
}

