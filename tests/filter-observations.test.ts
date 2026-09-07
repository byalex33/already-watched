import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { FilterObservations } from '../src/content/filter-observations';
import { validRequest } from '../src/background/validation';
const id = 'dQw4w9WgXcQ';
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 8, 5, 23, 59, 59)); });
afterEach(() => vi.useRealTimers());
it('preserves an observation when its card disappears before the first tick after midnight', () => {
  const observations = new FilterObservations();
  observations.observe(id);
  vi.setSystemTime(new Date(2026, 8, 6, 0, 0, 4));
  expect(observations.take()).toEqual({ day: '2026-09-05', videoIds: [id] });
  expect(observations.take()).toBeUndefined();
});
it('retries the original day independently of new-day observations', () => {
  const observations = new FilterObservations();
  observations.observe(id); observations.observe(id);
  const old = observations.take()!;
  vi.setSystemTime(new Date(2026, 8, 6, 0, 0, 4));
  observations.observe(id); observations.restore(old);
  expect([observations.take(), observations.take()]).toEqual([
    { day: '2026-09-06', videoIds: [id] }, { day: '2026-09-05', videoIds: [id] }
  ]);
  observations.observe(id); expect(observations.take()).toBeUndefined();
  observations.clear(); observations.observe(id);
  expect(observations.take()).toEqual({ day: '2026-09-06', videoIds: [id] });
});
it('batches without losing overflow', () => {
  const observations = new FilterObservations();
  observations.observe(id); observations.observe('abcdefghijk');
  expect(observations.take(1)?.videoIds).toEqual([id]);
  expect(observations.take(1)?.videoIds).toEqual(['abcdefghijk']);
});
it('validates observation dates without throwing for invalid calendar input', () => {
  for (const day of ['2026-02-30', '2026-99-99', '../bad', null]) {
    expect(validRequest({ type: 'filtered', videoIds: [id], revision: 0, day })).toBe(false);
  }
  expect(validRequest({ type: 'filtered', videoIds: [id], revision: 0, day: '2026-09-05' })).toBe(true);
  expect(validRequest({ type: 'filtered', videoIds: [id], revision: 0 })).toBe(true);
});

it('accepts a retained batch when the local date rolls back before it is sent', () => {
  vi.setSystemTime(new Date(2026, 8, 6, 0, 0, 4));
  const observations = new FilterObservations();
  observations.observe(id);
  vi.setSystemTime(new Date(2026, 8, 5, 23, 59, 59));
  const batch = observations.take()!;
  expect(batch.day).toBe('2026-09-06');
  expect(validRequest({ type: 'filtered', ...batch, revision: 0 })).toBe(true);
});
