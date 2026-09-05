import fixtures from './fixtures/youtube-compatibility.html?raw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { detectCard, findCardRoots } from '../src/content/card-detector';
import { CardDecorator } from '../src/content/card-decorator';
import { CardObserver } from '../src/content/observer';
import { HomeShortsFilter } from '../src/content/home-shorts-filter';
import { DEFAULT_SETTINGS } from '../src/shared/constants';
import { isWatched } from '../src/shared/watched-state';
import { youtubeProgress } from '../src/youtube/progress-detection';
import { Repository } from '../src/background/repository';
import { videoKey } from '../src/storage/watched-store';
import type { VideoRecord } from '../src/shared/types';

function fixture(name: string): HTMLElement {
  const container = document.createElement('div'); container.innerHTML = fixtures;
  document.body.replaceChildren((container.querySelector(`#${name}`) as HTMLTemplateElement).content.cloneNode(true));
  return [...findCardRoots(document)][0]!;
}
let observer: CardObserver | undefined;
beforeEach(() => { history.replaceState({}, '', '/'); });
afterEach(() => { observer?.stop(); observer = undefined; vi.useRealTimers(); vi.unstubAllGlobals(); document.body.replaceChildren(); });

describe('reference compatibility regressions', () => {
  it.each(['/', '/results?search_query=test', '/feed/subscriptions', '/@creator/videos', '/watch?v=abcdefghijk'])('reads ytw resume overlays on %s', path => {
    history.replaceState({}, '', path);
    expect(detectCard(fixture('search-ytw'))).toMatchObject({ videoId: 'dQw4w9WgXcQ', progress: .85, title: 'Search video' });
    expect(findCardRoots(document).size).toBe(1);
  });
  it('keeps new hints transient, preserves history priority and suppresses explicit imports after manual unwatched', async () => {
    const data: Record<string, unknown> = {};
    const set = vi.fn(async (values: Record<string, unknown>) => { Object.assign(data, structuredClone(values)); });
    vi.stubGlobal('chrome', { storage: { local: {
      get: vi.fn(async (keys: string | string[]) => Object.fromEntries((typeof keys === 'string' ? [keys] : keys).map(key => [key, data[key]]))), set
    } } });
    const card = detectCard(fixture('search-ytw'))!;
    expect(isWatched(undefined, card.progress, false, DEFAULT_SETTINGS)).toBe(true);
    expect(set).not.toHaveBeenCalled();
    const repository = new Repository();
    const videos = [{ videoId: card.videoId, progress: card.progress! }];
    expect(await repository.dispatch({ type: 'import', videos, revision: 0 })).toEqual({ imported: 1 });
    const record = data[videoKey(card.videoId)] as VideoRecord;
    expect(record.source).toBe('youtube-ui'); expect(record.watchedAt).toBeUndefined(); expect(record.importedAt).toBeTypeOf('number');
    expect(isWatched(record, null, false, DEFAULT_SETTINGS)).toBe(true);
    await repository.dispatch({ type: 'mark', videoId: card.videoId, watched: false });
    expect(isWatched(data[videoKey(card.videoId)] as VideoRecord, card.progress, false, DEFAULT_SETTINGS)).toBe(false);
    expect(await repository.dispatch({ type: 'import', videos, revision: 1 })).toEqual({ imported: 0 });
  });
  it('rejects active playback hints but still reads genuine resume history in the same card', () => {
    const root = fixture('related-playing');
    expect(youtubeProgress(root)).toBeNull();
    root.querySelector('a')!.insertAdjacentHTML('beforeend', '<ytd-thumbnail-overlay-resume-playback-renderer><div id="progress" style="width:80%"></div></ytd-thumbnail-overlay-resume-playback-renderer>');
    expect(youtubeProgress(root)).toBe(.8);
  });
  it('does not mistake unrelated or hidden progress for a ytw resume indicator', () => {
    const root = fixture('search-ytw');
    const host = root.querySelector<HTMLElement>('ytw-thumbnail-overlay-resume-playback-renderer')!;
    host.hidden = true; expect(youtubeProgress(root)).toBeNull();
    host.hidden = false;
    host.firstElementChild!.setAttribute('style', 'width:500px'); expect(youtubeProgress(root)).toBeNull();
    host.replaceWith(host.firstElementChild!); expect(youtubeProgress(root)).toBeNull();
    root.insertAdjacentHTML('beforeend', '<div role="progressbar" aria-valuenow="100"></div>');
    expect(youtubeProgress(root)).toBeNull();
  });
  it('re-evaluates now-playing and accessible scale changes without another mutation or full scan', async () => {
    vi.useFakeTimers(); const root = fixture('related-playing');
    const onCards = vi.fn(); const onSubtree = vi.fn();
    observer = new CardObserver(onCards, vi.fn(), vi.fn(), onSubtree); observer.start();
    onCards.mockClear(); onSubtree.mockClear();
    root.querySelector('ytd-thumbnail-overlay-now-playing-renderer')!.removeAttribute('now-playing-badge');
    await vi.advanceTimersByTimeAsync(200);
    expect(onCards).toHaveBeenCalledTimes(1); expect(youtubeProgress(root)).toBe(.95);
    expect(onSubtree.mock.calls.every(([subtree]) => subtree !== document)).toBe(true);
    root.querySelector('a')!.innerHTML = '<ytw-thumbnail-overlay-resume-playback-renderer><div role="progressbar" aria-valuenow="80" aria-valuemax="100"></div></ytw-thumbnail-overlay-resume-playback-renderer>';
    await vi.advanceTimersByTimeAsync(200); onCards.mockClear();
    root.querySelector('[role="progressbar"]')!.setAttribute('aria-valuemax', '200');
    await vi.advanceTimersByTimeAsync(200);
    expect(onCards).toHaveBeenCalledTimes(1); expect(youtubeProgress(root)).toBe(.4);
  });
  it('discovers late descendant renderer replacements once and prunes removals', async () => {
    vi.useFakeTimers(); const root = fixture('search-ytw');
    const onCards = vi.fn(); const onRemove = vi.fn();
    observer = new CardObserver(onCards, onRemove); observer.start(); onCards.mockClear();
    const nested = document.createElement('yt-lockup-view-model'); nested.innerHTML = root.innerHTML;
    root.replaceWith(nested);
    await vi.advanceTimersByTimeAsync(200);
    expect(onRemove).toHaveBeenCalled(); expect(onCards).toHaveBeenCalledTimes(1);
    expect([...onCards.mock.calls[0]![0]]).toEqual([nested]);
  });
  it('keeps the existing outer rich-item hide target for nested lockups and restores metadata', () => {
    const lockup = fixture('related-playing');
    const wrapper = document.createElement('ytd-rich-item-renderer'); lockup.replaceWith(wrapper); wrapper.append(lockup);
    wrapper.insertAdjacentHTML('beforeend', '<div id="metadata">Outer metadata</div>');
    expect([...findCardRoots(document)]).toEqual([wrapper]);
    const decorator = new CardDecorator(vi.fn()); const card = detectCard(wrapper)!;
    decorator.apply(card, true, undefined, { ...DEFAULT_SETTINGS, displayMode: 'hide' });
    expect(wrapper.querySelector('#metadata')!.closest('.aw-hidden')).toBe(wrapper);
    decorator.apply(card, false, undefined, DEFAULT_SETTINGS);
    expect(wrapper.classList.contains('aw-hidden')).toBe(false);
  });
  it('recognizes v2 Shorts, hides only the Home shelf, and restores recycled mixed grids', async () => {
    vi.useFakeTimers(); const root = fixture('shorts-grid');
    expect(detectCard(root)).toMatchObject({ shorts: true, title: 'Short video' });
    let settings = { ...DEFAULT_SETTINGS, hideHomeShorts: true };
    const filter = new HomeShortsFilter(() => settings);
    observer = new CardObserver(vi.fn(), () => filter.prune(), vi.fn(), subtree => filter.update(subtree)); observer.start();
    const shelf = root.closest<HTMLElement>('grid-shelf-view-model')!;
    expect(shelf.classList.contains('aw-home-shorts-hidden')).toBe(true);
    root.querySelector('a')!.href = '/watch?v=dQw4w9WgXcQ';
    await vi.advanceTimersByTimeAsync(300);
    expect(shelf.querySelector('.aw-home-shorts-hidden')).toBeNull(); expect(shelf.classList.contains('aw-home-shorts-hidden')).toBe(false);
    root.querySelector('a')!.href = '/shorts/dQw4w9WgXcQ';
    await vi.advanceTimersByTimeAsync(300);
    history.replaceState({}, '', '/@creator/shorts'); filter.update(document);
    expect(document.querySelector('.aw-home-shorts-hidden')).toBeNull();
    history.replaceState({}, '', '/'); filter.update(document);
    settings = { ...settings, hideHomeShorts: false }; filter.update(document);
    expect(document.querySelector('.aw-home-shorts-hidden')).toBeNull();
    filter.clear();
  });
  it('keeps mixed grid shelves and ordinary videos intact', () => {
    const root = fixture('shorts-grid');
    const shelf = root.closest<HTMLElement>('grid-shelf-view-model')!;
    shelf.insertAdjacentHTML('beforeend', '<yt-lockup-view-model><a id="thumbnail" href="/watch?v=abcdefghijk"><img></a></yt-lockup-view-model>');
    const filter = new HomeShortsFilter(() => ({ ...DEFAULT_SETTINGS, hideHomeShorts: true }));
    filter.update(document);
    expect(shelf.classList.contains('aw-home-shorts-hidden')).toBe(false);
    expect(root.classList.contains('aw-home-shorts-hidden')).toBe(true);
    expect(shelf.querySelector('yt-lockup-view-model')!.closest('.aw-home-shorts-hidden')).toBeNull();
    filter.clear();
  });
});
