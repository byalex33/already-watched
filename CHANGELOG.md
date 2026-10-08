# Changelog

## 1.1.0

- Add **Hide repeated recommendations**: hide Home videos that have been on screen for a chosen number of earlier Home visits. Defaults off. Impressions are forgotten after 30 days.
- Add **Videos per channel**: limit how many videos one channel can fill on Home. Defaults off.
- Add Home feed statistics: visits, recommendations served, different videos, rerun share, already-watched reruns, the most-served videos, and a shareable post after five visits.
- Reorganize the popup and Options page into Feed, Filters, Stats, and History tabs, with the enable switch and key numbers pinned at the top. Sections collapse to a one-line summary of their current settings and remember which ones you opened. Version, privacy, and source links stay at the bottom of every tab.
- Clearing history now also clears Home feed impressions and statistics.

## 1.0.3

- Restore minimum-views filtering for YouTube cards that display abbreviated counts such as "54k" and put "54 thousand views" in the accessibility label.
- Recheck filtering when YouTube updates a view-count accessibility label. Keep videos with unknown counts visible.

## 1.0.2

- Keep watched videos visible in History, Liked Videos, playlists, subscriptions, and every channel page. Retain watched indicators and tracking.
- Limit watched-video hiding to Home and watch-page recommendations. Search has an independent "Hide watched videos in Search" toggle, defaulting off for new installs and preserving existing users' prior preference.
- Restore visibility as YouTube navigates between pages, including reused video cards. Keep playlist panels visible while filtering watch-page recommendations.
- Show the loaded extension version in the popup and synchronize package, manifest, and release ZIP versions.
- Includes the merged search-thumbnail positioning fix and independent Shorts search filter.

## 1.0.1

- Previous packaged release. Subsequent search fixes are included in 1.0.2 above.
