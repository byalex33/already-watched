import { isVideoId } from '../youtube/video-id';
import type { Request } from '../shared/types';
export function validRequest(input: unknown): input is Request {
  if (!input || typeof input !== 'object') return false;
  const v = input as Record<string, unknown>;
  const title = (x: unknown): boolean => x === undefined || (typeof x === 'string' && x.length <= 500);
  const observationDay = (): boolean => {
    if (v.day === undefined) return true;
    // A retained observation may be ahead of the clock after a local-date rollback.
    if (typeof v.day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v.day)) return false;
    const date = new Date(v.day + 'T12:00:00Z');
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === v.day;
  };
  const revision = (): boolean => typeof v.revision === 'number' && Number.isSafeInteger(v.revision) && v.revision >= 0;
  switch (v.type) {
    case 'snapshot': case 'summary': case 'clear': return true;
    case 'settings': return !!v.settings && typeof v.settings === 'object';
    case 'mark': return isVideoId(v.videoId) && typeof v.watched === 'boolean' && title(v.title);
    case 'progress': return isVideoId(v.videoId) && title(v.title) && revision()
      && typeof v.duration === 'number' && Number.isFinite(v.duration) && v.duration > 0
      && Array.isArray(v.segments) && v.segments.length <= 128
      && v.segments.every(s => Array.isArray(s) && s.length === 2 && s.every(n => typeof n === 'number' && Number.isFinite(n)) && s[0] >= 0 && s[1] > s[0] && s[1] <= (v.duration as number));
    case 'touch': case 'filtered': return (v.type !== 'filtered' || observationDay()) && revision() && Array.isArray(v.videoIds) && v.videoIds.length <= 500 && v.videoIds.every(isVideoId);
    case 'import': return revision() && Array.isArray(v.videos) && v.videos.length <= 500 && v.videos.every(item => {
      if (!item || typeof item !== 'object') return false;
      const video = item as Record<string, unknown>;
      return isVideoId(video.videoId) && title(video.title) && typeof video.progress === 'number' && Number.isFinite(video.progress) && video.progress > 0 && video.progress <= 1;
    });
    default: return false;
  }
}
