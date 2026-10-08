import { SELECTORS } from './selectors';
// A card's channel as a canonical path such as "@handle" or "channel/UC…".
// Cards without a recognizable channel are never capped.
export function channelKey(card: Element): string | null {
  for (const link of card.querySelectorAll<HTMLAnchorElement>(SELECTORS.channelLinks)) {
    try {
      const [kind, name] = new URL(link.getAttribute('href') ?? '', 'https://www.youtube.com').pathname.split('/').filter(Boolean);
      if (kind?.startsWith('@')) return decodeURIComponent(kind).toLowerCase();
      if (kind && name && ['channel', 'c', 'user'].includes(kind)) return `${kind}/${decodeURIComponent(name)}`;
    } catch { /* Ignore malformed channel links. */ }
  }
  const name = card.querySelector(SELECTORS.channelName)?.textContent?.trim();
  return name ? `name:${name}` : null;
}
