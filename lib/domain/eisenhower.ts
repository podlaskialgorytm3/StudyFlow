import { PriorityOverride, UrgencyOverride, TaskStatus } from '@prisma/client';

export type EisenhowerQuadrant = 'Q1_IMPORTANT_URGENT' | 'Q2_IMPORTANT_NOT_URGENT' | 'Q3_NOT_IMPORTANT_URGENT' | 'Q4_NOT_IMPORTANT_NOT_URGENT';

export interface EisenhowerTaskInput {
  storyPoints: number;
  dueDate?: Date | string | null;
  priorityOverride?: PriorityOverride | null;
  urgencyOverride?: UrgencyOverride | null;
  status: TaskStatus;
}

export interface EisenhowerSettings {
  importantStoryPointsThreshold: number; // 1-10 (default 6)
  urgentWithinDays: number; // >= 0 (default 3)
}

export interface EisenhowerClassification {
  isImportant: boolean;
  isUrgent: boolean;
  quadrant: EisenhowerQuadrant;
  isPriorityOverridden: boolean;
  isUrgencyOverridden: boolean;
  autoImportance: boolean;
  autoUrgency: boolean;
  daysRemaining: number | null;
  isOverdue: boolean;
  isDueToday: boolean;
  isVisibleOnDefaultMatrix: boolean;
}

/**
 * Calculates calendar days difference between a due date and reference date (today).
 * Uses calendar days (midnight to midnight) to avoid daylight saving time / timezone hour glitches.
 */
export function getCalendarDaysRemaining(
  dueDate?: Date | string | null,
  referenceDate: Date = new Date()
): number | null {
  if (!dueDate) return null;

  const due = typeof dueDate === 'string' ? new Date(dueDate) : dueDate;
  if (isNaN(due.getTime())) return null;

  const dueUtc = Date.UTC(due.getFullYear(), due.getMonth(), due.getDate());
  const refUtc = Date.UTC(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());

  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.round((dueUtc - refUtc) / msPerDay);
}

/**
 * Single source of truth for Eisenhower classification per AI_SPECIFICATION.md section 5.
 */
export function classifyEisenhowerTask(
  task: EisenhowerTaskInput,
  settings: EisenhowerSettings,
  referenceDate: Date = new Date()
): EisenhowerClassification {
  const daysRemaining = getCalendarDaysRemaining(task.dueDate, referenceDate);

  // Automatic Importance
  const autoImportance = task.storyPoints >= settings.importantStoryPointsThreshold;

  // Final Importance considering override
  const isPriorityOverridden = task.priorityOverride !== null && task.priorityOverride !== undefined;
  const isImportant = isPriorityOverridden
    ? task.priorityOverride === PriorityOverride.IMPORTANT
    : autoImportance;

  // Automatic Urgency
  // AI_SPECIFICATION.md 5.2:
  // - Brak terminu nie jest pilne.
  // - Jeśli termin przypada dziś lub minął (daysRemaining <= 0), zadanie jest pilne.
  // - Jeśli liczba pełnych dni kalendarzowych do terminu <= urgentWithinDays, zadanie jest pilne.
  // - W pozostałych przypadkach niepilne.
  let autoUrgency = false;
  if (daysRemaining !== null) {
    if (daysRemaining <= 0) {
      autoUrgency = true;
    } else if (daysRemaining <= settings.urgentWithinDays) {
      autoUrgency = true;
    }
  }

  // Final Urgency considering override
  const isUrgencyOverridden = task.urgencyOverride !== null && task.urgencyOverride !== undefined;
  const isUrgent = isUrgencyOverridden
    ? task.urgencyOverride === UrgencyOverride.URGENT
    : autoUrgency;

  // Quadrant determination
  let quadrant: EisenhowerQuadrant;
  if (isImportant && isUrgent) {
    quadrant = 'Q1_IMPORTANT_URGENT';
  } else if (isImportant && !isUrgent) {
    quadrant = 'Q2_IMPORTANT_NOT_URGENT';
  } else if (!isImportant && isUrgent) {
    quadrant = 'Q3_NOT_IMPORTANT_URGENT';
  } else {
    quadrant = 'Q4_NOT_IMPORTANT_NOT_URGENT';
  }

  const isOverdue = daysRemaining !== null && daysRemaining < 0;
  const isDueToday = daysRemaining !== null && daysRemaining === 0;

  // Section 5.4: Tasks with DONE status are excluded from default matrix view
  const isVisibleOnDefaultMatrix = task.status !== TaskStatus.DONE;

  return {
    isImportant,
    isUrgent,
    quadrant,
    isPriorityOverridden,
    isUrgencyOverridden,
    autoImportance,
    autoUrgency,
    daysRemaining,
    isOverdue,
    isDueToday,
    isVisibleOnDefaultMatrix,
  };
}

export const QUADRANT_CONFIG: Record<
  EisenhowerQuadrant,
  {
    code: string;
    label: string;
    subtitle: string;
    color: string;
    bgLight: string;
    border: string;
  }
> = {
  Q1_IMPORTANT_URGENT: {
    code: 'Q1',
    label: 'Ważne i pilne',
    subtitle: 'Zrób to natychmiast (Do First)',
    color: '#d32f2f',
    bgLight: '#ffebee',
    border: '#ef9a9a',
  },
  Q2_IMPORTANT_NOT_URGENT: {
    code: 'Q2',
    label: 'Ważne i niepilne',
    subtitle: 'Zaplanuj w kalendarzu (Schedule)',
    color: '#1976d2',
    bgLight: '#e3f2fd',
    border: '#90caf9',
  },
  Q3_NOT_IMPORTANT_URGENT: {
    code: 'Q3',
    label: 'Nieważne i pilne',
    subtitle: 'Deleguj lub zrób szybko (Delegate/Quick)',
    color: '#ed6c02',
    bgLight: '#fff3e0',
    border: '#ffcc80',
  },
  Q4_NOT_IMPORTANT_NOT_URGENT: {
    code: 'Q4',
    label: 'Nieważne i niepilne',
    subtitle: 'Ogranicz lub odrzuć (Eliminate)',
    color: '#757575',
    bgLight: '#f5f5f5',
    border: '#e0e0e0',
  },
};
