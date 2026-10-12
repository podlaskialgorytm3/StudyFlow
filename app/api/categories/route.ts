import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
import { categorySchema } from '@/lib/validation/schemas';

export async function GET(req: Request) {
  const session = await getCurrentUser();
  if (!session) {
    return NextResponse.json({ error: 'Niezalogowany' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const subjectId = searchParams.get('subjectId');

  const whereClause: { ownerId: string; subjectId?: string } = {
    ownerId: session.userId,
  };

  if (subjectId) {
    whereClause.subjectId = subjectId;
  }

  const categories = await prisma.category.findMany({
    where: whereClause,
    orderBy: { name: 'asc' },
  });

  return NextResponse.json(categories);
}

export async function POST(req: Request) {
  const session = await getCurrentUser();
  if (!session) {
    return NextResponse.json({ error: 'Niezalogowany' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const parsed = categorySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || 'Niepoprawne dane kategorii' },
        { status: 400 }
      );
    }

    const { subjectId, name, description } = parsed.data;

    // Verify subject ownership
    const subject = await prisma.subject.findUnique({
      where: { id: subjectId },
    });

    if (!subject || subject.ownerId !== session.userId) {
      return NextResponse.json(
        { error: 'Wybrany przedmiot nie należy do Ciebie' },
        { status: 403 }
      );
    }

    const category = await prisma.category.create({
      data: {
        ownerId: session.userId,
        subjectId,
        name,
        description: description || null,
      },
    });

    return NextResponse.json(category, { status: 201 });
  } catch (error) {
    console.error('Create category error:', error);
    return NextResponse.json(
      { error: 'Błąd podczas tworzenia kategorii' },
      { status: 500 }
    );
  }
}

