import type { Settings } from '../shared/types';
import { findPlaylistCandidates, isPlaylistCard } from '../youtube/playlist-detection';

export class PlaylistFilter {
  private hidden = new Set<HTMLElement>();
  constructor(private settings: () => Settings) {}

  update(root: Element | Document): void {
    const settings = this.settings();
    if (!settings.enabled || !settings.hidePlaylists) { this.clear(); return; }
    this.prune();
    for (const card of findPlaylistCandidates(root)) {
      const hide = isPlaylistCard(card);
      card.classList.toggle('aw-playlist-hidden', hide);
      if (hide) this.hidden.add(card); else this.hidden.delete(card);
    }
  }

  prune(): void {
    for (const card of this.hidden) if (!card.isConnected) {
      card.classList.remove('aw-playlist-hidden'); this.hidden.delete(card);
    }
  }

  clear(): void {
    for (const card of this.hidden) card.classList.remove('aw-playlist-hidden');
    this.hidden.clear();
  }
}
