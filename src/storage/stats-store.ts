import { localDay } from '../shared/date';
import { isVideoId } from '../youtube/video-id';
import type { Stats } from '../shared/types';
export function emptyStats(now = Date.now()): Stats {
  return { day: localDay(now), filteredIds: [], filteredAllTime: 0, totalMarked: 0 };
}
export function normalizeStats(value: unknown): Stats {
  if (!value || typeof value !== 'object') return emptyStats();
  const data = value as Record<string, unknown>;
  return {
    day: typeof data.day === 'string' ? data.day : localDay(),
    filteredIds: Array.isArray(data.filteredIds) ? data.filteredIds.filter(isVideoId) : [],
    filteredAllTime: typeof data.filteredAllTime === 'number' ? Math.max(0, data.filteredAllTime) : 0,
    totalMarked: typeof data.totalMarked === 'number' ? Math.max(0, data.totalMarked) : 0
  };
}
export function addFiltered(stats: Stats, videoIds: string[], now = Date.now(), day = localDay(now)): Stats {
  const seen = new Set(stats.day === day ? stats.filteredIds : []);
  const previous = seen.size;
  videoIds.filter(isVideoId).forEach(id => seen.add(id));
  return { ...stats, day, filteredIds: [...seen], filteredAllTime: stats.filteredAllTime + seen.size - previous };
}
