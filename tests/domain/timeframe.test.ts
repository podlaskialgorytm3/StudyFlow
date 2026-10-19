import { describe, it, expect } from 'vitest';
import {
  generateTimeframePeriods,
  isTaskInTimeframe,
  formatDatePl,
  addDays,
} from '@/lib/domain/timeframe';

describe('Timeframe Domain Logic', () => {
  const refDate = new Date(2026, 9, 13, 10, 0, 0); // Oct 13, 2026

  describe('formatDatePl and addDays', () => {
    it('formats date to DD.MM.YYYY', () => {
      expect(formatDatePl(new Date(2026, 9, 13))).toBe('13.10.2026');
      expect(formatDatePl(new Date(2026, 0, 5))).toBe('05.01.2026');
    });

    it('adds days correctly', () => {
      const start = new Date(2026, 9, 13);
      const end = addDays(start, 7);
      expect(formatDatePl(end)).toBe('20.10.2026');
    });
  });

  describe('generateTimeframePeriods with 7 days (default week)', () => {
    it('generates current week and subsequent weeks with expected labels and intervals', () => {
      const periods = generateTimeframePeriods({
        horizonDays: 7,
        referenceDate: refDate,
        minPeriods: 4,
      });

      expect(periods[0].key).toBe('current');
      expect(periods[0].label).toBe('Bieżący tydzień: [13.10.2026 – 20.10.2026]');
      expect(periods[0].endDays).toBe(7);

      expect(periods[1].key).toBe('period_1');
      expect(periods[1].label).toBe('Tydzień 2: [21.10.2026 – 27.10.2026]');
      expect(periods[1].startDays).toBe(8);
      expect(periods[1].endDays).toBe(14);

      expect(periods[2].key).toBe('period_2');
      expect(periods[2].label).toBe('Tydzień 3: [28.10.2026 – 03.11.2026]');
      expect(periods[2].startDays).toBe(15);
      expect(periods[2].endDays).toBe(21);

      expect(periods[3].key).toBe('period_3');
      expect(periods[3].label).toBe('Tydzień 4: [04.11.2026 – 10.11.2026]');
      expect(periods[3].startDays).toBe(22);
      expect(periods[3].endDays).toBe(28);

      // Check special options
      const allOption = periods.find((p) => p.key === 'all');
      expect(allOption).toBeDefined();
      const overdueOption = periods.find((p) => p.key === 'overdue');
      expect(overdueOption).toBeDefined();
      const noDateOption = periods.find((p) => p.key === 'no_date');
      expect(noDateOption).toBeDefined();
    });

    it('dynamically expands periods if tasks are scheduled further in the future', () => {
      const farDueDate = new Date(2026, 11, 15); // Dec 15, 2026 (~63 days away)
      const periods = generateTimeframePeriods({
        horizonDays: 7,
        tasksDueDates: [farDueDate],
        referenceDate: refDate,
      });

      // 63 days / 7 = 9 periods
      const weekPeriods = periods.filter((p) => p.key.startsWith('period_') || p.key === 'current');
      expect(weekPeriods.length).toBeGreaterThanOrEqual(9);
    });
  });

  describe('generateTimeframePeriods with custom interval (e.g. 5 days)', () => {
    it('generates custom period labels when interval is not 7', () => {
      const periods = generateTimeframePeriods({
        horizonDays: 5,
        referenceDate: refDate,
        minPeriods: 3,
      });

      expect(periods[0].key).toBe('current');
      expect(periods[0].label).toBe('Bieżący okres (5 dni): [13.10.2026 – 18.10.2026]');
      expect(periods[0].endDays).toBe(5);

      expect(periods[1].key).toBe('period_1');
      expect(periods[1].label).toBe('Okres 2 (5 dni): [19.10.2026 – 23.10.2026]');
      expect(periods[1].startDays).toBe(6);
      expect(periods[1].endDays).toBe(10);
    });
  });

  describe('isTaskInTimeframe filtering', () => {
    const periods = generateTimeframePeriods({
      horizonDays: 7,
      referenceDate: refDate,
    });

    it('matches default view for tasks due within 7 days', () => {
      const dueToday = new Date(2026, 9, 13);
      const dueIn3Days = new Date(2026, 9, 16);
      const dueIn7Days = new Date(2026, 9, 20);
      const dueIn8Days = new Date(2026, 9, 21);

      expect(isTaskInTimeframe(dueToday, 'current', 7, periods, refDate)).toBe(true);
      expect(isTaskInTimeframe(dueIn3Days, 'current', 7, periods, refDate)).toBe(true);
      expect(isTaskInTimeframe(dueIn7Days, 'current', 7, periods, refDate)).toBe(true);
      expect(isTaskInTimeframe(dueIn8Days, 'current', 7, periods, refDate)).toBe(false);
    });

    it('matches tasks due in 8 days and more when selecting Week 2', () => {
      const dueIn7Days = new Date(2026, 9, 20);
      const dueIn8Days = new Date(2026, 9, 21);
      const dueIn14Days = new Date(2026, 9, 27);
      const dueIn15Days = new Date(2026, 9, 28);

      expect(isTaskInTimeframe(dueIn7Days, 'period_1', 7, periods, refDate)).toBe(false);
      expect(isTaskInTimeframe(dueIn8Days, 'period_1', 7, periods, refDate)).toBe(true);
      expect(isTaskInTimeframe(dueIn14Days, 'period_1', 7, periods, refDate)).toBe(true);
      expect(isTaskInTimeframe(dueIn15Days, 'period_1', 7, periods, refDate)).toBe(false);
    });

    it('matches overdue tasks in overdue filter and in current period', () => {
      const pastDue = new Date(2026, 9, 10); // 3 days ago
      expect(isTaskInTimeframe(pastDue, 'overdue', 7, periods, refDate)).toBe(true);
      expect(isTaskInTimeframe(pastDue, 'current', 7, periods, refDate)).toBe(true);
      expect(isTaskInTimeframe(pastDue, 'period_1', 7, periods, refDate)).toBe(false);
    });

    it('handles tasks without due date', () => {
      expect(isTaskInTimeframe(null, 'current', 7, periods, refDate)).toBe(false);
      expect(isTaskInTimeframe(null, 'no_date', 7, periods, refDate)).toBe(true);
      expect(isTaskInTimeframe(null, 'all', 7, periods, refDate)).toBe(true);
    });

    it('returns true for all tasks when selecting "all"', () => {
      expect(isTaskInTimeframe(new Date(2026, 9, 13), 'all', 7, periods, refDate)).toBe(true);
      expect(isTaskInTimeframe(new Date(2026, 11, 20), 'all', 7, periods, refDate)).toBe(true);
      expect(isTaskInTimeframe(null, 'all', 7, periods, refDate)).toBe(true);
    });

    it('does not show completed tasks in following weeks (period_1, period_2) even if dueDate was in that week', () => {
      const taskCompletedThisWeekWithFutureDue = {
        dueDate: new Date(2026, 9, 25), // due in Week 2
        status: 'DONE',
        completedAt: new Date(2026, 9, 14), // completed in current week
      };

      // In current week, it shows because it was completed this week
      expect(isTaskInTimeframe(taskCompletedThisWeekWithFutureDue, 'current', 7, periods, refDate)).toBe(true);

      // In following week (Week 2), it MUST NOT show up
      expect(isTaskInTimeframe(taskCompletedThisWeekWithFutureDue, 'period_1', 7, periods, refDate)).toBe(false);
      expect(isTaskInTimeframe(taskCompletedThisWeekWithFutureDue, 'period_2', 7, periods, refDate)).toBe(false);

      // In "all", it shows up
      expect(isTaskInTimeframe(taskCompletedThisWeekWithFutureDue, 'all', 7, periods, refDate)).toBe(true);
    });

    it('does not show tasks completed in a previous week in the current week', () => {
      // refDate is Tuesday 13.10.2026 (Monday 12.10.2026 is start of current week)
      const taskCompletedLastWeek = {
        dueDate: new Date(2026, 9, 8),
        status: 'DONE',
        completedAt: new Date(2026, 9, 9), // Friday of previous week
      };

      // In current week, it MUST NOT show up because it was completed in the previous week
      expect(isTaskInTimeframe(taskCompletedLastWeek, 'current', 7, periods, refDate)).toBe(false);

      // In subsequent weeks, it MUST NOT show up
      expect(isTaskInTimeframe(taskCompletedLastWeek, 'period_1', 7, periods, refDate)).toBe(false);

      // Never shows in overdue
      expect(isTaskInTimeframe(taskCompletedLastWeek, 'overdue', 7, periods, refDate)).toBe(false);

      // Always shows in "all"
      expect(isTaskInTimeframe(taskCompletedLastWeek, 'all', 7, periods, refDate)).toBe(true);
    });
  });
});

