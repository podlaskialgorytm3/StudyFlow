import { describe, it, expect } from 'vitest';
import { selectFocusTopTasks } from '@/lib/domain/focusMode';
import { TaskItem } from '@/components/Tasks/TaskFormDialog';
import { EisenhowerSettings } from '@/lib/domain/eisenhower';
import { TaskStatus } from '@prisma/client';

describe('Focus Mode Top 3 Selection Algorithm', () => {
  const settings: EisenhowerSettings = {
    importantStoryPointsThreshold: 6,
    urgentWithinDays: 3,
  };

  const refDate = new Date('2026-10-14T10:00:00Z');

  const createTask = (
    id: string,
    title: string,
    storyPoints: number,
    dueDate: string | null,
    status: TaskStatus = TaskStatus.TODO
  ): TaskItem => ({
    id,
    subjectId: 'sub-1',
    title,
    storyPoints,
    dueDate,
    status,
    subject: { id: 'sub-1', name: 'Informatyka', color: '#1976d2' },
  });

  it('excludes completed tasks (DONE)', () => {
    const tasks = [
      createTask('1', 'Zadanie zrobione', 8, '2026-10-14T12:00:00Z', TaskStatus.DONE),
      createTask('2', 'Zadanie aktywne', 3, '2026-10-15T12:00:00Z', TaskStatus.TODO),
    ];

    const top = selectFocusTopTasks(tasks, settings, [], refDate);
    expect(top).toHaveLength(1);
    expect(top[0].id).toBe('2');
  });

  it('excludes tasks skipped for today', () => {
    const tasks = [
      createTask('1', 'Zadanie pilne 1', 5, '2026-10-14T12:00:00Z'),
      createTask('2', 'Zadanie pilne 2', 5, '2026-10-14T12:00:00Z'),
    ];

    const top = selectFocusTopTasks(tasks, settings, ['1'], refDate);
    expect(top).toHaveLength(1);
    expect(top[0].id).toBe('2');
  });

  it('prioritizes overdue tasks and tasks due today over future tasks', () => {
    const tasks = [
      createTask('future', 'Zadanie za 5 dni', 8, '2026-10-19T12:00:00Z'),
      createTask('today', 'Zadanie na dziś', 3, '2026-10-14T12:00:00Z'),
      createTask('overdue', 'Zadanie przeterminowane', 4, '2026-10-12T12:00:00Z'),
    ];

    const top = selectFocusTopTasks(tasks, settings, [], refDate);
    expect(top).toHaveLength(3);
    expect(top[0].id).toBe('overdue');
    expect(top[1].id).toBe('today');
    expect(top[2].id).toBe('future');
  });

  it('prioritizes important and urgent tasks (Q1) over low-urgency tasks', () => {
    const tasks = [
      createTask('low-urgent', 'Niski priorytet', 2, '2026-10-25T12:00:00Z'),
      createTask('q1-task', 'Ważne i pilne (Q1)', 8, '2026-10-16T12:00:00Z'), // SP >= 6, days = 2 <= 3
      createTask('q2-task', 'Ważne i niepilne (Q2)', 8, '2026-10-24T12:00:00Z'), // SP >= 6, days = 10 > 3
    ];

    const top = selectFocusTopTasks(tasks, settings, [], refDate);
    expect(top[0].id).toBe('q1-task');
  });

  it('prioritizes in-progress tasks when priority tier is similar', () => {
    const tasks = [
      createTask('todo-1', 'Zadanie nowe', 5, '2026-10-16T12:00:00Z', TaskStatus.TODO),
      createTask('in-prog-1', 'Zadanie rozpoczęte', 5, '2026-10-16T12:00:00Z', TaskStatus.IN_PROGRESS),
    ];

    const top = selectFocusTopTasks(tasks, settings, [], refDate);
    expect(top[0].id).toBe('in-prog-1');
  });

  it('limits results to maximum of 3 tasks', () => {
    const tasks = [
      createTask('1', 'Zadanie 1', 5, '2026-10-15T12:00:00Z'),
      createTask('2', 'Zadanie 2', 5, '2026-10-16T12:00:00Z'),
      createTask('3', 'Zadanie 3', 5, '2026-10-17T12:00:00Z'),
      createTask('4', 'Zadanie 4', 5, '2026-10-18T12:00:00Z'),
      createTask('5', 'Zadanie 5', 5, '2026-10-19T12:00:00Z'),
    ];

    const top = selectFocusTopTasks(tasks, settings, [], refDate);
    expect(top).toHaveLength(3);
  });

  it('returns empty array when no active tasks are available', () => {
    expect(selectFocusTopTasks([], settings, [], refDate)).toEqual([]);
  });
});

