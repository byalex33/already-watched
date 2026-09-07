import { localDay } from '../shared/date';
export interface FilterBatch { day: string; videoIds: string[] }

/** Keep observations tied to their date, including pending batches across midnight. */
export class FilterObservations {
  private pending = new Map<string, Set<string>>();
  private seen = new Set<string>();
  private day = localDay();
  observe(videoId: string): void {
    const day = localDay();
    if (day !== this.day) { this.day = day; this.seen.clear(); }
    if (this.seen.has(videoId)) return;
    this.seen.add(videoId);
    this.restore({ day, videoIds: [videoId] });
  }
  take(limit = 500): FilterBatch | undefined {
    const entry = this.pending.entries().next().value;
    if (!entry) return;
    const [day, pending] = entry;
    const videoIds = [...pending].slice(0, limit);
    videoIds.forEach(id => pending.delete(id));
    if (!pending.size) this.pending.delete(day);
    return { day, videoIds };
  }
  restore(batch: FilterBatch): void {
    const pending = this.pending.get(batch.day) ?? new Set<string>();
    batch.videoIds.forEach(id => pending.add(id));
    this.pending.set(batch.day, pending);
  }
  clear(): void { this.pending.clear(); this.seen.clear(); this.day = localDay(); }
}
