import type { Segment } from './types';
export function finiteDuration(duration: number): boolean {
  return Number.isFinite(duration) && duration > 0;
}
export function mergeSegments(segments: Segment[], duration: number): Segment[] {
  if (!finiteDuration(duration)) return [];
  const sorted = segments.filter(([a, b]) => Number.isFinite(a) && Number.isFinite(b) && b > a)
    .map(([a, b]): Segment => [Math.max(0, a), Math.min(duration, b)])
    .filter(([a, b]) => b > a).sort((a, b) => a[0] - b[0]);
  const merged: Segment[] = [];
  for (const segment of sorted) {
    const previous = merged.at(-1);
    if (previous && segment[0] <= previous[1] + 0.05) previous[1] = Math.max(previous[1], segment[1]);
    else merged.push([...segment]);
  }
  // Bound record size without filling in unwatched gaps.
  return merged.length <= 128 ? merged : merged.sort((a, b) => (b[1] - b[0]) - (a[1] - a[0])).slice(0, 128).sort((a, b) => a[0] - b[0]);
}
export function watchedFraction(segments: Segment[], duration: number): number {
  if (!finiteDuration(duration)) return 0;
  return Math.min(1, mergeSegments(segments, duration).reduce((sum, [a, b]) => sum + b - a, 0) / duration);
}
export function meetsThreshold(progress: number, threshold: number): boolean {
  return Number.isFinite(progress) && progress >= Math.min(100, Math.max(10, threshold)) / 100;
}
