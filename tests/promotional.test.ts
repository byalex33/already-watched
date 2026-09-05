import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PromotionalFilter } from '../src/content/promotional-filter';
import { CardObserver } from '../src/content/observer';
import { DEFAULT_SETTINGS } from '../src/shared/constants';
import type { Settings } from '../src/shared/types';
import { normalizeSettings } from '../src/storage/settings-store';
import { isPromotionalHeading } from '../src/youtube/promotional-sections';

let settings: Settings;
let filter: PromotionalFilter;
beforeEach(() => {
  document.body.innerHTML = '';
  settings = { ...DEFAULT_SETTINGS, hidePromotionalSections: true };
  filter = new PromotionalFilter(() => settings);
});
afterEach(() => { filter.clear(); vi.useRealTimers(); });

function fixture(heading: string, renderer = 'ytd-rich-shelf-renderer'): HTMLElement {
  document.body.innerHTML = `<ytd-rich-grid-renderer><div id="contents"><ytd-rich-item-renderer id="ordinary"><h3>Keep this video</h3></ytd-rich-item-renderer><ytd-rich-section-renderer id="promo"><${renderer}><h2>${heading}</h2><div>Section content</div></${renderer}></ytd-rich-section-renderer></div></ytd-rich-grid-renderer>`;
  return document.querySelector('#promo')!;
}

describe('promotional section settings', () => {
  it('migrates old settings gently and persists the explicit choice', () => {
    expect(normalizeSettings({ enabled: true }).hidePromotionalSections).toBe(false);
    expect(normalizeSettings(settings).hidePromotionalSections).toBe(true);
    expect(normalizeSettings({ hidePromotionalSections: 'true' }).hidePromotionalSections).toBe(false);
  });
  it('works independently of watched display mode and restores when disabled', () => {
    const section = fixture('YouTube Playables');
    filter.update(document); expect(section.classList.contains('aw-promo-hidden')).toBe(true);
    settings.hidePromotionalSections = false; filter.update(document);
    expect(section.classList.contains('aw-promo-hidden')).toBe(false);
    settings.hidePromotionalSections = true; filter.update(document);
    settings.enabled = false; filter.update(document);
    expect(section.classList.contains('aw-promo-hidden')).toBe(false);
  });
});

describe('promotional adapters', () => {
  it.each(['YouTube Playables', 'Playables', 'Instant games, no downloads', 'Explore more topics'])('hides the whole %s shelf without hiding the feed', heading => {
    const section = fixture(heading); filter.update(document);
    expect(section.classList.contains('aw-promo-hidden')).toBe(true);
    expect(document.querySelector('ytd-rich-grid-renderer')!.classList.contains('aw-promo-hidden')).toBe(false);
    expect(document.querySelector('#ordinary')!.closest('.aw-promo-hidden')).toBeNull();
  });
  it('matches the Playables title/subtitle structure inspected in Chrome', () => {
    const section = fixture('<a href="/playables"><span id="title">YouTube Playables</span></a><div id="subtitle">Instant games, no downloads</div>');
    filter.update(document); expect(section.classList.contains('aw-promo-hidden')).toBe(true);
  });
  it('matches the newer Explore more topics renderer inspected in Chrome', () => {
    const section = fixture('<span>Explore more topics</span>', 'ytd-chips-shelf-with-video-shelf-renderer');
    filter.update(document); expect(section.classList.contains('aw-promo-hidden')).toBe(true);
  });
  it('normalizes whitespace and punctuation but avoids broad substring matching', () => {
    expect(isPromotionalHeading('  Explore\n more topics: ')).toBe(true);
    expect(isPromotionalHeading('YouTube Playables review')).toBe(false);
    expect(isPromotionalHeading('How to hide YouTube Playables')).toBe(false);
  });
  it('does not hide videos with matching titles or normal Shorts shelves', () => {
    const section = fixture('Shorts');
    section.querySelector('div')!.innerHTML = '<ytd-rich-item-renderer><h3 id="title">YouTube Playables</h3></ytd-rich-item-renderer>';
    filter.update(document); expect(section.classList.contains('aw-promo-hidden')).toBe(false);
  });
  it('does not hide an unrelated sibling shelf in a shared wrapper', () => {
    const section = fixture('YouTube Playables');
    const other = document.createElement('ytd-rich-shelf-renderer'); other.innerHTML = '<h2>Music</h2>'; section.append(other);
    filter.update(document);
    expect(section.classList.contains('aw-promo-hidden')).toBe(false);
    expect(section.querySelector('ytd-rich-shelf-renderer')!.classList.contains('aw-promo-hidden')).toBe(true);
    expect(other.closest('.aw-promo-hidden')).toBeNull();
  });
  it('restores recycled sections and releases detached nodes', () => {
    const section = fixture('YouTube Playables'); filter.update(document);
    const heading = section.querySelector('h2')!; heading.textContent = 'Latest videos'; filter.update(heading);
    expect(section.classList.contains('aw-promo-hidden')).toBe(false);
    heading.textContent = 'Explore more topics'; filter.update(heading);
    section.remove(); filter.prune(); expect(section.classList.contains('aw-promo-hidden')).toBe(false);
  });
  it('keeps a matching shelf hidden when an unrelated wrapper child updates', () => {
    const section = fixture('YouTube Playables'); filter.update(document);
    const added = document.createElement('div'); added.textContent = 'Updated'; section.append(added);
    filter.update(added); expect(section.classList.contains('aw-promo-hidden')).toBe(true);
  });
  it('handles dynamically inserted shelves and late/recycled heading text without loops', async () => {
    vi.useFakeTimers();
    const update = vi.fn((root: Element | Document) => filter.update(root));
    const observer = new CardObserver(vi.fn(), () => filter.prune(), vi.fn(), update);
    observer.start();
    const section = fixture('Loading'); await vi.advanceTimersByTimeAsync(500);
    const text = section.querySelector('h2')!.firstChild!;
    text.nodeValue = 'YouTube Playables'; await vi.advanceTimersByTimeAsync(500);
    expect(section.classList.contains('aw-promo-hidden')).toBe(true);
    const calls = update.mock.calls.length; await vi.advanceTimersByTimeAsync(1000);
    expect(update.mock.calls.length).toBe(calls);
    text.nodeValue = 'New videos'; await vi.advanceTimersByTimeAsync(500);
    expect(section.classList.contains('aw-promo-hidden')).toBe(false);
    observer.stop();
  });
});
