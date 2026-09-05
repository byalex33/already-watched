import { SELECTORS, cardRoot } from './selectors';

function youtubeUrl(value: string): URL | null {
  try {
    const url = new URL(value, 'https://www.youtube.com');
    return ['https:', 'http:'].includes(url.protocol) && ['www.youtube.com', 'youtube.com', 'm.youtube.com'].includes(url.hostname) ? url : null;
  } catch { return null; }
}

export function isPlaylistCard(card: HTMLElement): boolean {
  if (card.matches(SELECTORS.playlistEntries) || card.closest(SELECTORS.playlistEntries)) return false;
  if (card.matches(SELECTORS.playlistRenderers) || card.querySelector(SELECTORS.playlistRenderers)) return true;
  const links = [...card.querySelectorAll<HTMLAnchorElement>('a[href]')].filter(link => !link.closest(SELECTORS.cardDescription));
  if (links.some(link => {
    const url = youtubeUrl(link.getAttribute('href') ?? '');
    return url?.pathname === '/playlist' && !!url.searchParams.get('list')
      && (link.matches(SELECTORS.playlistPrimaryLinks) || link.textContent?.trim().toLowerCase() === 'view full playlist');
  })) return true;

  // list= is also present on ordinary video URLs. Require a thumbnail collection
  // or playlist/Mix badge before classifying those links as a playlist card.
  const listPlayback = links.some(link => {
    const url = youtubeUrl(link.getAttribute('href') ?? '');
    return link.matches(SELECTORS.playlistPrimaryLinks) && url?.pathname === '/watch'
      && !!url.searchParams.get('v') && !!url.searchParams.get('list');
  });
  if (!listPlayback) return false;
  if (card.querySelector(SELECTORS.playlistCollection)) return true;
  return [...card.querySelectorAll(SELECTORS.playlistBadges)].some(badge =>
    /^(?:mix|playlist|\d[\d,.\s]* videos?)$/i.test(badge.textContent?.trim() ?? '')
  );
}

export function findPlaylistCandidates(root: Element | Document): Set<HTMLElement> {
  const candidates = new Set<HTMLElement>();
  if (root instanceof Element) {
    const owner = cardRoot(root); if (owner) candidates.add(owner);
  }
  root.querySelectorAll(SELECTORS.cards).forEach(element => {
    const owner = cardRoot(element); if (owner) candidates.add(owner);
  });
  return candidates;
}
