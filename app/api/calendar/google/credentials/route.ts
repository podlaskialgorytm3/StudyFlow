import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
import { getGoogleOAuthCredentials, getGoogleRedirectUri } from '@/lib/google/calendarClient';
import { encryptToken } from '@/lib/crypto/encryption';
import { z } from 'zod';

const credentialsSchema = z.object({
  clientId: z.string().trim().min(5, 'Client ID jest wymagany (min. 5 znaków)'),
  clientSecret: z.string().trim().min(5, 'Client Secret jest wymagany (min. 5 znaków)'),
});

/**
 * GET /api/calendar/google/credentials
 * Returns information whether credentials exist (masked) and redirectUri.
 * Never sends the secret or full tokens back to client.
 */
export async function GET() {
  const session = await getCurrentUser();
  if (!session) {
    return NextResponse.json({ error: 'Niezalogowany' }, { status: 401 });
  }

  const credentials = await getGoogleOAuthCredentials(session.userId);
  const redirectUri = getGoogleRedirectUri();

  let clientIdMasked: string | null = null;
  if (credentials) {
    const cid = credentials.clientId;
    if (cid.length > 16) {
      clientIdMasked = `${cid.slice(0, 8)}...${cid.slice(-12)}`;
    } else {
      clientIdMasked = '••••••••';
    }
  }

  return NextResponse.json({
    configured: Boolean(credentials),
    hasCustomKeys: Boolean(credentials?.isCustom),
    clientIdMasked,
    redirectUri,
  });
}

/**
 * POST /api/calendar/google/credentials
 * Encrypts and stores user's Google Client ID and Client Secret in database (AES-256-GCM).
 */
export async function POST(req: Request) {
  const session = await getCurrentUser();
  if (!session) {
    return NextResponse.json({ error: 'Niezalogowany' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const parsed = credentialsSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || 'Niepoprawne dane' },
        { status: 400 }
      );
    }

    const { clientId, clientSecret } = parsed.data;

    const encryptedGoogleClientId = encryptToken(clientId);
    const encryptedGoogleClientSecret = encryptToken(clientSecret);

    await prisma.userSettings.upsert({
      where: { userId: session.userId },
      create: {
        userId: session.userId,
        encryptedGoogleClientId,
        encryptedGoogleClientSecret,
      },
      update: {
        encryptedGoogleClientId,
        encryptedGoogleClientSecret,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Klucze Google API zostały pomyślnie zaszyfrowane i zapisane w bazie danych',
    });
  } catch {
    return NextResponse.json({ error: 'Błąd podczas zapisywania poświadczeń' }, { status: 500 });
  }
}

/**
 * DELETE /api/calendar/google/credentials
 * Deletes user's custom encrypted Google credentials from database.
 */
export async function DELETE() {
  const session = await getCurrentUser();
  if (!session) {
    return NextResponse.json({ error: 'Niezalogowany' }, { status: 401 });
  }

  try {
    await prisma.userSettings.updateMany({
      where: { userId: session.userId },
      data: {
        encryptedGoogleClientId: null,
        encryptedGoogleClientSecret: null,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Własne poświadczenia Google API zostały usunięte z bazy danych',
    });
  } catch {
    return NextResponse.json({ error: 'Błąd podczas usuwania poświadczeń' }, { status: 500 });
  }
}
