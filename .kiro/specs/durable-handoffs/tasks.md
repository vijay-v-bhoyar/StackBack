# Implementation Plan: Durable Handoffs

## Overview

Three-layer correction closing a compact-bypass gap in `parsePackage`, adding a pre-transaction portability check and same-transaction conflict guard to `Store.saveRun`, and adding a `readStoredRun` export so `refresh()` can list over-capacity records instead of discarding them. Kiro authors the browser regression tests first (expected red). Kiro implements the domain/storage changes after Codex confirms the behavioral failures. Codex integrates the UI and runs verification.

Implementation target files:
- `tests/durability.spec.ts` — new file, Kiro-authored
- `src/domain.ts` — `readStoredRun` export + `parsePackage` handoff path
- `src/storage.ts` — `Store.saveRun(run, expected?)` signature
- `src/main.ts` — `savedRun` state, `persistRun`, `begin`, `resume`, `openImport`, `refresh`, conflict UI

Integration status and authorship are recorded in [verification.md](verification.md). The original Kiro output is retained privately; this checklist was reconciled by Codex after execution.

No schema migration. No new dependencies. No relaxed limits. All 12 domain tests and 15 browser tests preserved without modification.

---

## Tasks

- [x] 1. Write browser regression tests (Kiro — **COMPLETE**; Codex confirmed all four tests RED on r5 production)
  - [x] 1.1 Create `tests/durability.spec.ts` with deterministic capacity fixture builder
    - Build a helper `buildCapacityFixture()` that constructs a synthetic `Run` deterministically:
      - 100 reachable acyclic cards, IDs exactly 64 alphanumeric/underscore characters
      - Card bodies `'界'.repeat(2000)` (6 000 UTF-8 bytes each, within the 2 000-character field limit)
      - Up to 6 choices per step card with labels `'路'.repeat(120)` (360 UTF-8 bytes each, within the 120-character field limit)
      - Alternating `choose`/`back` events replayed via the real `replay()` contract until the canonical `encodePackage` output is within one event of `MAX_FILE_BYTES` (1 048 576 bytes)
      - A valid `sourceRunId` UUID so import does not grow metadata
      - Pre-verified target: ~1 048 508 bytes at 240 events; a 1 000-ASCII-character note must push it past the cap
    - The builder must produce a valid `Run` object that passes `requireRun` / `replay` without any schema relaxation
    - _Requirements: 1, 2_

  - [x] 1.2 Write Test 1 — near-limit import + note overflow
    - Import the capacity-fixture handoff file through the native `input[type=file]` chooser (not `setInputFiles` directly on the hidden input — use the `Import a file` button to trigger the file chooser, then `setFiles` on the chooser event, matching the pattern in `journeys.spec.ts`)
    - Confirm the import dialog shows the guide title
    - Click "Import as new copy" and confirm the runner view loads
    - Edit the note to exactly 1 000 ASCII characters via `getByLabel('Current handoff note')`
    - Click "Save note" and assert `role=status` contains `'Not saved'`
    - Assert the original pre-edit note is **not** overwritten: reload the page, click "Resume session" for the same run, and assert the note textarea does **not** contain the 1 000-character string
    - _Requirements: 1_

  - [x] 1.3 Write Test 2 — compact-bypass rejection
    - Construct a JSON string that is ≤ `MAX_FILE_BYTES` raw bytes but whose pretty-printed canonical form (`JSON.stringify(…, null, 2)`) exceeds `MAX_FILE_BYTES`
    - Feed it through `input[type=file]` (via `locator('input[type=file]').setInputFiles(…)`)
    - Assert `role=alert` is visible and `role=dialog` has count 0 (no import dialog opened)
    - Assert the session list is unchanged (no new "Resume session" buttons)
    - _Requirements: 1_

  - [x] 1.4 Write Test 3 — legacy over-capacity stored session recovery
    - Using `page.evaluate`, open IndexedDB `stackback-v1`, object store `runs`, and `put` a raw serialised over-capacity `Run` object directly (bypass the application's `saveRun`; the run must pass `requireRun`/`replay` but have canonical bytes > `MAX_FILE_BYTES`)
    - Reload the page and assert the session list contains the run's guide title (not hidden as corrupt)
    - Assert the session list entry contains the text `'Over-capacity'` (or the exact tag wording from the design: `'Over-capacity — shorten note to export'`)
    - Click "Resume session" for that run and assert the runner view loads with the correct guide title heading
    - Shorten the note (set it to `''`), click "Save note", and assert `role=status` contains `'Saved'`
    - _Requirements: 2_

  - [x] 1.5 Write Test 4 — two stale tabs, conflict detection, copy isolation
    - Open page A and page B in the same `BrowserContext` (use `context.newPage()`)
    - On page A: start the sample guide, make one choice, save note `'Tab A note'`; wait for `Saved`
    - On page B: navigate to the same session via `Resume session`; confirm it loads (this simulates tab B having the same `savedRun` checkpoint)
    - On page A: make another choice and save; wait for `Saved` (A now holds a newer checkpoint)
    - On page B: make a different choice and attempt to save; assert `role=status` on page B contains `'Not saved'` and contains `'another tab'` (or `'conflict'`)
    - Assert a "Save session as new copy" button is visible on page B
    - Read the stored record for the original run id from IndexedDB on page B via `page.evaluate`; assert its `events` array length matches the number of events A saved (i.e. A's record is intact)
    - Click "Save session as new copy" on page B and wait for `Saved`
    - Assert page B now displays a run with a different `id` than A's run (the copy has a distinct UUID)
    - Assert A's stored record is still byte-for-byte equal to what was read before (re-read and compare)
    - _Requirements: 3, 4_

- [x] 2. Implement `readStoredRun` and fix `parsePackage` in `src/domain.ts` (Kiro — **COMPLETE**; verified by Codex; see verification.md)
  - [x] 2.1 Export `readStoredRun(input: unknown): Run` from `domain.ts`
    - Calls `requireRun(input)` for schema structure and replay integrity validation
    - Does **not** call `encodePackage` or measure canonical byte length
    - Returns `clone(input as Run)` (via `requireRun`'s return)
    - Throws if schema or replay validation fails (propagates from `requireRun`)

  - [x] 2.2 Add private `canonicalPackageBytes(pkg: Package): number` helper in `domain.ts`
    - Computes `new TextEncoder().encode(JSON.stringify(pkg, null, 2)).byteLength`
    - Used by the modified `parsePackage` to avoid calling `encodePackage` (recursion prevention)

  - [x] 2.3 Modify `parsePackage` to enforce canonical output size on **both** guide and handoff paths
    - After `requireGuide` (guide path) and after `requireRun` (handoff path), calls `canonicalPackageBytes(pkg)` and throws if > `MAX_FILE_BYTES`
    - Does **not** call `encodePackage` — see design.md recursion constraint note
    - Input byte-length check and all field/graph/replay limits unchanged

- [x] 3. Implement conflict-safe `Store.saveRun(run, expected?)` in `src/storage.ts` (Kiro — **COMPLETE**; verified by Codex; see verification.md)
  - [x] 3.1 Add pre-transaction canonical portability check
    - Computes `JSON.stringify({kind:'stackback.handoff', schemaVersion:1, run}, null, 2)` and checks byte length via `new TextEncoder().encode(canonical).byteLength > MAX_FILE_BYTES`
    - Does **not** call `encodePackage` (recursion prevention)
    - Throws `StorageError('Not saved — shorten the note to fit the portable handoff limit. The last saved checkpoint is unchanged.')` if over limit; no IDB transaction opened

  - [x] 3.2 Add `expected?: Run` parameter and same-transaction conflict guard
    - Signature: `async saveRun(r: Run, expected?: Run): Promise<void>`
    - **Update path (`expected` provided):** single `readwrite` transaction; get stored record by `r.id`; compare `JSON.stringify(storedRecord)` vs `JSON.stringify(expected)` (compact, no indent); absent or mismatch → `conflict = true`, abort; match → `put(clone(r))`
    - **Create/import path (`expected` absent):** single `readwrite` transaction; get stored record by `r.id`; if exists → `conflict = true`, abort; if absent → `put(clone(r))`
    - Over-capacity legacy stored records are valid comparison tokens; `JSON.stringify` comparison works regardless of their canonical byte size
    - Conflict message: `'Session conflict: this session was changed in another tab.'`
    - Generic storage error message: `'Session was not saved. Browser storage may be full or unavailable. Export a handoff backup.'`

- [x] 4. Wire `savedRun` state and update UI coordinator in `src/main.ts` (Codex — **COMPLETE** per Codex report)
  - [x] 4.1 Add `savedRun: Run | undefined` module-level variable and thread it through lifecycle functions
    - Declare `let savedRun: Run | undefined` at module scope (alongside `currentRun`)
    - `begin(g)`: set `savedRun = undefined` before calling `persistRun()` (new run has a fresh UUID; absence is expected)
    - `resume(r)`: set `savedRun = clone(r)` alongside `currentRun = clone(r)`
    - `openImport` handoff path: after assigning fresh `r.id`, call `store.saveRun(r)` with no `expected`; on success set `savedRun = clone(r)`, then call `resume(r)`
    - _Requirements: 3, 4_

  - [x] 4.2 Update `persistRun` to pass `savedRun` and advance checkpoint only on success
    - Call `store.saveRun(currentRun, savedRun)` instead of `store.saveRun(currentRun)`
    - On success: set `savedRun = clone(currentRun)` and clear any conflict state
    - On `StorageError` with `'another tab'` or `'conflict'` in the message: set `saveStatus` to the conflict message, set `dirty = true`, set a `conflictDetected` flag to expose "Save session as new copy"; do **not** advance `savedRun`
    - On other `StorageError`: use the existing `'Not saved — this session is temporary. Export a handoff backup.'` path; do **not** advance `savedRun`
    - _Requirements: 3, 4_

  - [x] 4.3 Update `refresh()` to use `readStoredRun` and tag over-capacity runs
    - Replace the current `encodePackage`-based filter with `readStoredRun(r)` for schema/replay validation
    - After `readStoredRun` succeeds, call `encodePackage({kind:'stackback.handoff', schemaVersion:1, run:r})`:
      - Succeeds → include in `runs[]` with standard session rendering
      - Throws → include in `runs[]` but render with the tag `'Over-capacity — shorten note to export'` visible in the session list entry
    - Over-capacity runs are **not** counted as corrupt; only `readStoredRun` failures increment `corrupt`
    - _Requirements: 2_

  - [x] 4.4 Add "Save session as new copy" conflict recovery action to runner view
    - When `persistRun` detects a conflict, render a "Save session as new copy" button in the runner view (in addition to the existing `dirty` condition that already shows this button)
    - The `saveSessionCopy` function (already present): clones `currentRun`, assigns `crypto.randomUUID()` as its `id`, sets `sourceRunId` to `currentRun.sourceRunId || currentRun.id`, calls `store.saveRun(conflictCopy)` with no `expected`, on success sets `currentRun = conflictCopy` and `savedRun = clone(conflictCopy)` and clears conflict state
    - The original stored record (the other tab's version) must not be read or modified
    - _Requirements: 4_

- [x] 5. Checkpoint — run test suite and verify red-then-green sequence (Codex — **VERIFIED**)
  - Codex confirmed four durability tests RED on r5 (unchanged production)
  - Kiro has now implemented Tasks 2 and 3; Codex has implemented Task 4
  - Run `npm run typecheck` first; fix any type errors before proceeding
  - Ran `npm test`: 15 unit/domain tests passed, including the original 12 and 300 generated cases
  - Ran `npm run test:e2e`: all 24 browser tests passed, including the original 15 journeys and four new durability tests
  - Report any failure with exact error output; do not relax limits or rewrite existing seeds
  - Do not claim passes without providing the actual execution output

---

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP; no sub-tasks in this plan are marked optional because all four browser tests and all implementation steps are required by the C-03 correction contract.
- Task 1 (tests) has no dependency on Tasks 2–4. It is written first and is expected to be red until implementation is complete.
- Tasks 2 and 3 are parallel — `domain.ts` and `storage.ts` changes are independent.
- Task 4 depends on both Task 2 (`readStoredRun` import, modified `parsePackage`) and Task 3 (new `saveRun` signature).
- Task 5 depends on Task 4 (full implementation complete).
- The existing `seeds11303` and `seeds13003` fixtures and all 27 existing tests are preserved without modification.
- `MAX_FILE_BYTES` (1 048 576) is unchanged. Schema version remains 1. No new npm dependencies.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.3", "1.4", "1.5"] },
    { "id": 2, "tasks": ["2.1", "2.2", "3.1", "3.2"] },
    { "id": 3, "tasks": ["4.1", "4.2", "4.3", "4.4"] },
    { "id": 4, "tasks": ["5"] }
  ]
}
```
