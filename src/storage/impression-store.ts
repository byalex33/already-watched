import { IMPRESSION_PREFIX, IMPRESSION_TTL_MS } from '../shared/constants';
import type { HomeStats, HomeSummary, Impression, ServedVideo } from '../shared/types';
import { isVideoId } from '../youtube/video-id';
export const impressionKey = (id: string): string => `${IMPRESSION_PREFIX}${id}`;
const count = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
export function isImpression(value: unknown): value is Impression {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return isVideoId(v.videoId) && count(v.served) && count(v.shown) && typeof v.lastSeen === 'number' && Number.isFinite(v.lastSeen)
    && (v.title === undefined || typeof v.title === 'string');
}
export function readImpressions(data: Record<string, unknown>): Record<string, Impression> {
  const impressions: Record<string, Impression> = {};
  for (const [key, value] of Object.entries(data)) {
    if (key.startsWith(IMPRESSION_PREFIX) && isImpression(value)) impressions[value.videoId] = value;
  }
  return impressions;
}
export function emptyHomeStats(): HomeStats {
  return { visits: 0, served: 0, distinct: 0, repeats: 0, watched: 0, since: 0 };
}
export function normalizeHomeStats(value: unknown): HomeStats {
  const stats = emptyHomeStats();
  if (!value || typeof value !== 'object') return stats;
  const data = value as Record<string, unknown>;
  for (const key of Object.keys(stats) as (keyof HomeStats)[]) if (count(data[key])) stats[key] = data[key];
  return stats;
}
export function expiredImpressions(impressions: Record<string, Impression>, now = Date.now()): string[] {
  return Object.values(impressions).filter(impression => now - impression.lastSeen > IMPRESSION_TTL_MS).map(impression => impression.videoId);
}
// "Served" means YouTube rendered the video on Home during a visit, whether or not
// a filter hid it. "Shown" means it was actually on screen, unhidden. A repeat is
// a video served on an earlier visit, or one already watched.
export function recordHome(impressions: Record<string, Impression>, stats: HomeStats, batch: { visits: number; served: ServedVideo[]; shown: string[] }, now = Date.now()): { updates: Record<string, Impression>; stats: HomeStats } {
  const updates: Record<string, Impression> = {};
  const next = { ...stats, visits: stats.visits + batch.visits };
  const current = (id: string): Impression => updates[id] ?? impressions[id] ?? { videoId: id, served: 0, shown: 0, lastSeen: now };
  for (const video of batch.served) {
    const previous = current(video.videoId);
    updates[video.videoId] = { ...previous, title: previous.title ?? video.title?.slice(0, 300), served: previous.served + 1, lastSeen: now };
    next.served++;
    if (!previous.served) next.distinct++;
    if (video.watched || previous.served > 0) next.repeats++;
    if (video.watched) next.watched++;
  }
  for (const id of batch.shown) {
    const previous = current(id);
    updates[id] = { ...previous, shown: previous.shown + 1, lastSeen: now };
  }
  if (!next.since && (next.visits || next.served)) next.since = now;
  return { updates, stats: next };
}
export function summarizeHome(impressions: Record<string, Impression>, stats: HomeStats): HomeSummary {
  const top = Object.values(impressions)
    .filter((impression): impression is Impression & { title: string } => impression.served > 1 && !!impression.title)
    .sort((a, b) => b.served - a.served).slice(0, 5)
    .map(({ videoId, title, served }) => ({ videoId, title, served }));
  return { ...stats, top };
}
