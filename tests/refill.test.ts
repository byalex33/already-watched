import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FeedRefiller, REFILL_LIMITS } from '../src/content/feed-refiller';
import { detectCard, type VideoCard } from '../src/content/card-detector';
import { DEFAULT_SETTINGS } from '../src/shared/constants';
import type { Settings } from '../src/shared/types';
import { activateContinuation, continuationFor, refillFeed, supportsRefill } from '../src/youtube/continuation';
import { CardObserver } from '../src/content/observer';
import { normalizeSettings } from '../src/storage/settings-store';
import { CardDecorator } from '../src/content/card-decorator';

let controller: FeedRefiller;
let settings: Settings;
let cards: VideoCard[];
let feed: HTMLElement;
let continuation: HTMLElement;
let tabHidden: boolean;
let sequence: number;
const rectangle = (bottom = 300): DOMRect => ({ x: 0, y: bottom - 100, width: 500, height: 100, top: bottom - 100, bottom, left: 0, right: 500, toJSON: () => ({}) });

function addCard(watched = true, bottom = 300): VideoCard {
  const element = document.createElement('ytd-rich-item-renderer');
  const id = `video${String(sequence++).padStart(6, '0')}`;
  element.innerHTML = `<a id="thumbnail" href="/watch?v=${id}"><img alt="Fixture"></a>`;
  if (watched) element.classList.add('aw-hidden');
  element.getBoundingClientRect = () => rectangle(bottom);
  feed.prepend(element);
  const card = detectCard(element)!;
  cards.push(card);
  return card;
}
function button(): HTMLButtonElement {
  continuation.innerHTML = '<ytd-button-renderer><button type="button">Load more</button></ytd-button-renderer>';
  return continuation.querySelector('button')!;
}
const advance = async (ms: number = REFILL_LIMITS.debounceMs): Promise<void> => { await vi.advanceTimersByTimeAsync(ms); };

beforeEach(() => {
  vi.useFakeTimers();
  history.replaceState({}, '', '/');
  tabHidden = false; sequence = 0;
  vi.spyOn(document, 'hidden', 'get').mockImplementation(() => tabHidden);
  vi.spyOn(HTMLElement.prototype, 'getClientRects').mockImplementation(function (this: HTMLElement) {
    return (this.closest('[hidden]') || this.style.display === 'none' ? [] : [rectangle()]) as unknown as DOMRectList;
  });
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(() => rectangle());
  document.body.innerHTML = '<ytd-browse><ytd-rich-grid-renderer><ytd-continuation-item-renderer></ytd-continuation-item-renderer></ytd-rich-grid-renderer></ytd-browse>';
  feed = document.querySelector('ytd-rich-grid-renderer')!;
  continuation = document.querySelector('ytd-continuation-item-renderer')!;
  settings = { ...DEFAULT_SETTINGS, displayMode: 'hide-refill' }; cards = [];
  controller = new FeedRefiller(() => settings, () => cards);
});
afterEach(() => { controller.stop(); vi.restoreAllMocks(); vi.useRealTimers(); });

describe('refill mode', () => {
  it('persists the new mode, hides watched cards and restores them when disabled', () => {
    expect(normalizeSettings(settings).displayMode).toBe('hide-refill');
    expect(normalizeSettings(undefined).displayMode).toBe('badge-dim');
    const card = addCard(false);
    const decorator = new CardDecorator(vi.fn());
    decorator.apply(card, true, undefined, settings);
    expect(card.element.classList.contains('aw-hidden')).toBe(true);
    decorator.apply(card, true, undefined, { ...settings, enabled: false });
    expect(card.element.classList.contains('aw-hidden')).toBe(false);
  });
  it('activates a continuation briefly without scrolling, then restores it', async () => {
    addCard();
    const scroll = vi.spyOn(window, 'scrollTo');
    controller.schedule(); await advance();
    expect(continuation.classList.contains('aw-refill-probe')).toBe(true);
    await advance(REFILL_LIMITS.pulseMs);
    expect(continuation.classList.contains('aw-refill-probe')).toBe(false);
    expect(scroll).not.toHaveBeenCalled();
  });
  it('stops when YouTube adds enough remaining cards', async () => {
    addCard();
    const load = vi.fn(() => { for (let i = 0; i < 12; i++) addCard(false); });
    button().onclick = load;
    controller.schedule(); await advance(30000);
    expect(load).toHaveBeenCalledTimes(1);
  });
  it('caps successful but all-watched batches at five, despite mutations and repeated finish events', async () => {
    addCard();
    const load = vi.fn(() => { addCard(); controller.navigationFinish(); });
    button().onclick = load;
    controller.schedule(); await advance(REFILL_LIMITS.cooldownMs);
    expect(load).toHaveBeenCalledTimes(1);
    await advance(30000);
    for (let i = 0; i < 20; i++) controller.schedule();
    controller.navigationFinish(); await advance(30000);
    expect(load).toHaveBeenCalledTimes(REFILL_LIMITS.attempts);
  });
  it('waits for slow responses and stops after two loads with no new IDs', async () => {
    addCard();
    const load = vi.fn(); button().onclick = load;
    controller.schedule(); await advance(8000);
    expect(load).toHaveBeenCalledTimes(1);
    await advance(60000);
    expect(load).toHaveBeenCalledTimes(2);
    controller.schedule(); await advance(30000);
    expect(load).toHaveBeenCalledTimes(2);
  });
  it('treats duplicate/recycled IDs as no progress', async () => {
    const original = addCard();
    const load = vi.fn(() => { const duplicate = addCard(); duplicate.videoId = original.videoId; });
    button().onclick = load;
    controller.schedule(); await advance(60000);
    expect(load).toHaveBeenCalledTimes(2);
  });
  it('does not reset the budget by toggling modes, but resets on a real SPA route change', async () => {
    addCard(); const load = vi.fn(); button().onclick = load;
    controller.schedule(); await advance(30000);
    settings.displayMode = 'badge'; controller.schedule();
    settings.displayMode = 'hide-refill'; controller.schedule(); await advance(30000);
    expect(load).toHaveBeenCalledTimes(2);
    controller.navigationStart(); history.replaceState({}, '', '/feed/subscriptions'); controller.navigationFinish();
    await advance(); expect(load).toHaveBeenCalledTimes(3);
  });
  it.each(['badge', 'dim', 'hide', 'badge-dim'] as const)('never refills in %s mode', async displayMode => {
    settings.displayMode = displayMode; addCard();
    const load = vi.fn(); button().onclick = load;
    controller.schedule(); await advance(30000); expect(load).not.toHaveBeenCalled();
  });
  it('does not load a healthy feed or one with no watched cards removed', async () => {
    addCard(false); const load = vi.fn(); button().onclick = load;
    controller.schedule(); await advance(10000); expect(load).not.toHaveBeenCalled();
    addCard(); addCard(false, window.innerHeight * 2);
    controller.schedule(); await advance(10000); expect(load).not.toHaveBeenCalled();
  });
  it('cancels scheduled work and viewport pulses when disabled, hidden, navigating or stopped', async () => {
    addCard(); controller.schedule(); settings.enabled = false; await advance();
    expect(continuation.classList.contains('aw-refill-probe')).toBe(false);
    settings.enabled = true; controller.schedule(); await advance();
    expect(continuation.classList.contains('aw-refill-probe')).toBe(true);
    tabHidden = true; document.dispatchEvent(new Event('visibilitychange'));
    expect(continuation.classList.contains('aw-refill-probe')).toBe(false);
    tabHidden = false; controller.navigationStart(); controller.schedule(); await advance(30000);
    expect(continuation.classList.contains('aw-refill-probe')).toBe(false);
    controller.navigationFinish(); controller.stop(); await advance(30000);
    expect(continuation.classList.contains('aw-refill-probe')).toBe(false);
  });
  it('does not act on a changed URL before navigation settles', async () => {
    addCard(); controller.schedule(); history.replaceState({}, '', '/shorts/dQw4w9WgXcQ'); await advance();
    expect(continuation.classList.contains('aw-refill-probe')).toBe(false);
  });
  it('responds when a continuation arrives without any new cards', async () => {
    addCard(); continuation.remove();
    const observer = new CardObserver(vi.fn(), vi.fn(), () => controller.schedule());
    observer.start(); controller.schedule(); await advance(1000);
    feed.append(continuation); await advance(450);
    expect(continuation.classList.contains('aw-refill-probe')).toBe(true);
    await advance(500);
    expect(continuation.classList.contains('aw-refill-probe')).toBe(false);
    observer.stop();
  });
  it('waits for a native load to finish before attempting another', async () => {
    addCard(); continuation.setAttribute('is-loading', '');
    const observer = new CardObserver(vi.fn(), vi.fn(), () => controller.schedule());
    observer.start(); controller.schedule(); await advance(1000);
    expect(continuation.classList.contains('aw-refill-probe')).toBe(false);
    continuation.removeAttribute('is-loading'); await advance(450);
    expect(continuation.classList.contains('aw-refill-probe')).toBe(true);
    observer.stop();
  });
});

describe('continuation adapters', () => {
  it.each(['/', '/results?search_query=music', '/feed/subscriptions', '/@creator/videos', '/channel/UCabc/shorts', '/watch?v=dQw4w9WgXcQ'])('supports %s', path => {
    expect(supportsRefill(`https://www.youtube.com${path}`)).toBe(true);
  });
  it.each(['/shorts/dQw4w9WgXcQ', '/feed/history', '/playlist?list=PLabc', '/account', '/@creator/about'])('leaves %s alone', path => {
    expect(supportsRefill(`https://www.youtube.com${path}`)).toBe(false);
  });
  it('scopes watch-page refill to recommendations, excluding comments and playlist pagination', () => {
    history.replaceState({}, '', '/watch?v=dQw4w9WgXcQ');
    document.body.innerHTML = '<ytd-watch-flexy><ytd-comments><ytd-continuation-item-renderer id="comments"></ytd-continuation-item-renderer></ytd-comments><div id="related"><ytd-watch-next-secondary-results-renderer><ytd-continuation-item-renderer id="recommendations"></ytd-continuation-item-renderer></ytd-watch-next-secondary-results-renderer></div></ytd-watch-flexy>';
    expect(continuationFor(refillFeed(location.href)!)?.id).toBe('recommendations');
  });
  it('skips hidden stale feeds and continuations belonging to nested shelves', () => {
    const hidden = document.createElement('ytd-browse'); hidden.hidden = true;
    hidden.innerHTML = '<ytd-rich-grid-renderer></ytd-rich-grid-renderer>'; document.body.prepend(hidden);
    const shelf = document.createElement('ytd-rich-shelf-renderer');
    shelf.innerHTML = '<ytd-continuation-item-renderer></ytd-continuation-item-renderer>'; feed.prepend(shelf);
    expect(refillFeed(location.href)).toBe(feed);
    expect(continuationFor(feed)).toBe(continuation);
  });
  it('does not activate busy, disabled, disconnected or hidden targets', () => {
    const control = button(); control.disabled = true;
    expect(activateContinuation(continuation)).toBeNull();
    control.disabled = false; continuation.setAttribute('is-loading', '');
    expect(activateContinuation(continuation)).toBeNull();
    continuation.removeAttribute('is-loading'); continuation.hidden = true;
    expect(activateContinuation(continuation)).toBeNull();
    continuation.hidden = false; continuation.remove();
    expect(activateContinuation(continuation)).toBeNull();
  });
});
