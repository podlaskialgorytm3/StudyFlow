/**
 * Formats seconds into digital timer display HH:MM:SS
 */
export function formatDigitalTime(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;

  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

/**
 * Formats seconds into human-readable Polish duration string.
 * Example: 3665 -> "1 godz. 1 min 5 sek"
 */
export function formatHumanDuration(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  if (safeSeconds === 0) return '0 min';

  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;

  const parts: string[] = [];
  if (hours > 0) {
    parts.push(`${hours} ${hours === 1 ? 'godz.' : 'godz.'}`);
  }
  if (minutes > 0) {
    parts.push(`${minutes} min`);
  }
  if (seconds > 0 && hours === 0) {
    parts.push(`${seconds} sek`);
  }

  return parts.join(' ') || '0 min';
}

