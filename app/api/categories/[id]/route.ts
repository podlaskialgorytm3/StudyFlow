import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
import { updateCategorySchema } from '@/lib/validation/schemas';

interface RouteParams {
  params: { id: string };
}

export async function PATCH(req: Request, { params }: RouteParams) {
  const session = await getCurrentUser();
  if (!session) {
    return NextResponse.json({ error: 'Niezalogowany' }, { status: 401 });
  }

  const existing = await prisma.category.findUnique({
    where: { id: params.id },
  });

  if (!existing || existing.ownerId !== session.userId) {
    return NextResponse.json({ error: 'Kategoria nie została znaleziona' }, { status: 404 });
  }

  try {
    const body = await req.json();
    const parsed = updateCategorySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || 'Niepoprawne dane kategorii' },
        { status: 400 }
      );
    }

    const { name, description } = parsed.data;

    const updated = await prisma.category.update({
      where: { id: params.id },
      data: {
        name,
        description: description !== undefined ? description : existing.description,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Update category error:', error);
    return NextResponse.json(
      { error: 'Błąd podczas aktualizacji kategorii' },
      { status: 500 }
    );
  }
}

export async function DELETE(_req: Request, { params }: RouteParams) {
  const session = await getCurrentUser();
  if (!session) {
    return NextResponse.json({ error: 'Niezalogowany' }, { status: 401 });
  }

  const existing = await prisma.category.findUnique({
    where: { id: params.id },
  });

  if (!existing || existing.ownerId !== session.userId) {
    return NextResponse.json({ error: 'Kategoria nie została znaleziona' }, { status: 404 });
  }

  // Schema has onDelete: SetNull on Task.category, but let's be explicit and guaranteed
  await prisma.$transaction(async (tx) => {
    await tx.task.updateMany({
      where: { categoryId: params.id },
      data: { categoryId: null },
    });
    await tx.category.delete({
      where: { id: params.id },
    });
  });

  return NextResponse.json({ success: true });
}

