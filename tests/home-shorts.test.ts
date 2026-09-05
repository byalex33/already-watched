import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HomeShortsFilter, isHomePage } from '../src/content/home-shorts-filter';
import { DEFAULT_SETTINGS } from '../src/shared/constants';
import { normalizeSettings } from '../src/storage/settings-store';
import type { Settings } from '../src/shared/types';
import { CardObserver } from '../src/content/observer';

let settings: Settings;
let filter: HomeShortsFilter;
beforeEach(() => {
  history.replaceState({}, '', '/');
  settings = { ...DEFAULT_SETTINGS, hideHomeShorts: true };
  filter = new HomeShortsFilter(() => settings);
  document.body.innerHTML = '<ytd-rich-grid-renderer><div id="contents"><ytd-rich-section-renderer id="shelf"><ytd-rich-shelf-renderer is-shorts><h2>Shorts</h2><ytd-rich-item-renderer id="short"><a id="thumbnail" href="/shorts/dQw4w9WgXcQ"><img></a></ytd-rich-item-renderer></ytd-rich-shelf-renderer></ytd-rich-section-renderer><ytd-rich-item-renderer id="video"><a id="thumbnail" href="/watch?v=abcdefghijk"><img></a><h3>Shorts</h3></ytd-rich-item-renderer></div></ytd-rich-grid-renderer>';
});
afterEach(() => { filter.clear(); vi.useRealTimers(); });
describe('Home-only Shorts hiding', () => {
  it('defaults off and preserves an explicitly saved setting', () => {
    expect(normalizeSettings({}).hideHomeShorts).toBe(false);
    expect(normalizeSettings(settings).hideHomeShorts).toBe(true);
  });
  it('hides the whole Home shelf and leaves normal videos intact', () => {
    filter.update(document);
    expect(document.querySelector('#shelf')!.classList.contains('aw-home-shorts-hidden')).toBe(true);
    expect(document.querySelector('#video')!.closest('.aw-home-shorts-hidden')).toBeNull();
  });
  it('hides standalone Shorts even if watched-Shorts processing is disabled', () => {
    settings.applyToShorts = false;
    const short = document.querySelector<HTMLElement>('#short')!;
    document.querySelector('ytd-rich-grid-renderer > #contents')!.append(short);
    filter.update(short); expect(short.classList.contains('aw-home-shorts-hidden')).toBe(true);
  });
  it.each(['/shorts/dQw4w9WgXcQ', '/results?search_query=shorts', '/@creator/shorts', '/feed/subscriptions', '/watch?v=dQw4w9WgXcQ'])('restores Shorts when navigating to %s', path => {
    filter.update(document); history.replaceState({}, '', path); filter.update(document);
    expect(document.querySelector('.aw-home-shorts-hidden')).toBeNull();
  });
  it('restores Shorts when the toggle or extension is disabled', () => {
    filter.update(document); settings.hideHomeShorts = false; filter.update(document);
    expect(document.querySelector('.aw-home-shorts-hidden')).toBeNull();
    settings.hideHomeShorts = true; filter.update(document); settings.enabled = false; filter.update(document);
    expect(document.querySelector('.aw-home-shorts-hidden')).toBeNull();
  });
  it('restores recycled cards after their href changes to a normal video', async () => {
    vi.useFakeTimers();
    const short = document.querySelector<HTMLElement>('#short')!;
    document.querySelector('ytd-rich-grid-renderer > #contents')!.append(short);
    const observer = new CardObserver(vi.fn(), vi.fn(), vi.fn(), root => filter.update(root)); observer.start();
    expect(short.classList.contains('aw-home-shorts-hidden')).toBe(true);
    short.querySelector('a')!.href = '/watch?v=dQw4w9WgXcQ';
    await vi.advanceTimersByTimeAsync(500);
    expect(short.classList.contains('aw-home-shorts-hidden')).toBe(false);
    observer.stop();
  });
  it('handles late-added shelves and releases detached elements', async () => {
    vi.useFakeTimers();
    const shelf = document.querySelector<HTMLElement>('#shelf')!; shelf.remove();
    const observer = new CardObserver(vi.fn(), () => filter.prune(), vi.fn(), root => filter.update(root)); observer.start();
    document.querySelector('ytd-rich-grid-renderer > #contents')!.append(shelf);
    await vi.advanceTimersByTimeAsync(500);
    expect(shelf.classList.contains('aw-home-shorts-hidden')).toBe(true);
    shelf.remove(); filter.prune(); expect(shelf.classList.contains('aw-home-shorts-hidden')).toBe(false);
    observer.stop();
  });
  it('recognizes Home with feed filters without matching other hosts', () => {
    expect(isHomePage('https://www.youtube.com/?app=desktop')).toBe(true);
    expect(isHomePage('https://example.com/')).toBe(false);
    expect(isHomePage('invalid')).toBe(false);
  });
});
