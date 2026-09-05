import { beforeEach, describe, expect, it, vi } from 'vitest';
import { detectCard, findCardRoots } from '../src/content/card-detector';
import { CardDecorator } from '../src/content/card-decorator';
import { youtubeProgress, parseProgressPercent } from '../src/youtube/progress-detection';
import { DEFAULT_SETTINGS } from '../src/shared/constants';
import { CardObserver } from '../src/content/observer';
const id = 'dQw4w9WgXcQ';
function fixture(tag = 'ytd-rich-item-renderer', href = `/watch?v=${id}`): HTMLElement {
  document.body.innerHTML = `<${tag}><a id="thumbnail" href="${href}"><img alt="Example"><ytd-thumbnail-overlay-resume-playback-renderer><div id="progress" style="width:80%"></div></ytd-thumbnail-overlay-resume-playback-renderer></a><a id="video-title" href="${href}">Example video</a></${tag}>`;
  return document.body.firstElementChild as HTMLElement;
}
beforeEach(() => { document.body.innerHTML = ''; });
describe('DOM adapters', () => {
  it.each(['ytd-rich-item-renderer', 'ytd-video-renderer', 'ytd-compact-video-renderer', 'ytd-grid-video-renderer', 'ytd-playlist-video-renderer', 'yt-lockup-view-model', 'yt-lockup-view-model-wiz', 'ytd-reel-item-renderer'])('detects %s once despite duplicate links', tag => {
    const root = fixture(tag);
    expect(findCardRoots(document).size).toBe(1);
    expect(detectCard(root)).toMatchObject({ videoId: id, title: 'Example video', progress: .8, shorts: false });
  });
  it('handles Shorts and outer rich-grid containers', () => {
    const root = fixture('ytd-rich-item-renderer', `/shorts/${id}`);
    expect(detectCard(root)?.shorts).toBe(true);
    root.innerHTML = `<yt-lockup-view-model>${root.innerHTML}</yt-lockup-view-model>`;
    expect([...findCardRoots(document)]).toEqual([root]);
  });
  it('ignores sponsored cards, playlists, and unknown renderers', () => {
    const root = fixture(); root.append(document.createElement('ytd-ad-slot-renderer'));
    expect(findCardRoots(document).size).toBe(0);
    expect(detectCard(root)).toBeNull();
    expect(detectCard(fixture('ytd-video-renderer', '/playlist?list=PL123'))).toBeNull();
    fixture('unknown-renderer'); expect(findCardRoots(document).size).toBe(0);
  });
  it('only recognizes real nonzero progress and skips hidden bars', () => {
    const root = fixture();
    expect(youtubeProgress(root)).toBe(.8);
    root.querySelector<HTMLElement>('#progress')!.hidden = true;
    expect(youtubeProgress(root)).toBeNull();
    expect(parseProgressPercent('0%')).toBeNull();
    expect(parseProgressPercent('500px')).toBeNull();
    expect(parseProgressPercent('200%')).toBeNull();
  });
  it('supports newer progress and accessible progress hints', () => {
    const root = fixture();
    root.innerHTML = '<yt-thumbnail-overlay-progress-bar-view-model><div class="ytThumbnailOverlayProgressBarHostWatchedProgressBarSegment" style="width:91%"></div></yt-thumbnail-overlay-progress-bar-view-model>';
    expect(youtubeProgress(root)).toBe(.91);
    root.innerHTML = '<ytd-thumbnail-overlay-resume-playback-renderer><div role="progressbar" aria-valuenow="80" aria-valuemax="100"></div></ytd-thumbnail-overlay-resume-playback-renderer>';
    expect(youtubeProgress(root)).toBe(.8);
    root.querySelector('ytd-thumbnail-overlay-resume-playback-renderer')!.setAttribute('aria-hidden', 'true');
    expect(youtubeProgress(root)).toBe(.8);
  });
});
describe('decorations', () => {
  it('is idempotent, accessible, clickable, and never invents an imported date', () => {
    const card = detectCard(fixture())!;
    const toggle = vi.fn(); const decorator = new CardDecorator(toggle);
    decorator.apply(card, true, undefined, DEFAULT_SETTINGS);
    decorator.apply(card, true, undefined, DEFAULT_SETTINGS);
    expect(card.element.querySelectorAll('.aw-badge')).toHaveLength(1);
    expect(card.element.querySelector('.aw-badge')?.textContent).toBe('WATCHED');
    expect(card.element.classList.contains('aw-dim')).toBe(true);
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    card.element.querySelector('button')!.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(toggle).toHaveBeenCalledWith(card, false);
  });
  it('cleans recycled cards and restores disabled/hidden cards', () => {
    const root = fixture(); const decorator = new CardDecorator(vi.fn());
    decorator.apply(detectCard(root)!, true, undefined, { ...DEFAULT_SETTINGS, displayMode: 'hide' });
    expect(root.classList.contains('aw-hidden')).toBe(true);
    root.querySelector('a')!.href = '/watch?v=abcdefghijk';
    decorator.apply(detectCard(root)!, false, undefined, DEFAULT_SETTINGS);
    expect(root.classList.contains('aw-hidden')).toBe(false);
    expect(root.querySelectorAll('.aw-control')).toHaveLength(1);
    decorator.apply(detectCard(root)!, false, undefined, { ...DEFAULT_SETTINGS, enabled: false });
    expect(root.querySelectorAll('.aw-control,.aw-badge')).toHaveLength(0);
    expect(root.querySelector('.aw-thumbnail')).toBeNull();
  });
  it('does not loop in response to its own decorations', async () => {
    vi.useFakeTimers(); fixture();
    const decorator = new CardDecorator(vi.fn());
    const onCards = vi.fn((cards: Set<HTMLElement>) => { for (const root of cards) { const card = detectCard(root); if (card) decorator.apply(card, true, undefined, DEFAULT_SETTINGS); } });
    const observer = new CardObserver(onCards, vi.fn()); observer.start();
    await vi.advanceTimersByTimeAsync(1000);
    expect(onCards.mock.calls.length).toBeLessThanOrEqual(3);
    const before = onCards.mock.calls.length;
    const root = document.body.firstElementChild!;
    root.querySelector('a')!.setAttribute('href', '/watch?v=abcdefghijk');
    await vi.advanceTimersByTimeAsync(500);
    expect(onCards.mock.calls.length).toBeGreaterThan(before);
    observer.stop(); vi.useRealTimers();
  });
});
