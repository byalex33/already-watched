import type { Settings } from '../shared/types';
import { detectCard, findCardRoots } from './card-detector';
import { isHomePage } from './home-shorts-filter';

// A channel avatar can advertise a different live video. Only inspect the
// video's thumbnail overlay and metadata badges, never its title or avatar.
export function isLivestream(card: HTMLElement): boolean {
  const scopes = '#thumbnail, yt-thumbnail-view-model, yt-thumbnail-view-model-wiz, a.yt-lockup-view-model__content-image, a.yt-lockup-view-model-wiz__content-image, #badges, #metadata, yt-content-metadata-view-model, yt-content-metadata-view-model-wiz';
  const excluded = '#avatar, #avatar-link, #channel-thumbnail, yt-avatar-shape, yt-avatar-shape-wiz, yt-decorated-avatar-view-model, ytd-channel-name, ytd-channel-renderer';
  return [...card.querySelectorAll('ytd-thumbnail-overlay-time-status-renderer, .badge-style-type-live-now, yt-thumbnail-badge-view-model, yt-badge-view-model, ytd-badge-supported-renderer')].some(badge => {
    if (!badge.closest(scopes) || badge.closest(excluded)) return false;
    return badge.matches('[overlay-style="LIVE"], .badge-style-type-live-now')
      || /^(?:live|live now)$/i.test(badge.textContent?.trim() ?? '');
  });
}

export class HomeLivestreamFilter {
  private hidden = new Set<HTMLElement>();
  constructor(private settings: () => Settings) {}

  update(root: Element | Document): void {
    const settings = this.settings();
    if (!settings.enabled || !settings.hideHomeLivestreams || !isHomePage(location.href)) { this.clear(); return; }
    for (const card of findCardRoots(root)) {
      const hide = !!detectCard(card) && isLivestream(card);
      card.classList.toggle('aw-home-live-hidden', hide);
      if (hide) this.hidden.add(card);
      else this.hidden.delete(card);
    }
  }

  prune(): void {
    for (const card of this.hidden) if (!card.isConnected) {
      card.classList.remove('aw-home-live-hidden'); this.hidden.delete(card);
    }
  }

  clear(): void {
    for (const card of this.hidden) card.classList.remove('aw-home-live-hidden');
    this.hidden.clear();
  }
}
