import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Repository } from '../src/background/repository';
import { DEFAULT_SETTINGS, REVISION_KEY, STATS_KEY } from '../src/shared/constants';
import type { Summary, VideoRecord } from '../src/shared/types';
import { videoKey } from '../src/storage/watched-store';
const id = 'dQw4w9WgXcQ';
let data: Record<string, unknown>;
let set: ReturnType<typeof vi.fn>;
let repository: Repository;
beforeEach(() => {
  data = {};
  set = vi.fn(async (values: Record<string, unknown>) => { Object.assign(data, structuredClone(values)); });
  vi.stubGlobal('chrome', { storage: { local: {
    get: vi.fn(async (keys: string | string[] | null) => structuredClone(keys === null ? data : Object.fromEntries((typeof keys === 'string' ? [keys] : keys).filter(key => key in data).map(key => [key, data[key]])))),
    set, remove: vi.fn(async (keys: string[]) => { keys.forEach(key => { delete data[key]; }); }),
    getBytesInUse: vi.fn(async () => JSON.stringify(data).length)
  } } });
  repository = new Repository();
});
describe('single-writer repository', () => {
  it('counts late observations on their original day and deduplicates across restarts', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 6, 0, 0, 1));
    try {
      await repository.dispatch({ type: 'filtered', videoIds: [id], revision: 0, day: '2026-09-05' });
      expect(await repository.dispatch({ type: 'summary' })).toMatchObject({ filteredToday: 0, filteredAllTime: 1 });
      await repository.dispatch({ type: 'filtered', videoIds: [id], revision: 0, day: '2026-09-06' });
      repository = new Repository();
      await repository.dispatch({ type: 'filtered', videoIds: [id], revision: 0, day: '2026-09-05' });
      expect(await repository.dispatch({ type: 'summary' })).toMatchObject({ filteredToday: 1, filteredAllTime: 2 });
      await repository.dispatch({ type: 'clear' });
      expect(Object.keys(data).filter(key => key.startsWith('filtered:'))).toEqual([]);
    } finally { vi.useRealTimers(); }
  });

  it('preserves legacy daily deduplication when the first new-format batch is from another day', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 8, 6, 0, 0, 1));
    try {
      data[STATS_KEY] = { day: '2026-09-05', filteredIds: [id], filteredAllTime: 1, totalMarked: 0 };
      await repository.dispatch({ type: 'filtered', videoIds: ['abcdefghijk'], revision: 0, day: '2026-09-06' });
      await repository.dispatch({ type: 'filtered', videoIds: [id], revision: 0, day: '2026-09-05' });
      expect(await repository.dispatch({ type: 'summary' })).toMatchObject({ filteredToday: 1, filteredAllTime: 2 });
    } finally { vi.useRealTimers(); }
  });
  it('serializes simultaneous tabs and persists only individual changed records', async () => {
    await Promise.all([
      repository.dispatch({ type: 'progress', videoId: id, duration: 100, segments: [[0, 40]], revision: 0 }),
      repository.dispatch({ type: 'progress', videoId: id, duration: 100, segments: [[40, 80]], revision: 0 })
    ]);
    expect(data[videoKey(id)]).toMatchObject({ watched: true, progress: .8 });
    expect(data[STATS_KEY]).toMatchObject({ totalMarked: 1 });
    expect(set.mock.calls.every(call => !('watchedVideos' in call[0]))).toBe(true);
  });
  it('survives a worker restart and deduplicates filter stats across tabs', async () => {
    await repository.dispatch({ type: 'filtered', videoIds: [id, id], revision: 0 });
    repository = new Repository();
    await repository.dispatch({ type: 'filtered', videoIds: [id], revision: 0 });
    expect(await repository.dispatch({ type: 'summary' })).toMatchObject({ filteredToday: 1, filteredAllTime: 1 });
  });
  it('imports without fabricated watched dates and respects explicit unwatched overrides', async () => {
    const videos = [{ videoId: id, progress: .9 }];
    expect(await repository.dispatch({ type: 'import', videos: [...videos, ...videos], revision: 0 })).toEqual({ imported: 1 });
    expect(data[videoKey(id)]).toMatchObject({ source: 'youtube-ui', watched: true });
    expect((data[videoKey(id)] as VideoRecord).watchedAt).toBeUndefined();
    await repository.dispatch({ type: 'mark', videoId: id, watched: false });
    expect(data[videoKey(id)]).toMatchObject({ watched: false, unwatchedOverride: true, segments: [] });
    expect(await repository.dispatch({ type: 'import', videos, revision: 1 })).toEqual({ imported: 0 });
  });
  it('reset preserves settings and rejects queued pre-reset playback', async () => {
    await repository.dispatch({ type: 'settings', settings: { ...DEFAULT_SETTINGS, threshold: 80 } });
    await repository.dispatch({ type: 'mark', videoId: id, watched: true });
    await repository.dispatch({ type: 'clear' });
    expect(await repository.dispatch({ type: 'progress', videoId: id, duration: 100, segments: [[0, 90]], revision: 0 })).toEqual({ stale: true });
    const summary = await repository.dispatch({ type: 'summary' }) as Summary;
    expect(summary.watchedCount).toBe(0);
    expect(summary.totalMarked).toBe(0);
    expect(summary.settings.threshold).toBe(80);
    expect(data[REVISION_KEY]).toBe(1);
  });
  it('manual unwatched invalidates old progress and allows freshly observed playback', async () => {
    await repository.dispatch({ type: 'mark', videoId: id, watched: false });
    expect(await repository.dispatch({ type: 'progress', videoId: id, duration: 100, segments: [[0, 90]], revision: 0 })).toEqual({ stale: true });
    await repository.dispatch({ type: 'progress', videoId: id, duration: 100, segments: [[0, 80]], revision: 1 });
    expect(data[videoKey(id)]).toMatchObject({ watched: true, unwatchedOverride: false, source: 'playback' });
  });
  it('does not save automatic playback while disabled', async () => {
    await repository.dispatch({ type: 'settings', settings: { ...DEFAULT_SETTINGS, enabled: false } });
    await repository.dispatch({ type: 'progress', videoId: id, duration: 100, segments: [[0, 90]], revision: 0 });
    expect(data[videoKey(id)]).toBeUndefined();
  });
  it('surfaces storage failures and recovers without poisoning the write queue', async () => {
    set.mockRejectedValueOnce(new Error('QUOTA_BYTES exceeded'));
    await expect(repository.dispatch({ type: 'mark', videoId: id, watched: true })).rejects.toThrow('QUOTA');
    expect(await repository.dispatch({ type: 'summary' })).toMatchObject({ error: expect.stringContaining('could not be saved') });
    await repository.dispatch({ type: 'mark', videoId: id, watched: true });
    expect(await repository.dispatch({ type: 'summary' })).toMatchObject({ watchedCount: 1, error: undefined });
  });
});
