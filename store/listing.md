# Already Watched — Chrome Web Store listing

## Product details

- Name: Already Watched
- Language: English (United Kingdom), or English if the dashboard offers a single English option
- Category: Workflow & Planning → Tools (choose Tools if categories are presented as a flat list)
- Price: Free
- Distribution: Public, all available regions
- Publication: Submit for review with automatic publication disabled; publish manually after approval
- Support email: hello@alex.codes
- Privacy policy: https://already-watched-privacy.alexcbaldry.chatgpt.site
- Support URL: https://already-watched-privacy.alexcbaldry.chatgpt.site/#support
- Homepage: Leave blank; a separate product homepage is not required

## Short description

A quieter YouTube feed. Mark, dim, or hide videos you've already watched. Private and entirely local.

## Detailed description — paste into the dashboard

A little less déjà vu. Already Watched helps you recognise videos you've seen and make room for something new on desktop YouTube.

CHOOSE HOW WATCHED VIDEOS APPEAR
Add a watched badge, gently dim watched cards, combine both, or hide them. With Hide and load more, the extension also tries to load more recommendations when the remaining feed is short. Refilling depends on YouTube and the watch history known to the extension.

BUILD YOUR HISTORY AS YOU WATCH
Choose a watched threshold from 10% to 100%. Already Watched records the playback segments it observes, so skipping ahead does not count as watching the skipped section. You can also use YouTube's existing thumbnail progress bars as watched indicators.

MARK OR UNDO IN A MOMENT
Mark a video watched or unwatched using thumbnail controls, supported YouTube three-dot menus, or Chrome's right-click menu. Scan the currently rendered YouTube page to import qualifying progress indicators without fetching your Google account's watch-history database.

TAILOR YOUR FEED
Optional filters hide playlists and Mixes, Shorts on Home, and supported Playables and topic-suggestion sections. These options are off by default.

YOUR HISTORY STAYS LOCAL
Video IDs, titles, playback progress, timestamps, settings, and filtering statistics stay in this Chrome profile. No extension account, analytics service, cloud sync, or developer server receives your extension data. Clear watched history in the popup or Options page, or uninstall to remove local extension data.

Already Watched makes no direct network requests. Hide and load more can trigger YouTube's own normal recommendation requests. It does not change YouTube's recommendation algorithm or guarantee that every remaining video is new to you.

Works on supported desktop YouTube feeds and players, including Home, Search, Subscriptions, channel pages, recommendations, and supported Shorts layouts. YouTube changes its layouts regularly, so some layouts or experiments may not be supported. Chrome 114 or later is required.

Privacy policy: https://already-watched-privacy.alexcbaldry.chatgpt.site
Support: hello@alex.codes

Already Watched is independent and is not affiliated with or endorsed by YouTube or Google.

## Assets

1. `assets/01-settings-1280x800.jpg` — Actual extension settings interface, framed for the listing. Statistics are clearly labelled sample data.
2. `assets/02-feed-demo-1280x800.jpg` — Clearly labelled illustrative feed using the production badge and dimming implementation. Sample content is original and does not expose personal recommendations or browsing history.
3. `assets/promo-440x280.jpg` — Small promotional tile.
4. `assets/icon-128.png` — Existing extension icon, copied unchanged.

The feed demonstration is not a screenshot of a live YouTube page. The actual settings screenshot is the primary required screenshot.

## Reviewer test instructions

No extension login, payment, API key, or test credentials are required. Open desktop YouTube and refresh tabs opened before installation. Some YouTube surfaces depend on the reviewer's own YouTube sign-in; core marking and settings can be tested without an extension account.

1. Open the extension popup. Verify Dim and show a badge and a 70% threshold are the defaults.
2. Hover a video thumbnail and mark it watched. Verify the badge and dimming, then mark it unwatched to undo.
3. Switch to Hide videos and confirm a manually watched card disappears. Switch back to restore it.
4. Set a low watched threshold, play a fresh finite video, and confirm only observed playback contributes. Skipping ahead should not count the skipped section.
5. On a page with qualifying YouTube progress bars, use the popup scan command. It scans the cards already rendered on that page.
6. Toggle optional feed filters. Disable each to restore matching cards or sections.
7. Select Hide and load more on a supported sparse feed containing watched cards. Refilling is best effort, capped at five extension-initiated loads per page visit, and stops after two attempts with no new video IDs.
8. Clear watched history using the confirmation inside the popup. Settings remain; history and statistics are reset. YouTube progress hints may still appear while enabled.

## Source requirements checked on 6 September 2026

- https://developer.chrome.com/docs/webstore/cws-dashboard-listing
- https://developer.chrome.com/docs/webstore/images
- https://developer.chrome.com/docs/webstore/cws-dashboard-privacy
- https://developer.chrome.com/docs/webstore/program-policies/user-data-faq
- https://developer.chrome.com/docs/webstore/publish
