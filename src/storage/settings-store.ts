import { DEFAULT_SETTINGS, SETTINGS_KEY } from '../shared/constants';
import type { Settings } from '../shared/types';
export function normalizeSettings(value: unknown): Settings {
  const input = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const mode = input.displayMode;
  return {
    enabled: typeof input.enabled === 'boolean' ? input.enabled : DEFAULT_SETTINGS.enabled,
    displayMode: mode === 'badge' || mode === 'dim' || mode === 'hide' || mode === 'badge-dim' || mode === 'hide-refill' ? mode : DEFAULT_SETTINGS.displayMode,
    threshold: typeof input.threshold === 'number' && Number.isFinite(input.threshold) ? Math.round(Math.max(10, Math.min(100, input.threshold))) : DEFAULT_SETTINGS.threshold,
    useYouTubeProgress: typeof input.useYouTubeProgress === 'boolean' ? input.useYouTubeProgress : DEFAULT_SETTINGS.useYouTubeProgress,
    applyToShorts: typeof input.applyToShorts === 'boolean' ? input.applyToShorts : DEFAULT_SETTINGS.applyToShorts,
    showWatchedDate: typeof input.showWatchedDate === 'boolean' ? input.showWatchedDate : DEFAULT_SETTINGS.showWatchedDate,
    hidePromotionalSections: typeof input.hidePromotionalSections === 'boolean' ? input.hidePromotionalSections : DEFAULT_SETTINGS.hidePromotionalSections,
    hideHomeShorts: typeof input.hideHomeShorts === 'boolean' ? input.hideHomeShorts : DEFAULT_SETTINGS.hideHomeShorts,
    hidePlaylists: typeof input.hidePlaylists === 'boolean' ? input.hidePlaylists : DEFAULT_SETTINGS.hidePlaylists
  };
}
export async function getSettings(): Promise<Settings> {
  const data = await chrome.storage.local.get(SETTINGS_KEY);
  return normalizeSettings(data[SETTINGS_KEY]);
}
