import { cardRoot, SELECTORS } from '../youtube/selectors';
import { parseVideoUrl } from '../youtube/video-id';
import { youtubeProgress } from '../youtube/progress-detection';
import { isPlaylistCard } from '../youtube/playlist-detection';
export interface VideoCard {
  element: HTMLElement;
  thumbnail: HTMLElement;
  videoId: string;
  shorts: boolean;
  title?: string;
  progress: number | null;
}
export function detectCard(element: HTMLElement): VideoCard | null {
  if (element.matches(SELECTORS.adCard) || element.querySelector(SELECTORS.adCard)) return null;
  if (isPlaylistCard(element)) return null;
  const links = [...element.querySelectorAll<HTMLAnchorElement>(SELECTORS.videoLinks)];
  const anchor = links.find(link => link.matches(SELECTORS.thumbnail)) ?? links[0];
  if (!anchor) return null;
  const parsed = parseVideoUrl(anchor.href);
  if (!parsed) return null;
  const thumbnail = anchor.matches(SELECTORS.thumbnail) ? anchor : element.querySelector<HTMLElement>(SELECTORS.thumbnail);
  if (!thumbnail) return null;
  const title = element.querySelector(SELECTORS.title)?.textContent?.trim() || anchor.getAttribute('title') || anchor.getAttribute('aria-label') || undefined;
  return { element, thumbnail, ...parsed, title: title?.slice(0, 300), progress: youtubeProgress(element) };
}
export function findCardRoots(root: Element | Document): Set<HTMLElement> {
  const found = new Set<HTMLElement>();
  if (root instanceof Element) {
    const own = cardRoot(root);
    if (own) found.add(own);
  }
  root.querySelectorAll(`${SELECTORS.videoLinks},${SELECTORS.playlistLinks}`).forEach(link => {
    const card = cardRoot(link);
    if (card) found.add(card);
  });
  return found;
}
