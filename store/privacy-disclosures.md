# Chrome Web Store privacy fields

Privacy policy URL: https://already-watched-privacy.alexcbaldry.chatgpt.site

## Single purpose — paste into the dashboard

Help users recognise watched videos and customise their desktop YouTube feed using locally stored watch progress, watched/unwatched controls, and optional video and section filters.

## Storage justification

The storage permission saves settings, watched and unwatched video records, video IDs and titles, observed playback segments, timestamps, and local filtering statistics in chrome.storage.local. This lets the extension remember progress and preferences across tabs and browser sessions. Data is not synced or transmitted to the developer. Users can clear local history in the popup or Options page.

## Context menus justification

The contextMenus permission adds Mark as watched and Mark as unwatched commands for supported YouTube video links and watch pages. These commands update the same local records used by thumbnail controls and automatic playback tracking. Context menus are scoped to YouTube pages.

## Host permission justification

Access to https://www.youtube.com/* and https://youtube.com/* lets the content script identify video links, titles, displayed view counts, progress indicators, and supported players; observe playback; and apply badges, dimming, and selected feed filters. It also lets the popup identify the active YouTube tab and send the user's scan command to its content script. Access is limited to desktop YouTube; no all-sites permission or Chrome history permission is requested.

Use the same justification if the dashboard presents the two host patterns separately.

## Remote code

Select: No, I am not using remote code.

Explanation if requested: All JavaScript, CSS, React code, and icons are bundled with the extension. No remotely hosted scripts, executable code downloads, eval-based code loading, CDN dependencies, or remote WebAssembly are used. Hide + refill invokes YouTube's existing page controls; it does not fetch or execute remote extension code.

## Data types

Declare local data handling accurately; do not select “no user data” merely because the extension has no backend. Google's User Data FAQ explicitly includes data processed or stored only on the device.

Select these categories where the dashboard uses its standard data-type checkboxes:

| Category | Selection | Reason |
| --- | --- | --- |
| Web history | Yes | YouTube video IDs, available titles, watched status, and watch/import/last-seen dates form local video activity records. No Chrome browsing-history API access is used. |
| User activity | Yes | The extension observes player playback segments, progress, and manual watched/unwatched actions for its visible features and statistics. |
| Website content | Yes | It reads video titles, video links, displayed view counts, progress indicators, and supported YouTube page elements to apply filtering and marking. |
| Personally identifiable information | No | The extension does not collect names, email addresses, phone numbers, or account identifiers. Support email is separately described in the policy. |
| Health information | No | No health-information feature or intentional collection. |
| Financial and payment information | No | No extension billing, payment collection, or card access. |
| Authentication information | No | No login credentials, authentication tokens, or cookie access. |
| Personal communications | No | No access to emails, messages, or communications. |
| Location | No | No location collection or geolocation access. |

All declared extension data is processed on-device, is not sold, and is not transferred to the developer or third parties. No advertising or analytics purpose applies. Support correspondence and ordinary privacy-page hosting requests are separate from extension activity and do not provide access to local extension history.

## Data-use certifications

The implementation supports all three standard certifications:

- Data is not sold or transferred to third parties outside the approved use cases.
- Data is not used or transferred for purposes unrelated to the extension's single purpose.
- Data is not used or transferred to determine creditworthiness or for lending purposes.

Use the dashboard's current wording when completing the form. These are prepared answers; they have not been saved to the dashboard until a successful submission is separately recorded.
