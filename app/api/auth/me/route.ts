import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const session = await getCurrentUser();
  if (!session) {
    return NextResponse.json({ error: 'Niezalogowany' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      username: true,
      role: true,
      createdAt: true,
      settings: {
        select: {
          importantStoryPointsThreshold: true,
          urgentWithinDays: true,
        },
      },
    },
  });

  if (!user) {
    return NextResponse.json({ error: 'Użytkownik nie istnieje' }, { status: 401 });
  }

  return NextResponse.json(user);
}

