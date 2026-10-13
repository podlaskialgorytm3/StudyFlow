import { TaskItem } from '@/components/Tasks/TaskFormDialog';
import {
  EisenhowerSettings,
  classifyEisenhowerTask,
} from '@/lib/domain/eisenhower';
import { TaskStatus } from '@prisma/client';

/**
 * Selects up to 3 top priority tasks for Focus Mode (Tryb skupienia).
 * Deterministically ranks active tasks based on:
 * 1. Overdue tasks and tasks due today.
 * 2. Important and urgent tasks (Eisenhower Q1).
 * 3. Tasks approaching deadline (urgency threshold).
 * 4. Tasks in progress (IN_PROGRESS) that the student can continue.
 * 5. Other active tasks by importance (SP) and tie-breakers.
 *
 * Never returns completed tasks (DONE) or tasks skipped for today.
 */
export function selectFocusTopTasks(
  tasks: TaskItem[],
  settings: EisenhowerSettings,
  skippedTaskIds: string[] = [],
  referenceDate: Date = new Date(),
  limit: number = 3
): TaskItem[] {
  // 1. Filter out completed and skipped tasks
  const eligibleTasks = tasks.filter((t) => {
    if (t.status === TaskStatus.DONE) return false;
    if (skippedTaskIds.includes(t.id)) return false;
    return true;
  });

  if (eligibleTasks.length === 0) return [];

  // 2. Score and sort tasks deterministically
  const scored = eligibleTasks.map((task) => {
    const classification = classifyEisenhowerTask(task, settings, referenceDate);
    const days = classification.daysRemaining;
    const isOverdue = classification.isOverdue;
    const isDueToday = classification.isDueToday;
    const isQ1 = classification.quadrant === 'Q1_IMPORTANT_URGENT';
    const isInProgress = task.status === TaskStatus.IN_PROGRESS;
    const sp = task.storyPoints || 3;

    // Determine tier (0 = highest priority, 5 = lowest)
    let tier: number;

    if (isOverdue) {
      // Overdue tasks are #1 priority
      tier = 0;
    } else if (isDueToday) {
      // Due today tasks are next
      tier = 1;
    } else if (isQ1) {
      // Important and urgent
      tier = 2;
    } else if (days !== null && days <= settings.urgentWithinDays) {
      // Urgent / Approaching deadline
      tier = 3;
    } else if (isInProgress) {
      // Already in progress, continue working
      tier = 4;
    } else {
      // Other active tasks
      tier = 5;
    }

    return {
      task,
      classification,
      tier,
      days: days ?? 9999,
      isInProgress,
      sp,
    };
  });

  scored.sort((a, b) => {
    // 1. Tier comparison
    if (a.tier !== b.tier) {
      return a.tier - b.tier;
    }

    // 2. Within same tier: closer deadline first (smaller daysRemaining)
    if (a.days !== b.days) {
      return a.days - b.days;
    }

    // 3. IN_PROGRESS tasks before NEW / TODO
    if (a.isInProgress !== b.isInProgress) {
      return a.isInProgress ? -1 : 1;
    }

    // 4. Higher Story Points first
    if (a.sp !== b.sp) {
      return b.sp - a.sp;
    }

    // 5. Deterministic tie-breaker by title, then ID
    const titleCmp = a.task.title.localeCompare(b.task.title);
    if (titleCmp !== 0) return titleCmp;

    return a.task.id.localeCompare(b.task.id);
  });

  return scored.slice(0, limit).map((s) => s.task);
}
