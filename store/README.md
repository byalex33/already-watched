# Chrome Web Store release materials

The public privacy policy is at https://already-watched-privacy.alexcbaldry.chatgpt.site.

## Upload materials

- `already-watched-1.0.0.zip`: extension package, generated locally and intentionally excluded from Git.
- `listing.md`: store description, category, distribution settings, and reviewer instructions.
- `privacy-disclosures.md`: single purpose, permission explanations, data categories, and data-use answers.
- `assets/01-settings-1280x800.jpg`: actual settings interface using labelled sample statistics.
- `assets/02-feed-demo-1280x800.jpg`: illustrative feed using the actual decorator and original sample content; this is not a live YouTube screenshot.
- `assets/promo-440x280.jpg`: small promotional tile.
- `assets/icon-128.png`: existing 128×128 extension icon.

Use Public distribution and disable automatic publication when submitting for review. Google registration, account verification, and submission must succeed before the extension is considered submitted. Preparing these files or publishing the privacy page does not submit the extension.

## Rebuild the extension ZIP

From the extension repository root, run `node scripts/package-store.mjs` after dependencies are installed. The script copies a fixed source snapshot, checks it for concurrent changes, runs `npm run check` in that snapshot, validates the build-file allowlist, and creates the extension-only ZIP. It also writes `release-manifest.json` with source and ZIP hashes and `release-validation.txt` with the validation output. Snapshots are retained in the OS temporary directory; no files are permanently deleted.

The release ZIP contains only the extension files from the validated snapshot. It excludes this directory, the privacy-page source, test fixtures, preview mocks, source maps, dependencies, and repository metadata. Do not zip the repository root or upload the listing-assets folder as the extension.

If `manifest.version` has already been uploaded to the store, increase it before rebuilding a replacement version. Complete the live YouTube release checks in the main README before launch; automated fixtures do not establish compatibility with every current YouTube experiment.

## Artwork provenance and regeneration

Run `node store/preview.mjs` from the repository root after building the extension. The local-only routes `/settings`, `/feed`, and `/promo` render the artwork. Capture the first two at 1280×800 and the promotional tile at 440×280. Screenshots were exported as JPEG; the icon remains PNG. No personal YouTube feed, history, account details, third-party thumbnails, or generated representations of real YouTube creators are used.

The preview API is not an extension storage backend. Its values are synthetic, and it is never bundled into the upload package. Settings and badges are rendered from the actual application/production implementation. Update the screenshots if the shipped interface changes materially.

## Privacy-page source

`../privacy-site/src/index.html` contains the public policy and support contact. Its `npm run build` validates required disclosures and copies the static page into `dist/`. The page has no application dependencies, runtime scripts, external fonts, or analytics. Sites hosting metadata identifies its existing public deployment; reuse that site for updates.
