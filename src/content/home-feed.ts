import type { Impression, ServedVideo, Settings } from '../shared/types';
import { channelKey } from '../youtube/channel';
import { SELECTORS } from '../youtube/selectors';
import type { VideoCard } from './card-detector';
import { isHomePage } from './home-shorts-filter';

export const HOME_LIMITS = Object.freeze({ shownRatio: .6, visitDebounceMs: 2000, batch: 500 });
export interface HomeBatch { visits: number; served: ServedVideo[]; shown: string[] }
const otherwiseHidden = `.aw-hidden, ${SELECTORS.sectionHidden}`;
const emptyBatch = (): HomeBatch => ({ visits: 0, served: [], shown: [] });

// Hides Home recommendations already shown on too many earlier visits, caps
// videos per channel, and counts what YouTube served for the rerun statistics.
// A visit is one navigation to Home; each video counts at most once per visit.
export class HomeFeed {
  private visit = 0;
  private navigated = true;
  private lastVisit = 0;
  private served = new Set<string>();
  // Prior shown count, fixed when a video is first on screen during this visit,
  // so a card the viewer has seen never disappears mid-visit.
  private baseline = new Map<string, number>();
  // This tab's counts that storage has not reflected yet.
  private optimistic = new Map<string, number>();
  private pending = emptyBatch();
  private tracked = new Map<HTMLElement, VideoCard>();
  private io = typeof IntersectionObserver === 'function'
    ? new IntersectionObserver(entries => this.onIntersect(entries), { threshold: HOME_LIMITS.shownRatio })
    : undefined;

  constructor(private settings: () => Settings, private impressions: () => Record<string, Impression>, private watched: (card: VideoCard) => boolean) {}

  navigationStart(): void { this.navigated = true; }

  navigationFinish(): void {
    // YouTube also emits data-updated events while scrolling; only a navigation starts a visit.
    if (!this.navigated) return;
    this.navigated = false;
    if (!isHomePage(location.href) || Date.now() - this.lastVisit < HOME_LIMITS.visitDebounceMs) return;
    this.lastVisit = Date.now(); this.visit++;
    this.served.clear(); this.baseline.clear();
    if (this.settings().enabled) this.pending.visits++;
  }

  update(cards: Iterable<VideoCard>): void {
    const settings = this.settings();
    if (!settings.enabled || !this.visit || !isHomePage(location.href)) { this.clear(); return; }
    const home = [...cards]
      .filter(card => card.element.isConnected && !card.shorts && card.element.closest(SELECTORS.homeGrid) && !card.element.closest(SELECTORS.homeShelf))
      .sort((a, b) => a.element.compareDocumentPosition(b.element) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1);
    const perChannel = new Map<string, number>();
    const current = new Set<HTMLElement>();
    for (const card of home) {
      const { element, videoId } = card;
      current.add(element);
      const hidden = !!element.closest(otherwiseHidden);
      const repeat = !hidden && settings.hideRepeatsAfter > 0 && this.priorShown(videoId) >= settings.hideRepeatsAfter;
      let capped = false;
      if (!hidden && !repeat && settings.channelCap > 0) {
        const channel = channelKey(element);
        if (channel) {
          const count = (perChannel.get(channel) ?? 0) + 1;
          perChannel.set(channel, count); capped = count > settings.channelCap;
        }
      }
      element.classList.toggle('aw-repeat-hidden', repeat);
      element.classList.toggle('aw-channel-hidden', capped);
      // Visible cards are served once on screen; hidden ones were still served.
      if (hidden || repeat || capped) this.markServed(card);
      if (!this.tracked.has(element)) this.io?.observe(element);
      this.tracked.set(element, card);
    }
    for (const element of this.tracked.keys()) if (!current.has(element)) this.forget(element);
  }

  private onIntersect(entries: IntersectionObserverEntry[]): void {
    if (!this.settings().enabled || !this.visit || !isHomePage(location.href)) return;
    for (const entry of entries) {
      const card = this.tracked.get(entry.target as HTMLElement);
      if (!card || !entry.isIntersecting || entry.intersectionRatio < HOME_LIMITS.shownRatio || card.element.closest(SELECTORS.feedHidden) || card.element.closest(SELECTORS.sectionHidden)) continue;
      this.markServed(card);
      if (this.baseline.has(card.videoId)) continue;
      const prior = this.priorShown(card.videoId);
      this.baseline.set(card.videoId, prior); this.optimistic.set(card.videoId, prior + 1);
      this.pending.shown.push(card.videoId);
    }
  }

  private markServed(card: VideoCard): void {
    if (this.served.has(card.videoId)) return;
    this.served.add(card.videoId);
    this.pending.served.push({ videoId: card.videoId, title: card.title, watched: this.watched(card) });
  }

  private priorShown(id: string): number {
    const stored = this.impressions()[id]?.shown ?? 0;
    const baseline = this.baseline.get(id);
    // After a history reset storage drops below the baseline; follow storage.
    if (baseline !== undefined) return Math.min(baseline, stored);
    const local = this.optimistic.get(id) ?? 0;
    if (local <= stored) this.optimistic.delete(id);
    return Math.max(stored, local);
  }

  takeBatch(): HomeBatch | null {
    const { visits, served, shown } = this.pending;
    if (!visits && !served.length && !shown.length) return null;
    this.pending = { visits: 0, served: served.slice(HOME_LIMITS.batch), shown: shown.slice(HOME_LIMITS.batch) };
    return { visits, served: served.slice(0, HOME_LIMITS.batch), shown: shown.slice(0, HOME_LIMITS.batch) };
  }

  restoreBatch(batch: HomeBatch): void {
    this.pending = { visits: this.pending.visits + batch.visits, served: [...batch.served, ...this.pending.served], shown: [...batch.shown, ...this.pending.shown] };
  }

  // A new history revision invalidates unsent counts, as it does for playback.
  reset(): void { this.pending = emptyBatch(); this.optimistic.clear(); }

  forget(element: HTMLElement): void {
    this.io?.unobserve(element);
    element.classList.remove('aw-repeat-hidden', 'aw-channel-hidden');
    this.tracked.delete(element);
  }

  clear(): void {
    for (const element of this.tracked.keys()) this.forget(element);
  }

  stop(): void { this.clear(); this.io?.disconnect(); }
}
