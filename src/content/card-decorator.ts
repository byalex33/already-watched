import { matchesContentFilters } from '../shared/content-filters';
import { formatWatchedDate } from '../shared/date';
import type { Settings, VideoRecord } from '../shared/types';
import type { VideoCard } from './card-detector';
interface Decoration { thumbnail: HTMLElement; badge: HTMLSpanElement; button: HTMLButtonElement; videoId: string }
export class CardDecorator {
  private decorations = new WeakMap<HTMLElement, Decoration>();
  constructor(private onToggle: (card: VideoCard, watched: boolean) => void) {}
  clear(element: HTMLElement): void {
    const existing = this.decorations.get(element);
    if (existing) {
      existing.badge.remove();
      existing.button.remove();
      existing.thumbnail.classList.remove('aw-thumbnail');
    }
    element.classList.remove('aw-card', 'aw-dim', 'aw-hidden');
    this.decorations.delete(element);
  }
  apply(card: VideoCard, watched: boolean, record: VideoRecord | undefined, settings: Settings): void {
    if (!settings.enabled || (card.shorts && !settings.applyToShorts)) { this.clear(card.element); return; }
    let decoration = this.decorations.get(card.element);
    if (decoration && (decoration.videoId !== card.videoId || decoration.thumbnail !== card.thumbnail || !decoration.button.isConnected)) {
      this.clear(card.element); decoration = undefined;
    }
    if (!decoration) {
      const badge = document.createElement('span');
      badge.className = 'aw-badge';
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'aw-control';
      card.thumbnail.append(badge, button);
      card.thumbnail.classList.add('aw-thumbnail');
      decoration = { thumbnail: card.thumbnail, badge, button, videoId: card.videoId };
      this.decorations.set(card.element, decoration);
    }
    const { badge, button } = decoration;
    card.element.classList.add('aw-card');
    card.element.classList.toggle('aw-dim', watched && ['dim', 'badge-dim'].includes(settings.displayMode));
    card.element.classList.toggle('aw-hidden', matchesContentFilters(card, settings) || (watched && ['hide', 'hide-refill'].includes(settings.displayMode)));
    badge.hidden = !watched || !['badge', 'badge-dim'].includes(settings.displayMode);
    const date = settings.showWatchedDate ? formatWatchedDate(record?.watchedAt) : null;
    const badgeText = `WATCHED${date ? `\n${date}` : ''}`;
    if (badge.textContent !== badgeText) badge.textContent = badgeText;
    badge.title = record?.watchedAt ? `Marked watched ${new Date(record.watchedAt).toLocaleString()}` : 'Watched indicator from YouTube; watch date unknown';
    const label = watched ? 'Mark as unwatched' : 'Mark as watched';
    if (button.textContent !== (watched ? '↶' : '✓')) button.textContent = watched ? '↶' : '✓';
    button.title = label;
    button.setAttribute('aria-label', `${label}${card.title ? `: ${card.title}` : ''}`);
    // Cancel thumbnail navigation; YouTube owns the surrounding click handler.
    button.onclick = event => {
      event.preventDefault(); event.stopImmediatePropagation();
      this.onToggle(card, !watched);
    };
  }
}
