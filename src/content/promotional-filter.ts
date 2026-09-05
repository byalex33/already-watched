import type { Settings } from '../shared/types';
import { findPromotionalSections, isPromotionalSection, promotionalContainer } from '../youtube/promotional-sections';

export class PromotionalFilter {
  private hidden = new Set<HTMLElement>();
  constructor(private settings: () => Settings) {}

  update(root: Element | Document): void {
    const settings = this.settings();
    if (!settings.enabled || !settings.hidePromotionalSections) { this.clear(); return; }
    const sections = findPromotionalSections(root);
    const matched = new Set<HTMLElement>();
    for (const section of sections) if (isPromotionalSection(section)) matched.add(promotionalContainer(section));
    for (const element of this.hidden) {
      if (!element.isConnected || (sections.has(element) && !matched.has(element))) {
        element.classList.remove('aw-promo-hidden'); this.hidden.delete(element);
      }
    }
    for (const element of matched) {
      element.classList.add('aw-promo-hidden'); this.hidden.add(element);
    }
  }

  prune(): void {
    for (const element of this.hidden) if (!element.isConnected) {
      element.classList.remove('aw-promo-hidden'); this.hidden.delete(element);
    }
  }

  clear(): void {
    for (const element of this.hidden) element.classList.remove('aw-promo-hidden');
    this.hidden.clear();
  }
}
