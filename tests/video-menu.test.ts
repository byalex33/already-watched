import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { VideoMenu } from '../src/content/video-menu';
import type { VideoCard } from '../src/content/card-detector';

let menu: VideoMenu;
let marked: Set<string>;
let mark: ReturnType<typeof vi.fn<(card: VideoCard, watched: boolean) => Promise<void>>>;
let error: ReturnType<typeof vi.fn>;
function card(id: string, playlist = false): HTMLElement {
  const element = document.createElement(playlist ? 'ytd-playlist-renderer' : 'ytd-rich-item-renderer');
  element.innerHTML = `<a id="thumbnail" href="/watch?v=${id}"><img></a><h3 id="video-title">Video ${id}</h3><ytd-menu-renderer><button aria-label="More actions">…</button></ytd-menu-renderer>`;
  document.body.append(element); return element;
}
function popup(): HTMLElement {
  const element = document.createElement('ytd-menu-popup-renderer');
  element.innerHTML = '<tp-yt-paper-listbox><button role="menuitem">Save to playlist</button></tp-yt-paper-listbox>';
  document.body.append(element); return element;
}
beforeEach(() => {
  vi.useFakeTimers(); history.replaceState({}, '', '/'); document.body.innerHTML = '';
  vi.spyOn(HTMLElement.prototype, 'getClientRects').mockReturnValue([{}] as unknown as DOMRectList);
  marked = new Set(); error = vi.fn();
  mark = vi.fn(async (video: VideoCard, watched: boolean) => { if (watched) marked.add(video.videoId); else marked.delete(video.videoId); });
  menu = new VideoMenu(video => marked.has(video.videoId), mark, error);
});
afterEach(() => { menu.stop(); vi.restoreAllMocks(); vi.useRealTimers(); });
const action = (): HTMLButtonElement | null => document.querySelector('.aw-menu-action');
async function open(element: HTMLElement): Promise<void> {
  element.querySelector<HTMLButtonElement>('button')!.click(); await vi.advanceTimersByTimeAsync(60);
}

describe('YouTube video dropdown action', () => {
  it('adds and removes the clicked video using the existing watched-history command', async () => {
    const video = card('dQw4w9WgXcQ'); popup(); await open(video);
    expect(action()?.textContent).toBe('Add to watched');
    expect(action()?.getAttribute('role')).toBe('menuitem');
    action()!.click(); await vi.advanceTimersByTimeAsync(300);
    expect(mark).toHaveBeenCalledWith(expect.objectContaining({ videoId: 'dQw4w9WgXcQ', title: 'Video dQw4w9WgXcQ' }), true);
    expect(action()?.textContent).toBe('Remove from watched');
    action()!.click(); await vi.advanceTimersByTimeAsync(300);
    expect(marked.size).toBe(0); expect(action()?.textContent).toBe('Add to watched');
  });
  it('handles delayed portal menus and rebuilt menu contents without duplicate entries', async () => {
    const video = card('dQw4w9WgXcQ'); await open(video);
    expect(action()).toBeNull(); const portal = popup(); await vi.advanceTimersByTimeAsync(150);
    expect(action()).not.toBeNull();
    portal.querySelector('tp-yt-paper-listbox')!.innerHTML = '<button>Save</button>';
    await vi.advanceTimersByTimeAsync(1000);
    expect(document.querySelectorAll('.aw-menu-action')).toHaveLength(1);
  });
  it('tracks the new card when YouTube reuses its shared dropdown', async () => {
    const first = card('dQw4w9WgXcQ'); const second = card('abcdefghijk'); popup();
    await open(first); await open(second); action()!.click(); await vi.advanceTimersByTimeAsync(300);
    expect([...marked]).toEqual(['abcdefghijk']);
    expect(document.querySelectorAll('.aw-menu-action')).toHaveLength(1);
  });
  it('refuses stale clicks after a renderer is recycled', async () => {
    const video = card('dQw4w9WgXcQ'); popup(); await open(video);
    video.querySelector('a')!.href = '/watch?v=abcdefghijk'; action()!.click();
    await vi.advanceTimersByTimeAsync(300);
    expect(mark).not.toHaveBeenCalled(); expect(action()).toBeNull();
  });
  it('cleans up on navigation, Escape, closing the popup and disposal', async () => {
    const video = card('dQw4w9WgXcQ'); const portal = popup(); await open(video);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); expect(action()).toBeNull();
    await open(video); portal.hidden = true; await vi.advanceTimersByTimeAsync(300); expect(action()).toBeNull();
    portal.hidden = false; await open(video); history.replaceState({}, '', '/results?search_query=test'); await vi.advanceTimersByTimeAsync(300); expect(action()).toBeNull();
    await open(video); menu.stop(); expect(action()).toBeNull(); expect(vi.getTimerCount()).toBe(0);
  });
  it('removes the action before another native menu action or unrelated menu is opened', async () => {
    const video = card('dQw4w9WgXcQ'); const portal = popup(); await open(video);
    portal.querySelector<HTMLButtonElement>('button:not(.aw-menu-action)')!.click(); expect(action()).toBeNull();
    await open(video); document.body.click(); expect(action()).toBeNull();
  });
  it('does not add video actions to playlist cards or unrelated menus', async () => {
    const playlist = card('dQw4w9WgXcQ', true); popup(); await open(playlist); expect(action()).toBeNull();
    const account = document.createElement('button'); account.setAttribute('aria-label', 'More actions'); document.body.append(account); account.click();
    await vi.advanceTimersByTimeAsync(3000); expect(action()).toBeNull(); expect(vi.getTimerCount()).toBe(0);
  });
  it('does not keep polling when YouTube never opens a supported menu', async () => {
    await open(card('dQw4w9WgXcQ')); await vi.advanceTimersByTimeAsync(3000);
    expect(action()).toBeNull(); expect(vi.getTimerCount()).toBe(0);
  });
  it('prevents duplicate writes and recovers from storage errors', async () => {
    let reject: (error: Error) => void = () => undefined;
    mark.mockImplementationOnce(() => new Promise<void>((_, fail) => { reject = fail; }));
    const video = card('dQw4w9WgXcQ'); popup(); await open(video);
    action()!.click(); action()!.click(); expect(mark).toHaveBeenCalledTimes(1); expect(action()?.disabled).toBe(true);
    reject(new Error('Storage full')); await vi.advanceTimersByTimeAsync(300);
    expect(error).toHaveBeenCalledOnce(); expect(action()?.disabled).toBe(false); expect(action()?.textContent).toBe('Add to watched');
  });
});
