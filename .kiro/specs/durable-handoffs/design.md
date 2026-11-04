# Design Document: Durable Handoffs

Codex integration note: this document describes Kiro's bounded domain/storage design. The integrated app also has separately implemented offline-cache repair and linked-card browsing/version comparison. Actual execution and authorship are recorded in [verification.md](verification.md).

## Overview

StackBack sessions must remain portable, conflict-safe, and recoverable across tabs and storage boundaries. This design corrects three gaps in the current implementation:

1. **Compact-bypass**: `parsePackage` accepted compact JSON input whose pretty-printed canonical form could silently exceed the 1 MiB limit on import.
2. **Unchecked saveRun**: `Store.saveRun` performed no canonical size check and no conflict detection, allowing silent overwrites and over-limit writes to IndexedDB.
3. **Legacy exclusion**: `refresh()` used `encodePackage` to validate stored runs, discarding over-capacity records as corrupt instead of listing them for recovery.

No schema migration, no new dependencies, no relaxed limits. All changes are backward-compatible with existing stored data and the original 12 domain / 15 browser tests.

---

## Architecture

The correction touches three layers — domain validation, storage, and the UI coordinator — without changing the overall offline-first, single-page architecture.

```
┌──────────────────────────────────────────────────────┐
│  main.ts  (UI coordinator)                           │
│  ┌─────────────────────────────────────────────────┐ │
│  │  savedRun: Run | undefined  (new checkpoint)    │ │
│  │  persistRun(currentRun, savedRun)               │ │
│  │  refresh() via readStoredRun                    │ │
│  └─────────────────────────────────────────────────┘ │
│             │                      │                  │
│    store.saveRun(run, expected?)   │ readStoredRun()  │
│             │                      │                  │
│  ┌──────────▼──────────┐  ┌────────▼──────────────┐  │
│  │  storage.ts         │  │  domain.ts             │  │
│  │  saveRun:           │  │  readStoredRun: schema │  │
│  │  - pre-tx encode    │  │    + replay only       │  │
│  │  - full-JSON conflict│  │  parsePackage: input  │  │
│  │    check in same tx │  │    bytes + canonical   │  │
│  └─────────────────────┘  │    output check        │  │
│                            └────────────────────────┘  │
└──────────────────────────────────────────────────────┘
                    │
             IndexedDB 'runs'
```

**Unchanged:** `MAX_FILE_BYTES`, schema v1, `encodePackage`, `requireRun`, `startRun`, `choose`, `stepBack`, guide conflict logic, service worker, sample data.

---

## Components and Interfaces

### domain.ts — new export: `readStoredRun`

Purpose: read an existing IndexedDB record for listing and resumption without imposing the canonical output size limit. Separates "can this record be loaded" from "can this record be exported as a file".

```typescript
export function readStoredRun(input: unknown): Run
```

- Calls `requireRun(input)` (schema structure + replay integrity).
- Does **not** call `encodePackage` or measure canonical byte length.
- Returns `clone(input as Run)`.
- Throws if schema or replay validation fails.

**Contrast with `parsePackage`:**

| Function | Input byte check | Schema + replay | Canonical output check |
|---|---|---|---|
| `parsePackage(s)` | ✓ (≤ MAX_FILE_BYTES) | ✓ | ✓ (both kinds, see below) |
| `readStoredRun(x)` | — (not a string) | ✓ | ✗ |

---

### domain.ts — modified: `parsePackage`

Adds a canonical output check for **both** guide and handoff kinds. After the respective `requireGuide`/`requireRun` call validates the parsed value, the canonical form is measured directly — without calling `encodePackage`. Closes the compact-bypass gap.

```typescript
export function parsePackage(s: string): Package
```

- Input byte-length check: unchanged.
- `stackback.guide` path: after `requireGuide`, compute `new TextEncoder().encode(JSON.stringify(pkg, null, 2)).byteLength` and throw if > `MAX_FILE_BYTES`.
- `stackback.handoff` path: after `requireRun`, same canonical byte check.

**⚠ Recursion constraint (corrected from original design draft):** `encodePackage` calls `JSON.stringify(p, null, 2)` then calls `parsePackage(s)`. If `parsePackage` for the canonical check called `encodePackage` in turn, the chain would be `encodePackage → parsePackage → encodePackage → …` indefinitely. The implementation therefore uses `JSON.stringify(pkg, null, 2)` + `new TextEncoder().encode(s).byteLength` inline (via the private `canonicalPackageBytes` helper) instead of delegating to `encodePackage`. `Store.saveRun` also measures canonical JSON directly to avoid an unnecessary parse/validation round trip; calling `encodePackage` there alone would not cause recursion.

---

### storage.ts — modified: `Store.saveRun`

Adds a pre-transaction portability check and a same-transaction full-record conflict guard.

```typescript
async saveRun(run: Run, expected?: Run): Promise<void>
```

**Pre-transaction (before opening IDB):**
- Computes `JSON.stringify({kind:'stackback.handoff', schemaVersion:1, run}, null, 2)` and checks `new TextEncoder().encode(canonical).byteLength > MAX_FILE_BYTES`.
- Does **not** call `encodePackage` (see recursion constraint above).
- If over limit: immediately throws `StorageError('Not saved — shorten the note to fit the portable handoff limit. The last saved checkpoint is unchanged.')`. No transaction is opened.

**Transaction — `expected` provided (update path):**
- Opens a `readwrite` transaction on `'runs'`.
- Gets stored record by `run.id`.
- Compares `JSON.stringify(storedRecord)` against `JSON.stringify(expected)` (no indent, compact).
- Mismatch or absent stored record: `conflict = true`, abort.
- The stored old record is never required to be canonical-size-portable; over-capacity legacy records are valid conflict-detection tokens.
- Match: `put(clone(run))`.

**Transaction — `expected` absent (create / import path):**
- Opens a `readwrite` transaction on `'runs'`.
- Gets stored record by `run.id`.
- If a record **exists**: `conflict = true`, abort.
- If absent: `put(clone(run))`.

**Error messages:**
- Conflict abort: `'Session conflict: this session was changed in another tab.'`
- Storage abort / error: `'Session was not saved. Browser storage may be full or unavailable. Export a handoff backup.'`

---

### main.ts — new state: `savedRun`

```typescript
let savedRun: Run | undefined;
```

Tracks the last Run successfully committed to IndexedDB for the active session. Acts as the expected-checkpoint token passed to `store.saveRun`.

**Invariants:**
- Reset to `undefined` when `begin()` starts a new session.
- Set to `clone(r)` when `resume(r)` loads a session.
- Advanced to `clone(currentRun)` on each successful `persistRun()`.
- Never advanced on a conflict or storage error.

---

### main.ts — modified: `persistRun`

- Calls `store.saveRun(currentRun, savedRun)`.
- On success: `savedRun = clone(currentRun)`.
- On `StorageError` with conflict message: sets `saveStatus` to the conflict message, sets `dirty = true`, exposes "Save session as new copy" action. Does not change `savedRun`.
- On other `StorageError`: sets existing fallback `saveStatus`, `dirty = true`. Does not change `savedRun`.

---

### main.ts — modified: `begin`

- Sets `savedRun = undefined` before calling `persistRun()`. The new run has a fresh UUID; absence is expected.

---

### main.ts — modified: `resume`

- Sets `savedRun = clone(r)` alongside `currentRun = clone(r)`.

---

### main.ts — modified: `openImport` (handoff path)

- After assigning fresh `r.id`: calls `store.saveRun(r)` with no `expected` (absence expected).
- On success: `savedRun = clone(r)`, then `resume(r)`.

---

### main.ts — modified: `refresh`

Replaces `parsePackage(encodePackage(...))` filter with `readStoredRun`.

For each raw record `r` from `store.list('runs')`:
- Call `readStoredRun(r)`. On failure: `corrupt++`, continue.
- Call `encodePackage({kind:'stackback.handoff',schemaVersion:1,run:r})`:
  - Succeeds → include in `runs[]` with standard session tag.
  - Throws → include in `runs[]` with `'Over-capacity — shorten note to export'` tag.
- Over-capacity runs are **not** counted as corrupt.

---

### main.ts — new UI: "Save session as new copy"

Shown in the runner view when `persistRun` encounters a conflict.

**Behaviour:**
- Clones `currentRun`, assigns `crypto.randomUUID()` as its `id`.
- Sets `sourceRunId` to the original `currentRun.id` (or preserves existing `sourceRunId`).
- Calls `store.saveRun(conflictCopy)` with no `expected`.
- On success: `currentRun = conflictCopy`, `savedRun = clone(conflictCopy)`, clears conflict state, re-renders.
- The original stored record (the other tab's version) is never read or modified.

---

## Data Models

No new persistent types. Existing types (`Run`, `Guide`, `Event`, `Package`) are unchanged.

### savedRun (in-memory only)

`savedRun: Run | undefined` is a module-level variable in `main.ts`. It is not persisted and is never written to IndexedDB directly. Its sole role is to carry the expected-checkpoint into `store.saveRun`.

### Over-capacity tag (UI metadata only)

The runner-view session list derives a display tag from a boolean derived at `refresh()` time: whether `encodePackage` succeeded or threw. This tag is not stored.

---

## Error Handling

### Canonical limit exceeded (pre-save)

**Condition:** `encodePackage` throws before the IDB transaction opens in `saveRun`.  
**Response:** `StorageError` propagates to `persistRun`, which sets `saveStatus` to "Not saved — this session is temporary. Export a handoff backup." and leaves `savedRun` unchanged.  
**Recovery:** User exports current session, then starts a new session or shortens the note and retries.

### Session conflict (concurrent tabs)

**Condition:** Stored record at `run.id` does not deep-equal `expected` at transaction time.  
**Response:** `StorageError('Session conflict: this session was changed in another tab.')` propagates. `persistRun` sets the conflict flag, exposes "Save session as new copy" action. `savedRun` is not advanced.  
**Recovery:** User saves a distinct copy (new UUID) or exports for manual transfer. The original stored record remains intact.

### Over-capacity stored record (legacy recovery)

**Condition:** `readStoredRun(r)` succeeds but `encodePackage` throws during `refresh()`.  
**Response:** Run is listed with "Over-capacity — shorten note to export" tag. Not counted as corrupt.  
**Recovery:** User resumes the session, shortens the note, and saves. On successful `persistRun`, the record is replaced with a within-limit version.

### Import canonical output exceeded

**Condition:** Imported handoff file has input bytes ≤ MAX_FILE_BYTES but `encodePackage` on the parsed run throws.  
**Response:** `parsePackage` propagates the error. `openImport` shows it in the dialog error area. Nothing is written.  
**Recovery:** The sender must export a shorter session (shorten note or reduce events) and re-transfer.

---

## Testing Strategy

### Unit Testing Approach

New and modified domain functions require direct unit tests in the existing domain test suite:

- `readStoredRun`: valid run passes, invalid schema throws, invalid replay throws, over-capacity run passes (schema/replay only).
- `parsePackage` (handoff, modified path): compact input that expands beyond MAX_FILE_BYTES is rejected; valid compact input within limit is accepted; existing passing cases remain green.

### Property-Based Testing Approach

**Property-based test library:** fast-check (already used in the project).

Properties targeting the new invariants are described in the Correctness Properties section.

### Browser Regression Oracles

Four independent synthetic-fixture browser tests covering the new behavioural contracts:

1. Valid near-limit imported session + 1,000-character note appended → `parsePackage` rejects if canonical output exceeds MAX_FILE_BYTES.
2. Compact JSON input whose pretty-printed form exceeds MAX_FILE_BYTES → `parsePackage` rejects.
3. Legacy over-capacity stored session → appears in the session list as "Over-capacity — shorten note to export", is resumable, shortening note and saving succeeds.
4. Two stale tabs: tab B saves run r1; tab A (holding stale r0 as `savedRun`) tries to save → StorageError conflict, tab A exposes "Save session as new copy"; after copy save, stored record from tab B is unchanged and copy has a distinct id.

Existing 12 domain tests and 15 browser tests are preserved without modification. Seeds `seeds11303` and `seeds13003` are unchanged.

---

## Correctness Properties

### Property 1: Canonical portability invariant

**Validates: Requirements 1**

For any Run `r`, if `store.saveRun(r, _)` resolves successfully then `encodePackage({kind:'stackback.handoff', schemaVersion:1, run:r})` also succeeds and the result is ≤ `MAX_FILE_BYTES`. `store.saveRun` never stores a run whose canonical form exceeds the limit.

### Property 2: Compact-bypass prevention

**Validates: Requirements 1**

For any string `s` with `TextEncoder().encode(s).byteLength ≤ MAX_FILE_BYTES`, if `parsePackage(s)` returns a handoff package then `encodePackage` on that package's run succeeds with output ≤ `MAX_FILE_BYTES`.

### Property 3: Conflict detection completeness

**Validates: Requirements 3**

If the stored record at `run.id` at transaction time does not deep-equal `JSON.stringify(expected)`, then `store.saveRun(run, expected)` always throws `StorageError` with a conflict message and the stored record is unchanged. A timestamp-only comparison is never the sole criterion.

### Property 4: Legacy recovery

**Validates: Requirements 2**

Any Run `r` that passes `readStoredRun` is resumable: `replay(r)` succeeds and returns a valid `{ path, current }`. This holds regardless of canonical byte size. Such runs appear in the session list and can be resumed to allow the user to shorten the note.

### Property 5: Conflict copy isolation

**Validates: Requirements 4**

When "Save session as new copy" resolves successfully, the run stored under the original id is byte-for-byte identical to its state before the conflict was detected. The copy is stored under a distinct UUID.

### Property 6: Expected-absence guarantee

**Validates: Requirements 3**

`store.saveRun(run)` (no `expected`) stores `run` only if no record for `run.id` currently exists. A collision causes a `StorageError`; no existing data is overwritten.

---

## Compatibility

- **Schema version**: unchanged (v1). No migrations.
- **MAX_FILE_BYTES**: unchanged (1,048,576 bytes). No relaxations.
- **Existing tests**: the 12 domain tests and 15 browser tests are preserved without rewrites. The new `readStoredRun` export and modified `saveRun` signature are additive; existing call sites passing no `expected` argument remain valid and now receive the expected-absence check.
- **Existing seeds**: `seeds11303` and `seeds13003` are unchanged.
- **No new dependencies**: all changes use `IndexedDB`, `structuredClone`, `TextEncoder`, and `JSON.stringify` already present.
- **No cloud or authentication**: sessions remain unsigned, unencrypted, and device-local. File contents are user-editable.
