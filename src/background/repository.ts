import { FILTERED_PREFIX, ERROR_KEY, REVISION_KEY, SETTINGS_KEY, STATS_KEY, VIDEO_PREFIX } from '../shared/constants';
import { isVideoId } from '../youtube/video-id';
import { localDay } from '../shared/date';
import type { Request, Snapshot, Stats, Summary, VideoRecord } from '../shared/types';
import { getSettings, normalizeSettings } from '../storage/settings-store';
import { addFiltered, emptyStats, normalizeStats } from '../storage/stats-store';
import { getRecord, playbackRecord, readRecords, videoKey } from '../storage/watched-store';

const PENDING_RESET_KEY = 'pendingHistoryReset';

// The service worker is the only writer. A promise queue serializes read/modify/write
// operations across tabs, including resets, without relying on worker lifetime.
export class Repository {
  private tail: Promise<unknown> = Promise.resolve();
  dispatch(message: Request): Promise<unknown> {
    const result = this.tail.then(() => this.handle(message));
    this.tail = result.catch(() => undefined);
    return result;
  }
  private async persist(values: Record<string, unknown>): Promise<void> {
    try {
      await chrome.storage.local.set({ ...values, [ERROR_KEY]: null });
    } catch (error) {
      await chrome.storage.local.set({ [ERROR_KEY]: 'History could not be saved. Local storage may be full. Clear history to free space, then try again.' }).catch(() => undefined);
      throw error;
    }
  }
  private async commitRecord(previous: VideoRecord | undefined, next: VideoRecord, stats: Stats, extra: Record<string, unknown> = {}): Promise<void> {
    await this.persist({ ...extra, [videoKey(next.videoId)]: next, ...(next.watched && !previous?.watched ? { [STATS_KEY]: { ...stats, totalMarked: stats.totalMarked + 1 } } : {}) });
  }
  /** Complete a reset before accepting messages, including after a worker restart. */
  private async finishReset(): Promise<void> {
    const pending = await chrome.storage.session.get(PENDING_RESET_KEY);
    const revision: unknown = pending[PENDING_RESET_KEY];
    if (typeof revision !== 'number' || !Number.isSafeInteger(revision) || revision < 1) return;
    const data = await chrome.storage.local.get(null);
    await chrome.storage.local.remove(Object.keys(data).filter(key => key.startsWith(VIDEO_PREFIX) || key.startsWith(FILTERED_PREFIX) || key === STATS_KEY || key === ERROR_KEY));
    await this.persist({ [REVISION_KEY]: revision, [STATS_KEY]: emptyStats() });
    await chrome.storage.session.remove(PENDING_RESET_KEY);
  }
  private async handle(message: Request): Promise<unknown> {
    await this.finishReset();
    if (message.type === 'snapshot' || message.type === 'summary') {
      const data = await chrome.storage.local.get(null);
      const records = readRecords(data);
      const settings = normalizeSettings(data[SETTINGS_KEY]);
      if (message.type === 'snapshot') return { settings, records, revision: Number(data[REVISION_KEY]) || 0 } satisfies Snapshot;
      const stats = normalizeStats(data[STATS_KEY]);
      return {
        settings, watchedCount: Object.values(records).filter(record => record.watched).length,
        filteredToday: stats.day === localDay() ? stats.filteredIds.length : 0,
        filteredAllTime: stats.filteredAllTime, totalMarked: stats.totalMarked,
        storageBytes: await chrome.storage.local.getBytesInUse(null),
        error: typeof data[ERROR_KEY] === 'string' ? data[ERROR_KEY] : undefined
      } satisfies Summary;
    }
    if (message.type === 'settings') {
      const settings = normalizeSettings(message.settings);
      await this.persist({ [SETTINGS_KEY]: settings });
      return settings;
    }
    const meta = await chrome.storage.local.get([STATS_KEY, REVISION_KEY]);
    const revision = Number(meta[REVISION_KEY]) || 0;
    if ('revision' in message && message.revision !== revision) return { stale: true };
    const stats = normalizeStats(meta[STATS_KEY]);
    if (message.type === 'clear') {
      // Session storage has a separate quota and survives worker restarts. Record
      // intent there before freeing local space; recovery rejects old tab writes.
      await chrome.storage.session.set({ [PENDING_RESET_KEY]: revision + 1 });
      await this.finishReset();
      return null;
    }
    if (message.type === 'filtered') {
      if ((await getSettings()).enabled) {
        const day = message.day ?? localDay();
        const key = FILTERED_PREFIX + day;
        const legacyKey = FILTERED_PREFIX + stats.day;
        const days = await chrome.storage.local.get([key, legacyKey]);
        const stored = days[key];
        // Seed legacy current-day data without double-counting after an upgrade.
        const filteredIds = Array.isArray(stored) ? stored.filter(isVideoId) : stats.day === day ? stats.filteredIds : [];
        const next = addFiltered({ ...stats, day, filteredIds }, message.videoIds, Date.now(), day);
        const current = day >= stats.day ? next : { ...stats, filteredAllTime: next.filteredAllTime };
        const legacy = stats.day !== day && !Array.isArray(days[legacyKey]) ? { [legacyKey]: stats.filteredIds } : {};
        await this.persist({ ...legacy, [key]: next.filteredIds, [STATS_KEY]: current });
      }
      return null;
    }
    if (message.type === 'touch') {
      const keys = message.videoIds.map(videoKey);
      const records = readRecords(await chrome.storage.local.get(keys));
      const now = Date.now();
      const updates: Record<string, unknown> = {};
      for (const record of Object.values(records)) {
        if (now - record.lastSeen >= 3_600_000) updates[videoKey(record.videoId)] = { ...record, lastSeen: now };
      }
      if (Object.keys(updates).length) await this.persist(updates);
      return null;
    }
    if (message.type === 'import') {
      const records = readRecords(await chrome.storage.local.get(message.videos.map(v => videoKey(v.videoId))));
      const updates: Record<string, unknown> = {};
      let imported = 0;
      for (const video of message.videos) {
        const previous = records[video.videoId];
        if (previous?.watched || previous?.unwatchedOverride) continue;
        const record: VideoRecord = { ...previous, ...video, title: video.title?.slice(0, 300), watched: true, source: 'youtube-ui', lastSeen: Date.now(), importedAt: Date.now() };
        // Import time is deliberately not a watched date.
        delete record.watchedAt;
        records[video.videoId] = record;
        updates[videoKey(video.videoId)] = record;
        imported++;
      }
      if (imported) await this.persist({ ...updates, [STATS_KEY]: { ...stats, totalMarked: stats.totalMarked + imported } });
      return { imported };
    }
    const previous = await getRecord(message.videoId);
    if (message.type === 'mark') {
      const next: VideoRecord = message.watched
        ? { ...previous, videoId: message.videoId, title: message.title?.slice(0, 300) || previous?.title, watched: true, source: 'manual', watchedAt: previous?.watchedAt ?? Date.now(), progress: previous?.progress ?? 0, lastSeen: Date.now(), unwatchedOverride: false }
        : { videoId: message.videoId, title: message.title?.slice(0, 300) || previous?.title, watched: false, source: 'manual', progress: 0, lastSeen: Date.now(), unwatchedOverride: true, segments: [] };
      // Invalidate in-flight playback when manually resetting a video.
      await this.commitRecord(previous, next, stats, message.watched ? {} : { [REVISION_KEY]: revision + 1 });
      return next;
    }
    if (message.type === 'progress') {
      const settings = await getSettings();
      if (!settings.enabled) return null;
      const next = playbackRecord(previous, { ...message, title: message.title?.slice(0, 300) }, settings.threshold);
      await this.commitRecord(previous, next, stats);
      return next;
    }
    return null;
  }
}
