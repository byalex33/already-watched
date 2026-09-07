import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { HomeLivestreamFilter } from '../src/content/home-livestream-filter';
import { CardObserver } from '../src/content/observer';
import { DEFAULT_SETTINGS } from '../src/shared/constants';
import { normalizeSettings } from '../src/storage/settings-store';
import type { Settings } from '../src/shared/types';

let settings: Settings;
let filter: HomeLivestreamFilter;
let observer: CardObserver | undefined;
function fixture(badge: string): HTMLElement {
  document.body.innerHTML = `<ytd-rich-item-renderer><a id="thumbnail" href="/watch?v=abcdefghijk"><img>${badge}</a><h3>Live concert recording</h3><button aria-label="Tap to watch live, channel">LIVE</button></ytd-rich-item-renderer>`;
  return document.body.firstElementChild as HTMLElement;
}
beforeEach(() => {
  history.replaceState({}, '', '/');
  settings = { ...DEFAULT_SETTINGS, hideHomeLivestreams: true };
  filter = new HomeLivestreamFilter(() => settings);
});
afterEach(() => { observer?.stop(); observer = undefined; filter.clear(); vi.useRealTimers(); document.body.innerHTML = ''; });
it('defaults off and persists an explicit toggle', () => {
  expect(normalizeSettings({}).hideHomeLivestreams).toBe(false);
  expect(normalizeSettings(settings).hideHomeLivestreams).toBe(true);
});
it.each([
  '<ytd-thumbnail-overlay-time-status-renderer overlay-style="LIVE">LIVE</ytd-thumbnail-overlay-time-status-renderer>',
  '<yt-thumbnail-badge-view-model><span>LIVE</span></yt-thumbnail-badge-view-model>',
  '<yt-badge-view-model><span>Live now</span></yt-badge-view-model>',
  '<ytd-badge-supported-renderer><div class="badge-style-type-live-now">EN DIRECT</div></ytd-badge-supported-renderer>'
])('hides live video badges on Home: %s', badge => {
  const card = fixture(badge); filter.update(document);
  expect(card.classList.contains('aw-home-live-hidden')).toBe(true);
});
it.each(['', '<yt-thumbnail-badge-view-model>12:34</yt-thumbnail-badge-view-model>', '<yt-badge-view-model>UPCOMING</yt-badge-view-model>', '<span>Streamed live 2 days ago</span>'])('preserves recordings, upcoming videos and live channel avatars: %s', badge => {
  const card = fixture(badge); filter.update(document);
  expect(card.classList.contains('aw-home-live-hidden')).toBe(false);
});
it.each(['/feed/subscriptions', '/watch?v=abcdefghijk', '/results?search_query=live', '/@creator', '/playlist?list=WL'])('restores cards away from Home: %s', path => {
  const card = fixture('<yt-thumbnail-badge-view-model>LIVE</yt-thumbnail-badge-view-model>');
  filter.update(document); history.replaceState({}, '', path); filter.update(document);
  expect(card.classList.contains('aw-home-live-hidden')).toBe(false);
});
it('restores cards when either switch is disabled', () => {
  const card = fixture('<yt-thumbnail-badge-view-model>LIVE</yt-thumbnail-badge-view-model>');
  filter.update(document); settings.hideHomeLivestreams = false; filter.update(document);
  expect(card.classList.contains('aw-home-live-hidden')).toBe(false);
  settings.hideHomeLivestreams = true; filter.update(document); settings.enabled = false; filter.update(document);
  expect(card.classList.contains('aw-home-live-hidden')).toBe(false);
});
it('handles late badges, ended streams, and detached cards without an observer loop', async () => {
  vi.useFakeTimers();
  const card = fixture('');
  const update = vi.fn(root => filter.update(root));
  observer = new CardObserver(vi.fn(), () => filter.prune(), vi.fn(), update); observer.start();
  const badge = document.createElement('ytd-thumbnail-overlay-time-status-renderer');
  badge.setAttribute('overlay-style', 'LIVE'); card.querySelector('a')!.append(badge);
  await vi.advanceTimersByTimeAsync(500);
  expect(card.classList.contains('aw-home-live-hidden')).toBe(true);
  badge.setAttribute('overlay-style', 'DEFAULT');
  await vi.advanceTimersByTimeAsync(500);
  expect(card.classList.contains('aw-home-live-hidden')).toBe(false);
  badge.setAttribute('overlay-style', 'LIVE');
  await vi.advanceTimersByTimeAsync(500);
  card.remove(); await vi.advanceTimersByTimeAsync(500);
  expect(card.classList.contains('aw-home-live-hidden')).toBe(false);
  expect(update.mock.calls.length).toBeLessThan(10);
});
