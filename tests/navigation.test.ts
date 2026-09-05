import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { watchNavigation } from '../src/content/youtube-navigation';

let stop: (() => void) | undefined;
beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { stop?.(); stop = undefined; vi.useRealTimers(); history.replaceState({}, '', '/'); });

it.each([
  ['/', '/watch?v=dQw4w9WgXcQ'],
  ['/watch?v=dQw4w9WgXcQ', '/watch?v=abcdefghijk'],
  ['/watch?v=dQw4w9WgXcQ', '/results?search_query=test'],
  ['/results?search_query=test', '/@creator'],
  ['/@creator', '/@creator/videos'],
  ['/@creator/videos', '/@creator/shorts'],
  ['/feed/subscriptions', '/watch?v=dQw4w9WgXcQ'],
  ['/shorts/dQw4w9WgXcQ', '/'],
  ['/watch?v=dQw4w9WgXcQ&list=PL123&index=1', '/watch?v=abcdefghijk&list=PL123&index=2']
])('settles navigation from %s to %s once despite duplicate YouTube events', async (from, to) => {
  history.replaceState({}, '', from);
  const start = vi.fn(); const finish = vi.fn(); stop = watchNavigation(start, finish);
  document.dispatchEvent(new Event('yt-navigate-start'));
  history.replaceState({}, '', to);
  document.dispatchEvent(new Event('yt-navigate-finish'));
  document.dispatchEvent(new Event('yt-page-data-updated'));
  await vi.advanceTimersByTimeAsync(1200);
  expect(start).toHaveBeenCalledTimes(1); expect(finish).toHaveBeenCalledTimes(1);
});

it.each(['autoplay', 'popstate'])('detects same-path video changes through %s without YouTube events', async kind => {
  history.replaceState({}, '', '/watch?v=dQw4w9WgXcQ');
  const start = vi.fn(); const finish = vi.fn(); stop = watchNavigation(start, finish);
  history.replaceState({}, '', '/watch?v=abcdefghijk');
  if (kind === 'popstate') window.dispatchEvent(new PopStateEvent('popstate'));
  await vi.advanceTimersByTimeAsync(1200);
  expect(start).toHaveBeenCalledTimes(1); expect(finish).toHaveBeenCalledTimes(1);
  stop();
  history.replaceState({}, '', '/');
  document.dispatchEvent(new Event('yt-navigate-finish'));
  await vi.advanceTimersByTimeAsync(1200);
  expect(finish).toHaveBeenCalledTimes(1);
});
