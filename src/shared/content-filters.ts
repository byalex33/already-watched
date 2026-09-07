import type { Settings } from './types';

export function matchesContentFilters(card: { title?: string; views?: number | null; shorts: boolean }, settings: Settings): boolean {
  if (!settings.enabled || (card.shorts && !settings.applyToShorts)) return false;
  if (card.views != null && card.views < settings.minimumViews) return true;
  const title = card.title?.normalize('NFKC').toLowerCase();
  return !!title && settings.blockedTitleTerms.some(term => {
    const normalized = term.trim().normalize('NFKC').toLowerCase();
    return normalized.length > 0 && title.includes(normalized);
  });
}
