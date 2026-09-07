import { cardRoot, SELECTORS } from '../youtube/selectors';
import { findCardRoots } from './card-detector';
export class CardObserver {
  private observer: MutationObserver;
  private pending = new Set<HTMLElement>();
  private roots = new Set<Element>();
  private timer: ReturnType<typeof setTimeout> | undefined;
  constructor(private onCards: (cards: Set<HTMLElement>) => void, private onRemove: () => void, private onSettled: () => void = () => undefined, private onSubtree: (root: Element | Document) => void = () => undefined) {
    this.observer = new MutationObserver(mutations => {
      let removed = false;
      for (const mutation of mutations) {
        const target = mutation.target instanceof Element ? mutation.target : mutation.target.parentElement;
        if (!target || target.closest(SELECTORS.extensionOwned)) continue;
        const owner = cardRoot(target);
        if (owner) this.pending.add(owner);
        if (owner) this.roots.add(owner);
        const promotionalSection = target.closest(SELECTORS.promotionalSections);
        if (promotionalSection) this.roots.add(promotionalSection);
        const shortsGrid = target.closest(SELECTORS.homeShortsGridShelves);
        if (shortsGrid) this.roots.add(shortsGrid);
        const continuation = target.closest(SELECTORS.continuation);
        if (continuation) this.roots.add(continuation);
        if (mutation.type === 'childList') {
          for (const node of mutation.addedNodes) {
            if (node instanceof Element && !node.matches(SELECTORS.extensionOwned)) this.roots.add(node);
          }
          removed ||= mutation.removedNodes.length > 0;
        }
      }
      if (removed) this.onRemove();
      this.schedule();
    });
  }
  start(): void {
    this.observer.observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['href', 'style', 'aria-valuenow', 'aria-valuemax', 'now-playing-badge', 'hidden', 'is-loading', 'aria-busy', 'active', 'is-shorts', 'overlay-style'] });
    this.scan();
  }
  scan(): void {
    this.onSubtree(document);
    this.onCards(findCardRoots(document));
  }
  private schedule(): void {
    if (this.timer || (!this.pending.size && !this.roots.size)) return;
    this.timer = setTimeout(() => {
      this.timer = undefined;
      const roots = this.roots; this.roots = new Set();
      // Skip nested additions already covered by an ancestor in this batch.
      for (const root of roots) {
        if (!root.isConnected) continue;
        let parent = root.parentElement;
        while (parent && !roots.has(parent)) parent = parent.parentElement;
        if (parent) continue;
        this.onSubtree(root);
        for (const card of findCardRoots(root)) this.pending.add(card);
      }
      const batch = new Set([...this.pending].filter(card => card.isConnected));
      this.pending.clear();
      if (batch.size) this.onCards(batch);
      this.onSettled();
    }, 120);
  }
  stop(): void {
    this.observer.disconnect();
    if (this.timer) clearTimeout(this.timer);
    this.pending.clear(); this.roots.clear();
  }
}
