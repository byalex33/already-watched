export function watchNavigation(onStart: () => void, onFinish: () => void): () => void {
  let href = location.href;
  let finishing: ReturnType<typeof setTimeout> | undefined;
  const start = (): void => { onStart(); };
  const finish = (): void => {
    href = location.href;
    if (finishing) clearTimeout(finishing);
    finishing = setTimeout(onFinish, 150);
  };
  const fallback = (): void => {
    if (href !== location.href) { start(); finish(); }
  };
  document.addEventListener('yt-navigate-start', start);
  document.addEventListener('yt-navigate-finish', finish);
  document.addEventListener('yt-page-data-updated', finish);
  window.addEventListener('popstate', fallback);
  // Also catches Shorts/autoplay routes that omit YouTube's navigation events.
  const timer = setInterval(fallback, 1000);
  return () => {
    clearInterval(timer); if (finishing) clearTimeout(finishing);
    document.removeEventListener('yt-navigate-start', start);
    document.removeEventListener('yt-navigate-finish', finish);
    document.removeEventListener('yt-page-data-updated', finish);
    window.removeEventListener('popstate', fallback);
  };
}
