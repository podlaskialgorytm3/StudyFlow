import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const COOKIE_NAME = 'studyflow_session';
const SECRET_KEY = new TextEncoder().encode(
  process.env.SESSION_SECRET || 'studyflow_default_fallback_secret_must_be_32_characters_long'
);

const PROTECTED_PREFIXES = ['/dashboard', '/tasks', '/subjects', '/settings', '/admin'];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isProtected = PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  const isAuthPage = pathname === '/login' || pathname === '/register';

  const token = req.cookies.get(COOKIE_NAME)?.value;

  let session: { userId: string; username: string; role: string } | null = null;
  if (token) {
    try {
      const { payload } = await jwtVerify(token, SECRET_KEY);
      session = payload as unknown as { userId: string; username: string; role: string };
    } catch {
      session = null;
    }
  }

  // If visiting protected page without valid session, redirect to login
  if (isProtected && !session) {
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // If visiting admin panel and user is not ADMIN, redirect to dashboard
  if (pathname.startsWith('/admin') && session?.role !== 'ADMIN') {
    return NextResponse.redirect(new URL('/dashboard', req.url));
  }

  // If visiting login or register while already authenticated, redirect to dashboard
  if (isAuthPage && session) {
    return NextResponse.redirect(new URL('/dashboard', req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/tasks/:path*',
    '/subjects/:path*',
    '/settings/:path*',
    '/admin/:path*',
    '/login',
    '/register',
  ],
};
