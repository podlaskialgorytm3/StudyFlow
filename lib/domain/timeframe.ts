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
  referenceDate?: Date;
  minPeriods?: number;
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
 * Default period (key: 'current') covers from today to today + horizonDays (and past due tasks requiring completion).
 * Subsequent periods (keys: 'period_1', 'period_2', ...) cover interval chunks:
 * - Horizon 7 days: Week 2 (days 8-14), Week 3 (days 15-21), etc.
 * - Horizon N days: Period 2 (days N+1 to 2N), Period 3 (days 2N+1 to 3N), etc.
 */
export function generateTimeframePeriods(options: GenerateTimeframeOptions): TimeframePeriod[] {
  const horizonDays = Math.max(1, options.horizonDays || 7);
  const ref = options.referenceDate ? new Date(options.referenceDate) : new Date();
  const today = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
  const minPeriods = options.minPeriods ?? 4;

  let maxDaysRemaining = 0;
  if (options.tasksDueDates && options.tasksDueDates.length > 0) {
    for (const d of options.tasksDueDates) {
      const days = getCalendarDaysRemaining(d, today);
      if (days !== null && days > maxDaysRemaining) {
        maxDaysRemaining = days;
      }
    }
  }

  // Calculate how many periods are needed to cover future tasks
  const periodsCount = Math.max(minPeriods, Math.ceil(maxDaysRemaining / horizonDays));

  const periods: TimeframePeriod[] = [];

  // 1. Current period (Default: from today to +horizonDays)
  const currentEndDate = addDays(today, horizonDays);
  const isSevenDays = horizonDays === 7;

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

  // 2. Future periods: period_1 (e.g. days 8 to 14), period_2 (days 15 to 21), etc.
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

  // 3. Special filters
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


