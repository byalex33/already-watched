import { VIDEO_PREFIX } from '../shared/constants';
import { mergeSegments, meetsThreshold, watchedFraction } from '../shared/progress';
import type { Segment, VideoRecord } from '../shared/types';
import { isVideoId } from '../youtube/video-id';
export const videoKey = (id: string): string => `${VIDEO_PREFIX}${id}`;
export function isVideoRecord(value: unknown): value is VideoRecord {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return isVideoId(v.videoId) && typeof v.watched === 'boolean' && typeof v.progress === 'number'
    && Number.isFinite(v.progress) && v.progress >= 0 && v.progress <= 1 && typeof v.lastSeen === 'number'
    && ['playback', 'manual', 'youtube-ui'].includes(String(v.source));
}
export function readRecords(data: Record<string, unknown>): Record<string, VideoRecord> {
  const records: Record<string, VideoRecord> = {};
  for (const [key, value] of Object.entries(data)) {
    if (key.startsWith(VIDEO_PREFIX) && isVideoRecord(value)) records[value.videoId] = value;
  }
  return records;
}
export async function getRecord(id: string): Promise<VideoRecord | undefined> {
  const data = await chrome.storage.local.get(videoKey(id));
  const record: unknown = data[videoKey(id)];
  return isVideoRecord(record) ? record : undefined;
}
export function playbackRecord(previous: VideoRecord | undefined, input: { videoId: string; title?: string; segments: Segment[]; duration: number }, threshold: number, now = Date.now()): VideoRecord {
  const segments = mergeSegments([...(previous?.segments ?? []), ...input.segments], input.duration);
  const progress = watchedFraction(segments, input.duration);
  const watched = previous?.watched === true || meetsThreshold(progress, threshold);
  return {
    ...previous, videoId: input.videoId, title: input.title || previous?.title,
    segments, progress: Math.max(previous?.progress ?? 0, progress),
    watched, watchedAt: previous?.watchedAt ?? (watched && meetsThreshold(progress, threshold) ? now : undefined),
    source: meetsThreshold(progress, threshold) ? 'playback' : previous?.source ?? 'playback',
    unwatchedOverride: watched ? false : previous?.unwatchedOverride,
    lastSeen: now
  };
}
