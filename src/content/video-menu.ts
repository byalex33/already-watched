import { detectCard, type VideoCard } from './card-detector';
import { menuVisible, videoMenuTrigger, visibleMenuItems } from '../youtube/menu';

interface OpenMenu {
  card: VideoCard;
  trigger: HTMLElement;
  url: string;
  deadline: number;
  items?: HTMLElement;
  button?: HTMLButtonElement;
  saving: boolean;
}

export class VideoMenu {
  private active?: OpenMenu;
  private timer?: ReturnType<typeof setTimeout>;
  private readonly onClick = (event: MouseEvent): void => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) { this.reset(); return; }
    if (this.active?.items?.contains(target)) {
      if (!this.active.button?.contains(target)) this.reset();
      return;
    }
    const context = videoMenuTrigger(target);
    this.reset();
    if (!context) return;
    this.active = { ...context, url: location.href, deadline: Date.now() + 2000, saving: false };
    // Defer until YouTube's click handler has opened/populated its shared popup.
    this.timer = setTimeout(() => this.update(), 50);
  };
  private readonly onKey = (event: KeyboardEvent): void => { if (event.key === 'Escape') this.reset(); };

  constructor(
    private watched: (card: VideoCard) => boolean,
    private mark: (card: VideoCard, watched: boolean) => Promise<unknown>,
    private onError: (error: unknown) => void
  ) {
    document.addEventListener('click', this.onClick, true);
    document.addEventListener('keydown', this.onKey, true);
  }

  private valid(context: OpenMenu): boolean {
    return context.url === location.href && context.card.element.isConnected
      && detectCard(context.card.element)?.videoId === context.card.videoId;
  }

  private update(): void {
    this.timer = undefined;
    const context = this.active;
    if (!context || !this.valid(context)) { this.reset(); return; }
    if (context.items && !menuVisible(context.items)) { this.reset(); return; }
    const items = context.items ?? visibleMenuItems();
    if (!items) {
      if (Date.now() >= context.deadline) { this.reset(); return; }
      this.timer = setTimeout(() => this.update(), 100); return;
    }
    context.items = items;
    if (!context.button?.isConnected) {
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'aw-menu-action';
      button.setAttribute('role', 'menuitem');
      button.onclick = event => {
        event.preventDefault(); event.stopPropagation();
        void this.activate(context);
      };
      items.append(button); context.button = button;
    }
    if (!context.saving) {
      const label = this.watched(context.card) ? 'Remove from watched' : 'Add to watched';
      if (context.button.textContent !== label) context.button.textContent = label;
      context.button.title = 'Already Watched · saved only on this device';
    }
    // Only inspect while a video menu is open, including reused/hidden popups.
    this.timer = setTimeout(() => this.update(), 250);
  }

  private async activate(context: OpenMenu): Promise<void> {
    if (context !== this.active || context.saving || !this.valid(context)) { if (!context.saving) this.reset(); return; }
    const button = context.button;
    if (!button) return;
    context.saving = true; button.disabled = true; button.textContent = 'Saving…';
    try { await this.mark(context.card, !this.watched(context.card)); }
    catch (error) { this.onError(error); }
    finally { context.saving = false; button.disabled = false; }
  }

  reset(): void {
    if (this.timer !== undefined) clearTimeout(this.timer);
    this.timer = undefined;
    this.active?.button?.remove(); this.active = undefined;
  }

  stop(): void {
    this.reset();
    document.removeEventListener('click', this.onClick, true);
    document.removeEventListener('keydown', this.onKey, true);
  }
}
