import { normalizeSettings } from '../src/storage/settings-store';
import { afterEach, expect, it, vi } from 'vitest';
import { CardDecorator } from '../src/content/card-decorator';
import { detectCard } from '../src/content/card-detector';
import { DEFAULT_SETTINGS } from '../src/shared/constants';

const decorator = new CardDecorator(vi.fn());
afterEach(() => { document.body.innerHTML = ''; history.replaceState({}, '', '/'); });
function card(path: string, parent = '') {
  history.replaceState({}, '', path);
  document.body.innerHTML = `${parent}<ytd-video-renderer><a id="thumbnail" href="/watch?v=abcdefghijk"><img></a><h3 id="video-title">Example</h3></ytd-video-renderer>`;
  return detectCard(document.querySelector('ytd-video-renderer')!)!;
}
it.each(['/playlist?list=LL', '/feed/history', '/@me/videos', '/@someone/videos', '/channel/UC123', '/user/creator', '/c/creator', '/feed/subscriptions', '/feed/library', '/feed/you'])('keeps watched videos visible with a badge on %s', path => {
  const video = card(path);
  decorator.apply(video, true, undefined, { ...DEFAULT_SETTINGS, displayMode: 'hide', minimumViews: 1000, blockedTitleTerms: ['Example'] });
  expect(video.element.classList.contains('aw-hidden')).toBe(false);
  expect(video.element.querySelector<HTMLSpanElement>('.aw-badge')!.hidden).toBe(false);
});
it('hides only watch-page recommendations, leaving the playlist panel intact', () => {
  const video = card('/watch?v=dQw4w9WgXcQ', '<div id="related">');
  decorator.apply(video, true, undefined, { ...DEFAULT_SETTINGS, displayMode: 'hide' });
  expect(video.element.classList.contains('aw-hidden')).toBe(true);
  const playlist = document.createElement('ytd-playlist-panel-renderer');
  document.body.append(playlist); playlist.append(video.element);
  decorator.apply(video, true, undefined, { ...DEFAULT_SETTINGS, displayMode: 'hide' });
  expect(video.element.classList.contains('aw-hidden')).toBe(false);
});

it.each(['badge', 'dim', 'hide', 'badge-dim', 'hide-refill'] as const)('lets Search visibility override %s independently', displayMode => {
  const video = card('/results?search_query=test');
  for (const hideWatchedInSearch of [false, true, false]) {
    decorator.apply(video, true, undefined, { ...DEFAULT_SETTINGS, displayMode, hideWatchedInSearch });
    expect(video.element.classList.contains('aw-hidden')).toBe(hideWatchedInSearch);
  }
});
it('migrates Search visibility from prior mode and preserves explicit choices', () => {
  expect(normalizeSettings({}).hideWatchedInSearch).toBe(false);
  for (const displayMode of ['hide', 'hide-refill']) expect(normalizeSettings({ displayMode }).hideWatchedInSearch).toBe(true);
  expect(normalizeSettings({ displayMode: 'hide', hideWatchedInSearch: false }).hideWatchedInSearch).toBe(false);
  expect(normalizeSettings({ displayMode: 'badge', hideWatchedInSearch: true }).hideWatchedInSearch).toBe(true);
});
