import { SELECTORS } from './selectors';

export function supportsRefill(url: string): boolean {
  try {
    const { hostname, pathname } = new URL(url);
    if (!['www.youtube.com', 'youtube.com'].includes(hostname)) return false;
    return ['/', '/results', '/feed/subscriptions', '/watch'].includes(pathname)
      || /^\/(?:@[^/]+|(?:channel|c|user)\/[^/]+)\/(?:videos|shorts|streams)\/?$/.test(pathname);
  } catch { return false; }
}

export function rendered(element: HTMLElement): boolean {
  if (!element.isConnected || element.closest('[hidden]')) return false;
  const style = getComputedStyle(element);
  return style.display !== 'none' && style.visibility !== 'hidden' && element.getClientRects().length > 0;
}

export function refillFeed(url: string): HTMLElement | null {
  if (!supportsRefill(url)) return null;
  const path = new URL(url).pathname;
  const selector = path === '/watch' ? SELECTORS.refillRelated : path === '/results' ? SELECTORS.refillSearch : SELECTORS.refillBrowse;
  return [...document.querySelectorAll<HTMLElement>(selector)].find(element => rendered(element) && !element.closest(SELECTORS.refillExcluded)) ?? null;
}

export function continuationFor(feed: HTMLElement): HTMLElement | null {
  return [...feed.querySelectorAll<HTMLElement>(SELECTORS.continuation)].find(element =>
    rendered(element) && !element.closest(SELECTORS.refillExcluded)
  ) ?? null;
}

export function continuationBusy(element: HTMLElement): boolean {
  return element.matches(SELECTORS.continuationBusy) || !!element.querySelector(SELECTORS.continuationBusy);
}

// Return cleanup rather than changing scroll position or calling private YouTube
// APIs. Automatic continuations observe their position relative to the viewport.
export function activateContinuation(element: HTMLElement): (() => void) | null {
  if (!rendered(element) || continuationBusy(element)) return null;
  const button = element.querySelector<HTMLButtonElement>(SELECTORS.continuationButton);
  if (button && rendered(button)) {
    if (button.disabled || button.getAttribute('aria-disabled') === 'true') return null;
    button.click();
    return () => undefined;
  }
  element.classList.add('aw-refill-probe');
  return () => element.classList.remove('aw-refill-probe');
}
