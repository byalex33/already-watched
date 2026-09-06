# Contributing

Run `npm ci`, then `npm run check` before opening a pull request. For release changes, also run `node scripts/package-store.mjs`. Packaging needs Python 3.8+ with zipfile. Run `npm run build --prefix privacy-site` when changing the privacy page.

Every change goes through a pull request. Wait for Sourcery to finish reviewing the latest commit, read its summary and inline comments, address actionable findings, and request another review after fixes. A pending or skipped review is not approval. Explain findings that do not warrant a code change on the PR and resolve addressed threads.

The Project checks workflow validates tests, types, the production extension ZIP, and the privacy page on pull requests and main. Repository administrators must protect main with required status checks, up-to-date branches, and resolved review conversations. Required AI review checks must come from the installed review app. Do not bypass these requirements or merge before the latest AI review is complete and its actionable findings are resolved.

Branch protection is a GitHub repository setting, not something a workflow file enables. Verify it in the repository settings after installing or changing review integrations.
