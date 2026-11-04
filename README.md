# StackBack
Linked-card guides, brought back for volunteer handoffs.

StackBack is a local web prototype for authoring a branching guide, following it, correcting a choice, saving your place and transferring the exact context in a portable file. The original fictional repair-café welcome guide demonstrates routing to a station. It does not give repair or safety advice.

## Run locally
Use Node.js 26.4.0 and npm 11.17.0 (the verified development versions).
```sh
npm ci --ignore-scripts
npm run dev -- --port 4793 --strictPort
```
Open the displayed loopback URL. For the offline-capable production shell:
```sh
npm run build
npm run preview -- --port 4793 --strictPort
```
PowerShell users can use `npm.cmd` in place of `npm`. Development mode is not the offline acceptance target.

## Try the complete workflow
1. Start **Welcome desk**, choose **Find a station**, then a station. The sample is fictional.
2. Use **Previous card** to correct a choice. **Session history** retains earlier choices; the active path is separate.
3. Save a benign current note. Reload and choose **Resume session**.
4. **Export handoff**, open a fresh browser profile at the same running app, select **Import a file**, inspect the preview and **Import as new copy**. Continue from the same guide snapshot and context.
5. Edit a copy of a guide. Change a destination and validate. Incomplete drafts can be saved and reopened, but cannot start/export as runnable guides.
6. For offline use, wait for **Offline ready** in a production-served build before disabling the network and cold-reloading. An initial uncached offline visit cannot work.

## Local data and limits
No account, server database, runtime AI, telemetry or automatic file transmission. Data lives in this origin's IndexedDB and shell cache. Local browser/profile access can expose or modify it; exported files are editable, unsigned and unencrypted. Avoid sensitive notes. Browser clearing/eviction can remove data, so export backups.

Imports are bounded to 1 MiB, schema v1, 100 cards, six choices per card, 1000 history events and specified text limits. Structural IDs are 1–64 ASCII letters/digits/underscore/hyphen. A session cannot advance beyond the portable-file/history limits. Guides use explicit acyclic routes with terminal outcomes. No HyperCard binary or HyperTalk compatibility is provided.

A session's guide snapshot never follows later author edits. Imports create distinct local copies. A newer worker waits for an explicit update; save first. Save failure leaves in-memory work marked **Not saved** and available for backup. Changing browser origins does not transfer data automatically.

## Verify
```sh
npm run typecheck
npm test
npm run build
npm run test:e2e
```
The browser suite starts its own production server on 127.0.0.1:4793, so stop another server on that port first. It uses isolated synthetic fixtures. Install the compatible Chromium binary once with `npx playwright install chromium` before running the browser suite.

Tests cover graph/replay/file boundaries, generated valid paths, durable recovery, safe import/export, duplicate copies, stale saves, quota/unavailable storage, offline reload/update, literal hostile strings, responsive keyboard interaction and automated axe checks. Automated accessibility results do not establish real screen-reader usability or human acceptance.

## Source layout
- `src/domain.ts`: schemas, graph validation, replay and portable-file limits.
- `src/storage.ts`: native IndexedDB transactions and guide revision conflicts.
- `src/main.ts`, `src/styles.css`: semantic Archive Workbench UI.
- `src/sample.ts`: original fictional sample.
- `src/sw-template.js`, `scripts/build-sw.mjs`: content-identified production shell cache.
- `src/domain.test.ts`, `tests/journeys.spec.ts`: domain and real-browser verification.

## Development and verification
Local verification is separate from hosted operation, independent human validation and contest qualification. A hosted app and public narrated video have not been verified. This prototype is not represented as submission-ready or beta-validated.

Kiro IDE 1.4.86 (Auto, Default agent) authored the focused replay-property requirements, design, task list and new model-based property test in root `.kiro/specs/stackback-replay-properties`. Kiro corrected an invalid test generator after receiving its minimized counterexample. Codex implemented the application, reviewed and integrated the test contribution, updated its execution notes and ran verification: 12 domain tests with 300 generated cases and 15 browser tests. The [verification note](.kiro/specs/stackback-replay-properties/verification.md) records the scope and authorship. No Kiro hook, custom agent, MCP, power or standalone CLI contribution is claimed.

The source is MIT licensed. Development tooling is pinned in the lockfile; its own licenses apply. No third-party media or legacy HyperCard assets are bundled.

