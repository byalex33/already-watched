import type { Settings } from './types';
export const DEFAULT_SETTINGS: Readonly<Settings> = Object.freeze({
  enabled: true, displayMode: 'badge-dim', threshold: 70,
  useYouTubeProgress: true, applyToShorts: true, showWatchedDate: true, hidePromotionalSections: false, hideHomeShorts: false, hideSearchShorts: true, hideWatchedInSearch: false, hideHomeLivestreams: false, hidePlaylists: false, minimumViews: 0, blockedTitleTerms: [], hideRepeatsAfter: 0, channelCap: 0
});
export const VIDEO_PREFIX = 'video:';
export const SETTINGS_KEY = 'settings';
export const STATS_KEY = 'stats';
export const REVISION_KEY = 'historyRevision';
export const ERROR_KEY = 'storageError';

export const FILTERED_PREFIX = 'filtered:';
export const IMPRESSION_PREFIX = 'impression:';
export const HOME_STATS_KEY = 'homeStats';
// Home impressions are forgotten after this long, so old videos can return.
export const IMPRESSION_TTL_MS = 30 * 86_400_000;
