import { describe, it, expect, vi, beforeEach } from 'vitest';
import { pushTaskToGoogleCalendar, removeTaskFromGoogleCalendar } from '@/lib/google/taskExportService';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedCalendarClient } from '@/lib/google/calendarClient';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    task: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    googleCalendarEvent: {
      upsert: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

vi.mock('@/lib/google/calendarClient', () => ({
  getAuthenticatedCalendarClient: vi.fn(),
}));

describe('Google Calendar Task Export Service', () => {
  const userId = 'user-export-test';
  const taskId = 'task-export-1';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fails when task does not exist or user does not own it', async () => {
    vi.mocked(prisma.task.findUnique).mockResolvedValue(null);

    const result = await pushTaskToGoogleCalendar(userId, taskId);
    expect(result.success).toBe(false);
    expect(result.code).toBe('TASK_NOT_FOUND');
  });

  it('fails when task has no dueDate', async () => {
    vi.mocked(prisma.task.findUnique).mockResolvedValue({
      id: taskId,
      ownerId: userId,
      title: 'Zadanie bez terminu',
      dueDate: null,
      subject: { name: 'Matematyka', color: '#1976d2' },
    } as any);

    const result = await pushTaskToGoogleCalendar(userId, taskId);
    expect(result.success).toBe(false);
    expect(result.code).toBe('NO_DUE_DATE');
    expect(result.error).toContain('musi mieć określony termin');
  });

  it('fails with INSUFFICIENT_SCOPES when token was authorized only with readonly scope', async () => {
    vi.mocked(prisma.task.findUnique).mockResolvedValue({
      id: taskId,
      ownerId: userId,
      title: 'Nauka do egzaminu',
      dueDate: new Date('2026-10-20T14:00:00Z'),
      estimatedMinutes: 90,
      subject: { name: 'Fizyka', color: '#ff9800' },
    } as any);

    vi.mocked(getAuthenticatedCalendarClient).mockResolvedValue({
      calendar: {} as any,
      account: {
        scope: 'https://www.googleapis.com/auth/calendar.events.readonly',
        selectedCalendarId: 'primary',
      } as any,
    });

    const result = await pushTaskToGoogleCalendar(userId, taskId);
    expect(result.success).toBe(false);
    expect(result.code).toBe('INSUFFICIENT_SCOPES');
  });

  it('successfully creates an event in Google Calendar and saves googleEventId', async () => {
    vi.mocked(prisma.task.findUnique).mockResolvedValue({
      id: taskId,
      ownerId: userId,
      title: 'Projekt zaliczeniowy',
      description: 'Opis projektu',
      dueDate: new Date('2026-10-25T16:00:00Z'),
      estimatedMinutes: 60,
      storyPoints: 5,
      status: 'IN_PROGRESS',
      googleEventId: null,
      googleCalendarId: null,
      subject: { name: 'Informatyka', color: '#2563eb' },
    } as any);

    const mockInsert = vi.fn().mockResolvedValue({
      data: {
        id: 'google-event-new-id',
        htmlLink: 'https://calendar.google.com/event?id=xyz',
      },
    });

    vi.mocked(getAuthenticatedCalendarClient).mockResolvedValue({
      calendar: {
        events: {
          insert: mockInsert,
        },
      } as any,
      account: {
        scope: 'https://www.googleapis.com/auth/calendar.events',
        selectedCalendarId: 'primary',
      } as any,
    });

    const result = await pushTaskToGoogleCalendar(userId, taskId);
    expect(result.success).toBe(true);
    expect(result.googleEventId).toBe('google-event-new-id');

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        calendarId: 'primary',
        requestBody: expect.objectContaining({
          summary: '[StudyFlow] Projekt zaliczeniowy',
        }),
      })
    );

    expect(prisma.task.update).toHaveBeenCalledWith({
      where: { id: taskId },
      data: {
        googleEventId: 'google-event-new-id',
        googleCalendarId: 'primary',
      },
    });
  });

  it('successfully removes an exported task from Google Calendar', async () => {
    vi.mocked(prisma.task.findUnique).mockResolvedValue({
      id: taskId,
      ownerId: userId,
      googleEventId: 'google-event-to-remove',
      googleCalendarId: 'primary',
    } as any);

    const mockDelete = vi.fn().mockResolvedValue({});

    vi.mocked(getAuthenticatedCalendarClient).mockResolvedValue({
      calendar: {
        events: {
          delete: mockDelete,
        },
      } as any,
      account: {} as any,
    });

    const result = await removeTaskFromGoogleCalendar(userId, taskId);
    expect(result.success).toBe(true);
    expect(mockDelete).toHaveBeenCalledWith({
      calendarId: 'primary',
      eventId: 'google-event-to-remove',
    });

    expect(prisma.task.update).toHaveBeenCalledWith({
      where: { id: taskId },
      data: {
        googleEventId: null,
        googleCalendarId: null,
      },
    });
  });
});

