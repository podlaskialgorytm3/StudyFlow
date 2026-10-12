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

    const { importantStoryPointsThreshold, urgentWithinDays } = parsed.data;

    const settings = await prisma.userSettings.upsert({
      where: { userId: session.userId },
      update: {
        importantStoryPointsThreshold,
        urgentWithinDays,
      },
      create: {
        userId: session.userId,
        importantStoryPointsThreshold,
        urgentWithinDays,
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

