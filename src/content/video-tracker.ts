import { request } from '../shared/messaging';
import { finiteDuration, mergeSegments, meetsThreshold, watchedFraction } from '../shared/progress';
import type { Segment, Snapshot } from '../shared/types';
import { currentPlaybackId } from '../youtube/video-id';
import { playbackBlocked, playerElements, SELECTORS } from '../youtube/selectors';
interface Sample { time: number; wall: number; playing: boolean; rate: number }
interface Session {
  videoId: string;
  video: HTMLVideoElement;
  source: string;
  duration: number;
  segments: Segment[];
  last?: Sample;
  title?: string;
  revision: number;
  lastSave: number;
  saving: boolean;
  retryAfter: number;
  retiredFailures: number;
  retryTimer?: ReturnType<typeof setTimeout>;
}
export class VideoTracker {
  private session?: Session;
  private retired = new Set<Session>();
  private pausedForNavigation = false;
  private timer: ReturnType<typeof setInterval>;
  private readonly interrupt = (): void => { if (this.session) this.session.last = undefined; };
  private readonly save = (): void => { this.tick(); void this.flush(); };
  constructor(private snapshot: () => Snapshot, private onError: (error: unknown) => void) {
    this.timer = setInterval(() => this.tick(), 1000);
    window.addEventListener('pagehide', this.save);
    document.addEventListener('visibilitychange', this.save);
    this.tick();
  }
  navigationStart(): void {
    this.detach(true); this.pausedForNavigation = true;
  }
  navigationFinish(): void { this.pausedForNavigation = false; this.tick(); }
  reset(): void {
    this.detach();
    for (const session of this.retired) this.discard(session);
  }
  private discard(session: Session): void {
    session.segments = [];
    if (session.retryTimer) clearTimeout(session.retryTimer);
    this.retired.delete(session);
  }
  private detach(save = false): void {
    if (this.session) {
      const video = this.session.video;
      video.removeEventListener('seeking', this.interrupt);
      video.removeEventListener('emptied', this.interrupt);
      video.removeEventListener('pause', this.save);
      video.removeEventListener('ended', this.save);
      if (save) { this.retired.add(this.session); void this.flush(this.session); }
      else this.discard(this.session);
    }
    this.session = undefined;
  }
  private tick(): void {
    const snapshot = this.snapshot();
    const route = currentPlaybackId(location.href);
    if (this.pausedForNavigation || !snapshot.settings.enabled || !route || (route.shorts && !snapshot.settings.applyToShorts)) {
      if (this.session) { this.detach(true); }
      return;
    }
    const elements = playerElements(route.shorts);
    if (!elements || (elements.declaredId && elements.declaredId !== route.videoId)) {
      this.interrupt(); return;
    }
    const { player, video } = elements;
    if (playbackBlocked(player) || !finiteDuration(video.duration) || video.readyState < 2 || video.seeking) {
      this.interrupt(); return;
    }
    let session = this.session;
    if (session && (session.videoId !== route.videoId || session.video !== video || session.source !== video.currentSrc || Math.abs(session.duration - video.duration) > 1 || session.revision !== snapshot.revision)) {
      this.detach(true); session = undefined;
    }
    if (!session) {
      session = { videoId: route.videoId, video, source: video.currentSrc, duration: video.duration, segments: [], revision: snapshot.revision, lastSave: Date.now(), saving: false, retryAfter: 0, retiredFailures: 0, title: document.querySelector(SELECTORS.watchTitle)?.textContent?.trim().slice(0, 300) };
      this.session = session;
      video.addEventListener('seeking', this.interrupt);
      video.addEventListener('emptied', this.interrupt);
      video.addEventListener('pause', this.save);
      video.addEventListener('ended', this.save);
    }
    const wall = performance.now();
    const previous = session.last;
    if (previous?.playing) {
      const delta = video.currentTime - previous.time;
      const elapsed = (wall - previous.wall) / 1000;
      // Never credit seeks, a sleeping tab's long gap, advertisements, or the
      // starting offset restored by YouTube. Replays merge without double credit.
      if (delta > 0 && elapsed <= 5 && delta <= elapsed * Math.max(previous.rate, video.playbackRate) + 0.75) {
        session.segments = mergeSegments([...session.segments, [previous.time, video.currentTime]], session.duration);
      }
    }
    session.last = { time: video.currentTime, wall, playing: !video.paused && !video.ended, rate: video.playbackRate };
    const existing = snapshot.records[session.videoId];
    const progress = watchedFraction([...(existing?.segments ?? []), ...session.segments], session.duration);
    if ((!existing?.watched && meetsThreshold(progress, snapshot.settings.threshold)) || Date.now() - session.lastSave >= 15_000 || video.ended) void this.flush();
  }
  /** Drain a departing session after its in-flight write, with bounded retries. */
  private async flush(session = this.session): Promise<void> {
    if (!session || session.saving) return;
    if (session.revision !== this.snapshot().revision) { this.discard(session); return; }
    if (!session.segments.length) { this.retired.delete(session); return; }
    if (Date.now() < session.retryAfter) {
      this.retryRetired(session);
      return;
    }
    const segments = session.segments;
    session.segments = [];
    session.saving = true;
    session.lastSave = Date.now();
    try {
      await request({ type: 'progress', videoId: session.videoId, title: session.title, duration: session.duration, segments, revision: session.revision });
    } catch (error) {
      session.segments = mergeSegments([...segments, ...session.segments], session.duration);
      session.retryAfter = Date.now() + 15_000;
      if (this.retired.has(session)) session.retiredFailures++;
      this.onError(error);
    } finally {
      session.saving = false;
      if (this.retired.has(session)) {
        if (session.retiredFailures >= 3) this.discard(session);
        else if (Date.now() < session.retryAfter) this.retryRetired(session);
        else void this.flush(session);
      }
    }
  }
  private retryRetired(session: Session): void {
    if (!this.retired.has(session) || session.retryTimer) return;
    session.retryTimer = setTimeout(() => {
      session.retryTimer = undefined;
      void this.flush(session);
    }, Math.max(0, session.retryAfter - Date.now()));
  }
  stop(): void {
    this.detach(true); clearInterval(this.timer);
    window.removeEventListener('pagehide', this.save);
    document.removeEventListener('visibilitychange', this.save);
  }
}
