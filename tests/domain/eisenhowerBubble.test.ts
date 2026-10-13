import { describe, it, expect } from 'vitest';
import {
  getBubbleRadius,
  getTaskInitials,
  getContrastTextColor,
} from '@/components/Eisenhower/EisenhowerBubbleView';

describe('Eisenhower Bubble View Utilities', () => {
  describe('getBubbleRadius', () => {
    it('calculates min radius for 1 Story Point and max radius for 10 Story Points', () => {
      const minRadius = getBubbleRadius(1);
      const maxRadius = getBubbleRadius(10);
      const midRadius = getBubbleRadius(5);

      expect(minRadius).toBe(19);
      expect(maxRadius).toBe(34);
      expect(midRadius).toBeGreaterThan(minRadius);
      expect(midRadius).toBeLessThan(maxRadius);
    });

    it('clamps values below 1 and above 10 gracefully', () => {
      expect(getBubbleRadius(0)).toBe(19);
      expect(getBubbleRadius(-5)).toBe(19);
      expect(getBubbleRadius(15)).toBe(34);
    });
  });

  describe('getTaskInitials', () => {
    it('extracts two uppercase initials from multi-word title', () => {
      expect(getTaskInitials('Kolokwium z analizy')).toBe('KZ');
      expect(getTaskInitials('Algorytmy i struktury danych')).toBe('AI');
      expect(getTaskInitials('Projekt inżynierski')).toBe('PI');
    });

    it('extracts first two letters from single-word title', () => {
      expect(getTaskInitials('Fizyka')).toBe('FI');
      expect(getTaskInitials('Bazy')).toBe('BA');
    });

    it('handles empty or special strings', () => {
      expect(getTaskInitials('')).toBe('??');
    });
  });

  describe('getContrastTextColor', () => {
    it('returns white text for dark or vibrant colors', () => {
      expect(getContrastTextColor('#1976d2')).toBe('#ffffff'); // Blue
      expect(getContrastTextColor('#d32f2f')).toBe('#ffffff'); // Red
      expect(getContrastTextColor('#000000')).toBe('#ffffff'); // Black
      expect(getContrastTextColor('#10b981')).toBe('#ffffff'); // Emerald
    });

    it('returns dark text for very bright colors', () => {
      expect(getContrastTextColor('#ffffff')).toBe('#0f172a'); // White
      expect(getContrastTextColor('#fef08a')).toBe('#0f172a'); // Light yellow
      expect(getContrastTextColor('#e2e8f0')).toBe('#0f172a'); // Light gray
    });
  });
});

