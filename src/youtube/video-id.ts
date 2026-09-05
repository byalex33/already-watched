const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
export function isVideoId(value: unknown): value is string {
  return typeof value === 'string' && VIDEO_ID.test(value);
}
export function parseVideoUrl(value: string, base = 'https://www.youtube.com'): { videoId: string; shorts: boolean } | null {
  try {
    const url = new URL(value, base);
    if (!['https:', 'http:'].includes(url.protocol)) return null;
    const host = url.hostname.toLowerCase();
    let id: string | null = null;
    let shorts = false;
    if (host === 'youtu.be') id = url.pathname.split('/')[1] ?? null;
    else if (['www.youtube.com', 'youtube.com', 'm.youtube.com'].includes(host)) {
      if (url.pathname === '/watch') id = url.searchParams.get('v');
      else {
        const parts = url.pathname.split('/');
        if (['shorts', 'live', 'embed'].includes(parts[1] ?? '')) id = parts[2] ?? null;
        shorts = parts[1] === 'shorts';
      }
    }
    return isVideoId(id) ? { videoId: id, shorts } : null;
  } catch { return null; }
}
export const extractVideoId = (url: string): string | null => parseVideoUrl(url)?.videoId ?? null;
export function currentPlaybackId(url: string): ReturnType<typeof parseVideoUrl> {
  try {
    const path = new URL(url).pathname;
    return path === '/watch' || path.startsWith('/shorts/') || path.startsWith('/live/') ? parseVideoUrl(url) : null;
  } catch { return null; }
}
