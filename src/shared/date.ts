export function localDay(timestamp = Date.now()): string {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function formatWatchedDate(timestamp: number | undefined, now = Date.now()): string | null {
  if (!timestamp || !Number.isFinite(timestamp) || timestamp > now) return null;
  const days = Math.floor((now - timestamp) / 86_400_000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(timestamp);
}
