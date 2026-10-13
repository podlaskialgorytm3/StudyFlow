import { describe, it, expect } from 'vitest';
import { formatDigitalTime, formatHumanDuration } from '@/lib/utils/formatTime';

describe('formatTime utils', () => {
  it('formats digital time correctly', () => {
    expect(formatDigitalTime(0)).toBe('00:00:00');
    expect(formatDigitalTime(59)).toBe('00:00:59');
    expect(formatDigitalTime(60)).toBe('00:01:00');
    expect(formatDigitalTime(3600)).toBe('01:00:00');
    expect(formatDigitalTime(3665)).toBe('01:01:05');
  });

  it('formats human readable duration correctly', () => {
    expect(formatHumanDuration(0)).toBe('0 min');
    expect(formatHumanDuration(45)).toBe('45 sek');
    expect(formatHumanDuration(120)).toBe('2 min');
    expect(formatHumanDuration(3600)).toBe('1 godz.');
    expect(formatHumanDuration(3660)).toBe('1 godz. 1 min');
  });
});

