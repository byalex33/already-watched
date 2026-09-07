import { describe, expect, it, vi } from 'vitest';
import { parseViewCount, youtubeViewCount } from '../src/youtube/view-count';
import { matchesContentFilters } from '../src/shared/content-filters';
import { DEFAULT_SETTINGS } from '../src/shared/constants';
import { normalizeSettings } from '../src/storage/settings-store';
import { detectCard } from '../src/content/card-detector';
import { CardObserver } from '../src/content/observer';
import { CardDecorator } from '../src/content/card-decorator';

describe('content filters', () => {
  it('rechecks metadata that loads later or changes on a recycled card', async () => {
    vi.useFakeTimers();
    document.body.innerHTML = '<ytd-rich-item-renderer><a id="thumbnail" href="/watch?v=abcdefghijk"><img></a><span class="ytContentMetadataViewModelMetadataText"></span></ytd-rich-item-renderer>';
    const root = document.body.firstElementChild as HTMLElement;
    const metadata = root.querySelector('span')!;
    const decorator = new CardDecorator(vi.fn());
    const observer = new CardObserver(roots => {
      for (const element of roots) decorator.apply(detectCard(element)!, false, undefined, { ...DEFAULT_SETTINGS, minimumViews: 250_000 });
    }, vi.fn());
    try {
      observer.start();
      expect(root.classList.contains('aw-hidden')).toBe(false);
      metadata.textContent = '49k views';
      await vi.advanceTimersByTimeAsync(500);
      expect(root.classList.contains('aw-hidden')).toBe(true);
      metadata.firstChild!.textContent = '551k views';
      await vi.advanceTimersByTimeAsync(500);
      expect(root.classList.contains('aw-hidden')).toBe(false);
    } finally {
      observer.stop();
      vi.useRealTimers();
    }
  });
  it.each([['49k views', true], ['250k views', false], ['551k views', false], ['9.7k watching', false]])('filters current Home metadata at a 250,000 minimum: %s', (label, hidden) => {
    document.body.innerHTML = `<ytd-rich-item-renderer><yt-lockup-view-model>
      <a class="yt-lockup-view-model__content-image" href="/watch?v=abcdefghijk"><img></a>
      <div class="ytContentMetadataViewModelMetadataRow" role="group">
        <span class="ytAttributedStringHost ytContentMetadataViewModelMetadataText ytAttributedStringWhiteSpacePreWrap ytAttributedStringLinkInheritColor" dir="auto" role="text">${label}</span>
        <span aria-hidden="true" class="ytContentMetadataViewModelDelimiter"> • </span>
        <span class="ytAttributedStringHost ytContentMetadataViewModelMetadataText ytContentMetadataViewModelMetadataTextLastPart" aria-label="4 years ago" role="text">4 years ago</span>
      </div></yt-lockup-view-model></ytd-rich-item-renderer>`;
    const root = document.body.firstElementChild as HTMLElement;
    const decorator = new CardDecorator(vi.fn());
    decorator.apply(detectCard(root)!, false, undefined, { ...DEFAULT_SETTINGS, minimumViews: 250_000 });
    expect(root.classList.contains('aw-hidden')).toBe(hidden);
  });
  it.each([['49k views', 49000], ['No views', 0], ['1 view', 1], ['12,345 views', 12345], ['1.2K views', 1200], ['3M views', 3000000], ['1.5B views', 1500000000], ['2K\u00a0views', 2000], ['123 watching', null], ['2 years ago', null], ['1,2K views', null], ['1.234 views', null], ['123 Aufrufe', null]])('parses %s safely', (label, count) => {
    expect(parseViewCount(label as string)).toBe(count);
  });
  it('normalizes old and invalid settings', () => {
    expect(normalizeSettings({})).toEqual(DEFAULT_SETTINGS);
    expect(normalizeSettings({ minimumViews: -5, blockedTitleTerms: [' foo ', '', null, 'foo'] })).toMatchObject({ minimumViews: 0, blockedTitleTerms: ['foo'] });
    expect(normalizeSettings({ minimumViews: Infinity }).minimumViews).toBe(0);
  });
  it('uses a strict threshold, preserves unknown counts, and matches literal title phrases', () => {
    const settings = { ...DEFAULT_SETTINGS, minimumViews: 1000, blockedTitleTerms: ['REACTION', '#shorts', '[test]'] };
    const card = { shorts: false, title: 'Ordinary video', views: 1000 };
    expect(matchesContentFilters(card, settings)).toBe(false);
    expect(matchesContentFilters({ ...card, views: 999 }, settings)).toBe(true);
    expect(matchesContentFilters({ ...card, views: null }, settings)).toBe(false);
    for (const title of ['My reaction video', 'Today #Shorts', 'A [test] video']) expect(matchesContentFilters({ ...card, title }, settings)).toBe(true);
    expect(matchesContentFilters({ ...card, title: 'reaction' }, { ...settings, enabled: false })).toBe(false);
    expect(matchesContentFilters({ ...card, shorts: true, views: 0 }, { ...settings, applyToShorts: false })).toBe(false);
  });
  it.each(['.ytContentMetadataViewModelMetadataText', '#metadata-line', '.yt-content-metadata-view-model__metadata-text', '.yt-content-metadata-view-model-wiz__metadata-text', '.shortsLockupViewModelHostMetadataSubhead'])('extracts only metadata and restores cards when settings or content change (%s)', selector => {
    document.body.innerHTML = '<ytd-video-renderer><a id="thumbnail" href="/watch?v=dQw4w9WgXcQ"><img></a><a id="video-title">3M views in a day</a><div><span>500 views</span></div></ytd-video-renderer>';
    const root = document.body.firstElementChild as HTMLElement;
    const metadata = root.querySelector('div')!;
    if (selector.startsWith('#')) metadata.id = selector.slice(1);
    else metadata.className = selector.slice(1);
    expect(youtubeViewCount(root)).toBe(500);
    const decorator = new CardDecorator(vi.fn());
    const settings = { ...DEFAULT_SETTINGS, minimumViews: 1000 };
    decorator.apply(detectCard(root)!, false, undefined, settings);
    expect(root.classList.contains('aw-hidden')).toBe(true);
    metadata.querySelector('span')!.textContent = '2K views';
    decorator.apply(detectCard(root)!, false, undefined, settings);
    expect(root.classList.contains('aw-hidden')).toBe(false);
    decorator.apply(detectCard(root)!, false, undefined, { ...settings, blockedTitleTerms: ['in a day'] });
    expect(root.classList.contains('aw-hidden')).toBe(true);
    decorator.apply(detectCard(root)!, false, undefined, DEFAULT_SETTINGS);
    expect(root.classList.contains('aw-hidden')).toBe(false);
    metadata.remove();
    expect(youtubeViewCount(root)).toBeNull();
  });
});
