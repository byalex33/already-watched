import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { VideoTracker } from '../src/content/video-tracker';
import { DEFAULT_SETTINGS } from '../src/shared/constants';
import type { Request, Snapshot } from '../src/shared/types';
import { mergeSegments } from '../src/shared/progress';
const id = 'dQw4w9WgXcQ';
let tracker: VideoTracker | undefined;
let video: HTMLVideoElement;
let state: Snapshot;
let messages: Request[];
let time: number;
let duration: number;
let paused: boolean;
let source: string;
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date', 'performance'] });
  history.replaceState({}, '', `/watch?v=${id}`);
  document.body.innerHTML = `<ytd-watch-flexy video-id="${id}"><div id="movie_player"><video class="html5-main-video"></video></div></ytd-watch-flexy>`;
  video = document.querySelector('video')!;
  time = 0; duration = 100; paused = false; source = 'blob:video-one'; messages = [];
  Object.defineProperties(video, {
    currentTime: { configurable: true, get: () => time }, duration: { configurable: true, get: () => duration },
    paused: { configurable: true, get: () => paused }, readyState: { configurable: true, get: () => 4 },
    currentSrc: { configurable: true, get: () => source }
  });
  state = { settings: { ...DEFAULT_SETTINGS }, records: {}, revision: 0 };
  vi.stubGlobal('chrome', { runtime: { sendMessage: vi.fn(async (message: Request) => { messages.push(message); return { ok: true, data: null }; }) } });
});
afterEach(() => { tracker?.stop(); tracker = undefined; vi.useRealTimers(); vi.unstubAllGlobals(); });
async function play(seconds: number): Promise<void> {
  for (let i = 0; i < seconds; i++) { time++; await vi.advanceTimersByTimeAsync(1000); }
}
function progressMessages() { return messages.filter((m): m is Extract<Request, { type: 'progress' }> => m.type === 'progress'); }
describe('player tracking', () => {
  it('starts at the restored offset, samples actual playback, and flushes on pause', async () => {
    time = 80; tracker = new VideoTracker(() => state, vi.fn());
    await play(5); paused = true; video.dispatchEvent(new Event('pause')); await Promise.resolve();
    expect(progressMessages()).toHaveLength(1);
    expect(progressMessages()[0]?.segments).toEqual([[80, 85]]);
  });
  it('excludes seeking and does not mark immediately after a jump', async () => {
    tracker = new VideoTracker(() => state, vi.fn());
    await play(2); video.dispatchEvent(new Event('seeking')); time = 90;
    await play(2); tracker.stop(); await Promise.resolve();
    const segments = progressMessages().flatMap(message => message.segments);
    expect(segments).toEqual([[0, 2], [91, 92]]);
  });
  it('does not credit advertisements or the ad/content transition', async () => {
    tracker = new VideoTracker(() => state, vi.fn());
    document.querySelector('#movie_player')!.classList.add('ad-showing');
    await play(20);
    expect(progressMessages()).toHaveLength(0);
    document.querySelector('#movie_player')!.classList.remove('ad-showing'); time = 0;
    await play(3); tracker.stop(); await Promise.resolve();
    expect(mergeSegments(progressMessages().flatMap(m => m.segments), 100)).toEqual([[1, 3]]);
  });
  it('ignores infinite duration, live DVR players and paused premieres', async () => {
    duration = Infinity; tracker = new VideoTracker(() => state, vi.fn()); await play(20);
    duration = 200; document.querySelector('#movie_player')!.classList.add('ytp-live'); await play(20);
    document.querySelector('#movie_player')!.classList.remove('ytp-live'); paused = true; await vi.advanceTimersByTimeAsync(20000);
    tracker.stop(); expect(progressMessages()).toHaveLength(0);
  });
  it('flushes old video progress on SPA navigation and binds autoplay to the new ID', async () => {
    tracker = new VideoTracker(() => state, vi.fn()); await play(5); tracker.navigationStart();
    history.replaceState({}, '', '/watch?v=abcdefghijk');
    document.querySelector('ytd-watch-flexy')!.setAttribute('video-id', 'abcdefghijk');
    time = 0; source = 'blob:video-two'; tracker.navigationFinish(); await play(5); tracker.stop(); await Promise.resolve();
    expect(progressMessages().map(m => [m.videoId, m.segments])).toEqual([[id, [[0, 5]]], ['abcdefghijk', [[0, 5]]]]);
  });
  it('drops pending playback when a history generation changes', async () => {
    tracker = new VideoTracker(() => state, vi.fn()); await play(5);
    state.revision++; tracker.reset(); await play(3); tracker.stop(); await Promise.resolve();
    expect(progressMessages()).toHaveLength(1);
    expect(progressMessages()[0]).toMatchObject({ revision: 1, segments: [[6, 8]] });
  });
});
