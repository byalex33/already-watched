// Filtering belongs to discovery, never intentional library/channel browsing.
// Watch pages also contain playlist entries; only the related-video area filters.
export function filterScope(element: Element, url = location.href): 'recommendations' | 'search' | null {
  try {
    const { hostname, pathname } = new URL(url);
    if (!['youtube.com', 'www.youtube.com'].includes(hostname)) return null;
    const path = pathname.replace(/\/+$/, '') || '/';
    if (element.closest('ytd-playlist-panel-renderer')) return null;
    if (path === '/') return 'recommendations';
    if (path === '/results') return 'search';
    if (path === '/watch' && element.closest('#related')) return 'recommendations';
  } catch { /* Unknown routes keep their videos visible. */ }
  return null;
}
