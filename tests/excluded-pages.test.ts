import { afterEach, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '../src/shared/constants';

const settings = { ...DEFAULT_SETTINGS, displayMode: 'hide' as const, hideWatchedInSearch: false };
const sendMessage = vi.fn(async () => ({ ok: true, data: { settings, records: {}, revision: 0 } }));
let onStorage: (changes: Record<string, chrome.storage.StorageChange>, area: string) => void;
vi.stubGlobal('chrome', {
  runtime: { id: 'test', sendMessage, onMessage: { addListener: vi.fn(), removeListener: vi.fn() } },
  storage: { onChanged: { addListener: vi.fn(listener => { onStorage = listener; }), removeListener: vi.fn() } }
});

afterEach(() => {
  window.dispatchEvent(new Event('pagehide'));
  vi.useRealTimers();
  document.body.innerHTML = '';
});

it('keeps library/channel indicators and restores reused cards across SPA navigation and search settings', async () => {
  vi.useFakeTimers();
  history.replaceState({}, '', '/feed/history');
  document.body.innerHTML = '<ytd-video-renderer><a id="thumbnail" href="/watch?v=dQw4w9WgXcQ"><img></a><h3>Video</h3><ytd-thumbnail-overlay-resume-playback-renderer><div id="progress" style="width: 100%"></div></ytd-thumbnail-overlay-resume-playback-renderer></ytd-video-renderer>';
  await import('../src/content/index');
  await vi.advanceTimersByTimeAsync(500);
  expect(document.querySelector('.aw-hidden')).toBeNull();
  expect(document.querySelector<HTMLSpanElement>('.aw-badge')!.hidden).toBe(false);
  expect(document.querySelector('.aw-control')).not.toBeNull();

  const visiblePaths = [
    '/feed/history?query=test', '/playlist?list=WL', '/playlist?list=LL', '/playlist?list=PL123', '/playlist/?list=LL',
    '/@me', '/@creator/videos', '/@creator/shorts', '/@creator/playlists?view=1',
    '/channel/UC123', '/channel/UC123/streams', '/c/creator/videos', '/user/creator/featured',
    '/feed/subscriptions', '/feed/library', '/feed/you', '/results?search_query=test'
  ];
  for (const path of visiblePaths.flatMap(path => ['/', path])) {
    document.dispatchEvent(new Event('yt-navigate-start'));
    history.replaceState({}, '', path);
    document.dispatchEvent(new Event('yt-navigate-finish'));
    await vi.advanceTimersByTimeAsync(500);
    expect(document.querySelector('.aw-control'), path).not.toBeNull();
    expect(Boolean(document.querySelector('.aw-hidden')), path).toBe(path === '/');
    if (path !== '/') expect(document.querySelector<HTMLSpanElement>('.aw-badge')!.hidden, path).toBe(false);
  }
  // A storage event applies the independent Search preference without navigation.
  onStorage!({ settings: { newValue: { ...settings, hideWatchedInSearch: true } } }, 'local');
  expect(document.querySelector('.aw-hidden')).not.toBeNull();
  onStorage!({ settings: { newValue: settings } }, 'local');
  expect(document.querySelector('.aw-hidden')).toBeNull();
  expect(sendMessage.mock.calls.filter(call => (call as unknown as [{ type: string }])[0]?.type === 'snapshot')).toHaveLength(1);
});
