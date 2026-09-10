import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isPlaylistCard } from '../src/youtube/playlist-detection';
import { PlaylistFilter } from '../src/content/playlist-filter';
import { CardObserver } from '../src/content/observer';
import { detectCard } from '../src/content/card-detector';
import { DEFAULT_SETTINGS } from '../src/shared/constants';
import { normalizeSettings } from '../src/storage/settings-store';
import type { Settings } from '../src/shared/types';

let settings: Settings;
let filter: PlaylistFilter;
function fixture(tag: string, body = '<a id="thumbnail" href="/watch?v=dQw4w9WgXcQ&list=PLexample"><img></a>'): HTMLElement {
  document.body.innerHTML = `<${tag}>${body}</${tag}>`;
  return document.body.firstElementChild as HTMLElement;
}
beforeEach(() => {
  history.replaceState({}, '', '/');
  settings = { ...DEFAULT_SETTINGS, hidePlaylists: true };
  filter = new PlaylistFilter(() => settings);
});
afterEach(() => { filter.clear(); vi.useRealTimers(); });

describe('playlist and Mix detection', () => {
  it.each(['ytd-playlist-renderer', 'ytd-grid-playlist-renderer', 'ytd-compact-playlist-renderer', 'ytd-radio-renderer', 'ytd-grid-radio-renderer', 'ytd-compact-radio-renderer'])('recognizes %s', tag => {
    const card = fixture(tag); expect(isPlaylistCard(card)).toBe(true);
    filter.update(document); expect(card.classList.contains('aw-playlist-hidden')).toBe(true);
    expect(detectCard(card)).toBeNull();
  });
  it('hides the outer Home card containing a playlist', () => {
    const outer = fixture('ytd-rich-item-renderer', '<ytd-grid-playlist-renderer><a id="thumbnail" href="/playlist?list=PLexample"><img></a></ytd-grid-playlist-renderer>');
    filter.update(document); expect(outer.classList.contains('aw-playlist-hidden')).toBe(true);
  });
  it.each(['yt-lockup-view-model', 'yt-lockup-view-model-wiz', 'ytd-rich-item-renderer'])('recognizes playlist thumbnails in %s', tag => {
    const card = fixture(tag, '<a id="thumbnail" href="/playlist?list=PLexample"><img></a>');
    expect(isPlaylistCard(card)).toBe(true);
  });
  it('recognizes View full playlist links and collection thumbnails', () => {
    let card = fixture('yt-lockup-view-model');
    card.insertAdjacentHTML('beforeend', '<a href="/playlist?list=PLexample">View full playlist</a>');
    expect(isPlaylistCard(card)).toBe(true);
    card = fixture('yt-lockup-view-model'); card.insertAdjacentHTML('beforeend', '<yt-collection-thumbnail-view-model></yt-collection-thumbnail-view-model>');
    expect(isPlaylistCard(card)).toBe(true);
  });
  it.each(['Mix', 'Playlist', '55 videos'])('recognizes the %s thumbnail badge', label => {
    const card = fixture('yt-lockup-view-model', `<a id="thumbnail" href="/watch?v=dQw4w9WgXcQ&list=RDdQw4w9WgXcQ"><img><yt-badge-view-model>${label}</yt-badge-view-model></a>`);
    expect(isPlaylistCard(card)).toBe(true);
  });
  it('leaves normal videos with list= or radio parameters alone', () => {
    const card = fixture('ytd-rich-item-renderer', '<a id="thumbnail" href="/watch?v=dQw4w9WgXcQ&list=RDdQw4w9WgXcQ&start_radio=1"><img><yt-badge-view-model>12:34</yt-badge-view-model></a><h3>My favourite Mix</h3>');
    expect(isPlaylistCard(card)).toBe(false);
    expect(detectCard(card)?.videoId).toBe('dQw4w9WgXcQ');
  });
  it.each(['ytd-playlist-video-renderer', 'ytd-playlist-panel-video-renderer'])('preserves individual entries in %s', tag => {
    const card = fixture(tag); expect(isPlaylistCard(card)).toBe(false);
    filter.update(document); expect(card.classList.contains('aw-playlist-hidden')).toBe(false);
  });
  it('ignores description links, unrelated badges and spoofed YouTube URLs', () => {
    const card = fixture('ytd-video-renderer', '<a id="thumbnail" href="/watch?v=dQw4w9WgXcQ"><img></a><div id="description"><a href="/playlist?list=PLexample">View full playlist</a></div><h3>55 videos</h3>');
    expect(isPlaylistCard(card)).toBe(false);
    expect(isPlaylistCard(fixture('yt-lockup-view-model', '<a id="thumbnail" href="https://youtube.com.evil.test/playlist?list=PLexample"><img></a>'))).toBe(false);
  });
});

describe('playlist filter lifecycle', () => {
  it.each(['/@creator', '/@creator/playlists', '/@creator/videos', '/channel/UCexample', '/channel/UCexample/playlists', '/c/creator/playlists', '/user/creator/playlists'])('keeps playlists visible on channel page %s', path => {
    history.replaceState({}, '', path);
    const card = fixture('ytd-grid-playlist-renderer');
    filter.update(document);
    expect(card.classList.contains('aw-playlist-hidden')).toBe(false);
  });
  it('restores playlists when navigating to a channel and filters again on Home', () => {
    const card = fixture('ytd-grid-playlist-renderer');
    filter.update(document);
    expect(card.classList.contains('aw-playlist-hidden')).toBe(true);
    history.replaceState({}, '', '/@creator/playlists');
    filter.update(card);
    expect(card.classList.contains('aw-playlist-hidden')).toBe(false);
    history.replaceState({}, '', '/');
    filter.update(document);
    expect(card.classList.contains('aw-playlist-hidden')).toBe(true);
  });
  it('defaults off and preserves explicit preferences', () => {
    expect(normalizeSettings({}).hidePlaylists).toBe(false);
    expect(normalizeSettings(settings).hidePlaylists).toBe(true);
  });
  it('restores cards when disabled and keeps filters independent', () => {
    const card = fixture('ytd-playlist-renderer'); card.classList.add('aw-home-shorts-hidden');
    filter.update(document); settings.hidePlaylists = false; filter.update(document);
    expect(card.classList.contains('aw-playlist-hidden')).toBe(false);
    expect(card.classList.contains('aw-home-shorts-hidden')).toBe(true);
    settings.hidePlaylists = true; filter.update(document); settings.enabled = false; filter.update(document);
    expect(card.classList.contains('aw-playlist-hidden')).toBe(false);
  });
  it('handles dynamically inserted playlist-only links and recycled cards', async () => {
    vi.useFakeTimers(); document.body.innerHTML = '';
    const observer = new CardObserver(vi.fn(), () => filter.prune(), vi.fn(), root => filter.update(root)); observer.start();
    const card = fixture('yt-lockup-view-model', '<a id="thumbnail" href="/playlist?list=PLexample"><img></a>');
    await vi.advanceTimersByTimeAsync(500); expect(card.classList.contains('aw-playlist-hidden')).toBe(true);
    card.querySelector('a')!.href = '/watch?v=dQw4w9WgXcQ';
    await vi.advanceTimersByTimeAsync(500); expect(card.classList.contains('aw-playlist-hidden')).toBe(false);
    card.querySelector('a')!.href = '/playlist?list=PLexample';
    await vi.advanceTimersByTimeAsync(500); expect(card.classList.contains('aw-playlist-hidden')).toBe(true);
    card.remove(); filter.prune(); expect(card.classList.contains('aw-playlist-hidden')).toBe(false);
    observer.stop();
  });
  it('responds when a Mix badge arrives late without looping on its own classes', async () => {
    vi.useFakeTimers(); const card = fixture('yt-lockup-view-model');
    const update = vi.fn((root: Element | Document) => filter.update(root));
    const observer = new CardObserver(vi.fn(), vi.fn(), vi.fn(), update); observer.start();
    const badge = document.createElement('yt-badge-view-model'); badge.textContent = 'Mix'; card.append(badge);
    await vi.advanceTimersByTimeAsync(500); expect(card.classList.contains('aw-playlist-hidden')).toBe(true);
    const calls = update.mock.calls.length; await vi.advanceTimersByTimeAsync(1000); expect(update.mock.calls.length).toBe(calls);
    badge.firstChild!.nodeValue = '12:34'; await vi.advanceTimersByTimeAsync(500);
    expect(card.classList.contains('aw-playlist-hidden')).toBe(false); observer.stop();
  });
});
