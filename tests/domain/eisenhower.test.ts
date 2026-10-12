import { describe, it, expect } from 'vitest';
import { classifyEisenhowerTask, getCalendarDaysRemaining } from '@/lib/domain/eisenhower';
import { PriorityOverride, UrgencyOverride, TaskStatus } from '@prisma/client';

describe('Eisenhower Matrix Domain Logic', () => {
  const defaultSettings = {
    importantStoryPointsThreshold: 6,
    urgentWithinDays: 3,
  };

  const refDate = new Date(2026, 9, 12, 12, 0, 0); // Oct 12, 2026

  describe('Importance calculation (Story Points)', () => {
    it('marks task as important when Story Points are equal to threshold', () => {
      const result = classifyEisenhowerTask(
        {
          storyPoints: 6,
          dueDate: null,
          status: TaskStatus.TODO,
        },
        defaultSettings,
        refDate
      );
      expect(result.isImportant).toBe(true);
      expect(result.autoImportance).toBe(true);
      expect(result.quadrant).toBe('Q2_IMPORTANT_NOT_URGENT');
    });

    it('marks task as important when Story Points are above threshold', () => {
      const result = classifyEisenhowerTask(
        {
          storyPoints: 8,
          dueDate: null,
          status: TaskStatus.TODO,
        },
        defaultSettings,
        refDate
      );
      expect(result.isImportant).toBe(true);
      expect(result.autoImportance).toBe(true);
    });

    it('marks task as not important when Story Points are below threshold', () => {
      const result = classifyEisenhowerTask(
        {
          storyPoints: 5,
          dueDate: null,
          status: TaskStatus.TODO,
        },
        defaultSettings,
        refDate
      );
      expect(result.isImportant).toBe(false);
      expect(result.autoImportance).toBe(false);
      expect(result.quadrant).toBe('Q4_NOT_IMPORTANT_NOT_URGENT');
    });
  });

  describe('Urgency calculation (Due Date & urgentWithinDays)', () => {
    it('marks task as urgent when due date is today', () => {
      const todayDate = new Date(2026, 9, 12, 23, 59, 59);
      const result = classifyEisenhowerTask(
        {
          storyPoints: 3,
          dueDate: todayDate,
          status: TaskStatus.TODO,
        },
        defaultSettings,
        refDate
      );
      expect(result.isUrgent).toBe(true);
      expect(result.autoUrgency).toBe(true);
      expect(result.isDueToday).toBe(true);
      expect(result.isOverdue).toBe(false);
      expect(result.daysRemaining).toBe(0);
      expect(result.quadrant).toBe('Q3_NOT_IMPORTANT_URGENT');
    });

    it('marks task as urgent when due date is in the past (overdue)', () => {
      const pastDate = new Date(2026, 9, 10, 10, 0, 0); // 2 days ago
      const result = classifyEisenhowerTask(
        {
          storyPoints: 2,
          dueDate: pastDate,
          status: TaskStatus.TODO,
        },
        defaultSettings,
        refDate
      );
      expect(result.isUrgent).toBe(true);
      expect(result.autoUrgency).toBe(true);
      expect(result.isOverdue).toBe(true);
      expect(result.daysRemaining).toBe(-2);
      expect(result.quadrant).toBe('Q3_NOT_IMPORTANT_URGENT');
    });

    it('marks task as urgent when due date is within urgentWithinDays threshold', () => {
      const withinThresholdDate = new Date(2026, 9, 15, 10, 0, 0); // 3 days ahead (equal to threshold 3)
      const result = classifyEisenhowerTask(
        {
          storyPoints: 7,
          dueDate: withinThresholdDate,
          status: TaskStatus.TODO,
        },
        defaultSettings,
        refDate
      );
      expect(result.isUrgent).toBe(true);
      expect(result.autoUrgency).toBe(true);
      expect(result.daysRemaining).toBe(3);
      expect(result.quadrant).toBe('Q1_IMPORTANT_URGENT');
    });

    it('marks task as not urgent when due date is outside urgentWithinDays threshold', () => {
      const outsideThresholdDate = new Date(2026, 9, 16, 10, 0, 0); // 4 days ahead (> threshold 3)
      const result = classifyEisenhowerTask(
        {
          storyPoints: 8,
          dueDate: outsideThresholdDate,
          status: TaskStatus.TODO,
        },
        defaultSettings,
        refDate
      );
      expect(result.isUrgent).toBe(false);
      expect(result.autoUrgency).toBe(false);
      expect(result.daysRemaining).toBe(4);
      expect(result.quadrant).toBe('Q2_IMPORTANT_NOT_URGENT');
    });

    it('marks task without due date (null) as not urgent', () => {
      const result = classifyEisenhowerTask(
        {
          storyPoints: 9,
          dueDate: null,
          status: TaskStatus.TODO,
        },
        defaultSettings,
        refDate
      );
      expect(result.isUrgent).toBe(false);
      expect(result.autoUrgency).toBe(false);
      expect(result.daysRemaining).toBeNull();
      expect(result.quadrant).toBe('Q2_IMPORTANT_NOT_URGENT');
    });
  });

  describe('Manual override behavior', () => {
    it('manual priority override does not alter urgency', () => {
      // Automatic: SP=2 -> Not Important; Due=in 2 days -> Urgent
      const result = classifyEisenhowerTask(
        {
          storyPoints: 2,
          dueDate: new Date(2026, 9, 14),
          priorityOverride: PriorityOverride.IMPORTANT,
          status: TaskStatus.TODO,
        },
        defaultSettings,
        refDate
      );
      expect(result.isImportant).toBe(true);
      expect(result.autoImportance).toBe(false);
      expect(result.isPriorityOverridden).toBe(true);
      // Urgency remains unchanged from automatic
      expect(result.isUrgent).toBe(true);
      expect(result.autoUrgency).toBe(true);
      expect(result.isUrgencyOverridden).toBe(false);
      expect(result.quadrant).toBe('Q1_IMPORTANT_URGENT');
    });

    it('manual urgency override does not alter importance', () => {
      // Automatic: SP=8 -> Important; Due=in 10 days -> Not Urgent
      const result = classifyEisenhowerTask(
        {
          storyPoints: 8,
          dueDate: new Date(2026, 9, 22),
          urgencyOverride: UrgencyOverride.URGENT,
          status: TaskStatus.TODO,
        },
        defaultSettings,
        refDate
      );
      expect(result.isImportant).toBe(true);
      expect(result.autoImportance).toBe(true);
      expect(result.isPriorityOverridden).toBe(false);
      // Urgency is overridden
      expect(result.isUrgent).toBe(true);
      expect(result.autoUrgency).toBe(false);
      expect(result.isUrgencyOverridden).toBe(true);
      expect(result.quadrant).toBe('Q1_IMPORTANT_URGENT');
    });

    it('reverting overrides recalculates automatically', () => {
      const overriddenTask = {
        storyPoints: 3,
        dueDate: new Date(2026, 9, 20), // 8 days away -> not urgent
        priorityOverride: PriorityOverride.IMPORTANT,
        urgencyOverride: UrgencyOverride.URGENT,
        status: TaskStatus.TODO,
      };

      const resultOverridden = classifyEisenhowerTask(overriddenTask, defaultSettings, refDate);
      expect(resultOverridden.quadrant).toBe('Q1_IMPORTANT_URGENT');

      // Revert priority override to null
      const resultPriorityReverted = classifyEisenhowerTask(
        { ...overriddenTask, priorityOverride: null },
        defaultSettings,
        refDate
      );
      expect(resultPriorityReverted.isImportant).toBe(false);
      expect(resultPriorityReverted.isPriorityOverridden).toBe(false);
      expect(resultPriorityReverted.isUrgent).toBe(true); // still overridden

      // Revert urgency override to null
      const resultFullyReverted = classifyEisenhowerTask(
        { ...overriddenTask, priorityOverride: null, urgencyOverride: null },
        defaultSettings,
        refDate
      );
      expect(resultFullyReverted.isImportant).toBe(false);
      expect(resultFullyReverted.isUrgent).toBe(false);
      expect(resultFullyReverted.quadrant).toBe('Q4_NOT_IMPORTANT_NOT_URGENT');
    });
  });

  describe('Completed tasks visibility on default matrix', () => {
    it('excludes completed (DONE) tasks from default matrix view', () => {
      const activeTask = classifyEisenhowerTask(
        {
          storyPoints: 9,
          dueDate: new Date(2026, 9, 13),
          status: TaskStatus.IN_PROGRESS,
        },
        defaultSettings,
        refDate
      );
      expect(activeTask.isVisibleOnDefaultMatrix).toBe(true);

      const doneTask = classifyEisenhowerTask(
        {
          storyPoints: 9,
          dueDate: new Date(2026, 9, 13),
          status: TaskStatus.DONE,
        },
        defaultSettings,
        refDate
      );
      expect(doneTask.isVisibleOnDefaultMatrix).toBe(false);
    });
  });
});

