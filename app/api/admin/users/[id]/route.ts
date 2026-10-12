import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
import { Role } from '@prisma/client';
import { z } from 'zod';

interface RouteParams {
  params: { id: string };
}

const roleUpdateSchema = z.object({
  role: z.nativeEnum(Role),
});

export async function PATCH(req: Request, { params }: RouteParams) {
  const session = await getCurrentUser();
  if (!session) {
    return NextResponse.json({ error: 'Niezalogowany' }, { status: 401 });
  }

  if (session.role !== Role.ADMIN) {
    return NextResponse.json({ error: 'Brak uprawnień administratora' }, { status: 403 });
  }

  if (params.id === session.userId) {
    return NextResponse.json(
      { error: 'Nie możesz modyfikować własnej roli administratora' },
      { status: 400 }
    );
  }

  try {
    const body = await req.json();
    const parsed = roleUpdateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Niepoprawna rola użytkownika' }, { status: 400 });
    }

    const updated = await prisma.user.update({
      where: { id: params.id },
      data: { role: parsed.data.role },
      select: {
        id: true,
        username: true,
        role: true,
        createdAt: true,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Update user role error:', error);
    return NextResponse.json(
      { error: 'Błąd podczas aktualizacji roli użytkownika' },
      { status: 500 }
    );
  }
}

export async function DELETE(_req: Request, { params }: RouteParams) {
  const session = await getCurrentUser();
  if (!session) {
    return NextResponse.json({ error: 'Niezalogowany' }, { status: 401 });
  }

  if (session.role !== Role.ADMIN) {
    return NextResponse.json({ error: 'Brak uprawnień administratora' }, { status: 403 });
  }

  if (params.id === session.userId) {
    return NextResponse.json(
      { error: 'Nie możesz usunąć własnego konta z panelu administratora' },
      { status: 400 }
    );
  }

  await prisma.user.delete({
    where: { id: params.id },
  });

  return NextResponse.json({ success: true });
}
