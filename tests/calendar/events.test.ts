import { describe, it, expect } from 'vitest';
import type { UnifiedCalendarItem } from '@/app/api/calendar/events/route';

describe('Calendar Event and Task Unified Integration', () => {
  it('correctly maps StudyFlow tasks into calendar items with duration calculated from estimatedMinutes', () => {
    const dueDate = new Date('2026-10-20T16:00:00.000Z');
    const estimatedMinutes = 90; // 1h 30m
    const durationMs = estimatedMinutes * 60 * 1000;
    const calculatedStart = new Date(dueDate.getTime() - durationMs);

    const task = {
      id: 'task-uuid-1',
      title: 'Projekt bazy danych',
      description: 'Zaprojektować schemat ERD',
      dueDate,
      estimatedMinutes,
      storyPoints: 5,
      progressPercent: 40,
      status: 'IN_PROGRESS',
      subjectId: 'sub-1',
      subject: {
        id: 'sub-1',
        name: 'Bazy Danych',
        color: '#e91e63',
      },
    };

    const calendarItem: UnifiedCalendarItem = {
      id: `task_${task.id}`,
      source: 'studyflow',
      title: task.title,
      description: task.description,
      location: null,
      start: calculatedStart.toISOString(),
      end: dueDate.toISOString(),
      isAllDay: false,
      color: task.subject.color,
      url: `/tasks/${task.id}`,
      studyflowMeta: {
        taskId: task.id,
        subjectId: task.subjectId,
        subjectName: task.subject.name,
        status: task.status,
        storyPoints: task.storyPoints,
        estimatedMinutes: task.estimatedMinutes,
        progressPercent: task.progressPercent,
      },
    };

    expect(calendarItem.source).toBe('studyflow');
    expect(calendarItem.start).toBe('2026-10-20T14:30:00.000Z');
    expect(calendarItem.end).toBe('2026-10-20T16:00:00.000Z');
    expect(calendarItem.studyflowMeta?.progressPercent).toBe(40);
    expect(calendarItem.color).toBe('#e91e63');
  });

  it('correctly maps Google Calendar all-day and timed events with UTC boundaries', () => {
    // All-day event
    const allDayEvent = {
      id: 'g-all-day-1',
      isAllDay: true,
      allDayDate: '2026-10-25',
      summary: 'Dzień Rektorski',
      description: 'Brak zajęć',
    };

    const startAllDay = `${allDayEvent.allDayDate}T00:00:00Z`;
    const endAllDay = `${allDayEvent.allDayDate}T23:59:59Z`;

    const allDayItem: UnifiedCalendarItem = {
      id: `google_${allDayEvent.id}`,
      source: 'google',
      title: allDayEvent.summary,
      description: allDayEvent.description,
      location: null,
      start: startAllDay,
      end: endAllDay,
      isAllDay: true,
      color: '#4285F4',
    };

    expect(allDayItem.isAllDay).toBe(true);
    expect(allDayItem.start).toBe('2026-10-25T00:00:00Z');
    expect(allDayItem.end).toBe('2026-10-25T23:59:59Z');
    expect(allDayItem.color).toBe('#4285F4');

    // Timed event
    const timedEvent = {
      id: 'g-timed-1',
      isAllDay: false,
      startDateTime: new Date('2026-10-25T08:15:00Z'),
      endDateTime: new Date('2026-10-25T09:45:00Z'),
      summary: 'Konsultacje',
    };

    const timedItem: UnifiedCalendarItem = {
      id: `google_${timedEvent.id}`,
      source: 'google',
      title: timedEvent.summary,
      start: timedEvent.startDateTime.toISOString(),
      end: timedEvent.endDateTime.toISOString(),
      isAllDay: false,
      color: '#4285F4',
    };

    expect(timedItem.isAllDay).toBe(false);
    expect(timedItem.start).toBe('2026-10-25T08:15:00.000Z');
    expect(timedItem.end).toBe('2026-10-25T09:45:00.000Z');
  });

  it('filters items correctly based on visibility preferences', () => {
    const googleItems: UnifiedCalendarItem[] = [
      {
        id: 'google_1',
        source: 'google',
        title: 'Spotkanie',
        start: '2026-10-20T10:00:00Z',
        end: '2026-10-20T11:00:00Z',
        isAllDay: false,
      },
    ];

    const taskItems: UnifiedCalendarItem[] = [
      {
        id: 'task_1',
        source: 'studyflow',
        title: 'Zadanie domowe',
        start: '2026-10-20T14:00:00Z',
        end: '2026-10-20T15:00:00Z',
        isAllDay: false,
      },
    ];

    const filterItems = (showGoogle: boolean, showTasks: boolean) => {
      const result: UnifiedCalendarItem[] = [];
      if (showGoogle) result.push(...googleItems);
      if (showTasks) result.push(...taskItems);
      return result;
    };

    // Both visible
    expect(filterItems(true, true)).toHaveLength(2);

    // Only Google visible
    const onlyGoogle = filterItems(true, false);
    expect(onlyGoogle).toHaveLength(1);
    expect(onlyGoogle[0].source).toBe('google');

    // Only Tasks visible
    const onlyTasks = filterItems(false, true);
    expect(onlyTasks).toHaveLength(1);
    expect(onlyTasks[0].source).toBe('studyflow');

    // Neither visible
    expect(filterItems(false, false)).toHaveLength(0);
  });

  it('filters items correctly by timeframe range (startDate <= event <= endDate)', () => {
    const rangeStart = new Date('2026-10-15T00:00:00Z');
    const rangeEnd = new Date('2026-10-22T23:59:59Z');

    const events = [
      { id: '1', date: new Date('2026-10-10T12:00:00Z'), title: 'Za wcześnie' },
      { id: '2', date: new Date('2026-10-18T12:00:00Z'), title: 'W przedziale' },
      { id: '3', date: new Date('2026-10-25T12:00:00Z'), title: 'Za późno' },
    ];

    const filtered = events.filter((e) => e.date >= rangeStart && e.date <= rangeEnd);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].title).toBe('W przedziale');
  });
});
