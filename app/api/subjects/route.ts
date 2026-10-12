import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
import { subjectSchema } from '@/lib/validation/schemas';

export async function GET() {
  const session = await getCurrentUser();
  if (!session) {
    return NextResponse.json({ error: 'Niezalogowany' }, { status: 401 });
  }

  const subjects = await prisma.subject.findMany({
    where: { ownerId: session.userId },
    include: {
      categories: {
        select: { id: true, name: true, description: true },
        orderBy: { name: 'asc' },
      },
      _count: {
        select: {
          tasks: true,
          categories: true,
        },
      },
    },
    orderBy: { name: 'asc' },
  });

  return NextResponse.json(subjects);
}

export async function POST(req: Request) {
  const session = await getCurrentUser();
  if (!session) {
    return NextResponse.json({ error: 'Niezalogowany' }, { status: 401 });
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

    const subject = await prisma.subject.create({
      data: {
        ownerId: session.userId,
        name,
        color: color || '#1976d2',
        description: description || null,
      },
      include: {
        categories: true,
        _count: {
          select: { tasks: true, categories: true },
        },
      },
    });

    return NextResponse.json(subject, { status: 201 });
  } catch (error) {
    console.error('Create subject error:', error);
    return NextResponse.json(
      { error: 'Błąd podczas tworzenia przedmiotu' },
      { status: 500 }
    );
  }
}
