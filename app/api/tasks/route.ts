import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
import { taskSchema } from '@/lib/validation/schemas';
import { TaskStatus } from '@prisma/client';

export async function GET(req: Request) {
  const session = await getCurrentUser();
  if (!session) {
    return NextResponse.json({ error: 'Niezalogowany' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const subjectId = searchParams.get('subjectId');
  const categoryId = searchParams.get('categoryId');
  const statusParam = searchParams.get('status');
  const includeDoneParam = searchParams.get('includeDone');

  const whereClause: Record<string, unknown> = {
    ownerId: session.userId,
  };

  if (subjectId) {
    whereClause.subjectId = subjectId;
  }

  if (categoryId) {
    whereClause.categoryId = categoryId;
  }

  if (statusParam && Object.values(TaskStatus).includes(statusParam as TaskStatus)) {
    whereClause.status = statusParam as TaskStatus;
  } else if (includeDoneParam !== 'true' && includeDoneParam !== '1') {
    // If not explicitly asking to include DONE, exclude DONE by default for matrix / active task views
    whereClause.status = { not: TaskStatus.DONE };
  }

  const tasks = await prisma.task.findMany({
    where: whereClause,
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
    },
    orderBy: [
      { dueDate: 'asc' },
      { storyPoints: 'desc' },
      { createdAt: 'desc' },
    ],
  });

  return NextResponse.json(tasks);
}

export async function POST(req: Request) {
  const session = await getCurrentUser();
  if (!session) {
    return NextResponse.json({ error: 'Niezalogowany' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const parsed = taskSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || 'Niepoprawne dane zadania' },
        { status: 400 }
      );
    }

    const {
      subjectId,
      categoryId,
      title,
      description,
      dueDate,
      storyPoints,
      status,
      priorityOverride,
      urgencyOverride,
    } = parsed.data;

    // 1. Check subject ownership
    const subject = await prisma.subject.findUnique({
      where: { id: subjectId },
    });

    if (!subject || subject.ownerId !== session.userId) {
      return NextResponse.json(
        { error: 'Wybrany przedmiot nie należy do Twojego konta' },
        { status: 403 }
      );
    }

    // 2. If categoryId provided, verify it belongs to user AND to the selected subject
    if (categoryId) {
      const category = await prisma.category.findUnique({
        where: { id: categoryId },
      });

      if (!category || category.ownerId !== session.userId || category.subjectId !== subjectId) {
        return NextResponse.json(
          { error: 'Wybrana kategoria nie należy do wskazanego przedmiotu' },
          { status: 400 }
        );
      }
    }

    const task = await prisma.task.create({
      data: {
        ownerId: session.userId,
        subjectId,
        categoryId: categoryId || null,
        title,
        description: description || null,
        dueDate: dueDate ? new Date(dueDate) : null,
        storyPoints,
        status,
        completedAt: status === TaskStatus.DONE ? new Date() : null,
        priorityOverride: priorityOverride || null,
        urgencyOverride: urgencyOverride || null,
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
      },
    });

    return NextResponse.json(task, { status: 201 });
  } catch (error) {
    console.error('Create task error:', error);
    return NextResponse.json(
      { error: 'Błąd podczas tworzenia zadania' },
      { status: 500 }
    );
  }
}
