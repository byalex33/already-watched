export type DisplayMode = 'badge' | 'dim' | 'hide' | 'badge-dim' | 'hide-refill';
export interface Settings {
  enabled: boolean;
  displayMode: DisplayMode;
  threshold: number;
  useYouTubeProgress: boolean;
  applyToShorts: boolean;
  showWatchedDate: boolean;
  hidePromotionalSections: boolean;
  hideHomeShorts: boolean;
  hidePlaylists: boolean;
}
export type Segment = [number, number];
export interface VideoRecord {
  videoId: string;
  title?: string;
  watched: boolean;
  watchedAt?: number;
  progress: number;
  lastSeen: number;
  source: 'playback' | 'manual' | 'youtube-ui';
  importedAt?: number;
  unwatchedOverride?: boolean;
  segments?: Segment[];
}
export interface Stats {
  day: string;
  filteredIds: string[];
  filteredAllTime: number;
  totalMarked: number;
}
export interface Snapshot {
  settings: Settings;
  records: Record<string, VideoRecord>;
  revision: number;
}
export interface Summary {
  settings: Settings;
  watchedCount: number;
  filteredToday: number;
  filteredAllTime: number;
  totalMarked: number;
  storageBytes: number;
  error?: string;
}
export type Request =
  | { type: 'snapshot' }
  | { type: 'summary' }
  | { type: 'settings'; settings: Partial<Settings> }
  | { type: 'mark'; videoId: string; watched: boolean; title?: string }
  | { type: 'progress'; videoId: string; title?: string; duration: number; segments: Segment[]; revision: number }
  | { type: 'import'; videos: { videoId: string; title?: string; progress: number }[]; revision: number }
  | { type: 'touch'; videoIds: string[]; revision: number }
  | { type: 'filtered'; videoIds: string[]; revision: number }
  | { type: 'clear' };
export type Reply<T> = { ok: true; data: T } | { ok: false; error: string };
