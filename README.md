# Already Watched

A local-first Chrome extension for a less repetitive YouTube feed. Watched recommendations get a thumbnail badge, gentle dimming, both, or can be hidden entirely. Default: **Badge + Dim, 70% watched**. Watched cards stay clickable and return to full opacity on hover or keyboard focus.

Choose **Hide + refill** to hide watched cards and try to bring in more recommendations when the remaining feed is short.

Turn on **Hide Playables and topic suggestions** to remove YouTube Playables (“Instant games, no downloads”) and “Explore more topics” sections. This optional toggle works with every display mode, updates dynamically, and restores the sections when switched off or the extension is disabled. It defaults off for existing and new installs. Matching is scoped to section headings, so videos discussing Playables are not removed. English heading fallbacks and known renderer adapters are used; unrecognized/localized layouts may need an adapter update. These sections do not count as watched videos or add to filtering statistics.

**Hide Shorts on Home** is a separate, optional toggle that removes all Shorts shelves and individual Shorts cards from the main Home feed, regardless of watched status. The dedicated Shorts player, search results, subscriptions, and channel pages remain available. It defaults off, restores content immediately when disabled, and is independent of **Apply to Shorts**, which controls watched detection/decorations for Shorts.

**Hide playlists and Mixes** removes playlist collection cards and YouTube's auto-generated Mix cards from supported feeds, search results, channel grids, and recommendations. It defaults off and works with every display mode. Individual videos within playlists, the playlist playback panel, and normal video URLs containing `list=` or `start_radio=1` stay available. Detection uses playlist/radio renderer types, playlist thumbnail/title links, and collection or playlist/Mix thumbnail badges rather than URL parameters alone. Recognized collection cards are excluded from per-video watched tracking and scan imports, so watching the first video does not mark the entire playlist watched. Hidden collections do not inflate video statistics, and supported Home grids fill the resulting gaps.

## Run it

Requires Node.js 20.19+ (Node 22 LTS recommended), npm, and Chrome 114 or later.

```sh
cd already-watched
npm ci
npm run check
```

The ready-to-load extension is built into `dist/`.

1. Open `chrome://extensions` in Chrome.
2. Enable **Developer mode**.
3. Choose **Load unpacked** and select this project's **dist** folder (not the source folder).
4. Refresh any YouTube tabs that were already open.
5. Pin **Already Watched** from Chrome's Extensions menu, then open the popup to adjust settings.

For the full settings page, right-click the extension icon and choose **Options**. Use the popup while a YouTube tab is active to scan that tab.

```sh
npm test             # unit, DOM, storage concurrency, and player regression tests
npm run typecheck    # strict TypeScript checks
npm run build        # typecheck + bundled production extension
npm run dev          # rebuild JavaScript/React source changes
npm run preview      # localhost popup preview with synthetic data, no extension install
```

After changes, reload the extension in `chrome://extensions` and refresh YouTube. In development watch mode, rerun the command for changes to the manifest, static assets, or content CSS. Builds overwrite generated files in place; they do not delete project files. Preview mocks stay in the development server and are never bundled into the extension.

With the preview server running, `http://127.0.0.1:4177/continuation-fixture` exercises the production continuation adapter against a native browser IntersectionObserver. Click **Trigger refill** to verify an intersection occurs, scroll is preserved, and temporary styling is restored. This local fixture has been checked in Chrome; it does not simulate or guarantee live YouTube responses.

`http://127.0.0.1:4177/grid-fixture` is the browser regression check for empty video slots before full-width shelves. It runs the production decorator and stylesheet and reports PASS when the next video fills the earlier empty slot. The original flex layout failed this check with a 222px row difference; the corrected layout passes with a 0px difference.

## Behaviour

- Finds video cards on Home, recommendations/sidebar, Search, Subscriptions, channel videos, playlists, related grids, and supported Shorts layouts. Video IDs come from video links, including links with playlist, time, or share parameters.
- Tracks the actual, unique playback segments observed on watch pages and supported Shorts players. A restored playback offset, a seek, or repeatedly watching the same segment does not inflate progress. Segments persist across tabs and sessions, even before the watched threshold is reached.
- Marks a video as watched when those segments reach your threshold. The first recorded mark date is preserved and progress continues updating. Changing the threshold affects future automatic marks and UI hints; it does not retroactively erase watched records.
- Optionally uses YouTube's thumbnail progress bars at the same threshold. These transient hints do **not** create a database entry and never supply a made-up watch date.
- Hover/focus a thumbnail and use **✓** to mark watched or **↶** to mark unwatched. You can also right-click a YouTube video link, or the current watch page, for Chrome context-menu commands. Manual marks work independently of the enabled toggle.
- Open a video's native **three-dot menu** and choose **Add to watched**, or **Remove from watched** to undo. This uses the same local history and manual override as thumbnail controls. The item follows the card that opened YouTube's shared dropdown, supports keyboard activation, and disappears when the menu closes or you navigate. Unsupported menu layouts and playlist/Mix menus are left untouched.
- Marking unwatched clears observed progress for that video and suppresses YouTube hints and imports for it. Fresh playback reaching the threshold, or another manual mark, can mark it watched again.
- **Scan current YouTube page for watched videos** imports qualifying progress bars from cards currently rendered in the active tab. It does not scroll, fetch the account's history, or access an API. Already-watched records and manual unwatched overrides are preserved. Import time is stored separately from watch time.
- Clearing history removes local video records, partial playback, overrides, and statistics, while keeping settings. Open tabs discard pre-reset playback batches. YouTube's own red-bar hints can immediately appear again; disable that setting if you want only fresh extension history. New playback can subsequently rebuild history.
- Disabling the extension restores cards and pauses automatic playback tracking and filtering. Data remains local until explicitly cleared or the extension is uninstalled.

### Hide + refill

Select **Hide + refill** in the popup or Options. It hides watched cards just like Hide, then asks YouTube to load more through its existing continuation controls. Supported scopes are Home, Search, Subscriptions, channel Videos/Shorts/Streams tabs, and watch-page recommendations. It does not paginate comments, playlists, or the Shorts playback viewer.

The extension only attempts a refill if it has hidden cards in that feed, fewer than 12 distinct remaining video IDs are below the current scroll position, and the remaining cards extend less than 1.5 viewport heights down the screen. It stops once enough content is available. The original Badge + Dim default is unchanged.

- At most **five extension-initiated loads per page visit**, at least three seconds apart. YouTube may still load more through its normal scrolling behaviour.
- Waits up to nine seconds for a response; stops after **two attempts with no new video IDs**. Duplicate/recycled cards do not count as new results.
- Pauses in background tabs, during navigation, and when disabled or another display mode is selected. Changing a setting or receiving a YouTube data-update event does not replenish the attempt budget; navigating to a different URL does.
- Uses a known continuation's native load-more button when available. For automatic continuations, it briefly positions that existing sentinel at the viewport edge to activate YouTube's intersection-based loading, then restores it. It does not move your scroll position, synthesize recommendations, read private YouTube state, or call a YouTube API. See [Intersection Observer behaviour](https://developer.mozilla.org/en-US/docs/Web/API/Intersection_Observer_API).
- Newly loaded cards pass through the same watched detection and decoration pipeline. “Unwatched” means **not known to be watched**, not a guarantee of a video you have never seen.

Refilling is best effort. If YouTube offers no supported continuation, ignores the trigger, or returns only watched videos, the feed can remain short. Unknown layouts are left alone; there is no fallback that scrolls the page or repeatedly fetches results.

## Statistics

**In your history** is the current number of stored records marked watched; partial playback and transient YouTube hints are excluded. **Total marks** counts transitions into the watched state, including manual marks and imports; marking unwatched and then watched again adds another mark.

**Filtered today** counts unique video IDs matched and decorated/hidden among rendered cards, once per local calendar day across all tabs. It is not a count of impressions, literal DOM nodes, or only the current viewport. Duplicate cards, re-renders, repeated observer events, and SPA navigation do not inflate it. **Filtered all-time** sums these daily unique counts, so a video seen on two different days contributes twice. Settings and watch pages have no filtering effect on YouTube's recommendation algorithm itself.

## Architecture

```text
manifest.json                  MV3, scoped permissions, bundled local assets
src/background/
  service-worker.ts            messaging + Chrome context menus
  repository.ts                sole writer, serialized operations and reset generations
  validation.ts                message validation and batch bounds
src/content/
  index.ts                     local cache, per-video card index, imports and batched counts
  observer.ts                  incremental MutationObserver + 120 ms batching
  video-tracker.ts             HTML5 playback continuity, ads/live guards, periodic saves
  feed-refiller.ts             sparse-feed checks, continuation cooldowns and load budgets
  promotional-filter.ts       reversible Playables/topic-suggestion section filtering
  home-shorts-filter.ts       Home-only Shorts shelves/cards, with SPA restoration
  playlist-filter.ts         reversible playlist and Mix collection-card filtering
  card-detector.ts             maps supported renderer elements to video cards
  card-decorator.ts            idempotent badges, dim/hide and manual controls
  video-menu.ts                watched/undo actions in native three-dot video menus
  youtube-navigation.ts       SPA events, popstate and lightweight URL fallback
  styles.css                  namespaced, reversible YouTube decorations
src/storage/                  settings, per-video record operations, stats logic
src/youtube/                  centralized selectors, URL parsing, progress and continuation adapters
src/shared/                   typed messages/models, defaults, progress/date/state logic
src/popup/                    React settings UI shared by popup and Options
tests/                        pure, DOM, player and repository regression suites
```

Content scripts are framework-free and run in Chrome's isolated world. React is bundled only into the popup/options UI. All scripts, styles, and icons ship locally; no CDN or runtime code download is used.

### Storage and performance

The service worker serializes mutations from all tabs through one queue; data always comes from persistent storage so suspending/restarting the worker does not reset history or deduplication. Records use individual `video:<11-character-id>` keys:

```json
{
  "video:dQw4w9WgXcQ": {
    "videoId": "dQw4w9WgXcQ",
    "title": "Example video",
    "watched": true,
    "watchedAt": 1788500000000,
    "progress": 0.91,
    "lastSeen": 1788502000000,
    "source": "playback",
    "segments": [[0, 182]]
  }
}
```

`source` is `playback`, `manual`, or `youtube-ui`; imported records have `importedAt` and no `watchedAt` unless subsequent observed playback qualifies. Manual unwatched records carry `unwatchedOverride`. `settings`, `stats`, `historyRevision`, and a recoverable storage-error message use separate keys. This repository boundary can support a different storage adapter later; Chrome sync is intentionally not enabled in v1.

- A tab takes one initial snapshot, then updates only changed records from `chrome.storage.onChanged`.
- Playback is sampled once a second, written about every 15 seconds, on pause/end/navigation, and immediately when qualifying. Individual video keys avoid rewriting the entire history. Intervals merge and are capped at 128 per record; extreme fragmentation discards the shortest intervals conservatively.
- Recommendation `lastSeen` writes happen at most hourly per record. Filter/touch messages batch every five seconds, capped at 500 IDs. Daily deduplication persists only the current day's IDs plus all-time totals.
- New/changed subtrees are queued and coalesced. Full discovery runs on initialization and navigation, not on every mutation. Attribute observation excludes classes and extension-owned text; decorators do not create observer feedback loops. Removed cards are pruned, and record updates address cards through a video-ID index.
- A revision token invalidates stale automatic messages when history is reset or a video is manually marked unwatched. Already-running tabs cannot undo a reset with an old progress batch. This conservatively discards pending unsaved segments in other tabs too.
- No automatic history eviction: quota failures leave existing data intact and surface an error. Chrome's default local-storage quota is 10 MB; the UI shows usage. This supports thousands of typical records, with capacity depending on title lengths and interval fragmentation. No `unlimitedStorage` permission is requested. See [Chrome storage documentation](https://developer.chrome.com/docs/extensions/reference/api/storage).

## Privacy and permissions

Everything is stored in **`chrome.storage.local` on this Chrome profile**. No analytics, backend, YouTube API, Google account access, browsing-history permission, cookies permission, or Chrome sync. The extension makes no direct network requests. In Hide + refill mode it can trigger YouTube's own recommendation loading, which causes YouTube to make its usual requests to YouTube. No additional permissions or third-party services are used.

- `storage`: persist settings, video IDs/titles, observed playback segments, dates, and statistics.
- `contextMenus`: manual watched/unwatched commands.
- Access only to `https://www.youtube.com/*` and `https://youtube.com/*`: inject the content script and identify/message the active YouTube tab for scanning. Parsing a shared `youtu.be` link does not grant access to that host.

Uninstalling the extension removes its local data. Local data is not encrypted by this extension; anyone with access to this Chrome profile can inspect it.

## Limitations and release checks

YouTube continuously changes layouts and runs experiments. The adapters cover known desktop renderer families, including newer lockup view models, but an unknown layout is left untouched. Shorts player tracking requires an identifiable active renderer; unsupported Shorts layouts fail safely. Mobile YouTube and embedded players on other sites are outside v1's scope.

Ad detection uses YouTube's player/ad markers and observed playback continuity. Ordinary marked video ads are excluded, and unknown/infinite-duration or visibly live/DVR players are not automatically marked with the percentage rule. Paused premieres do not accrue progress; finite recordings can qualify once played normally. A future ad format that omits those DOM markers may need an adapter update. Do not treat DOM heuristics as a YouTube-provided guarantee.

Sampling is conservative: background throttling, seeks, metadata changes, and navigation may leave small unobserved gaps. A strict 100% threshold may require replaying a missed segment. Force-closing Chrome may lose the final unsaved playback/counter batch (normally at most 15 seconds/five seconds). Saved records survive. On supported rich grids, hidden cards/sections enable dense CSS grid placement so later videos can fill gaps before full-width shelves. It preserves YouTube's responsive column count, card margins, DOM ownership, and event handlers; visual ordering across shelves can differ from DOM/keyboard order. When no direct grid items remain hidden, normal YouTube layout returns automatically. Legacy row wrappers and unsupported layouts may still leave gaps.

Automated validation covers pure logic, renderer fixtures, actual decorator interactions, observer feedback, playback events, ads/live handling, concurrent repository writes, reset invalidation, storage failures, and refill limits, cooldowns, duplicates, sparse-feed detection, delayed continuations, and cancellation. The popup has also been checked in Chrome using the local preview with synthetic data. This is not a claim that the unpacked extension has been exercised against every current live YouTube experiment.

Before distributing through the Chrome Web Store, load `dist/` and perform this live smoke check:

1. Visit Home, Search, Subscriptions, a channel, a playlist/watch page and Shorts. Mark one card and check duplicate cards agree without a reload.
2. Change each mode, disable/re-enable, mark unwatched, and confirm the red-bar hint stays suppressed. Check light/dark themes and keyboard access.
3. Set the threshold to 10%, play a fresh finite video, seek ahead, and verify only actual playback qualifies. Let autoplay move to the next video. Check a normal pre-roll/mid-roll ad and a live/DVR stream.
4. Scan a rendered page with playback bars. Check imported videos have no invented date. Check today's count does not grow on repeated mutations/navigation for the same IDs.
5. Clear history while playback is open in another tab; old segments must not restore the record. Reload the extension, refresh tabs, and verify settings and new records persist.
6. Select Hide + refill on a feed with mostly watched cards. Check new cards are processed, your scroll position stays put, and the extension stops after five attempts or two responses with no new IDs. Switch modes or navigate while loading; no temporary continuation styles should remain. Confirm watch-page refills load recommendations, not comments.
7. Enable Hide Playables and topic suggestions; both sections should disappear with their outer spacing. Disable the toggle and confirm they return. In Hide modes, check later videos fill partial rows before full-width shelves, including after resizing the window.
8. Enable Hide Shorts on Home, verify Home has no Shorts shelves/cards, then navigate to Search, a channel's Shorts tab, and the dedicated Shorts page. Those surfaces should remain available. Return Home and toggle the setting off to restore the shelves.
9. Enable Hide playlists and Mixes. Check collection cards disappear and return when disabled. Play an individual video in a playlist and confirm playback and its playlist panel remain usable. Watching its first video must not mark the collection watched.

Keep `src/youtube/selectors.ts` and the DOM fixtures together when adapting to a changed layout. Store packaging/publishing is separate from the unpacked build; no extension was installed into your Chrome profile or published automatically.

Filtering batches retain the local date when each video was observed. Daily ID buckets remain in local storage until history is cleared, so retries and delayed tabs do not double-count earlier days or move observations into today's total. Storage use therefore grows with filtering activity as well as watched records.
