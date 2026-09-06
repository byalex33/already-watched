import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Repository } from '../src/background/repository';
import { DEFAULT_SETTINGS, REVISION_KEY, STATS_KEY } from '../src/shared/constants';
import type { Summary, VideoRecord } from '../src/shared/types';
import { videoKey } from '../src/storage/watched-store';
const id = 'dQw4w9WgXcQ';
let data: Record<string, unknown>;
let sessionData: Record<string, unknown>;
let set: ReturnType<typeof vi.fn>;
let repository: Repository;
beforeEach(() => {
  data = {}; sessionData = {};
  set = vi.fn(async (values: Record<string, unknown>) => { Object.assign(data, structuredClone(values)); });
  vi.stubGlobal('chrome', { storage: { session: {
    get: vi.fn(async (key: string) => structuredClone(key in sessionData ? { [key]: sessionData[key] } : {})),
    set: vi.fn(async (values: Record<string, unknown>) => { Object.assign(sessionData, structuredClone(values)); }),
    remove: vi.fn(async (key: string) => { delete sessionData[key]; })
  }, local: {
    get: vi.fn(async (keys: string | string[] | null) => structuredClone(keys === null ? data : Object.fromEntries((typeof keys === 'string' ? [keys] : keys).filter(key => key in data).map(key => [key, data[key]])))),
    set, remove: vi.fn(async (keys: string[]) => { keys.forEach(key => { delete data[key]; }); }),
    getBytesInUse: vi.fn(async () => JSON.stringify(data).length)
  } } });
  repository = new Repository();
});
describe('single-writer repository', () => {
  it('clears a full profile before its first history revision has been stored', async () => {
    data.settings = { ...DEFAULT_SETTINGS, threshold: 85 };
    data[videoKey(id)] = { videoId: id, watched: false, progress: .5, source: 'playback', lastSeen: Date.now(), title: 'x'.repeat(1000) };
    const bytes = (values: Record<string, unknown>): number => Object.entries(values).reduce((sum, [key, value]) => sum + key.length + JSON.stringify(value).length, 0);
    const quota = bytes(data);
    set.mockImplementation(async values => {
      if (bytes({ ...data, ...values }) > quota) throw new Error('QUOTA_BYTES exceeded');
      Object.assign(data, structuredClone(values));
    });
    await repository.dispatch({ type: 'clear' });
    expect(data[videoKey(id)]).toBeUndefined();
    expect(data[REVISION_KEY]).toBe(1);
    expect((await repository.dispatch({ type: 'summary' }) as Summary).settings.threshold).toBe(85);
    expect(await repository.dispatch({ type: 'progress', videoId: id, duration: 100, segments: [[0, 90]], revision: 0 })).toEqual({ stale: true });
  });
  it('finishes an interrupted clear after the worker restarts before accepting stale playback', async () => {
    await repository.dispatch({ type: 'mark', videoId: id, watched: true });
    vi.mocked(chrome.storage.local.remove).mockRejectedValueOnce(new Error('Interrupted'));
    await expect(repository.dispatch({ type: 'clear' })).rejects.toThrow('Interrupted');
    repository = new Repository();
    expect(await repository.dispatch({ type: 'progress', videoId: id, duration: 100, segments: [[0, 90]], revision: 0 })).toEqual({ stale: true });
    expect(data[videoKey(id)]).toBeUndefined();
    expect(sessionData).toEqual({});
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
