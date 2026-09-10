import { afterEach, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '../src/shared/constants';

const sendMessage = vi.fn(async () => ({ ok: true, data: { settings: { ...DEFAULT_SETTINGS, displayMode: 'hide' }, records: {}, revision: 0 } }));
vi.stubGlobal('chrome', {
  runtime: { id: 'test', sendMessage, onMessage: { addListener: vi.fn(), removeListener: vi.fn() } },
  storage: { onChanged: { addListener: vi.fn(), removeListener: vi.fn() } }
});

afterEach(() => {
  window.dispatchEvent(new Event('pagehide'));
  vi.useRealTimers();
  document.body.innerHTML = '';
});

it('leaves History, playlists, and profiles untouched and resumes on other pages', async () => {
  vi.useFakeTimers();
  history.replaceState({}, '', '/feed/history');
  document.body.innerHTML = '<ytd-video-renderer><a id="thumbnail" href="/watch?v=dQw4w9WgXcQ"><img></a><h3>Video</h3><ytd-thumbnail-overlay-resume-playback-renderer><div id="progress" style="width: 100%"></div></ytd-thumbnail-overlay-resume-playback-renderer></ytd-video-renderer>';
  await import('../src/content/index');
  await vi.advanceTimersByTimeAsync(500);
  expect(document.querySelector('.aw-control')).toBeNull();
  expect(sendMessage).not.toHaveBeenCalled();

  const excludedPaths = [
    '/feed/history?query=test', '/playlist?list=WL', '/playlist?list=PL123', '/playlist/?list=LL',
    '/@creator', '/@creator/videos', '/@creator/shorts', '/@creator/playlists?view=1',
    '/channel/UC123', '/channel/UC123/streams', '/c/creator/videos', '/user/creator/featured'
  ];
  // Reuse the same card across navigation to verify hiding is cleared and restored.
  for (const path of excludedPaths.flatMap(path => ['/', path, '/results?search_query=test'])) {
    document.dispatchEvent(new Event('yt-navigate-start'));
    history.replaceState({}, '', path);
    document.dispatchEvent(new Event('yt-navigate-finish'));
    await vi.advanceTimersByTimeAsync(500);
    const excluded = excludedPaths.includes(path);
    expect(Boolean(document.querySelector('.aw-control')), path).toBe(!excluded);
    if (excluded) expect(document.querySelector('[class*="aw-"]')).toBeNull();
    else expect(document.querySelector('.aw-hidden')).not.toBeNull();
  }

  // A snapshot requested on Home must not start processing after we leave it.
  window.dispatchEvent(new Event('pagehide'));
  let resolveSnapshot!: (value: Awaited<ReturnType<typeof sendMessage>>) => void;
  sendMessage.mockImplementationOnce(() => new Promise(resolve => { resolveSnapshot = resolve; }));
  history.replaceState({}, '', '/');
  window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
  document.dispatchEvent(new Event('yt-navigate-start'));
  history.replaceState({}, '', '/@creator/videos');
  document.dispatchEvent(new Event('yt-navigate-finish'));
  resolveSnapshot({ ok: true, data: { settings: { ...DEFAULT_SETTINGS, displayMode: 'hide' }, records: {}, revision: 0 } });
  await vi.advanceTimersByTimeAsync(500);
  expect(document.querySelector('[class*="aw-"]')).toBeNull();
});
