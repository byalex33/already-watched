# YouTube compatibility comparison

Reviewed 5 September 2026 against `youtube-hider-extension` develop commit
[`86fcd29ba537a5f25a9bbf2c89048b213354b58f`](https://github.com/MatteoLucerni/youtube-hider-extension/tree/86fcd29ba537a5f25a9bbf2c89048b213354b58f).
The local working tree already contained playlist/Mix filtering work; that work was preserved.
This audit does not attribute those existing changes to the comparison.

## We already do this better

| System inspected | Decision and reason |
| --- | --- |
| Playback tracking (`video-tracker`, shared progress, watched store) | Keep unique observed segments, partial saves before qualification, merging across sessions, bounded fragmentation without filling gaps, and continuity checks against seeks/restored offsets. The reference watched filter reads thumbnail widths and has no equivalent authoritative playback database. |
| Persistence (`repository`, service worker, validation) | Keep per-video local records, serialized read/modify/write operations, message bounds, worker restart persistence, revision checks and manual-unwatched/reset invalidation. No storage changes or migrations were introduced. |
| History provenance | Keep persistent watched records ahead of UI hints. Manual unwatched clears observed progress and suppresses hints/imports until fresh playback qualifies or a manual mark replaces it. Import time remains separate from watched time. |
| Cache and writes (`content/index`) | Keep the initial snapshot with buffered storage events, per-record `onChanged` updates, video-ID card index, 15-second playback saves, five-second counter batches, and hourly touches. No new storage reads/writes in DOM processing. |
| Statistics | Keep persistent daily ID deduplication across cards/tabs and transition-based mark totals. New selector coverage uses this existing pipeline. Shorts section filtering adds no watched statistics. |
| Decoration and restoration | Keep Hide, Dim, Badge and Badge + Dim, idempotent controls, recycled-card cleanup, settings restoration and rich-item wrapper selection. |
| Hide + refill | Keep native continuation controls, sparse-feed inspection, distinct-ID accounting, cooldown/attempt limits, background/navigation cancellation and recommendation-only watch-page scoping. |
| Dense grid | Keep existing CSS placement, responsive column variables and full-width shelves. No DOM reparenting or new layout CSS. |
| Playables/topics and Home Shorts | Keep reversible, scoped filtering; do not remove Shorts navigation or channel/search Shorts surfaces. |
| Observer | Keep incremental roots, ancestor coalescing, 120ms batching, detached-card pruning, character-data observation, and exclusion of extension-owned mutations. |
| Navigation | Keep YouTube start/finish/data-update events, popstate and full-URL fallback. Reference `init.js` compares pathname, which cannot alone distinguish watch-to-watch query changes. |
| Playback false positives | Keep identifiable main/active-Shorts players, declared-ID checks, ad/live/DVR guards, finite duration, paused-premiere exclusion and continuity resets. Do not substitute thumbnail state for these protections. |

## They handle this better / worth adopting

Reference evidence comes from its pinned
[changelog](https://github.com/MatteoLucerni/youtube-hider-extension/blob/86fcd29ba537a5f25a9bbf2c89048b213354b58f/CHANGELOG.md),
[filters](https://github.com/MatteoLucerni/youtube-hider-extension/blob/86fcd29ba537a5f25a9bbf2c89048b213354b58f/content/filters.js)
and [container parsers](https://github.com/MatteoLucerni/youtube-hider-extension/blob/86fcd29ba537a5f25a9bbf2c89048b213354b58f/content/parsers.js).

| Evidence | Local gap | Adopted change |
| --- | --- | --- |
| 3.1.21: search resume overlay changed to `ytw-*`, with rollout varying by account/surface | The new host and progress class were absent | Recognize `ytw-thumbnail-overlay-resume-playback-renderer .ytwThumbnailOverlayResumePlaybackRendererThumbnailOverlayResumePlaybackProgress` across surfaces, through the existing progress adapter. |
| 2.8.2: the generic watched segment also represents currently playing thumbnail progress | That segment could qualify as a history hint while a now-playing marker was present | Ignore this segment when its card contains `ytd-thumbnail-overlay-now-playing-renderer[now-playing-badge]`. Continue evaluating genuine resume overlays in that same card and preserve persistent watched records. |
| `hideShorts()` recognizes `ytm-shorts-lockup-view-model-v2` inside `grid-shelf-view-model` | Standalone v2 cards and their shelf heading/spacing could survive Home filtering | Add the v2 card to centralized discovery. Hide a grid shelf on Home only when it contains a supported Shorts lockup and all recognized video links are Shorts. Mixed grids retain their non-Shorts content. |
| Attribute-driven state implied by the new guard; existing accessible progress uses a maximum | An existing marker gaining/losing its attribute, or only `aria-valuemax` changing, would not queue processing | Observe `now-playing-badge` and `aria-valuemax`; use the existing batched processing. Queue the containing Shorts grid on descendant updates so recycled shelves restore correctly. |

## Renderer and surface inventory

| Renderer / indicator | Result |
| --- | --- |
| `ytd-rich-item-renderer` | Already supported; remains the outer hide target for nested lockups, including metadata. |
| `ytd-video-renderer` | Already supported for search and other desktop layouts; new ytw overlay fixture exercises it. |
| `ytd-grid-video-renderer` | Already supported, including channel grids. |
| `ytd-compact-video-renderer` | Already supported for sidebar recommendations. |
| `yt-lockup-view-model` and `yt-lockup-view-model-wiz` | Already supported without surface-specific selector lists. Reference 3.1.8 channel fix and 2.8.0 grid/related fixes are already covered conceptually. Added wrapper and replacement regression checks; no wrapper rewrite. |
| `ytd-playlist-video-renderer` | Already supported as an individual video. Existing playlist/Mix work distinguishes collection cards from ordinary watch links carrying `list=`. |
| Playlist/radio collection renderers | Existing working-tree playlist feature owns these. No new playlist feature ported. |
| `ytd-reel-item-renderer`, `yt-shorts-lockup-view-model`, `ytm-shorts-lockup-view-model` | Already supported; their appearance on desktop does not require mobile permissions. |
| `ytm-shorts-lockup-view-model-v2` | Added. Reference evidence is selector support, not a live DOM capture. |
| `grid-shelf-view-model` | Added as a guarded Home Shorts shelf, never as a video card or generic outer wrapper. |
| Legacy `ytd-thumbnail-overlay-resume-playback-renderer` | Already supported; remains valid even when a different progress segment is currently playing. |
| `yt-thumbnail-overlay-progress-bar-view-model` / camel-case watched segment | Already supported; added now-playing exclusion. |
| `ytw-thumbnail-overlay-resume-playback-renderer` | Added host and specific progress class; not a video-card renderer. No evidence in this reference for inventing additional `ytw-*` card selectors. |
| `ytm-rich-item-renderer`, `ytm-video-with-context-renderer`, `ytm-compact-video-renderer`, mobile resume overlay | Reference's mobile layout support. Not adopted: extension host permissions and documented product scope are desktop. No evidence in the inspected reference establishes these as missing desktop card families. |
| Mobile shelves, pivot bars and navigation entries | Not adopted: mobile support and global Shorts navigation removal are outside scope. |

Home, Search, Subscriptions, channel tabs and Related continue sharing card discovery.
Unknown wrappers are not guessed or hidden. The reference's outermost-ancestor walk
was not copied: it provides no demonstrated desktop wrapper improvement over our
rich-item handling for the fixtures examined.

## Do not adopt

- Width-only watched detection, automatic persistence of thumbnail hints, invented dates, or replacement of segment history.
- Document-wide filter passes on every debounced mutation; ours already processes changed subtrees.
- Pathname-only navigation, broad ancestor hiding, inline-style resets, or DOM reparenting for layout cleanup.
- View-count/upload-date filters, live-content filtering, channel allow/block lists, MAIN-world page-data bridges, hover-preview event suppression, global Shorts tab removal, tutorial/header controls, or automatic tab reload on install.
- Storage sync, new host permissions, or migrations from the reference's settings architecture.

Channel controls and header settings are possible product ideas, but are not needed
to make watched recommendations more resilient. No substantial reference code was
copied; implementation uses its documented compatibility ideas within our adapters.

## Files changed by this comparison

- `src/youtube/selectors.ts`: v2 Shorts, grid shelf, ytw resume host/bar and now-playing selectors.
- `src/youtube/progress-detection.ts`: new progress variant and active-playback hint guard.
- `src/content/observer.ts`: two relevant attributes and containing-grid invalidation.
- `src/content/home-shorts-filter.ts`: conservative grid-shelf matching/restoration.
- `tests/fixtures/youtube-compatibility.html`, `tests/fixtures/html.d.ts`: reduced structural DOM fixtures and raw-import typing.
- `tests/compatibility.test.ts`: 13 cases covering surfaces, hints/import provenance, manual suppression, now-playing, unrelated/hidden indicators, attribute changes, replacements, wrappers and Shorts restoration/mixed grids.
- `tests/navigation.test.ts`: 11 cases covering the requested SPA transitions, playlist watch changes, autoplay fallback, popstate and listener cleanup. Production navigation is unchanged.
- `YOUTUBE-COMPATIBILITY-AUDIT.md`: this comparison.

Generated production bundles were rebuilt. Other pre-existing working-tree changes
are outside this comparison's file list.

## Verification and remaining risks

`npm test`: **169 tests passed** in the final shared-tree check (136 baseline,
24 added by this comparison, and 9 menu tests from concurrent work).
`npm run typecheck`: passed. `npm run build`: passed.
Existing storage/concurrency/reset, statistics, playback, observer-feedback,
refill, promotional and playlist tests all pass unchanged.

No storage schema, history migration, settings, write cadence, statistics logic,
cross-tab cache code, playback tracking or dense-grid CSS changes were made.
Observer additions stay local to affected cards/shelves and retain batching;
regression coverage checks that attribute changes do not trigger document scans.

Fixtures are reduced reconstructions from known component names, not captured live
YouTube pages. The navigation tests exercise production event handling under jsdom,
not a live browser session. Existing browser grid/continuation fixtures were not
rerun because their code and layout CSS were unchanged by this comparison.

Remaining risks: account-dependent experiments and unknown renderer families;
legacy row-wrapper gaps; class-only component upgrades (classes intentionally are
not observed); hover/current playback variants without the known now-playing
marker; preview players that cover thumbnail controls; unknown ad markers;
unsupported Shorts player layouts; and layouts that report progress only through
unrecognized transforms or nested visibility rules. No claim is made that every
current live YouTube experiment is covered. Live extension smoke checks in README
remain appropriate before release.
