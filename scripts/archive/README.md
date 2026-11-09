# Historical browser diagnostics

These scripts captured specific UI fixes and investigations. They are retained as reference material, separate from maintained build tools and the automated regression checks in `tests/`.

Run a script deliberately from the repository root if needed, for example `node scripts/archive/shot-auth.mjs <output-directory>`. Inspect its browser executable path, server URL, mock account, and output location first. Some scripts accept `PJ_CHROME`, `PJ_URL`, `HERO_URL`, or command-line overrides; others retain the original developer environment.

These diagnostics are not run by `npm test`, `npm run check`, or CI. One-time scripts that rewrote application source were removed; Git history preserves them.
