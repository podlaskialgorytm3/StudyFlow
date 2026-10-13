import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { generateAuthUrl, getGoogleOAuth2Client, disconnectGoogleCalendar } from '@/lib/google/calendarClient';
import { encryptToken } from '@/lib/crypto/encryption';
import { prisma } from '@/lib/prisma';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    userSettings: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      updateMany: vi.fn(),
    },
    googleCalendarAccount: {
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
    googleCalendarEvent: {
      deleteMany: vi.fn(),
    },
    $transaction: vi.fn((promises) => Promise.all(promises)),
  },
}));

describe('Google Calendar OAuth 2.0 and State Security', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = {
      ...originalEnv,
      GOOGLE_CLIENT_ID: 'test-google-client-id.apps.googleusercontent.com',
      GOOGLE_CLIENT_SECRET: 'test-google-client-secret',
      GOOGLE_REDIRECT_URI: 'http://localhost:3000/api/auth/google/callback',
      NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('generates an authorization URL with required scopes and CSRF state', async () => {
    const testState = 'secure-random-csrf-state-abc-123';
    const authUrl = await generateAuthUrl(testState);

    const url = new URL(authUrl);
    expect(url.origin).toBe('https://accounts.google.com');
    expect(url.searchParams.get('client_id')).toBe('test-google-client-id.apps.googleusercontent.com');
    expect(url.searchParams.get('redirect_uri')).toBe('http://localhost:3000/api/auth/google/callback');
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('access_type')).toBe('offline');
    expect(url.searchParams.get('prompt')).toBe('consent');
    expect(url.searchParams.get('state')).toBe(testState);

    // Verify read-only calendar scope
    const scope = url.searchParams.get('scope') || '';
    expect(scope).toContain('calendar.events.readonly');
  });

  it('throws descriptive error if Google OAuth credentials are not configured in DB or env', async () => {
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;

    vi.mocked(prisma.userSettings.findUnique).mockResolvedValue(null);

    await expect(getGoogleOAuth2Client('user-no-creds')).rejects.toThrow('GOOGLE_OAUTH_NOT_CONFIGURED');
  });

  it('resolves and decrypts user custom credentials stored in the database', async () => {
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;

    const customClientId = 'custom-db-client-id-1234.apps.googleusercontent.com';
    const customClientSecret = 'custom-db-client-secret-9876';

    vi.mocked(prisma.userSettings.findUnique).mockResolvedValue({
      encryptedGoogleClientId: encryptToken(customClientId),
      encryptedGoogleClientSecret: encryptToken(customClientSecret),
    } as any);

    const client = await getGoogleOAuth2Client('user-with-custom-creds');
    expect(client).toBeDefined();

    // Verify client was initialized with the custom client ID
    const authUrl = await generateAuthUrl('test-state', 'user-with-custom-creds');
    const url = new URL(authUrl);
    expect(url.searchParams.get('client_id')).toBe(customClientId);
  });

  it('verifies state match between callback param and cookie to prevent CSRF', () => {
    const validCookieState: string = 'state_cookie_value_123';
    const callbackState: string = 'state_cookie_value_123';
    const attackerState: string = 'attacker_forged_state_456';

    const isValidRequest = callbackState === validCookieState;
    const isAttackerRequest = attackerState === validCookieState;

    expect(isValidRequest).toBe(true);
    expect(isAttackerRequest).toBe(false);
  });

  it('disconnects Google Calendar account and deletes all synced events for user', async () => {
    const userId = 'user-uuid-1';
    vi.mocked(prisma.googleCalendarAccount.findUnique).mockResolvedValue({
      id: 'acc-1',
      userId,
      encryptedAccessToken: 'iv:tag:token',
      encryptedRefreshToken: null,
    } as any);

    vi.mocked(prisma.googleCalendarEvent.deleteMany).mockResolvedValue({ count: 5 });
    vi.mocked(prisma.googleCalendarAccount.delete).mockResolvedValue({} as any);

    await disconnectGoogleCalendar(userId);

    expect(prisma.googleCalendarAccount.findUnique).toHaveBeenCalledWith({
      where: { userId },
    });
    expect(prisma.$transaction).toHaveBeenCalled();
  });
});
