import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { exchangeCodeAndSaveAccount } from '@/lib/google/calendarClient';
import { syncUserGoogleCalendar } from '@/lib/google/syncService';
import { cookies } from 'next/headers';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  if (error) {
    return NextResponse.redirect(`${appBaseUrl}/settings?google_error=${encodeURIComponent(error)}`);
  }

  if (!code || !state) {
    return NextResponse.redirect(`${appBaseUrl}/settings?google_error=missing_params`);
  }

  // 1. Verify CSRF State
  let statePayload: { userId: string; returnTo?: string; rand: string };
  try {
    const decoded = Buffer.from(state, 'base64url').toString('utf8');
    statePayload = JSON.parse(decoded);
  } catch {
    return NextResponse.redirect(`${appBaseUrl}/settings?google_error=invalid_state`);
  }

  const cookieStore = cookies();
  const storedRand = cookieStore.get('google_oauth_state')?.value;
  cookieStore.delete('google_oauth_state');

  if (!storedRand || storedRand !== statePayload.rand) {
    return NextResponse.redirect(`${appBaseUrl}/settings?google_error=csrf_detected`);
  }

  // 2. Verify Session matches state userId
  const session = await getCurrentUser();
  if (!session || session.userId !== statePayload.userId) {
    return NextResponse.redirect(`${appBaseUrl}/login?redirect=${encodeURIComponent('/settings')}`);
  }

  // 3. Exchange code for tokens and store account
  try {
    await exchangeCodeAndSaveAccount(session.userId, code);

    // Initial sync trigger asynchronously
    syncUserGoogleCalendar(session.userId).catch(() => {});

    const returnUrl = statePayload.returnTo?.startsWith('/')
      ? `${appBaseUrl}${statePayload.returnTo}?google_connected=true`
      : `${appBaseUrl}/settings?google_connected=true`;

    return NextResponse.redirect(returnUrl);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('Google OAuth callback error:', errorMsg);
    return NextResponse.redirect(`${appBaseUrl}/settings?google_error=exchange_failed`);
  }
}

