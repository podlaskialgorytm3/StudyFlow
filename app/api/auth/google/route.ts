import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { generateAuthUrl } from '@/lib/google/calendarClient';
import { cookies } from 'next/headers';
import crypto from 'crypto';

export async function GET(req: Request) {
  const session = await getCurrentUser();
  if (!session) {
    return NextResponse.json({ error: 'Niezalogowany' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const returnTo = searchParams.get('returnTo') || '/settings';

    // Generate CSRF state token containing userId, returnTo and random bytes
    const stateRandom = crypto.randomBytes(16).toString('hex');
    const statePayload = JSON.stringify({
      userId: session.userId,
      returnTo,
      rand: stateRandom,
    });
    const state = Buffer.from(statePayload).toString('base64url');

    // Store state in HttpOnly cookie to verify upon callback
    const cookieStore = cookies();
    cookieStore.set('google_oauth_state', stateRandom, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 10 * 60, // 10 minutes
    });

    const authUrl = await generateAuthUrl(state, session.userId);
    return NextResponse.redirect(authUrl);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === 'GOOGLE_OAUTH_NOT_CONFIGURED') {
      return NextResponse.redirect(new URL('/settings?google_error=not_configured', req.url));
    }
    return NextResponse.redirect(new URL('/settings?google_error=unknown', req.url));
  }
}

