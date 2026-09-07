import { matchesContentFilters } from '../shared/content-filters';
import { REVISION_KEY, SETTINGS_KEY, VIDEO_PREFIX } from '../shared/constants';
import { FilterObservations } from './filter-observations';
import { localDay } from '../shared/date';
import { errorMessage, request } from '../shared/messaging';
import { meetsThreshold } from '../shared/progress';
import type { Snapshot, VideoRecord } from '../shared/types';
import { isWatched } from '../shared/watched-state';
import { normalizeSettings } from '../storage/settings-store';
import { isVideoRecord } from '../storage/watched-store';
import { CardDecorator } from './card-decorator';
import { detectCard, findCardRoots, type VideoCard } from './card-detector';
import { CardObserver } from './observer';
import { VideoTracker } from './video-tracker';
import { watchNavigation } from './youtube-navigation';
import { FeedRefiller } from './feed-refiller';
import { PromotionalFilter } from './promotional-filter';
import { HomeShortsFilter } from './home-shorts-filter';
import { SELECTORS } from '../youtube/selectors';
import { PlaylistFilter } from './playlist-filter';
import { VideoMenu } from './video-menu';

let toastTimer: ReturnType<typeof setTimeout> | undefined;
function showError(error: unknown): void {
  if (excludedPage()) return;
  let toast = document.querySelector<HTMLElement>('.aw-toast');
  if (!toast) { toast = document.createElement('div'); toast.className = 'aw-toast'; toast.setAttribute('role', 'status'); document.body.append(toast); }
  toast.textContent = `Already Watched: ${errorMessage(error)}`;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast?.remove(), 6000);
}

async function start(isCurrent: () => boolean): Promise<(() => void) | undefined> {
  // Buffer events during initialization so a concurrent tab write cannot be lost
  // between the initial snapshot and installing the change listener.
  const buffered: Record<string, chrome.storage.StorageChange>[] = [];
  let receive = (changes: Record<string, chrome.storage.StorageChange>): void => { buffered.push(changes); };
  const storageListener = (changes: Record<string, chrome.storage.StorageChange>, area: string): void => { if (area === 'local') receive(changes); };
  // An extension reload can invalidate APIs while the old content script is still alive.
  const removeStorageListener = (): void => {
    try { chrome.storage?.onChanged?.removeListener(storageListener); }
    catch { /* Invalidated extension contexts cannot remove Chrome listeners. */ }
  };
  chrome.storage.onChanged.addListener(storageListener);
  let state: Snapshot;
  try { state = await request<Snapshot>({ type: 'snapshot' }); }
  catch (error) { removeStorageListener(); throw error; }
  if (!isCurrent()) { removeStorageListener(); return; }
  const cards = new Map<HTMLElement, VideoCard>();
  const byVideo = new Map<string, Set<HTMLElement>>();
  const filtered = new FilterObservations();
  const touches = new Set<string>();
  let day = localDay();
  let lastAutomaticError = 0;
  const onAutomaticError = (error: unknown): void => {
    if (Date.now() - lastAutomaticError > 60_000) { showError(error); lastAutomaticError = Date.now(); }
  };
  const decorator = new CardDecorator((card, watched) => {
    void request<VideoRecord>({ type: 'mark', videoId: card.videoId, title: card.title, watched }).catch(showError);
  });
  const tracker = new VideoTracker(() => state, onAutomaticError);
  const videoMenu = new VideoMenu(
    card => isWatched(state.records[card.videoId], card.progress, card.shorts, { ...state.settings, enabled: true, applyToShorts: true }),
    (card, watched) => request<VideoRecord>({ type: 'mark', videoId: card.videoId, title: card.title, watched }),
    showError
  );
  const refiller = new FeedRefiller(() => state.settings, () => cards.values());
  const promotionalFilter = new PromotionalFilter(() => state.settings);
  const homeShortsFilter = new HomeShortsFilter(() => state.settings);
  const playlistFilter = new PlaylistFilter(() => state.settings);
  function unregister(element: HTMLElement): void {
    const old = cards.get(element);
    if (old) {
      const group = byVideo.get(old.videoId); group?.delete(element);
      if (!group?.size) byVideo.delete(old.videoId);
    }
    cards.delete(element); decorator.clear(element);
  }
  function decorate(card: VideoCard): void {
    const record = state.records[card.videoId];
    const watched = isWatched(record, card.progress, card.shorts, state.settings);
    decorator.apply(card, watched, record, state.settings);
    if (card.element.closest(SELECTORS.sectionHidden)) return;
    if (watched || matchesContentFilters(card, state.settings)) filtered.observe(card.videoId);
    if (state.settings.enabled && record && Date.now() - record.lastSeen >= 3_600_000) touches.add(card.videoId);
  }
  function process(roots: Set<HTMLElement>): void {
    for (const element of roots) {
      const card = detectCard(element);
      if (!card) { unregister(element); continue; }
      const old = cards.get(element);
      if (old?.videoId !== card.videoId) unregister(element);
      cards.set(element, card);
      let group = byVideo.get(card.videoId);
      if (!group) { group = new Set(); byVideo.set(card.videoId, group); }
      group.add(element); decorate(card);
    }
    refiller.schedule();
  }
  let pruneTimer: ReturnType<typeof setTimeout> | undefined;
  const prune = (): void => {
    if (pruneTimer) return;
    pruneTimer = setTimeout(() => { pruneTimer = undefined; for (const element of cards.keys()) if (!element.isConnected) unregister(element); promotionalFilter.prune(); homeShortsFilter.prune(); playlistFilter.prune(); }, 500);
  };
  const observer = new CardObserver(process, prune, () => refiller.schedule(), root => { promotionalFilter.update(root); homeShortsFilter.update(root); playlistFilter.update(root); });
  receive = changes => {
    let all = false;
    if (changes[SETTINGS_KEY]) {
      state.settings = normalizeSettings(changes[SETTINGS_KEY].newValue);
      promotionalFilter.update(document);
      homeShortsFilter.update(document);
      playlistFilter.update(document);
      all = true;
    }
    if (changes[REVISION_KEY]) {
      state.revision = Number(changes[REVISION_KEY].newValue) || 0;
      tracker.reset(); filtered.clear(); touches.clear();
    }
    const changedIds = new Set<string>();
    for (const [key, change] of Object.entries(changes)) {
      if (!key.startsWith(VIDEO_PREFIX)) continue;
      const id = key.slice(VIDEO_PREFIX.length);
      if (isVideoRecord(change.newValue)) state.records[id] = change.newValue;
      else delete state.records[id];
      changedIds.add(id);
    }
    if (all) process(new Set(cards.keys()));
    else for (const id of changedIds) for (const element of byVideo.get(id) ?? []) {
      const card = cards.get(element); if (card) decorate(card);
    }
    refiller.schedule();
  };
  buffered.forEach(receive);
  observer.start();
  const stopNavigation = watchNavigation(() => { tracker.navigationStart(); refiller.navigationStart(); videoMenu.reset(); }, () => { tracker.navigationFinish(); refiller.navigationFinish(); observer.scan(); prune(); });
  let flushing = false;
  async function flushCounters(): Promise<void> {
    if (flushing) return;
    flushing = true;
    const revision = state.revision;
    const batch = filtered.take();
    const touchedIds = [...touches].slice(0, 500); touchedIds.forEach(id => touches.delete(id));
    try {
      // Stale batches belong to an invalidated generation and must not restore cleared statistics.
      if (batch) await request({ type: 'filtered', ...batch, revision });
      if (touchedIds.length) await request({ type: 'touch', videoIds: touchedIds, revision });
    } catch (error) {
      if (revision === state.revision) { if (batch) filtered.restore(batch); touchedIds.forEach(id => touches.add(id)); }
      onAutomaticError(error);
    } finally { flushing = false; }
  }
  const counters = setInterval(() => {
    if (day !== localDay()) {
      // Keep yesterday's pending batches; rendered cards can count on the new day.
      day = localDay(); cards.forEach(decorate);
    }
    void flushCounters();
  }, 5000);
  const onVisibility = (): void => { if (document.hidden) void flushCounters(); };
  document.addEventListener('visibilitychange', onVisibility);
  const messageListener = (message: unknown, sender: chrome.runtime.MessageSender, respond: (value: unknown) => void): boolean => {
    if (sender.id !== chrome.runtime.id || !message || typeof message !== 'object') return false;
    const data = message as Record<string, unknown>;
    if (data.type === 'aw-error') { showError(new Error(String(data.error))); return false; }
    if (data.type !== 'scan-page') return false;
    void (async () => {
      const videos = new Map<string, { videoId: string; title?: string; progress: number }>();
      for (const element of findCardRoots(document)) {
        const card = detectCard(element);
        if (!card || (card.shorts && !state.settings.applyToShorts) || card.progress === null || !meetsThreshold(card.progress, state.settings.threshold)) continue;
        videos.set(card.videoId, { videoId: card.videoId, title: card.title, progress: card.progress });
      }
      let imported = 0;
      const list = [...videos.values()];
      const revision = state.revision;
      for (let i = 0; i < list.length; i += 500) {
        const result = await request<{ imported?: number; stale?: boolean }>({ type: 'import', videos: list.slice(i, i + 500), revision });
        if (result.stale) throw new Error('History changed during the scan. Please try again.');
        imported += result.imported ?? 0;
      }
      return { imported, detected: videos.size };
    })().then(result => respond({ ok: true, data: result }), error => respond({ ok: false, error: errorMessage(error) }));
    return true;
  };
  chrome.runtime.onMessage.addListener(messageListener);
  return () => {
    void flushCounters(); observer.stop(); tracker.stop(); refiller.stop(); stopNavigation(); clearInterval(counters);
    videoMenu.stop();
    promotionalFilter.clear();
    homeShortsFilter.clear();
    playlistFilter.clear();
    if (pruneTimer) clearTimeout(pruneTimer);
    removeStorageListener();
    try { chrome.runtime?.onMessage?.removeListener(messageListener); }
    catch { /* Continue DOM cleanup even if Chrome has invalidated this context. */ }
    document.removeEventListener('visibilitychange', onVisibility);
    for (const element of cards.keys()) unregister(element);
  };
}

function excludedPage(): boolean {
  const url = new URL(location.href);
  const path = url.pathname.replace(/\/+$/, '');
  return path === '/feed/history' || path === '/playlist'
    || /^\/(?:@[^/]+|(?:channel|c|user)\/[^/]+)(?:\/|$)/.test(path);
}

let generation = 0;
let activeUrl: string | undefined;
let stopPage: (() => void) | undefined;
function suspendPage(): void {
  generation++;
  activeUrl = undefined;
  const stop = stopPage;
  stopPage = undefined;
  stop?.();
  if (toastTimer) clearTimeout(toastTimer);
  document.querySelector('.aw-toast')?.remove();
}
function syncPage(): void {
  // Keep the existing playback and counter session for normal YouTube navigation.
  if (!excludedPage() && stopPage) return;
  if (activeUrl === location.href) return;
  suspendPage();
  if (excludedPage()) return;
  activeUrl = location.href;
  const current = generation;
  const isCurrent = (): boolean => current === generation && activeUrl === location.href && !excludedPage();
  void start(isCurrent).then(stop => {
    if (isCurrent()) stopPage = stop;
    else stop?.();
  }).catch(error => { if (isCurrent()) showError(error); });
}
watchNavigation(() => { if (excludedPage()) suspendPage(); }, syncPage);
window.addEventListener('pagehide', suspendPage);
window.addEventListener('pageshow', event => { if (event.persisted) syncPage(); });
syncPage();
