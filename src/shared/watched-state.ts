import type { Settings, VideoRecord } from './types';
import { meetsThreshold } from './progress';
export function isWatched(record: VideoRecord | undefined, hint: number | null, shorts: boolean, settings: Settings): boolean {
  if (!settings.enabled || (shorts && !settings.applyToShorts)) return false;
  if (record?.watched) return true;
  if (record?.unwatchedOverride) return false;
  return settings.useYouTubeProgress && hint !== null && meetsThreshold(hint, settings.threshold);
}
