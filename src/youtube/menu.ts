import { cardRoot } from './selectors';
import { detectCard, type VideoCard } from '../content/card-detector';

const MENU_SELECTORS = {
  trigger: 'ytd-menu-renderer button, ytd-menu-renderer yt-icon-button, button[aria-label="More actions"], button[aria-label="Action menu"]',
  popup: 'ytd-menu-popup-renderer',
  items: 'tp-yt-paper-listbox, [role="menu"], #items'
} as const;

export function videoMenuTrigger(target: Element): { trigger: HTMLElement; card: VideoCard } | null {
  const trigger = target.closest<HTMLElement>(MENU_SELECTORS.trigger);
  const element = trigger && cardRoot(trigger);
  const card = element && detectCard(element);
  return trigger && card ? { trigger, card } : null;
}

export function visibleMenuItems(): HTMLElement | null {
  for (const popup of document.querySelectorAll<HTMLElement>(MENU_SELECTORS.popup)) {
    if (!menuVisible(popup)) continue;
    const items = popup.querySelector<HTMLElement>(MENU_SELECTORS.items);
    if (items && menuVisible(items)) return items;
  }
  return null;
}

export function menuVisible(element: HTMLElement): boolean {
  if (!element.isConnected || element.closest('[hidden], [aria-hidden="true"]')) return false;
  const style = getComputedStyle(element);
  return element.getClientRects().length > 0 && style.display !== 'none' && style.visibility !== 'hidden';
}
