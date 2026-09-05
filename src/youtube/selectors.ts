// Keep DOM knowledge here. Unknown renderers are left intact, rather than hiding
// a guessed ancestor that might contain an entire shelf or playlist.
export const SELECTORS = {
  cards: ['ytd-rich-item-renderer', 'ytd-video-renderer', 'ytd-compact-video-renderer', 'ytd-grid-video-renderer', 'ytd-playlist-video-renderer', 'ytd-reel-item-renderer', 'yt-lockup-view-model', 'yt-lockup-view-model-wiz', 'yt-shorts-lockup-view-model', 'ytm-shorts-lockup-view-model', 'ytm-shorts-lockup-view-model-v2', 'ytd-playlist-renderer', 'ytd-grid-playlist-renderer', 'ytd-compact-playlist-renderer', 'ytd-radio-renderer', 'ytd-grid-radio-renderer', 'ytd-compact-radio-renderer'].join(','),
  playlistRenderers: 'ytd-playlist-renderer, ytd-grid-playlist-renderer, ytd-compact-playlist-renderer, ytd-radio-renderer, ytd-grid-radio-renderer, ytd-compact-radio-renderer',
  playlistEntries: 'ytd-playlist-video-renderer, ytd-playlist-panel-video-renderer',
  playlistLinks: 'a[href*="/playlist?"]',
  playlistPrimaryLinks: 'a#thumbnail, a#video-title, a#video-title-link, a#view-more, a#view-full-playlist, h3 a, a.yt-lockup-view-model__content-image, a.yt-lockup-view-model-wiz__content-image',
  playlistCollection: 'yt-collection-thumbnail-view-model, ytd-thumbnail-overlay-side-panel-renderer',
  playlistBadges: 'ytd-thumbnail-overlay-bottom-panel-renderer, ytd-thumbnail-overlay-side-panel-renderer, #video-count, yt-badge-view-model, .yt-badge-shape__text, .yt-badge-shape-wiz__text',
  cardDescription: '#description, #description-text, ytd-text-inline-expander, .metadata-snippet-container',
  videoLinks: 'a[href*="/watch?"],a[href*="/shorts/"],a[href*="youtu.be/"],a[href*="/live/"]',
  thumbnail: 'a#thumbnail, a.yt-lockup-view-model__content-image, a.yt-lockup-view-model-wiz__content-image, a.shortsLockupViewModelHostEndpoint, ytd-thumbnail a, a:has(img)',
  title: '#video-title, #video-title-link, .yt-lockup-metadata-view-model__title, .yt-lockup-metadata-view-model-wiz__title, .shortsLockupViewModelHostMetadataTitle',
  progress: 'ytd-thumbnail-overlay-resume-playback-renderer #progress, ytd-thumbnail-overlay-resume-playback-renderer [style*="width"], .ytThumbnailOverlayProgressBarHostWatchedProgressBarSegment, .yt-thumbnail-overlay-progress-bar-view-model__progress-bar, [role="progressbar"][aria-valuenow]',
  resumeProgress: 'ytw-thumbnail-overlay-resume-playback-renderer .ytwThumbnailOverlayResumePlaybackRendererThumbnailOverlayResumePlaybackProgress',
  playbackProgress: '.ytThumbnailOverlayProgressBarHostWatchedProgressBarSegment',
  nowPlaying: 'ytd-thumbnail-overlay-now-playing-renderer[now-playing-badge]',
  progressHost: 'ytd-thumbnail-overlay-resume-playback-renderer, ytw-thumbnail-overlay-resume-playback-renderer, yt-thumbnail-overlay-progress-bar-view-model, .ytThumbnailOverlayProgressBarHost',
  adCard: 'ytd-ad-slot-renderer, ytd-display-ad-renderer, ytd-promoted-video-renderer, ytd-in-feed-ad-layout-renderer, ytd-promoted-sparkles-web-renderer',
  mainPlayer: '#movie_player',
  mainVideo: '#movie_player video.html5-main-video',
  activeShort: 'ytd-reel-video-renderer[is-active], ytd-reel-video-renderer[active]',
  shortVideo: 'video.html5-main-video, video',
  adPlayer: '.ad-showing, .ad-interrupting',
  livePlayer: '.ytp-live, .ytp-live-badge[disabled], .ytp-live-badge[aria-disabled="true"]',
  watchContainer: 'ytd-watch-flexy[video-id]',
  watchTitle: 'ytd-watch-metadata h1, h1.ytd-watch-metadata, #title h1',
  refillBrowse: 'ytd-browse:not([hidden]) ytd-rich-grid-renderer, ytd-browse:not([hidden]) ytd-grid-renderer, ytd-browse:not([hidden]) ytd-section-list-renderer',
  refillSearch: 'ytd-search:not([hidden]) ytd-section-list-renderer',
  refillRelated: 'ytd-watch-flexy:not([hidden]) #related ytd-watch-next-secondary-results-renderer',
  continuation: 'ytd-continuation-item-renderer',
  continuationButton: 'ytd-button-renderer button, yt-button-shape button',
  continuationBusy: '[is-loading], [aria-busy="true"], tp-yt-paper-spinner[active], tp-yt-paper-spinner-lite[active]',
  refillExcluded: 'ytd-comments, ytd-playlist-panel-renderer, ytd-rich-shelf-renderer, ytd-reel-shelf-renderer, ytd-shelf-renderer',
  promotionalSections: 'ytd-rich-section-renderer, ytd-rich-shelf-renderer, ytd-shelf-renderer, ytd-horizontal-card-list-renderer, ytd-exploratory-results-renderer, ytd-mini-game-shelf-renderer, ytd-chips-shelf-with-video-shelf-renderer',
  promotionalHeadings: 'h2, h3, [role="heading"], #title, #subtitle, #sub-title, #header',
  promotionalOuter: 'ytd-rich-section-renderer',
  promotionalShelves: 'ytd-rich-shelf-renderer, ytd-shelf-renderer, ytd-horizontal-card-list-renderer, ytd-exploratory-results-renderer, ytd-mini-game-shelf-renderer, ytd-chips-shelf-with-video-shelf-renderer',
  homeShortsShelves: 'ytd-rich-shelf-renderer[is-shorts], ytd-reel-shelf-renderer',
  homeShortsGridShelves: 'grid-shelf-view-model',
  shortsLockups: 'yt-shorts-lockup-view-model, ytm-shorts-lockup-view-model, ytm-shorts-lockup-view-model-v2',
  sectionHidden: '.aw-promo-hidden, .aw-home-shorts-hidden, .aw-playlist-hidden',
  extensionOwned: '.aw-badge, .aw-control, .aw-toast'
} as const;

export function cardRoot(element: Element): HTMLElement | null {
  const closest = element.closest<HTMLElement>(SELECTORS.cards);
  if (!closest || closest.closest(SELECTORS.adCard) || closest.querySelector(SELECTORS.adCard)) return null;
  return closest.closest<HTMLElement>('ytd-rich-item-renderer') ?? closest;
}
export function playerElements(shorts: boolean): { player: HTMLElement; video: HTMLVideoElement; declaredId: string | null } | null {
  const active = shorts ? document.querySelector<HTMLElement>(SELECTORS.activeShort) : document.querySelector<HTMLElement>(SELECTORS.mainPlayer);
  const video = shorts ? active?.querySelector<HTMLVideoElement>(SELECTORS.shortVideo) : document.querySelector<HTMLVideoElement>(SELECTORS.mainVideo);
  if (!active || !video) return null;
  const declaredId = shorts ? active.getAttribute('video-id') : document.querySelector(SELECTORS.watchContainer)?.getAttribute('video-id') ?? null;
  return { player: active, video, declaredId };
}
export function playbackBlocked(player: HTMLElement): boolean {
  return player.matches(SELECTORS.adPlayer) || !!player.querySelector(SELECTORS.adPlayer)
    || player.matches(SELECTORS.livePlayer) || !!player.querySelector(SELECTORS.livePlayer);
}
