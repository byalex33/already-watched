import { expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '../src/shared/constants';

it('cleans up navigation after extension APIs disappear', async () => {
  vi.useFakeTimers();
  const api = {
    runtime: { id: 'test', sendMessage: vi.fn(async () => ({ ok: true, data: { settings: DEFAULT_SETTINGS, records: {}, revision: 0 } })), onMessage: { addListener: vi.fn(), removeListener: vi.fn() } },
    storage: { onChanged: { addListener: vi.fn(), removeListener: vi.fn() } }
  };
  vi.stubGlobal('chrome', api);
  const errors: string[] = [];
  const onError = (event: ErrorEvent): void => { errors.push(event.message); event.preventDefault(); };
  window.addEventListener('error', onError);
  try {
    history.replaceState({}, '', '/');
    document.body.innerHTML = '<ytd-video-renderer><a id="thumbnail" href="/watch?v=dQw4w9WgXcQ"><img></a><h3>Video</h3></ytd-video-renderer>';
    await import('../src/content/index');
    await vi.advanceTimersByTimeAsync(500);
    expect(document.querySelector('.aw-control')).not.toBeNull();
    vi.stubGlobal('chrome', { runtime: {} });
    history.replaceState({}, '', '/feed/history');
    document.dispatchEvent(new Event('yt-navigate-finish'));
    await vi.advanceTimersByTimeAsync(500);
    expect(errors).toEqual([]);
    expect(document.querySelector('[class*="aw-"]')).toBeNull();
    window.dispatchEvent(new Event('pagehide'));
    expect(errors).toEqual([]);

    // Chrome may retain the event object but reject listener removal instead.
    vi.stubGlobal('chrome', api);
    history.replaceState({}, '', '/');
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
    await vi.advanceTimersByTimeAsync(500);
    expect(document.querySelector('.aw-control')).not.toBeNull();
    api.storage.onChanged.removeListener.mockImplementation(() => { throw new Error('Extension context invalidated.'); });
    api.runtime.onMessage.removeListener.mockImplementation(() => { throw new Error('Extension context invalidated.'); });
    history.replaceState({}, '', '/feed/history');
    document.dispatchEvent(new Event('yt-navigate-finish'));
    await vi.advanceTimersByTimeAsync(500);
    expect(errors).toEqual([]);
    expect(document.querySelector('[class*="aw-"]')).toBeNull();
    api.storage.onChanged.removeListener.mockReset();
    api.runtime.onMessage.removeListener.mockReset();

    // Cleanup also runs if navigation wins the race with snapshot loading.
    for (const rejectSnapshot of [false, true]) {
      let finish!: () => void;
      api.runtime.sendMessage.mockImplementationOnce(() => new Promise((resolve, reject) => {
        finish = () => rejectSnapshot
          ? reject(new Error('Extension context invalidated.'))
          : resolve({ ok: true, data: { settings: DEFAULT_SETTINGS, records: {}, revision: 0 } });
      }));
      history.replaceState({}, '', '/');
      window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
      vi.stubGlobal('chrome', { runtime: {} });
      history.replaceState({}, '', '/feed/history');
      document.dispatchEvent(new Event('yt-navigate-finish'));
      finish();
      await vi.advanceTimersByTimeAsync(500);
      expect(errors).toEqual([]);
      expect(document.querySelector('[class*="aw-"]')).toBeNull();
      vi.stubGlobal('chrome', api);
    }
  } finally {
    vi.stubGlobal('chrome', api);
    window.dispatchEvent(new Event('pagehide'));
    window.removeEventListener('error', onError);
    vi.useRealTimers();
    document.body.innerHTML = '';
  }
});
