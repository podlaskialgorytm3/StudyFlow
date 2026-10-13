import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';

interface RouteParams {
  params: { id: string; entryId: string };
}

export async function DELETE(_req: Request, { params }: RouteParams) {
  const session = await getCurrentUser();
  if (!session) {
    return NextResponse.json({ error: 'Niezalogowany' }, { status: 401 });
  }

  const task = await prisma.task.findUnique({
    where: { id: params.id },
  });

  if (!task || task.ownerId !== session.userId) {
    return NextResponse.json({ error: 'Zadanie nie zostało znalezione' }, { status: 404 });
  }

  const entry = await prisma.taskTimeEntry.findUnique({
    where: { id: params.entryId },
  });

  if (!entry || entry.taskId !== params.id) {
    return NextResponse.json({ error: 'Wpis czasu nie został znaleziony' }, { status: 404 });
  }

  const newTotal = Math.max(0, task.timeSpentSeconds - entry.durationSeconds);

  await prisma.$transaction([
    prisma.taskTimeEntry.delete({
      where: { id: params.entryId },
    }),
    prisma.task.update({
      where: { id: params.id },
      data: {
        timeSpentSeconds: newTotal,
      },
    }),
  ]);

  return NextResponse.json({ success: true, timeSpentSeconds: newTotal });
}

