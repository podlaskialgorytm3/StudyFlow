import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { Role } from '@prisma/client';
import { prisma } from '@/lib/prisma';

const COOKIE_NAME = 'studyflow_session';
const SECRET_KEY = new TextEncoder().encode(
  process.env.SESSION_SECRET || 'studyflow_default_fallback_secret_must_be_32_characters_long'
);

export interface SessionPayload {
  userId: string;
  username: string;
  role: Role;
  exp?: number;
}

/**
 * Creates and signs a JWT session token valid for 7 days.
 */
export async function createSessionToken(payload: {
  userId: string;
  username: string;
  role: Role;
}): Promise<string> {
  return new SignJWT({
    userId: payload.userId,
    username: payload.username,
    role: payload.role,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(SECRET_KEY);
}

/**
 * Verifies and decodes the JWT session token.
 */
export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET_KEY);
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

/**
 * Sets the HttpOnly session cookie on the current response.
 */
export async function setSessionCookie(token: string): Promise<void> {
  const cookieStore = cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60, // 7 days
  });
}

/**
 * Clears the session cookie on logout.
 */
export async function clearSessionCookie(): Promise<void> {
  const cookieStore = cookies();
  cookieStore.delete(COOKIE_NAME);
}

/**
 * Retrieves the current session user from request cookies.
 */
export async function getCurrentUser(): Promise<SessionPayload | null> {
  const cookieStore = cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  return verifySessionToken(token);
}

/**
 * Asserts the user is authenticated. Throws or returns payload.
 */
export async function requireAuth(): Promise<SessionPayload> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error('UNAUTHORIZED');
  }
  return user;
}

/**
 * Asserts the user is authenticated and has ADMIN role.
 */
export async function requireAdmin(): Promise<SessionPayload> {
  const user = await requireAuth();
  if (user.role !== Role.ADMIN) {
    throw new Error('FORBIDDEN');
  }
  return user;
}

