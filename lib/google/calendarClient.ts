import { google } from 'googleapis';
import { prisma } from '@/lib/prisma';
import { encryptToken, decryptToken } from '@/lib/crypto/encryption';

const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/calendar.events.readonly',
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
];

export interface GoogleOAuthCredentials {
  clientId: string;
  clientSecret: string;
  isCustom: boolean;
}

/**
 * Returns OAuth redirect URI for Google Calendar callback.
 */
export function getGoogleRedirectUri(): string {
  return (
    process.env.GOOGLE_REDIRECT_URI ||
    `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/auth/google/callback`
  );
}

/**
 * Resolves Google OAuth credentials for a user:
 * 1. Checks user's custom encrypted credentials in UserSettings (PostgreSQL)
 * 2. Falls back to process.env.GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET
 */
export async function getGoogleOAuthCredentials(userId?: string): Promise<GoogleOAuthCredentials | null> {
  if (userId) {
    const settings = await prisma.userSettings.findUnique({
      where: { userId },
      select: { encryptedGoogleClientId: true, encryptedGoogleClientSecret: true },
    });

    if (settings?.encryptedGoogleClientId && settings?.encryptedGoogleClientSecret) {
      try {
        const clientId = decryptToken(settings.encryptedGoogleClientId);
        const clientSecret = decryptToken(settings.encryptedGoogleClientSecret);
        if (clientId && clientSecret) {
          return { clientId, clientSecret, isCustom: true };
        }
      } catch {
        // If decryption fails, continue to check env
      }
    }
  }

  const envClientId = process.env.GOOGLE_CLIENT_ID;
  const envClientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (envClientId && envClientSecret) {
    return { clientId: envClientId, clientSecret: envClientSecret, isCustom: false };
  }

  return null;
}

/**
 * Returns configured OAuth2Client using database credentials or environment variables.
 */
export async function getGoogleOAuth2Client(userId?: string) {
  const credentials = await getGoogleOAuthCredentials(userId);

  if (!credentials) {
    throw new Error('GOOGLE_OAUTH_NOT_CONFIGURED');
  }

  const redirectUri = getGoogleRedirectUri();
  return new google.auth.OAuth2(credentials.clientId, credentials.clientSecret, redirectUri);
}

/**
 * Generates the Google OAuth authorization URL with PKCE / CSRF state.
 */
export async function generateAuthUrl(state: string, userId?: string): Promise<string> {
  const oauth2Client = await getGoogleOAuth2Client(userId);
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent', // force refresh_token generation
    scope: GOOGLE_SCOPES,
    state,
  });
}

/**
 * Exchanges authorization code for tokens, saves encrypted tokens into GoogleCalendarAccount.
 */
export async function exchangeCodeAndSaveAccount(userId: string, code: string) {
  const oauth2Client = await getGoogleOAuth2Client(userId);
  const { tokens } = await oauth2Client.getToken(code);

  oauth2Client.setCredentials(tokens);

  // Fetch Google user email
  let googleEmail: string | undefined = undefined;
  try {
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const userInfo = await oauth2.userinfo.get();
    googleEmail = userInfo.data.email || undefined;
  } catch {
    // optional userinfo fetch
  }

  const encryptedAccessToken = encryptToken(tokens.access_token || '');
  const encryptedRefreshToken = tokens.refresh_token ? encryptToken(tokens.refresh_token) : undefined;
  const tokenExpiresAt = tokens.expiry_date ? new Date(tokens.expiry_date) : undefined;

  return prisma.googleCalendarAccount.upsert({
    where: { userId },
    create: {
      userId,
      googleEmail,
      encryptedAccessToken,
      encryptedRefreshToken,
      tokenExpiresAt,
      scope: tokens.scope,
      selectedCalendarId: 'primary',
      selectedCalendarName: 'Podstawowy',
      syncFrequencyHours: 3,
      nextSyncAt: new Date(Date.now() + 3 * 3600 * 1000),
    },
    update: {
      googleEmail: googleEmail || undefined,
      encryptedAccessToken,
      ...(encryptedRefreshToken ? { encryptedRefreshToken } : {}),
      tokenExpiresAt,
      scope: tokens.scope || undefined,
      lastSyncError: null,
    },
  });
}

/**
 * Returns an authenticated Google Calendar client for the user, refreshing tokens if needed.
 */
export async function getAuthenticatedCalendarClient(userId: string) {
  const account = await prisma.googleCalendarAccount.findUnique({
    where: { userId },
  });

  if (!account) {
    throw new Error('NO_GOOGLE_ACCOUNT');
  }

  const oauth2Client = await getGoogleOAuth2Client(userId);
  const accessToken = decryptToken(account.encryptedAccessToken);
  const refreshToken = account.encryptedRefreshToken ? decryptToken(account.encryptedRefreshToken) : undefined;

  oauth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
    expiry_date: account.tokenExpiresAt ? account.tokenExpiresAt.getTime() : undefined,
  });

  // Listen for automatic token refreshes performed by googleapis
  oauth2Client.on('tokens', async (newTokens) => {
    try {
      const updateData: Record<string, unknown> = {
        encryptedAccessToken: encryptToken(newTokens.access_token || accessToken),
        tokenExpiresAt: newTokens.expiry_date ? new Date(newTokens.expiry_date) : undefined,
      };
      if (newTokens.refresh_token) {
        updateData.encryptedRefreshToken = encryptToken(newTokens.refresh_token);
      }
      await prisma.googleCalendarAccount.update({
        where: { userId },
        data: updateData,
      });
    } catch {
      // ignore async token update error
    }
  });

  // Check if token is expired or expires in next 60 seconds and we have refresh_token
  if (account.tokenExpiresAt && account.tokenExpiresAt.getTime() - Date.now() < 60000 && refreshToken) {
    try {
      const refreshResponse = await oauth2Client.refreshAccessToken();
      const newTokens = refreshResponse.credentials;
      await prisma.googleCalendarAccount.update({
        where: { userId },
        data: {
          encryptedAccessToken: encryptToken(newTokens.access_token || accessToken),
          tokenExpiresAt: newTokens.expiry_date ? new Date(newTokens.expiry_date) : undefined,
          ...(newTokens.refresh_token ? { encryptedRefreshToken: encryptToken(newTokens.refresh_token) } : {}),
        },
      });
      oauth2Client.setCredentials(newTokens);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      await prisma.googleCalendarAccount.update({
        where: { userId },
        data: {
          lastSyncStatus: 'ERROR',
          lastSyncError: `Błąd odświeżania tokenu OAuth: ${errorMsg}`,
        },
      });
      throw err;
    }
  }

  return {
    calendar: google.calendar({ version: 'v3', auth: oauth2Client }),
    account,
  };
}

/**
 * Revokes Google OAuth token and removes the GoogleCalendarAccount and synchronized events.
 */
export async function disconnectGoogleCalendar(userId: string) {
  const account = await prisma.googleCalendarAccount.findUnique({
    where: { userId },
  });

  if (account) {
    try {
      const token = account.encryptedRefreshToken
        ? decryptToken(account.encryptedRefreshToken)
        : decryptToken(account.encryptedAccessToken);
      if (token) {
        const oauth2Client = await getGoogleOAuth2Client(userId);
        await oauth2Client.revokeToken(token);
      }
    } catch {
      // Ignore revocation error if token already invalid/revoked
    }

    // Delete in database cascade
    await prisma.$transaction([
      prisma.googleCalendarEvent.deleteMany({ where: { userId } }),
      prisma.googleCalendarAccount.delete({ where: { userId } }),
    ]);
  }
}
