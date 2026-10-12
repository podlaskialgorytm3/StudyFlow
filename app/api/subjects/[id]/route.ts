import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
import { subjectSchema } from '@/lib/validation/schemas';

interface RouteParams {
  params: { id: string };
}

export async function GET(_req: Request, { params }: RouteParams) {
  const session = await getCurrentUser();
  if (!session) {
    return NextResponse.json({ error: 'Niezalogowany' }, { status: 401 });
  }

  const subject = await prisma.subject.findUnique({
    where: { id: params.id },
    include: {
      categories: {
        orderBy: { name: 'asc' },
      },
      tasks: {
        include: {
          category: {
            select: { id: true, name: true },
          },
        },
        orderBy: [{ dueDate: 'asc' }, { storyPoints: 'desc' }],
      },
    },
  });

  if (!subject || subject.ownerId !== session.userId) {
    return NextResponse.json({ error: 'Przedmiot nie został znaleziony' }, { status: 404 });
  }

  return NextResponse.json(subject);
}

export async function PATCH(req: Request, { params }: RouteParams) {
  const session = await getCurrentUser();
  if (!session) {
    return NextResponse.json({ error: 'Niezalogowany' }, { status: 401 });
  }

  const existing = await prisma.subject.findUnique({
    where: { id: params.id },
  });

  if (!existing || existing.ownerId !== session.userId) {
    return NextResponse.json({ error: 'Przedmiot nie został znaleziony' }, { status: 404 });
  }

  try {
    const body = await req.json();
    const parsed = subjectSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || 'Niepoprawne dane przedmiotu' },
        { status: 400 }
      );
    }

    const { name, color, description } = parsed.data;

    const updated = await prisma.subject.update({
      where: { id: params.id },
      data: {
        name,
        color: color || existing.color,
        description: description !== undefined ? description : existing.description,
      },
      include: {
        categories: true,
        _count: {
          select: { tasks: true, categories: true },
        },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Update subject error:', error);
    return NextResponse.json(
      { error: 'Błąd podczas aktualizacji przedmiotu' },
      { status: 500 }
    );
  }
}

export async function DELETE(_req: Request, { params }: RouteParams) {
  const session = await getCurrentUser();
  if (!session) {
    return NextResponse.json({ error: 'Niezalogowany' }, { status: 401 });
  }

  const existing = await prisma.subject.findUnique({
    where: { id: params.id },
  });

  if (!existing || existing.ownerId !== session.userId) {
    return NextResponse.json({ error: 'Przedmiot nie został znaleziony' }, { status: 404 });
  }

  await prisma.subject.delete({
    where: { id: params.id },
  });

  return NextResponse.json({ success: true });
}
