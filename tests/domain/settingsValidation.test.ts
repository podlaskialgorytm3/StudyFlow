import { describe, it, expect } from 'vitest';
import { settingsSchema } from '@/lib/validation/schemas';
import { z } from 'zod';

const updateGoogleAccountSchema = z.object({
  selectedCalendarId: z.string().trim().min(1).optional(),
  selectedCalendarName: z.string().trim().optional(),
  syncFrequencyHours: z.number().int().refine((val) => [1, 3, 6].includes(val), {
    message: 'Częstotliwość musi wynosić 1, 3 lub 6 godzin',
  }).optional(),
});

describe('Calendar Settings and Account Validation', () => {
  it('validates settingsSchema with calendar visibility toggles', () => {
    const validSettings = {
      importantStoryPointsThreshold: 8,
      urgentWithinDays: 3,
      taskHorizonDays: 7,
      calendarShowGoogleEvents: true,
      calendarShowStudyFlowTasks: false,
    };

    const result = settingsSchema.safeParse(validSettings);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.calendarShowGoogleEvents).toBe(true);
      expect(result.data.calendarShowStudyFlowTasks).toBe(false);
    }
  });

  it('allows optional calendar toggles with default fallback', () => {
    const minimalSettings = {
      importantStoryPointsThreshold: 5,
      urgentWithinDays: 2,
      taskHorizonDays: 14,
    };

    const result = settingsSchema.safeParse(minimalSettings);
    expect(result.success).toBe(true);
  });

  it('accepts valid sync frequencies: 1, 3, or 6 hours', () => {
    for (const freq of [1, 3, 6]) {
      const parsed = updateGoogleAccountSchema.safeParse({ syncFrequencyHours: freq });
      expect(parsed.success).toBe(true);
    }
  });

  it('rejects invalid sync frequencies (e.g. 0, 2, 4, 12, -1)', () => {
    for (const invalidFreq of [-1, 0, 2, 4, 5, 12, 24]) {
      const parsed = updateGoogleAccountSchema.safeParse({ syncFrequencyHours: invalidFreq });
      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        expect(parsed.error.errors[0]?.message).toBe('Częstotliwość musi wynosić 1, 3 lub 6 godzin');
      }
    }
  });

  it('validates selected calendar ID updates', () => {
    const valid = updateGoogleAccountSchema.safeParse({
      selectedCalendarId: 'c_abc123@group.calendar.google.com',
      selectedCalendarName: 'Uczelnia i Zajęcia',
    });
    expect(valid.success).toBe(true);

    const emptyId = updateGoogleAccountSchema.safeParse({
      selectedCalendarId: '   ',
    });
    expect(emptyId.success).toBe(false);
  });
});

