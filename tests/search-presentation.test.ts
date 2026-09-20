import styles from '../src/content/styles.css?raw';
import { afterEach, expect, it } from 'vitest';
import { CardDecorator } from '../src/content/card-decorator';
import { detectCard } from '../src/content/card-detector';
import { HomeShortsFilter } from '../src/content/home-shorts-filter';
import { normalizeSettings } from '../src/storage/settings-store';
import { DEFAULT_SETTINGS } from '../src/shared/constants';

afterEach(() => { document.head.innerHTML = ''; document.body.innerHTML = ''; history.replaceState({}, '', '/'); });

it('preserves YouTube absolute thumbnail positioning when decorating search videos', () => {
  document.head.innerHTML = '<style>ytd-thumbnail #thumbnail { position: absolute; inset: 0; }</style>';
  const style = document.createElement('style');
  style.textContent = styles;
  document.head.append(style);
  document.body.innerHTML = '<ytd-video-renderer><ytd-thumbnail><a id="thumbnail" href="/watch?v=abcdefghijk"><img></a></ytd-thumbnail></ytd-video-renderer>';
  const card = detectCard(document.querySelector('ytd-video-renderer')!)!;
  new CardDecorator(() => {}).apply(card, false, undefined, DEFAULT_SETTINGS);
  expect(getComputedStyle(card.thumbnail).position).toBe('absolute');
});

it('excludes Shorts shelves and standalone Shorts from search while preserving regular videos', () => {
  history.replaceState({}, '', '/results?search_query=typescript');
  document.body.innerHTML = '<ytd-reel-shelf-renderer><ytm-shorts-lockup-view-model><a href="/shorts/dQw4w9WgXcQ"><img></a></ytm-shorts-lockup-view-model></ytd-reel-shelf-renderer><ytd-video-renderer id="short"><a id="thumbnail" href="/shorts/dQw4w9WgXcQ"><img></a></ytd-video-renderer><ytd-video-renderer id="video"><a id="thumbnail" href="/watch?v=abcdefghijk"><img></a><h3>Shorts explained</h3></ytd-video-renderer>';
  const filter = new HomeShortsFilter(() => ({ ...DEFAULT_SETTINGS, applyToShorts: false }));
  filter.update(document);
  expect(document.querySelector('ytd-reel-shelf-renderer')!.classList.contains('aw-home-shorts-hidden')).toBe(true);
  expect(document.querySelector('#short')!.classList.contains('aw-home-shorts-hidden')).toBe(true);
  expect(document.querySelector('#video')!.closest('.aw-home-shorts-hidden')).toBeNull();
  filter.clear();
});

it('restores search Shorts when disabled, and respects independent Home settings', () => {
  history.replaceState({}, '', '/results?search_query=typescript');
  document.body.innerHTML = '<ytd-video-renderer><a id="thumbnail" href="/shorts/dQw4w9WgXcQ"><img></a></ytd-video-renderer>';
  const settings = { ...DEFAULT_SETTINGS };
  const filter = new HomeShortsFilter(() => settings);
  const short = document.querySelector('ytd-video-renderer')!;
  filter.update(document);
  expect(short.classList.contains('aw-home-shorts-hidden')).toBe(true);
  settings.hideSearchShorts = false; filter.update(document);
  expect(short.classList.contains('aw-home-shorts-hidden')).toBe(false);
  settings.hideSearchShorts = true; filter.update(document);
  settings.enabled = false; filter.update(document);
  expect(short.classList.contains('aw-home-shorts-hidden')).toBe(false);
  settings.enabled = true; filter.update(document);
  history.replaceState({}, '', '/'); filter.update(document);
  expect(short.classList.contains('aw-home-shorts-hidden')).toBe(false);
  filter.clear();
});

it('positions static thumbnail anchors and removes the fallback on cleanup', () => {
  document.head.innerHTML = `<style>${styles}</style>`;
  document.body.innerHTML = '<ytd-video-renderer><a id="thumbnail" href="/watch?v=abcdefghijk"><img></a></ytd-video-renderer>';
  const card = detectCard(document.querySelector('ytd-video-renderer')!)!;
  const decorator = new CardDecorator(() => {});
  decorator.apply(card, false, undefined, DEFAULT_SETTINGS);
  expect(card.thumbnail.classList.contains('aw-thumbnail-positioned')).toBe(true);
  decorator.clear(card.element);
  expect(card.thumbnail.classList.contains('aw-thumbnail-positioned')).toBe(false);
});

it('defaults search filtering on and preserves an explicit opt-out', () => {
  expect(normalizeSettings({}).hideSearchShorts).toBe(true);
  expect(normalizeSettings({ hideSearchShorts: false }).hideSearchShorts).toBe(false);
});
