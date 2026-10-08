import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Repository } from '../src/background/repository';
import { validRequest } from '../src/background/validation';
import { detectCard, type VideoCard } from '../src/content/card-detector';
import { HomeFeed } from '../src/content/home-feed';
import { DEFAULT_SETTINGS, HOME_STATS_KEY, IMPRESSION_TTL_MS, REVISION_KEY } from '../src/shared/constants';
import { SHARE_MIN_VISITS, sharePost } from '../src/shared/share-post';
import type { HomeSummary, Impression, Settings, Summary } from '../src/shared/types';
import { emptyHomeStats, expiredImpressions, impressionKey, recordHome, summarizeHome } from '../src/storage/impression-store';
import { normalizeSettings } from '../src/storage/settings-store';
import { channelKey } from '../src/youtube/channel';

const ids = ['aaaaaaaaaa1', 'aaaaaaaaaa2', 'aaaaaaaaaa3', 'aaaaaaaaaa4'];
const impression = (videoId: string, shown: number, served = shown): Impression => ({ videoId, served, shown, lastSeen: Date.now() });

describe('Home feed settings', () => {
  it('defaults off and clamps stored values', () => {
    expect(normalizeSettings({})).toMatchObject({ hideRepeatsAfter: 0, channelCap: 0 });
    expect(normalizeSettings({ hideRepeatsAfter: 3.7, channelCap: 2 })).toMatchObject({ hideRepeatsAfter: 3, channelCap: 2 });
    expect(normalizeSettings({ hideRepeatsAfter: 99, channelCap: -4 })).toMatchObject({ hideRepeatsAfter: 20, channelCap: 0 });
    expect(normalizeSettings({ hideRepeatsAfter: NaN, channelCap: '2' })).toMatchObject({ hideRepeatsAfter: 0, channelCap: 0 });
  });
});

describe('Home impression records', () => {
  it('counts served, distinct, reruns and watched videos once per entry', () => {
    const { updates, stats } = recordHome({ [ids[0]!]: impression(ids[0]!, 1) }, emptyHomeStats(), {
      visits: 1,
      served: [{ videoId: ids[0]!, title: 'Old', watched: false }, { videoId: ids[1]!, title: 'New', watched: false }, { videoId: ids[2]!, watched: true }],
      shown: [ids[1]!]
    }, 1000);
    expect(stats).toEqual({ visits: 1, served: 3, distinct: 2, repeats: 2, watched: 1, since: 1000 });
    expect(updates[ids[0]!]).toMatchObject({ served: 2, shown: 1, lastSeen: 1000 });
    expect(updates[ids[1]!]).toMatchObject({ served: 1, shown: 1, title: 'New' });
  });
  it('treats a second visit in the same batch as a rerun', () => {
    const { stats } = recordHome({}, emptyHomeStats(), { visits: 2, served: [{ videoId: ids[0]!, watched: false }, { videoId: ids[0]!, watched: false }], shown: [] });
    expect(stats).toMatchObject({ served: 2, distinct: 1, repeats: 1 });
  });
  it('lists the most-served titled videos and forgets stale ones', () => {
    const now = Date.now();
    const impressions = { a: { ...impression(ids[0]!, 1, 5), title: 'Five' }, b: { ...impression(ids[1]!, 1, 9), title: 'Nine' }, c: impression(ids[2]!, 1, 12), d: { ...impression(ids[3]!, 1, 1), title: 'Once', lastSeen: now - IMPRESSION_TTL_MS - 1 } };
    expect(summarizeHome(impressions, emptyHomeStats()).top.map(video => video.title)).toEqual(['Nine', 'Five']);
    expect(expiredImpressions(impressions, now)).toEqual([ids[3]]);
  });
  it('validates batches', () => {
    expect(validRequest({ type: 'home', visits: 1, served: [{ videoId: ids[0], watched: false }], shown: [ids[0]], revision: 0 })).toBe(true);
    expect(validRequest({ type: 'home', visits: 1, served: [{ videoId: 'bad', watched: false }], shown: [], revision: 0 })).toBe(false);
    expect(validRequest({ type: 'home', visits: -1, served: [], shown: [], revision: 0 })).toBe(false);
    expect(validRequest({ type: 'home', visits: 0, served: [], shown: Array(501).fill(ids[0]), revision: 0 })).toBe(false);
  });
});

describe('Home repository', () => {
  let data: Record<string, unknown>;
  let repository: Repository;
  beforeEach(() => {
    data = {};
    const session: Record<string, unknown> = {};
    vi.stubGlobal('chrome', { storage: { session: {
      get: vi.fn(async () => ({ ...session })), set: vi.fn(async (values: Record<string, unknown>) => { Object.assign(session, values); }),
      remove: vi.fn(async (key: string) => { delete session[key]; })
    }, local: {
      get: vi.fn(async (keys: string | string[] | null) => structuredClone(keys === null ? data : Object.fromEntries((typeof keys === 'string' ? [keys] : keys).filter(key => key in data).map(key => [key, data[key]])))),
      set: vi.fn(async (values: Record<string, unknown>) => { Object.assign(data, structuredClone(values)); }),
      remove: vi.fn(async (keys: string[]) => { keys.forEach(key => { delete data[key]; }); }),
      getBytesInUse: vi.fn(async () => 0)
    } } });
    repository = new Repository();
  });
  afterEach(() => { vi.unstubAllGlobals(); });
  it('persists impressions per video, prunes stale ones, and summarizes', async () => {
    data[impressionKey(ids[3]!)] = { ...impression(ids[3]!, 1), lastSeen: Date.now() - IMPRESSION_TTL_MS - 1 };
    await repository.dispatch({ type: 'home', visits: 1, served: [{ videoId: ids[0]!, title: 'Again', watched: false }], shown: [ids[0]!], revision: 0 });
    await repository.dispatch({ type: 'home', visits: 1, served: [{ videoId: ids[0]!, title: 'Again', watched: false }], shown: [], revision: 0 });
    expect(data[impressionKey(ids[0]!)]).toMatchObject({ served: 2, shown: 1, title: 'Again' });
    expect(data[impressionKey(ids[3]!)]).toBeUndefined();
    const summary = await repository.dispatch({ type: 'summary' }) as Summary;
    expect(summary.home).toMatchObject({ visits: 2, served: 2, distinct: 1, repeats: 1, top: [{ videoId: ids[0], served: 2 }] });
    expect(await repository.dispatch({ type: 'snapshot' })).toMatchObject({ impressions: { [ids[0]!]: { shown: 1 } } });
  });
  it('ignores batches while disabled or from before a reset, and clear removes them', async () => {
    await repository.dispatch({ type: 'settings', settings: { ...DEFAULT_SETTINGS, enabled: false } });
    await repository.dispatch({ type: 'home', visits: 1, served: [], shown: [ids[0]!], revision: 0 });
    expect(data[impressionKey(ids[0]!)]).toBeUndefined();
    await repository.dispatch({ type: 'settings', settings: { ...DEFAULT_SETTINGS } });
    await repository.dispatch({ type: 'home', visits: 1, served: [], shown: [ids[0]!], revision: 0 });
    await repository.dispatch({ type: 'clear' });
    expect(data[impressionKey(ids[0]!)]).toBeUndefined();
    expect(data[HOME_STATS_KEY]).toBeUndefined();
    expect((await repository.dispatch({ type: 'summary' }) as Summary).home).toEqual({ ...emptyHomeStats(), top: [] });
    expect(await repository.dispatch({ type: 'home', visits: 1, served: [], shown: [ids[0]!], revision: 0 })).toEqual({ stale: true });
    expect(data[REVISION_KEY]).toBe(1);
  });
});

class FakeObserver {
  static last: FakeObserver;
  targets = new Set<Element>();
  constructor(public callback: (entries: Partial<IntersectionObserverEntry>[]) => void) { FakeObserver.last = this; }
  observe(target: Element): void { this.targets.add(target); }
  unobserve(target: Element): void { this.targets.delete(target); }
  disconnect(): void { this.targets.clear(); }
}

describe('Home feed filtering', () => {
  let settings: Settings;
  let impressions: Record<string, Impression>;
  let feed: HomeFeed;
  let now: number;
  const watched = new Set<string>();
  function render(cards: { id: string; channel?: string; extra?: string }[]): VideoCard[] {
    document.body.innerHTML = `<ytd-rich-grid-renderer><div id="contents">${cards.map(({ id, channel = '/@one', extra = '' }) =>
      `<ytd-rich-item-renderer><a id="thumbnail" href="/watch?v=${id}"><img></a><h3 id="video-title">Title ${id}</h3><ytd-channel-name><a href="${channel}">Channel</a></ytd-channel-name>${extra}</ytd-rich-item-renderer>`).join('')}</div></ytd-rich-grid-renderer>`;
    return [...document.querySelectorAll<HTMLElement>('ytd-rich-item-renderer')].map(element => detectCard(element)!);
  }
  const hidden = (card: VideoCard): string | null => card.element.classList.contains('aw-repeat-hidden') ? 'repeat' : card.element.classList.contains('aw-channel-hidden') ? 'channel' : null;
  const show = (...cards: VideoCard[]): void => FakeObserver.last.callback(cards.map(card => ({ target: card.element, isIntersecting: true, intersectionRatio: 1 })));
  function visit(): void { now += 5000; vi.setSystemTime(now); feed.navigationStart(); feed.navigationFinish(); }
  beforeEach(() => {
    vi.useFakeTimers(); now = Date.now();
    vi.stubGlobal('IntersectionObserver', FakeObserver);
    history.replaceState({}, '', '/');
    settings = { ...DEFAULT_SETTINGS, hideRepeatsAfter: 3, channelCap: 0 };
    impressions = {}; watched.clear();
    feed = new HomeFeed(() => settings, () => impressions, card => watched.has(card.videoId));
    feed.navigationFinish();
  });
  afterEach(() => { feed.stop(); vi.unstubAllGlobals(); vi.useRealTimers(); document.body.innerHTML = ''; });

  it('hides videos already shown on enough earlier visits', () => {
    impressions = { [ids[0]!]: impression(ids[0]!, 3), [ids[1]!]: impression(ids[1]!, 2) };
    const cards = render([{ id: ids[0]! }, { id: ids[1]! }]);
    feed.update(cards);
    expect(cards.map(hidden)).toEqual(['repeat', null]);
  });
  it('keeps a card seen during this visit, then hides it on the next visit before storage catches up', () => {
    impressions = { [ids[0]!]: impression(ids[0]!, 2) };
    const cards = render([{ id: ids[0]! }]);
    feed.update(cards); show(cards[0]!);
    impressions = { [ids[0]!]: impression(ids[0]!, 3) };
    feed.update(cards);
    expect(hidden(cards[0]!)).toBeNull();
    impressions = { [ids[0]!]: impression(ids[0]!, 2) };
    visit(); feed.update(cards);
    expect(hidden(cards[0]!)).toBe('repeat');
  });
  it('follows storage after a history reset', () => {
    impressions = { [ids[0]!]: impression(ids[0]!, 3) };
    const cards = render([{ id: ids[0]! }]);
    feed.update(cards);
    impressions = {}; feed.reset(); feed.update(cards);
    expect(hidden(cards[0]!)).toBeNull();
    expect(feed.takeBatch()).toBeNull();
  });
  it('caps videos per channel in page order, ignoring cards hidden for other reasons', () => {
    settings.hideRepeatsAfter = 0; settings.channelCap = 2;
    const cards = render([{ id: ids[0]! }, { id: ids[1]!, channel: '/@One/videos' }, { id: ids[2]!, channel: '/@other' }, { id: ids[3]! }]);
    feed.update([...cards].reverse());
    expect(cards.map(hidden)).toEqual([null, null, null, 'channel']);
    cards[0]!.element.classList.add('aw-hidden');
    feed.update(cards);
    expect(cards.map(hidden)).toEqual([null, null, null, null]);
  });
  it('restores cards away from Home, when disabled, and when turned off', () => {
    impressions = { [ids[0]!]: impression(ids[0]!, 5) };
    const cards = render([{ id: ids[0]! }]);
    feed.update(cards); expect(hidden(cards[0]!)).toBe('repeat');
    history.replaceState({}, '', '/feed/subscriptions'); feed.update(cards);
    expect(hidden(cards[0]!)).toBeNull();
    history.replaceState({}, '', '/'); feed.update(cards); settings.enabled = false; feed.update(cards);
    expect(hidden(cards[0]!)).toBeNull();
    settings.enabled = true; settings.hideRepeatsAfter = 0; feed.update(cards);
    expect(hidden(cards[0]!)).toBeNull();
  });
  it('skips Shorts and shelf cards', () => {
    impressions = { [ids[0]!]: impression(ids[0]!, 5), [ids[1]!]: impression(ids[1]!, 5) };
    document.body.innerHTML = `<ytd-rich-grid-renderer><div id="contents"><ytd-rich-section-renderer><ytd-rich-item-renderer><a id="thumbnail" href="/watch?v=${ids[0]}"><img></a></ytd-rich-item-renderer></ytd-rich-section-renderer><ytd-rich-item-renderer><a id="thumbnail" href="/shorts/${ids[1]}"><img></a></ytd-rich-item-renderer></div></ytd-rich-grid-renderer>`;
    const cards = [...document.querySelectorAll<HTMLElement>('ytd-rich-item-renderer')].map(element => detectCard(element)!);
    feed.update(cards);
    expect(cards.map(hidden)).toEqual([null, null]);
    expect(feed.takeBatch()).toEqual({ visits: 1, served: [], shown: [] });
  });
  it('batches served and shown videos once per visit', () => {
    impressions = { [ids[0]!]: impression(ids[0]!, 3) };
    watched.add(ids[2]!);
    const cards = render([{ id: ids[0]! }, { id: ids[1]! }, { id: ids[2]! }]);
    feed.update(cards); feed.update(cards);
    expect(feed.takeBatch()).toEqual({ visits: 1, served: [{ videoId: ids[0], title: `Title ${ids[0]}`, watched: false }], shown: [] });
    show(cards[0]!, cards[1]!, cards[2]!); show(cards[1]!);
    expect(feed.takeBatch()).toEqual({ visits: 0, served: [{ videoId: ids[1], title: `Title ${ids[1]}`, watched: false }, { videoId: ids[2], title: `Title ${ids[2]}`, watched: true }], shown: [ids[1], ids[2]] });
    // Data updates during scrolling are not a new visit.
    feed.navigationFinish(); feed.update(cards); show(cards[1]!);
    expect(feed.takeBatch()).toBeNull();
    visit(); feed.update(cards); show(cards[1]!);
    expect(feed.takeBatch()).toMatchObject({ visits: 1, shown: [ids[1]] });
  });
  it('restores a failed batch ahead of newer counts', () => {
    const cards = render([{ id: ids[0]! }, { id: ids[1]! }]);
    feed.update(cards); show(cards[0]!);
    const batch = feed.takeBatch()!;
    show(cards[1]!); feed.restoreBatch(batch);
    expect(feed.takeBatch()).toMatchObject({ visits: 1, shown: [ids[0], ids[1]] });
  });
});

describe('channel and share helpers', () => {
  it.each([
    ['<a href="/@Creator/videos">x</a>', '@creator'], ['<a href="/channel/UC123">x</a>', 'channel/UC123'],
    ['<ytd-channel-name><a href="https://www.youtube.com/@Some%20One">x</a></ytd-channel-name>', '@some one'],
    ['<ytd-channel-name><div id="text">Plain Name</div></ytd-channel-name>', 'name:Plain Name'], ['<a href="/watch?v=x">x</a>', null]
  ])('reads %s', (html, expected) => {
    document.body.innerHTML = `<div>${html}</div>`;
    expect(channelKey(document.body.firstElementChild!)).toBe(expected);
  });
  const home: HomeSummary = { visits: SHARE_MIN_VISITS, served: 1200, distinct: 300, repeats: 900, watched: 40, since: 0, top: [{ videoId: ids[0]!, title: 'A'.repeat(300), served: 14 }] };
  it('fits the post within 280 characters and trims long titles', () => {
    const post = sharePost({ ...home, since: 1_000 }, 1_000 + 3 * 86_400_000);
    expect(post.length).toBeLessThanOrEqual(280);
    expect(post).toContain('3 days');
    expect(post).toContain('1,200 recommendations. Only 300 different videos.');
    expect(post).toContain('75% were reruns. 40 were videos');
    expect(post).toMatch(/A…" 14 times/);
  });
  it('omits the top video when it barely repeated', () => {
    expect(sharePost({ ...home, watched: 0, top: [{ videoId: ids[0]!, title: 'Short', served: 2 }] })).not.toContain('It showed me');
  });
});
