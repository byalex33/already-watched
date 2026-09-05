import type { Settings } from '../shared/types';
import { activateContinuation, continuationBusy, continuationFor, refillFeed } from '../youtube/continuation';
import type { VideoCard } from './card-detector';
import { SELECTORS } from '../youtube/selectors';

export const REFILL_LIMITS = Object.freeze({
  attempts: 5, stalledAttempts: 2, availableVideos: 12,
  debounceMs: 300, cooldownMs: 3000, responseTimeoutMs: 9000, pulseMs: 500
});

interface FeedState { feed: HTMLElement; ids: Set<string>; sparse: boolean }
interface PendingLoad { ids: Set<string>; deadline: number }

export class FeedRefiller {
  private url = location.href;
  private attempts = 0;
  private stalledAttempts = 0;
  private nextCheck = 0;
  private pending?: PendingLoad;
  private timer?: ReturnType<typeof setTimeout>;
  private pulseTimer?: ReturnType<typeof setTimeout>;
  private restore?: () => void;
  private navigating = false;
  private stopped = false;
  private readonly onViewport = (): void => this.schedule();
  private readonly onVisibility = (): void => {
    if (document.hidden) this.cancel();
    else this.schedule();
  };

  constructor(private settings: () => Settings, private cards: () => Iterable<VideoCard>) {
    window.addEventListener('scroll', this.onViewport, { passive: true });
    window.addEventListener('resize', this.onViewport);
    document.addEventListener('visibilitychange', this.onVisibility);
  }

  schedule(): void {
    if (this.stopped) return;
    if (!this.enabled() || document.hidden || this.navigating) { this.cancel(); return; }
    if (this.timer !== undefined || this.attempts >= REFILL_LIMITS.attempts || this.stalledAttempts >= REFILL_LIMITS.stalledAttempts) return;
    this.timer = setTimeout(() => {
      this.timer = undefined;
      this.check();
    }, Math.max(REFILL_LIMITS.debounceMs, this.nextCheck - Date.now()));
  }

  navigationStart(): void { this.navigating = true; this.cancel(); }

  navigationFinish(): void {
    // YouTube emits data-updated events during infinite loading too. Only an
    // actual route change replenishes the budget, never a mutation or toggle.
    if (this.url !== location.href) {
      this.url = location.href; this.attempts = 0; this.stalledAttempts = 0;
      this.nextCheck = 0; this.pending = undefined;
    }
    this.navigating = false; this.schedule();
  }

  private enabled(): boolean {
    const settings = this.settings();
    return settings.enabled && settings.displayMode === 'hide-refill';
  }

  private inspect(): FeedState | null {
    const feed = refillFeed(this.url);
    if (!feed) return null;
    const ids = new Set<string>();
    const available = new Set<string>();
    let hidden = 0;
    let bottom = 0;
    for (const card of this.cards()) {
      if (!card.element.isConnected || !feed.contains(card.element) || card.element.closest(SELECTORS.sectionHidden)) continue;
      ids.add(card.videoId);
      if (card.element.classList.contains('aw-hidden')) { hidden++; continue; }
      const rect = card.element.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0 || rect.bottom <= 0) continue;
      available.add(card.videoId);
      bottom = Math.max(bottom, rect.bottom);
    }
    return { feed, ids, sparse: hidden > 0 && available.size < REFILL_LIMITS.availableVideos && bottom < window.innerHeight * 1.5 };
  }

  private check(): void {
    if (!this.enabled() || document.hidden || this.navigating || this.url !== location.href) { this.cancel(); return; }
    if (Date.now() < this.nextCheck) { this.schedule(); return; }
    const state = this.inspect();
    if (!state) return;
    if (this.pending) {
      const previousIds = this.pending.ids;
      const arrived = [...state.ids].some(id => !previousIds.has(id));
      if (arrived) { this.stalledAttempts = 0; this.pending = undefined; }
      else if (Date.now() < this.pending.deadline) {
        this.nextCheck = Math.min(this.pending.deadline, Date.now() + REFILL_LIMITS.cooldownMs);
        this.schedule(); return;
      } else { this.stalledAttempts++; this.pending = undefined; }
    }
    if (!state.sparse || this.attempts >= REFILL_LIMITS.attempts || this.stalledAttempts >= REFILL_LIMITS.stalledAttempts) return;
    const continuation = continuationFor(state.feed);
    if (!continuation || continuationBusy(continuation)) return;
    const restore = activateContinuation(continuation);
    if (!restore) return;
    this.attempts++;
    this.pending = { ids: state.ids, deadline: Date.now() + REFILL_LIMITS.responseTimeoutMs };
    this.nextCheck = Date.now() + REFILL_LIMITS.cooldownMs;
    this.restore = restore;
    this.pulseTimer = setTimeout(() => this.restoreContinuation(), REFILL_LIMITS.pulseMs);
    this.schedule();
  }

  private restoreContinuation(): void {
    if (this.pulseTimer !== undefined) clearTimeout(this.pulseTimer);
    this.pulseTimer = undefined;
    this.restore?.(); this.restore = undefined;
  }

  private cancel(): void {
    if (this.timer !== undefined) clearTimeout(this.timer);
    this.timer = undefined;
    this.restoreContinuation();
  }

  stop(): void {
    this.stopped = true; this.cancel();
    window.removeEventListener('scroll', this.onViewport);
    window.removeEventListener('resize', this.onViewport);
    document.removeEventListener('visibilitychange', this.onVisibility);
  }
}
