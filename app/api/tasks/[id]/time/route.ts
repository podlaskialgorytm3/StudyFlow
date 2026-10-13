import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
import { taskTimeEntrySchema } from '@/lib/validation/schemas';

interface RouteParams {
  params: { id: string };
}

export async function GET(_req: Request, { params }: RouteParams) {
  const session = await getCurrentUser();
  if (!session) {
    return NextResponse.json({ error: 'Niezalogowany' }, { status: 401 });
  }

  const task = await prisma.task.findUnique({
    where: { id: params.id },
    include: {
      timeEntries: {
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!task || task.ownerId !== session.userId) {
    return NextResponse.json({ error: 'Zadanie nie zostało znalezione' }, { status: 404 });
  }

  return NextResponse.json({
    timeSpentSeconds: task.timeSpentSeconds,
    timeEntries: task.timeEntries,
  });
}

export async function POST(req: Request, { params }: RouteParams) {
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

  try {
    const body = await req.json();
    const parsed = taskTimeEntrySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || 'Niepoprawne dane wpisu czasu' },
        { status: 400 }
      );
    }

    const { durationSeconds, note, progressPercent } = parsed.data;

    const taskUpdates: Record<string, unknown> = {
      timeSpentSeconds: {
        increment: durationSeconds,
      },
    };

    if (progressPercent !== undefined && progressPercent !== null) {
      taskUpdates.progressPercent = progressPercent;
      if (progressPercent === 100 && task.status !== TaskStatus.DONE) {
        taskUpdates.status = TaskStatus.DONE;
        taskUpdates.completedAt = new Date();
      } else if (progressPercent < 100 && task.status === TaskStatus.DONE) {
        taskUpdates.status = TaskStatus.IN_PROGRESS;
        taskUpdates.completedAt = null;
      }
    }

    // Run creation and total time update in transaction
    const [entry, updatedTask] = await prisma.$transaction([
      prisma.taskTimeEntry.create({
        data: {
          taskId: params.id,
          durationSeconds,
          note: note || null,
        },
      }),
      prisma.task.update({
        where: { id: params.id },
        data: taskUpdates,
        select: {
          id: true,
          timeSpentSeconds: true,
          progressPercent: true,
          status: true,
        },
      }),
    ]);

    return NextResponse.json(
      {
        entry,
        timeSpentSeconds: updatedTask.timeSpentSeconds,
        progressPercent: updatedTask.progressPercent,
        status: updatedTask.status,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Add time entry error:', error);
    return NextResponse.json(
      { error: 'Błąd podczas zapisywania pomiaru czasu' },
      { status: 500 }
    );
  }
}

