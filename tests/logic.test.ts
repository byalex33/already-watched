import { describe, expect, it } from 'vitest';
import { extractVideoId, currentPlaybackId, parseVideoUrl } from '../src/youtube/video-id';
import { mergeSegments, meetsThreshold, watchedFraction } from '../src/shared/progress';
import { isWatched } from '../src/shared/watched-state';
import { formatWatchedDate, localDay } from '../src/shared/date';
import { DEFAULT_SETTINGS } from '../src/shared/constants';
import { normalizeSettings } from '../src/storage/settings-store';
import { addFiltered, emptyStats } from '../src/storage/stats-store';
import { playbackRecord } from '../src/storage/watched-store';
import { validRequest } from '../src/background/validation';
const id = 'dQw4w9WgXcQ';
describe('YouTube URLs', () => {
  it.each([
    [`https://www.youtube.com/watch?v=${id}`, id], [`/watch?list=PLabc&v=${id}&t=90s&index=3`, id],
    [`https://youtu.be/${id}?si=abc`, id], [`https://www.youtube.com/shorts/${id}?feature=share`, id],
    [`https://m.youtube.com/watch?v=${id}`, id], [`/live/${id}`, id], [`/embed/${id}`, id],
    ['/playlist?list=PL123', null], ['/watch?v=short', null], ['/watch?v=dQw4w9WgXcQextra', null],
    [`https://youtube.com.evil.test/watch?v=${id}`, null], [`javascript://youtube.com/watch?v=${id}`, null],
    [`https://evil.test/watch?v=${id}`, null], [`https://youtube.com@evil.test/watch?v=${id}`, null], ['%bad', null]
  ])('parses %s', (url, expected) => expect(extractVideoId(url!)).toBe(expected));
  it('distinguishes Shorts and only tracks playback routes', () => {
    expect(parseVideoUrl(`/shorts/${id}`)?.shorts).toBe(true);
    expect(currentPlaybackId(`https://www.youtube.com/embed/${id}`)).toBeNull();
    expect(currentPlaybackId('https://www.youtube.com/results?search_query=cats')).toBeNull();
  });
});
describe('observed watch progress', () => {
  it('merges overlaps, keeps skips, and never double-counts replays', () => {
    expect(mergeSegments([[0, 20], [10, 30], [60, 80], [60, 75]], 100)).toEqual([[0, 30], [60, 80]]);
    expect(watchedFraction([[0, 30], [60, 80]], 100)).toBe(.5);
  });
  it('does not credit a restored starting offset', () => expect(watchedFraction([[80, 90]], 100)).toBe(.1));
  it.each([0, NaN, Infinity, -10])('rejects unusable duration %s', duration => expect(watchedFraction([[0, 70]], duration)).toBe(0));
  it('clamps segments and bounds fragmentation without inventing playback', () => {
    expect(watchedFraction([[-10, 1000]], 100)).toBe(1);
    const segments = mergeSegments(Array.from({ length: 200 }, (_, i) => [i * 2, i * 2 + 1]), 400);
    expect(segments).toHaveLength(128);
    expect(watchedFraction(segments, 400)).toBe(.32);
  });
  it('uses the threshold inclusively', () => {
    expect(meetsThreshold(.7, 70)).toBe(true);
    expect(meetsThreshold(.699, 70)).toBe(false);
    expect(meetsThreshold(1, 100)).toBe(true);
    expect(meetsThreshold(NaN, 70)).toBe(false);
  });
  it('preserves first watched date and merges sessions', () => {
    const first = playbackRecord(undefined, { videoId: id, duration: 100, segments: [[0, 50]] }, 70, 1000);
    expect(first.watched).toBe(false);
    const second = playbackRecord(first, { videoId: id, duration: 100, segments: [[50, 75]] }, 70, 2000);
    const third = playbackRecord(second, { videoId: id, duration: 100, segments: [[75, 90]] }, 70, 3000);
    expect(third).toMatchObject({ watched: true, progress: .9, watchedAt: 2000, lastSeen: 3000 });
  });
});
describe('watched decisions and settings', () => {
  const record = playbackRecord(undefined, { videoId: id, duration: 100, segments: [[0, 80]] }, 70);
  it('uses gentle defaults and recovers malformed settings', () => {
    expect(normalizeSettings(undefined)).toEqual(DEFAULT_SETTINGS);
    expect(DEFAULT_SETTINGS).toMatchObject({ threshold: 70, displayMode: 'badge-dim', enabled: true });
    expect(normalizeSettings({ threshold: 200, displayMode: 'invalid' })).toMatchObject({ threshold: 100, displayMode: 'badge-dim' });
    expect(normalizeSettings({ threshold: NaN }).threshold).toBe(70);
  });
  it('combines history and hints while respecting overrides and toggles', () => {
    expect(isWatched(record, null, false, DEFAULT_SETTINGS)).toBe(true);
    expect(isWatched(undefined, .8, false, DEFAULT_SETTINGS)).toBe(true);
    expect(isWatched(undefined, .2, false, DEFAULT_SETTINGS)).toBe(false);
    expect(isWatched({ ...record, watched: false, unwatchedOverride: true }, 1, false, DEFAULT_SETTINGS)).toBe(false);
    expect(isWatched(record, 1, false, { ...DEFAULT_SETTINGS, enabled: false })).toBe(false);
    expect(isWatched(record, 1, true, { ...DEFAULT_SETTINGS, applyToShorts: false })).toBe(false);
    expect(isWatched(undefined, 1, false, { ...DEFAULT_SETTINGS, useYouTubeProgress: false })).toBe(false);
  });
});
describe('dates and counters', () => {
  const now = new Date(2026, 8, 5, 12).getTime();
  it('never invents a watch date', () => {
    expect(formatWatchedDate(undefined, now)).toBeNull();
    expect(formatWatchedDate(now + 1000, now)).toBeNull();
    expect(formatWatchedDate(now, now)).toBe('Today');
    expect(formatWatchedDate(now - 3 * 86400000, now)).toBe('3 days ago');
    expect(formatWatchedDate(new Date(2026, 7, 12).getTime(), now)).toBe('12 Aug 2026');
  });
  it('deduplicates IDs within and across batches, resetting at local midnight', () => {
    let stats = addFiltered(emptyStats(now), [id, id], now);
    stats = addFiltered(stats, [id], now);
    expect(stats.filteredAllTime).toBe(1);
    expect(stats.filteredIds).toEqual([id]);
    stats = addFiltered(stats, [id], now + 86400000);
    expect(stats.filteredAllTime).toBe(2);
    expect(stats.filteredIds).toEqual([id]);
    expect(stats.day).toBe(localDay(now + 86400000));
  });
});
it('rejects malformed and excessive messages at the worker boundary', () => {
  expect(validRequest({ type: 'progress', videoId: id, duration: Infinity, segments: [[0, 80]], revision: 0 })).toBe(false);
  expect(validRequest({ type: 'progress', videoId: id, duration: 100, segments: [[0, 101]], revision: 0 })).toBe(false);
  expect(validRequest({ type: 'filtered', videoIds: Array(501).fill(id), revision: 0 })).toBe(false);
  expect(validRequest({ type: 'mark', videoId: id, watched: true })).toBe(true);
  expect(validRequest({ type: 'unknown' })).toBe(false);
});
