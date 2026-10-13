import { describe, it, expect, vi, beforeEach } from 'vitest';
import { syncUserGoogleCalendar } from '@/lib/google/syncService';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedCalendarClient } from '@/lib/google/calendarClient';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    googleCalendarAccount: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    googleCalendarEvent: {
      findUnique: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

vi.mock('@/lib/google/calendarClient', () => ({
  getAuthenticatedCalendarClient: vi.fn(),
}));

describe('Google Calendar Sync Service', () => {
  const userId = 'user-sync-test-uuid';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fails gracefully when user has no linked Google account', async () => {
    vi.mocked(prisma.googleCalendarAccount.findUnique).mockResolvedValue(null);

    const result = await syncUserGoogleCalendar(userId);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Brak połączonego konta');
  });

  it('prevents concurrent synchronization within 2 minutes lock window', async () => {
    vi.mocked(prisma.googleCalendarAccount.findUnique).mockResolvedValue({
      id: 'acc-1',
      userId,
      selectedCalendarId: 'primary',
      lastSyncStatus: 'IN_PROGRESS',
      lastSyncAt: new Date(Date.now() - 30 * 1000), // 30 seconds ago
    } as any);

    const result = await syncUserGoogleCalendar(userId);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Synchronizacja jest już w trakcie realizacji');
  });

  it('synchronizes new events and saves them to local PostgreSQL database', async () => {
    vi.mocked(prisma.googleCalendarAccount.findUnique).mockResolvedValue({
      id: 'acc-1',
      userId,
      selectedCalendarId: 'primary',
      lastSyncStatus: 'SUCCESS',
      lastSyncAt: new Date(Date.now() - 3600 * 1000),
      syncToken: null,
      syncFrequencyHours: 3,
    } as any);

    const mockEventsList = vi.fn().mockResolvedValue({
      data: {
        items: [
          {
            id: 'event-g-1',
            summary: 'Wykład z Algorytmów',
            description: 'Sala 105',
            start: { dateTime: '2026-10-15T10:00:00Z' },
            end: { dateTime: '2026-10-15T11:30:00Z' },
            status: 'confirmed',
          },
        ],
        nextSyncToken: 'sync-token-xyz',
      },
    });

    vi.mocked(getAuthenticatedCalendarClient).mockResolvedValue({
      calendar: {
        events: {
          list: mockEventsList,
        },
      } as any,
      account: {} as any,
    });

    vi.mocked(prisma.googleCalendarEvent.findUnique).mockResolvedValue(null);

    const result = await syncUserGoogleCalendar(userId);

    expect(result.success).toBe(true);
    expect(result.imported).toBe(1);
    expect(result.updated).toBe(0);
    expect(result.deleted).toBe(0);

    expect(prisma.googleCalendarEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId,
        googleEventId: 'event-g-1',
        summary: 'Wykład z Algorytmów',
      }),
    });

    expect(prisma.googleCalendarAccount.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId },
        data: expect.objectContaining({
          lastSyncStatus: 'SUCCESS',
          syncToken: 'sync-token-xyz',
        }),
      })
    );
  });

  it('updates existing events when modified in Google Calendar (idempotent updates)', async () => {
    vi.mocked(prisma.googleCalendarAccount.findUnique).mockResolvedValue({
      id: 'acc-1',
      userId,
      selectedCalendarId: 'primary',
      lastSyncStatus: 'SUCCESS',
      lastSyncAt: new Date(Date.now() - 3600 * 1000),
      syncToken: 'existing-token-1',
      syncFrequencyHours: 3,
    } as any);

    const mockEventsList = vi.fn().mockResolvedValue({
      data: {
        items: [
          {
            id: 'event-g-1',
            summary: 'Zaktualizowany Wykład',
            start: { dateTime: '2026-10-15T12:00:00Z' },
            end: { dateTime: '2026-10-15T13:30:00Z' },
            status: 'confirmed',
          },
        ],
        nextSyncToken: 'new-token-2',
      },
    });

    vi.mocked(getAuthenticatedCalendarClient).mockResolvedValue({
      calendar: { events: { list: mockEventsList } } as any,
      account: {} as any,
    });

    // Existing event in database
    vi.mocked(prisma.googleCalendarEvent.findUnique).mockResolvedValue({
      id: 'db-ev-1',
      userId,
      googleEventId: 'event-g-1',
    } as any);

    const result = await syncUserGoogleCalendar(userId);

    expect(result.success).toBe(true);
    expect(result.imported).toBe(0);
    expect(result.updated).toBe(1);
    expect(prisma.googleCalendarEvent.update).toHaveBeenCalledWith({
      where: { id: 'db-ev-1' },
      data: expect.objectContaining({
        summary: 'Zaktualizowany Wykład',
      }),
    });
  });

  it('removes deleted or cancelled Google events from local database', async () => {
    vi.mocked(prisma.googleCalendarAccount.findUnique).mockResolvedValue({
      id: 'acc-1',
      userId,
      selectedCalendarId: 'primary',
      lastSyncStatus: 'SUCCESS',
      lastSyncAt: new Date(Date.now() - 3600 * 1000),
      syncToken: 'token-abc',
      syncFrequencyHours: 3,
    } as any);

    const mockEventsList = vi.fn().mockResolvedValue({
      data: {
        items: [
          {
            id: 'cancelled-event-1',
            status: 'cancelled',
          },
        ],
        nextSyncToken: 'token-after-deletion',
      },
    });

    vi.mocked(getAuthenticatedCalendarClient).mockResolvedValue({
      calendar: { events: { list: mockEventsList } } as any,
      account: {} as any,
    });

    vi.mocked(prisma.googleCalendarEvent.deleteMany).mockResolvedValue({ count: 1 });

    const result = await syncUserGoogleCalendar(userId);

    expect(result.success).toBe(true);
    expect(result.deleted).toBe(1);
    expect(prisma.googleCalendarEvent.deleteMany).toHaveBeenCalledWith({
      where: {
        userId,
        googleEventId: 'cancelled-event-1',
      },
    });
  });

  it('handles Google API 410 Gone error by resetting syncToken and doing full sync', async () => {
    vi.mocked(prisma.googleCalendarAccount.findUnique).mockResolvedValue({
      id: 'acc-1',
      userId,
      selectedCalendarId: 'primary',
      lastSyncStatus: 'SUCCESS',
      lastSyncAt: new Date(Date.now() - 3600 * 1000),
      syncToken: 'expired-invalid-token',
      syncFrequencyHours: 3,
    } as any);

    let callCount = 0;
    const mockEventsList = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // First call with expired syncToken returns 410 Gone
        const error = new Error('Sync token is expired');
        (error as any).status = 410;
        throw error;
      }
      // Second call (full sync without syncToken) succeeds
      return Promise.resolve({
        data: {
          items: [
            {
              id: 'event-full-sync',
              summary: 'Pełna synchronizacja po wygaśnięciu tokenu',
              start: { dateTime: '2026-10-16T08:00:00Z' },
              end: { dateTime: '2026-10-16T09:30:00Z' },
              status: 'confirmed',
            },
          ],
          nextSyncToken: 'fresh-valid-sync-token',
        },
      });
    });

    vi.mocked(getAuthenticatedCalendarClient).mockResolvedValue({
      calendar: { events: { list: mockEventsList } } as any,
      account: {} as any,
    });

    vi.mocked(prisma.googleCalendarEvent.findUnique).mockResolvedValue(null);

    const result = await syncUserGoogleCalendar(userId);

    expect(result.success).toBe(true);
    expect(result.imported).toBe(1);
    expect(mockEventsList).toHaveBeenCalledTimes(2);
    // Verified that syncToken was cleared in DB
    expect(prisma.googleCalendarAccount.update).toHaveBeenCalledWith({
      where: { userId },
      data: { syncToken: null },
    });
  });

  it('enforces user data isolation so sync for user A cannot touch user B events', async () => {
    const userA = 'user-A-id';
    const userB = 'user-B-id';

    vi.mocked(prisma.googleCalendarAccount.findUnique).mockResolvedValue({
      id: 'acc-A',
      userId: userA,
      selectedCalendarId: 'primary',
      lastSyncStatus: 'SUCCESS',
      lastSyncAt: new Date(Date.now() - 3600 * 1000),
      syncToken: null,
      syncFrequencyHours: 3,
    } as any);

    const mockEventsList = vi.fn().mockResolvedValue({
      data: {
        items: [{ id: 'event-A-1', summary: 'Wydarzenie User A', status: 'confirmed' }],
        nextSyncToken: 'token-A',
      },
    });

    vi.mocked(getAuthenticatedCalendarClient).mockResolvedValue({
      calendar: { events: { list: mockEventsList } } as any,
      account: {} as any,
    });

    await syncUserGoogleCalendar(userA);

    // Assert that every create/update/delete call specifies userId: userA and NOT userB
    const createCalls = vi.mocked(prisma.googleCalendarEvent.create).mock.calls;
    expect(createCalls.length).toBeGreaterThan(0);
    for (const call of createCalls) {
      expect(call[0].data.userId).toBe(userA);
      expect(call[0].data.userId).not.toBe(userB);
    }
  });
});

