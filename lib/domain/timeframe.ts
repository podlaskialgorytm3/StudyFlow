import { getCalendarDaysRemaining } from './eisenhower';
import { TaskStatus } from '@prisma/client';

export interface TimeframePeriod {
  key: string;
  label: string;
  shortLabel: string;
  startDays: number | null;
  endDays: number | null;
  startDate?: Date;
  endDate?: Date;
  isSpecial?: 'all' | 'overdue' | 'no_date';
}

export interface GenerateTimeframeOptions {
  horizonDays: number;
  tasksDueDates?: (Date | string | null | undefined)[];
  tasksCompletedDates?: (Date | string | null | undefined)[];
  referenceDate?: Date;
  minPeriods?: number;
  pastPeriods?: number;
  minPastPeriods?: number;
}

/**
 * Formats a Date object to Polish DD.MM.YYYY string format.
 */
export function formatDatePl(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}.${month}.${year}`;
}

/**
 * Adds full calendar days to a date.
 */
export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Generates timeframe periods based on the student's horizon interval (e.g. 7 days).
 *
 * Chronological order:
 * - Past periods: 'past_2', 'past_1' (e.g. "Poprzedni tydzień", "2 tygodnie temu")
 * - Default period: 'current' (today to today + horizonDays)
 * - Future periods: 'period_1', 'period_2', ...
 * - Special filters: 'all', 'overdue', 'no_date'
 */
export function generateTimeframePeriods(options: GenerateTimeframeOptions): TimeframePeriod[] {
  const horizonDays = Math.max(1, options.horizonDays || 7);
  const ref = options.referenceDate ? new Date(options.referenceDate) : new Date();
  const today = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
  const minPeriods = options.minPeriods ?? 4;
  const isSevenDays = horizonDays === 7;

  // Scan future dates
  let maxDaysRemaining = 0;
  if (options.tasksDueDates && options.tasksDueDates.length > 0) {
    for (const d of options.tasksDueDates) {
      const days = getCalendarDaysRemaining(d, today);
      if (days !== null && days > maxDaysRemaining) {
        maxDaysRemaining = days;
      }
    }
  }

  // Scan past dates (due dates & completed dates)
  let minDaysRemaining = 0;
  const allPastCandidates = [
    ...(options.tasksDueDates || []),
    ...(options.tasksCompletedDates || []),
  ];
  for (const d of allPastCandidates) {
    if (!d) continue;
    const days = getCalendarDaysRemaining(d, today);
    if (days !== null && days < minDaysRemaining) {
      minDaysRemaining = days;
    }
  }

  // Calculate how many past & future periods are needed
  const periodsCount = Math.max(minPeriods, Math.ceil(maxDaysRemaining / horizonDays));
  const defaultMinPast = options.pastPeriods !== undefined ? options.pastPeriods : (options.minPastPeriods ?? 1);
  const neededPastPeriods = Math.ceil(Math.abs(minDaysRemaining) / horizonDays);
  const pastPeriodsCount = Math.max(defaultMinPast, Math.min(6, neededPastPeriods));

  const periods: TimeframePeriod[] = [];

  // 1. Past periods: past_k from oldest to newest (e.g. past_2, past_1)
  for (let k = pastPeriodsCount; k >= 1; k--) {
    const startDay = -(k * horizonDays);
    const endDay = -((k - 1) * horizonDays + 1);
    const periodStartDate = addDays(today, startDay);
    const periodEndDate = addDays(today, endDay);

    let label: string;
    let shortLabel: string;

    if (isSevenDays) {
      if (k === 1) {
        label = `Poprzedni tydzień: [${formatDatePl(periodStartDate)} – ${formatDatePl(periodEndDate)}]`;
        shortLabel = 'Poprzedni tydzień';
      } else if (k >= 2 && k <= 4) {
        label = `${k} tygodnie temu: [${formatDatePl(periodStartDate)} – ${formatDatePl(periodEndDate)}]`;
        shortLabel = `${k} tyg. temu`;
      } else {
        label = `${k} tygodni temu: [${formatDatePl(periodStartDate)} – ${formatDatePl(periodEndDate)}]`;
        shortLabel = `${k} tyg. temu`;
      }
    } else {
      if (k === 1) {
        label = `Poprzedni okres (${horizonDays} dni): [${formatDatePl(periodStartDate)} – ${formatDatePl(periodEndDate)}]`;
        shortLabel = 'Poprzedni okres';
      } else {
        label = `${k} okresy temu (${horizonDays} dni): [${formatDatePl(periodStartDate)} – ${formatDatePl(periodEndDate)}]`;
        shortLabel = `${k} okr. temu`;
      }
    }

    periods.push({
      key: `past_${k}`,
      label,
      shortLabel,
      startDays: startDay,
      endDays: endDay,
      startDate: periodStartDate,
      endDate: periodEndDate,
    });
  }

  // 2. Current period (Default: from today to +horizonDays)
  const currentEndDate = addDays(today, horizonDays);

  periods.push({
    key: 'current',
    label: isSevenDays
      ? `Bieżący tydzień: [${formatDatePl(today)} – ${formatDatePl(currentEndDate)}]`
      : `Bieżący okres (${horizonDays} dni): [${formatDatePl(today)} – ${formatDatePl(currentEndDate)}]`,
    shortLabel: isSevenDays ? 'Bieżący tydzień' : `Bieżące ${horizonDays} dni`,
    startDays: null, // covers tasks up to horizonDays (including overdue)
    endDays: horizonDays,
    startDate: today,
    endDate: currentEndDate,
  });

  // 3. Future periods: period_1 (e.g. days 8 to 14), period_2 (days 15 to 21), etc.
  for (let k = 1; k < periodsCount; k++) {
    const startDay = k * horizonDays + 1;
    const endDay = (k + 1) * horizonDays;
    const periodStartDate = addDays(today, startDay);
    const periodEndDate = addDays(today, endDay);
    const periodNumber = k + 1;

    periods.push({
      key: `period_${k}`,
      label: isSevenDays
        ? `Tydzień ${periodNumber}: [${formatDatePl(periodStartDate)} – ${formatDatePl(periodEndDate)}]`
        : `Okres ${periodNumber} (${horizonDays} dni): [${formatDatePl(periodStartDate)} – ${formatDatePl(periodEndDate)}]`,
      shortLabel: isSevenDays ? `Tydzień ${periodNumber}` : `Okres ${periodNumber}`,
      startDays: startDay,
      endDays: endDay,
      startDate: periodStartDate,
      endDate: periodEndDate,
    });
  }

  // 4. Special filters
  periods.push({
    key: 'all',
    label: 'Wszystkie terminy (brak filtra czasu)',
    shortLabel: 'Wszystkie',
    startDays: null,
    endDays: null,
    isSpecial: 'all',
  });

  periods.push({
    key: 'overdue',
    label: 'Tylko zaległe (po terminie)',
    shortLabel: 'Zaległe',
    startDays: null,
    endDays: null,
    isSpecial: 'overdue',
  });

  periods.push({
    key: 'no_date',
    label: 'Bez ustalonego terminu',
    shortLabel: 'Bez terminu',
    startDays: null,
    endDays: null,
    isSpecial: 'no_date',
  });

  return periods;
}

/**
 * Returns chronological list of timeframe periods (excluding special filters like 'all', 'overdue', 'no_date').
 * Used for stepping backward and forward through weeks/periods.
 */
export function getChronologicalPeriods(periods: TimeframePeriod[]): TimeframePeriod[] {
  return periods.filter((p) => !p.isSpecial);
}

/**
 * Returns the start of the week (Monday 00:00:00.000) for a given reference date.
 */
export function getStartOfWeek(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay(); // 0 is Sunday, 1 is Monday...
  const diffToMonday = (day === 0 ? -6 : 1) - day;
  date.setDate(date.getDate() + diffToMonday);
  date.setHours(0, 0, 0, 0);
  return date;
}

export interface TaskTimeframeMeta {
  dueDate?: Date | string | null;
  status?: TaskStatus | string | null;
  completedAt?: Date | string | null;
}

/**
 * Checks whether a task falls within the selected timeframe period.
 *
 * Rules for completed tasks (status === 'DONE'):
 * - Completed tasks are NEVER overdue (never appear in 'overdue').
 * - Once completed in a given week, they MUST NOT appear in subsequent / future weeks ('period_1', 'period_2', etc.).
 * - In 'current' (current week), only tasks completed within the current week appear (tasks completed in previous weeks are hidden).
 * - In 'all' (all terms), all tasks including completed are visible.
 */
export function isTaskInTimeframe(
  dueDateOrTask: Date | string | null | undefined | TaskTimeframeMeta,
  selectedPeriodKey: string,
  horizonDays: number,
  periods: TimeframePeriod[],
  referenceDate: Date = new Date(),
  explicitStatus?: TaskStatus | string | null,
  explicitCompletedAt?: Date | string | null
): boolean {
  if (selectedPeriodKey === 'all') {
    return true;
  }

  // Extract task properties
  let dueDate: Date | string | null | undefined;
  let status: TaskStatus | string | null | undefined = explicitStatus;
  let completedAt: Date | string | null | undefined = explicitCompletedAt;

  if (
    typeof dueDateOrTask === 'object' &&
    dueDateOrTask !== null &&
    !(dueDateOrTask instanceof Date)
  ) {
    dueDate = dueDateOrTask.dueDate;
    if (status === undefined) status = dueDateOrTask.status;
    if (completedAt === undefined) completedAt = dueDateOrTask.completedAt;
  } else {
    dueDate = dueDateOrTask as Date | string | null | undefined;
  }

  const isDone = status === TaskStatus.DONE || status === 'DONE';

  // Completed tasks are never "overdue"
  if (selectedPeriodKey === 'overdue') {
    if (isDone) return false;
    const daysRemaining = getCalendarDaysRemaining(dueDate, referenceDate);
    return daysRemaining !== null && daysRemaining < 0;
  }

  // Special filter: without due date
  if (selectedPeriodKey === 'no_date') {
    if (dueDate !== null && dueDate !== undefined) return false;
    if (isDone) {
      if (!completedAt) return true;
      const compDate = new Date(completedAt);
      const startOfWeek = getStartOfWeek(referenceDate);
      return compDate >= startOfWeek;
    }
    return true;
  }

  // Handle completed tasks:
  if (isDone) {
    const period = periods.find((p) => p.key === selectedPeriodKey);

    // Rule: Completed tasks must NOT appear in future weeks/periods ('period_1', 'period_2', etc.)
    if (period && period.startDays !== null && period.startDays > 0) {
      return false;
    }

    // In past periods ('past_1', 'past_2', etc.):
    if (selectedPeriodKey.startsWith('past_')) {
      if (completedAt) {
        const compDate = new Date(completedAt);
        if (!isNaN(compDate.getTime())) {
          if (horizonDays === 7) {
            const currentWeekStart = getStartOfWeek(referenceDate);
            const k = parseInt(selectedPeriodKey.replace('past_', ''), 10) || 1;
            const pastWeekStart = addDays(currentWeekStart, -k * 7);
            const pastWeekEnd = addDays(currentWeekStart, -(k - 1) * 7);
            return compDate >= pastWeekStart && compDate < pastWeekEnd;
          } else {
            const today = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());
            const pStart = period?.startDate ? new Date(period.startDate) : addDays(today, period?.startDays ?? -horizonDays);
            const pEnd = period?.endDate ? new Date(period.endDate) : addDays(today, period?.endDays ?? -1);
            pStart.setHours(0, 0, 0, 0);
            pEnd.setHours(23, 59, 59, 999);
            return compDate >= pStart && compDate <= pEnd;
          }
        }
      }
      // If completedAt is not recorded, check if dueDate is within that past period
      const daysRemaining = getCalendarDaysRemaining(dueDate, referenceDate);
      if (daysRemaining === null) return false;
      return (
        period !== undefined &&
        period.startDays !== null &&
        period.endDays !== null &&
        daysRemaining >= period.startDays &&
        daysRemaining <= period.endDays
      );
    }

    // In 'current' (Bieżący tydzień / okres):
    if (selectedPeriodKey === 'current') {
      if (completedAt) {
        const compDate = new Date(completedAt);
        if (!isNaN(compDate.getTime())) {
          const startOfWeek = getStartOfWeek(referenceDate);
          // Only show if completed within the current week (since Monday 00:00)
          return compDate >= startOfWeek;
        }
      }
      // If completedAt is not recorded, check if dueDate is within current week
      const daysRemaining = getCalendarDaysRemaining(dueDate, referenceDate);
      if (daysRemaining === null) return true;
      return daysRemaining >= 0 && daysRemaining <= horizonDays;
    }
  }

  // Active tasks (NEW, TODO, IN_PROGRESS):
  const daysRemaining = getCalendarDaysRemaining(dueDate, referenceDate);
  if (daysRemaining === null) {
    return false;
  }

  if (selectedPeriodKey === 'current') {
    // Current period covers active tasks up to horizonDays (including overdue active tasks)
    return daysRemaining <= horizonDays;
  }

  const period = periods.find((p) => p.key === selectedPeriodKey);
  if (!period || period.startDays === null || period.endDays === null) {
    return true;
  }

  return daysRemaining >= period.startDays && daysRemaining <= period.endDays;
}


