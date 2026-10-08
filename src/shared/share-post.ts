import type { HomeSummary } from './types';
export const SHARE_MIN_VISITS = 5;
const POST_LIMIT = 280;
export function trackedDays(since: number, now = Date.now()): number {
  return since ? Math.max(1, Math.ceil((now - since) / 86_400_000)) : 0;
}
export function rerunPercent(home: Pick<HomeSummary, 'served' | 'repeats'>): number {
  return home.served ? Math.round(home.repeats / home.served * 100) : 0;
}
// A post written from the viewer's own Home numbers, sized for X.
export function sharePost(home: HomeSummary, now = Date.now()): string {
  const days = trackedDays(home.since, now);
  const number = (value: number): string => value.toLocaleString('en-US');
  const head = [
    `I tracked my YouTube homepage for ${days} day${days === 1 ? '' : 's'}.`,
    '',
    `${number(home.visits)} visits. ${number(home.served)} recommendations. Only ${number(home.distinct)} different videos.`,
    `${rerunPercent(home)}% were reruns.${home.watched ? ` ${number(home.watched)} were videos I'd already watched.` : ''}`
  ].join('\n');
  const tail = '\n\nNow Already Watched hides them for me.';
  const top = home.top[0];
  if (!top || top.served <= 2) return head + tail;
  // Fit the most-repeated title; drop the line if it cannot fit readably.
  const line = (title: string): string => `\n\nIt showed me "${title}" ${top.served} times.`;
  const room = POST_LIMIT - head.length - tail.length - line('').length;
  if (room < 20) return head + tail;
  const title = top.title.length <= room ? top.title : `${top.title.slice(0, room - 1).trimEnd()}…`;
  return head + line(title) + tail;
}
