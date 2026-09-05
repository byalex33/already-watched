import type { Settings } from '../shared/types';
import { findCardRoots, detectCard } from './card-detector';
import { findPromotionalSections, promotionalContainer } from '../youtube/promotional-sections';
import { SELECTORS } from '../youtube/selectors';

export function isHomePage(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ['www.youtube.com', 'youtube.com'].includes(parsed.hostname) && parsed.pathname === '/';
  } catch { return false; }
}

export class HomeShortsFilter {
  private hidden = new Set<HTMLElement>();
  constructor(private settings: () => Settings) {}

  update(root: Element | Document): void {
    const settings = this.settings();
    if (!settings.enabled || !settings.hideHomeShorts || !isHomePage(location.href)) { this.clear(); return; }
    const candidates = findPromotionalSections(root);
    root.querySelectorAll<HTMLElement>(SELECTORS.homeShortsShelves).forEach(element => candidates.add(element));
    if (root instanceof Element) {
      const shelf = root.closest<HTMLElement>(SELECTORS.homeShortsShelves);
      if (shelf) candidates.add(shelf);
    }
    const matched = new Set<HTMLElement>();
    for (const section of candidates) {
      const shorts = section.matches(SELECTORS.homeShortsShelves) || [...section.querySelectorAll(SELECTORS.promotionalHeadings)].some(heading =>
        heading.closest(SELECTORS.promotionalSections) === section && !heading.closest(SELECTORS.cards)
        && heading.textContent?.trim().toLowerCase() === 'shorts'
      );
      if (shorts) matched.add(promotionalContainer(section));
    }
    for (const element of findCardRoots(root)) {
      candidates.add(element);
      if (detectCard(element)?.shorts) matched.add(element);
    }
    for (const element of this.hidden) {
      if (!element.isConnected || (candidates.has(element) && !matched.has(element))) {
        element.classList.remove('aw-home-shorts-hidden'); this.hidden.delete(element);
      }
    }
    for (const element of matched) { element.classList.add('aw-home-shorts-hidden'); this.hidden.add(element); }
  }

  prune(): void {
    for (const element of this.hidden) if (!element.isConnected) {
      element.classList.remove('aw-home-shorts-hidden'); this.hidden.delete(element);
    }
  }

  clear(): void {
    for (const element of this.hidden) element.classList.remove('aw-home-shorts-hidden');
    this.hidden.clear();
  }
}
