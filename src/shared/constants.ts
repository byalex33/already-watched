import type { Settings } from './types';
export const DEFAULT_SETTINGS: Readonly<Settings> = Object.freeze({
  enabled: true, displayMode: 'badge-dim', threshold: 70,
  useYouTubeProgress: true, applyToShorts: true, showWatchedDate: true, hidePromotionalSections: false, hideHomeShorts: false, hideHomeLivestreams: false, hidePlaylists: false, minimumViews: 0, blockedTitleTerms: []
});
export const VIDEO_PREFIX = 'video:';
export const SETTINGS_KEY = 'settings';
export const STATS_KEY = 'stats';
export const REVISION_KEY = 'historyRevision';
export const ERROR_KEY = 'storageError';

export const FILTERED_PREFIX = 'filtered:';
