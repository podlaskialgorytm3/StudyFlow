import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
import { taskUpdateSchema } from '@/lib/validation/schemas';
import { TaskStatus } from '@prisma/client';

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
      subject: true,
      category: true,
      timeEntries: {
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!task || task.ownerId !== session.userId) {
    return NextResponse.json({ error: 'Zadanie nie zostało znalezione' }, { status: 404 });
  }

  return NextResponse.json(task);
}

export async function PATCH(req: Request, { params }: RouteParams) {
  const session = await getCurrentUser();
  if (!session) {
    return NextResponse.json({ error: 'Niezalogowany' }, { status: 401 });
  }

  const existing = await prisma.task.findUnique({
    where: { id: params.id },
  });

  if (!existing || existing.ownerId !== session.userId) {
    return NextResponse.json({ error: 'Zadanie nie zostało znalezione' }, { status: 404 });
  }

  try {
    const body = await req.json();
    const parsed = taskUpdateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || 'Niepoprawne dane aktualizacji zadania' },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const targetSubjectId = data.subjectId || existing.subjectId;

    // Check subject ownership if changing subject
    if (data.subjectId && data.subjectId !== existing.subjectId) {
      const subject = await prisma.subject.findUnique({
        where: { id: data.subjectId },
      });
      if (!subject || subject.ownerId !== session.userId) {
        return NextResponse.json(
          { error: 'Przedmiot nie należy do Twojego konta' },
          { status: 403 }
        );
      }
    }

    // Check category ownership & match to subject if category is being modified
    if (data.categoryId !== undefined) {
      if (data.categoryId !== null) {
        const category = await prisma.category.findUnique({
          where: { id: data.categoryId },
        });
        if (!category || category.ownerId !== session.userId || category.subjectId !== targetSubjectId) {
          return NextResponse.json(
            { error: 'Kategoria nie pasuje do wskazanego przedmiotu' },
            { status: 400 }
          );
        }
      }
    }

    // Determine completion timestamp
    let completedAt = existing.completedAt;
    if (data.status !== undefined) {
      if (data.status === TaskStatus.DONE && existing.status !== TaskStatus.DONE) {
        completedAt = new Date();
      } else if (data.status !== TaskStatus.DONE && existing.status === TaskStatus.DONE) {
        completedAt = null;
      }
    }

    const updated = await prisma.task.update({
      where: { id: params.id },
      data: {
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.subjectId !== undefined ? { subjectId: data.subjectId } : {}),
        ...(data.categoryId !== undefined ? { categoryId: data.categoryId } : {}),
        ...(data.dueDate !== undefined ? { dueDate: data.dueDate ? new Date(data.dueDate) : null } : {}),
        ...(data.storyPoints !== undefined ? { storyPoints: data.storyPoints } : {}),
        ...(data.status !== undefined ? { status: data.status, completedAt } : {}),
        ...(data.priorityOverride !== undefined ? { priorityOverride: data.priorityOverride } : {}),
        ...(data.urgencyOverride !== undefined ? { urgencyOverride: data.urgencyOverride } : {}),
        ...(data.timeSpentSeconds !== undefined ? { timeSpentSeconds: data.timeSpentSeconds } : {}),
      },
      include: {
        subject: {
          select: {
            id: true,
            name: true,
            color: true,
          },
        },
        category: {
          select: {
            id: true,
            name: true,
          },
        },
        timeEntries: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Update task error:', error);
    return NextResponse.json(
      { error: 'Błąd podczas aktualizacji zadania' },
      { status: 500 }
    );
  }
}

export async function DELETE(_req: Request, { params }: RouteParams) {
  const session = await getCurrentUser();
  if (!session) {
    return NextResponse.json({ error: 'Niezalogowany' }, { status: 401 });
  }

  const existing = await prisma.task.findUnique({
    where: { id: params.id },
  });

  if (!existing || existing.ownerId !== session.userId) {
    return NextResponse.json({ error: 'Zadanie nie zostało znalezione' }, { status: 404 });
  }

  await prisma.task.delete({
    where: { id: params.id },
  });

  return NextResponse.json({ success: true });
}

