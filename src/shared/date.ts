export function localDay(timestamp = Date.now()): string {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function formatWatchedDate(timestamp: number | undefined, now = Date.now()): string | null {
  if (!timestamp || !Number.isFinite(timestamp) || timestamp > now) return null;
  const watched = new Date(timestamp);
  const current = new Date(now);
  // UTC ordinals of local calendar dates avoid 23/25-hour daylight-saving days.
  const calendarDay = (date: Date): number => Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  const days = Math.round((calendarDay(current) - calendarDay(watched)) / 86_400_000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(timestamp);
}
