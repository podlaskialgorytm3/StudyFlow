import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getWeekRange,
  getPreviousWeekRange,
  calculateWeeklyReportData,
  generateWeeklyPdf,
} from '@/lib/reports/reportService';
import { prisma } from '@/lib/prisma';
import { TaskStatus } from '@prisma/client';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    task: {
      findMany: vi.fn(),
    },
    taskTimeEntry: {
      findMany: vi.fn(),
    },
    weeklyReport: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

describe('Weekly Report Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getWeekRange', () => {
    it('calculates Monday 00:00 to Sunday 22:00 for a Wednesday', () => {
      // Wednesday Oct 14, 2026
      const wednesday = new Date('2026-10-14T15:30:00Z');
      const { weekStart, weekEnd } = getWeekRange(wednesday);

      expect(weekStart.getDay()).toBe(1); // Monday
      expect(weekStart.getHours()).toBe(0);
      expect(weekStart.getMinutes()).toBe(0);

      expect(weekEnd.getDay()).toBe(0); // Sunday
      expect(weekEnd.getHours()).toBe(22);
      expect(weekEnd.getMinutes()).toBe(0);

      // Verify duration is exactly 6 days and 22 hours (166 hours)
      const diffHours = Math.round((weekEnd.getTime() - weekStart.getTime()) / (1000 * 60 * 60));
      expect(diffHours).toBe(166);
    });

    it('calculates the same week range when given Sunday', () => {
      // Sunday Oct 18, 2026
      const sunday = new Date('2026-10-18T22:00:00Z');
      const { weekStart, weekEnd } = getWeekRange(sunday);

      expect(weekStart.getDay()).toBe(1); // Monday
      expect(weekEnd.getDay()).toBe(0); // Sunday
    });

    it('calculates the same week range when given Monday', () => {
      // Monday Oct 12, 2026
      const monday = new Date('2026-10-12T08:00:00Z');
      const { weekStart, weekEnd } = getWeekRange(monday);

      expect(weekStart.getDay()).toBe(1);
      expect(weekEnd.getDay()).toBe(0);
    });
  });

  describe('getPreviousWeekRange', () => {
    it('returns the exact range of the preceding week (7 days earlier)', () => {
      const wednesday = new Date('2026-10-14T12:00:00Z');
      const current = getWeekRange(wednesday);
      const prev = getPreviousWeekRange(wednesday);

      const diffMs = current.weekStart.getTime() - prev.weekStart.getTime();
      expect(diffMs).toBe(7 * 24 * 60 * 60 * 1000);
      expect(prev.weekStart.getDay()).toBe(1);
      expect(prev.weekEnd.getDay()).toBe(0);
    });
  });

  describe('calculateWeeklyReportData', () => {
    const userId = 'user-123';
    const weekStart = new Date('2026-10-12T00:00:00Z');
    const weekEnd = new Date('2026-10-18T22:00:00Z');

    it('correctly aggregates completed tasks, in-progress tasks, and study time', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: userId,
        username: 'student_jan',
        settings: {
          importantStoryPointsThreshold: 6,
          urgentWithinDays: 3,
        },
      } as any);

      // Mock tasks
      vi.mocked(prisma.task.findMany).mockResolvedValue([
        {
          id: 'task-1',
          title: 'Ukończony projekt',
          status: TaskStatus.DONE,
          completedAt: new Date('2026-10-14T14:00:00Z'),
          timeSpentSeconds: 3600,
          storyPoints: 5,
          subject: { name: 'Programowanie', color: '#1976d2' },
          category: { name: 'Projekt' },
          dueDate: new Date('2026-10-15T12:00:00Z'),
        },
        {
          id: 'task-2',
          title: 'Zadanie w toku',
          status: TaskStatus.IN_PROGRESS,
          completedAt: null,
          timeSpentSeconds: 1800,
          progressPercent: 50,
          storyPoints: 3,
          subject: { name: 'Matematyka', color: '#ff9800' },
          category: null,
          dueDate: new Date('2026-10-20T12:00:00Z'),
        },
        {
          id: 'task-3',
          title: 'Zaległe kolokwium',
          status: TaskStatus.TODO,
          completedAt: null,
          timeSpentSeconds: 0,
          progressPercent: 0,
          storyPoints: 8,
          subject: { name: 'Fizyka', color: '#ef4444' },
          category: null,
          dueDate: new Date('2026-10-16T12:00:00Z'), // Before weekEnd -> Overdue
        },
      ] as any);

      // Mock time entries for this week
      vi.mocked(prisma.taskTimeEntry.findMany)
        .mockResolvedValueOnce([
          {
            id: 'entry-1',
            durationSeconds: 3600,
            task: { subject: { name: 'Programowanie', color: '#1976d2' } },
          },
          {
            id: 'entry-2',
            durationSeconds: 1800,
            task: { subject: { name: 'Matematyka', color: '#ff9800' } },
          },
        ] as any)
        // Mock time entries for prev week
        .mockResolvedValueOnce([
          { id: 'entry-old', durationSeconds: 3600 },
        ] as any);

      const reportData = await calculateWeeklyReportData(userId, weekStart, weekEnd);

      expect(reportData.username).toBe('student_jan');
      expect(reportData.stats.completedCount).toBe(1);
      expect(reportData.stats.inProgressCount).toBe(1);
      expect(reportData.stats.totalStudyTimeSeconds).toBe(5400); // 3600 + 1800
      expect(reportData.stats.sessionCount).toBe(2);
      expect(reportData.stats.averageSessionMinutes).toBe(45); // 5400 / 2 / 60
      expect(reportData.stats.overdueCount).toBe(1);

      // Study time by subject
      expect(reportData.studyTimeBySubject).toHaveLength(2);
      expect(reportData.studyTimeBySubject[0].subjectName).toBe('Programowanie');
      expect(reportData.studyTimeBySubject[0].durationSeconds).toBe(3600);

      // Next week plan recommendations
      expect(reportData.nextWeekPlan.length).toBeGreaterThan(0);
      expect(reportData.nextWeekPlan[0].title).toBe('Zaległe kolokwium'); // Overdue takes priority
    });
  });

  describe('generateWeeklyPdf', () => {
    it('generates a valid binary PDF buffer starting with %PDF', async () => {
      const mockData = {
        username: 'jan_kowalski',
        weekStart: '2026-10-12T00:00:00.000Z',
        weekEnd: '2026-10-18T22:00:00.000Z',
        generatedAt: '2026-10-18T22:00:00.000Z',
        stats: {
          completedCount: 3,
          inProgressCount: 2,
          activeCount: 5,
          overdueCount: 1,
          plannedCount: 4,
          completionRatePercent: 75,
          totalStudyTimeSeconds: 7200,
          formattedStudyTime: '2 godz.',
          sessionCount: 4,
          averageSessionMinutes: 30,
          prevWeekTotalSeconds: 3600,
          studyTimeChangePercent: 100,
        },
        completedTasks: [
          {
            id: '1',
            title: 'Zadanie z polskimi znakami: Zażółć gęślą jaźń',
            subjectName: 'Filologia polska',
            categoryName: 'Esej',
            completedAt: '2026-10-15T14:00:00.000Z',
            timeSpentSeconds: 3600,
            storyPoints: 5,
          },
        ],
        inProgressTasks: [
          {
            id: '2',
            title: 'Projekt bazy danych PostgreSQL',
            subjectName: 'Bazy Danych',
            dueDate: '2026-10-22T10:00:00.000Z',
            progressPercent: 60,
            timeSpentSeconds: 3600,
            isOverdue: false,
            storyPoints: 8,
          },
        ],
        backlogAndOverdueTasks: [],
        studyTimeBySubject: [
          {
            subjectName: 'Filologia polska',
            durationSeconds: 3600,
            formattedDuration: '1 godz.',
            percentOfTotal: 50,
          },
        ],
        nextWeekPlan: [
          {
            id: '3',
            title: 'Przygotowanie do egzaminu',
            subjectName: 'Matematyka dyskretna',
            dueDate: '2026-10-24T12:00:00.000Z',
            priorityReason: 'Ważne i pilne (Q1)',
            storyPoints: 8,
          },
        ],
      };

      const buffer = await generateWeeklyPdf(mockData as any);

      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(buffer.length).toBeGreaterThan(1000);
      // Valid PDF files start with %PDF
      const header = buffer.toString('utf-8', 0, 5);
      expect(header).toBe('%PDF-');
    });
  });
});
