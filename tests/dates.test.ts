import { describe, expect, it } from 'vitest';
import { formatWatchedDate } from '../src/shared/date';

describe('watched calendar dates', () => {
  it('uses the previous calendar day across midnight', () => {
    expect(formatWatchedDate(new Date(2026, 8, 5, 23, 30).getTime(), new Date(2026, 8, 6, 0, 30).getTime())).toBe('Yesterday');
  });
  it('does not call two calendar days ago yesterday', () => {
    expect(formatWatchedDate(new Date(2026, 8, 4, 23, 30).getTime(), new Date(2026, 8, 6, 0, 30).getTime())).toBe('2 days ago');
  });
  it('uses local dates across short and long daylight-saving days', () => {
    for (const [month, day, minutes] of [[2, 29, 1370], [9, 25, 1490]] as const) {
      const watched = new Date(2026, month, day, 0, 15).getTime();
      const now = new Date(2026, month, day + 1, 0, 5).getTime();
      expect((now - watched) / 60_000).toBe(minutes);
      expect(formatWatchedDate(watched, now)).toBe('Yesterday');
    }
  });
  it('calls a long autumn calendar day Today even after 24 elapsed hours', () => {
    expect(formatWatchedDate(new Date(2026, 9, 25, 0).getTime(), new Date(2026, 9, 25, 23, 50).getTime())).toBe('Today');
  });
  it('keeps same-day and invalid timestamp behavior', () => {
    const now = new Date(2026, 8, 6, 20).getTime();
    expect(formatWatchedDate(new Date(2026, 8, 6, 1).getTime(), now)).toBe('Today');
    expect(formatWatchedDate(undefined, now)).toBeNull();
    expect(formatWatchedDate(NaN, now)).toBeNull();
    expect(formatWatchedDate(now + 1, now)).toBeNull();
  });
});
