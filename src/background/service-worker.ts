import { errorMessage } from '../shared/messaging';
import { extractVideoId } from '../youtube/video-id';
import { Repository } from './repository';
import { validRequest } from './validation';

const repository = new Repository();
chrome.runtime.onMessage.addListener((message: unknown, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id || !validRequest(message)) return false;
  void repository.dispatch(message).then(
    data => sendResponse({ ok: true, data }),
    error => sendResponse({ ok: false, error: errorMessage(error) })
  );
  return true;
});

chrome.runtime.onInstalled.addListener(() => {
  void chrome.contextMenus.removeAll().then(() => {
    for (const [id, title] of [['aw-watched', 'Already Watched: mark as watched'], ['aw-unwatched', 'Already Watched: mark as unwatched']]) {
      if (!id || !title) continue;
      chrome.contextMenus.create({ id, title, contexts: ['link'], targetUrlPatterns: ['*://*.youtube.com/watch?*', '*://*.youtube.com/shorts/*', '*://youtu.be/*'], documentUrlPatterns: ['https://www.youtube.com/*', 'https://youtube.com/*'] });
      chrome.contextMenus.create({ id: `${id}-page`, title, contexts: ['page', 'video'], documentUrlPatterns: ['https://www.youtube.com/watch?*', 'https://www.youtube.com/shorts/*', 'https://www.youtube.com/live/*'] });
    }
  }).catch(() => undefined);
});
chrome.contextMenus.onClicked.addListener((info, tab) => {
  const videoId = extractVideoId(info.linkUrl ?? info.pageUrl ?? '');
  if (!videoId || !String(info.menuItemId).startsWith('aw-')) return;
  void repository.dispatch({ type: 'mark', videoId, watched: String(info.menuItemId).startsWith('aw-watched') }).catch(error => {
    if (tab?.id) void chrome.tabs.sendMessage(tab.id, { type: 'aw-error', error: errorMessage(error) }).catch(() => undefined);
  });
});
