import { SELECTORS } from './selectors';
export function parseProgressPercent(value: string | null): number | null {
  if (!value || !/^\s*\d+(?:\.\d+)?%\s*$/.test(value)) return null;
  const number = Number.parseFloat(value);
  return number > 0 && number <= 100 ? number / 100 : null;
}
export function youtubeProgress(root: Element): number | null {
  let best: number | null = null;
  for (const element of root.querySelectorAll<HTMLElement>(`${SELECTORS.progress},${SELECTORS.resumeProgress}`)) {
    // This segment also represents current/preview playback. A genuine resume
    // overlay in the same card remains eligible; stored history is unaffected.
    if (element.matches(SELECTORS.playbackProgress) && root.querySelector(SELECTORS.nowPlaying)) continue;
    // aria-hidden often means decorative, not visually hidden, on thumbnails.
    if (element.hidden || element.closest('[hidden]')) continue;
    if (element.matches('[role="progressbar"]') && !element.closest(SELECTORS.progressHost)) continue;
    const style = getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden') continue;
    let value = parseProgressPercent(element.style.width);
    if (value === null && element.closest(SELECTORS.progressHost)) {
      const current = Number(element.getAttribute('aria-valuenow'));
      const max = Number(element.getAttribute('aria-valuemax') ?? 100);
      if (element.hasAttribute('aria-valuenow') && current > 0 && max > 0 && current <= max) value = current / max;
      else {
        const parentWidth = element.parentElement?.getBoundingClientRect().width ?? 0;
        const width = element.getBoundingClientRect().width;
        if (parentWidth > 0 && width > 0 && width <= parentWidth) value = width / parentWidth;
      }
    }
    if (value !== null) best = Math.max(best ?? 0, value);
  }
  return best;
}
