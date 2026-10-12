import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { registerSchema } from '@/lib/validation/schemas';
import { createSessionToken, setSessionCookie } from '@/lib/auth/session';
import { Role } from '@prisma/client';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || 'Nieprawidłowe dane rejestracji' },
        { status: 400 }
      );
    }

    const { username, password } = parsed.data;

    // Check if username already exists (case-insensitive)
    const existing = await prisma.user.findFirst({
      where: {
        username: {
          equals: username,
          mode: 'insensitive',
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Użytkownik o takim loginie już istnieje' },
        { status: 409 }
      );
    }

    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    const newUser = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          username,
          passwordHash,
          role: Role.STUDENT,
          settings: {
            create: {
              importantStoryPointsThreshold: 6,
              urgentWithinDays: 3,
            },
          },
        },
        select: {
          id: true,
          username: true,
          role: true,
        },
      });
      return user;
    });

    const token = await createSessionToken({
      userId: newUser.id,
      username: newUser.username,
      role: newUser.role,
    });

    await setSessionCookie(token);

    return NextResponse.json(newUser, { status: 201 });
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: 'Wystąpił błąd podczas rejestracji' },
      { status: 500 }
    );
  }
}
