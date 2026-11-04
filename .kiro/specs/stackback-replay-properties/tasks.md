# Tasks — StackBack Replay Properties (K-002)

Authorship: Kiro IDE 1.4.86 (Auto, Default agent) authored this task list, the replay requirements/design and the property test. Codex reviewed the output and updated the execution statuses and reference-model details after verification. This document describes the bounded replay-property contribution; it is not a history of later application changes. See [verification.md](verification.md) for scope and results.

## Status legend
- [x] Complete (authored in this session)
- [ ] Pending (execution verification by Codex)

---

## T-1 Read permitted source files [x]
Files read: `src/domain.ts`, `src/domain.test.ts`, `src/sample.ts`,
`package.json`, `tsconfig.json`, `vite.config.ts`.  
Confirmed: fast-check 4.10.2 and vitest 5.1.0 available; existing seed 11303
present and must be preserved.

## T-2 Design layered guide generator [x]
Designed topological-layer approach (see design.md).  
Guarantees acyclicity, at least one branching step, at least one terminal.

## T-3 Design independent reference model [x]
The corrected `RefState` contains a path stack and full expected event records (seq, kind, from, to, choiceId), derived from the captured input card map. This replaces the initial eventKinds-only model.
No calls to `replay`, `choose`, or `stepBack`.

## T-4 Author property test block [x]
New `describe('mixed choose/back property', ...)` appended to
`src/domain.test.ts`.  
Seed 13003, 200 runs, ≤ 40 actions per case.  
Checks REQ-1 through REQ-6 at each action step.

## T-5 Verify all existing tests untouched [x]
Existing four `describe` blocks and seed 11303 preserved verbatim.

## T-6 Execute test suite [x] — verified by Codex
Codex ran the corrected suite: 12 domain tests passed, including the existing 100 generated-path cases and 200 new mixed-history cases. Typecheck and production build passed. Kiro did not run these commands. See verification.md for reproducible verification commands.

## T-7 Review for suspected defects [x] — verified by Codex
The initial generator failed at seed13003, path0:0:1:1, minimized [[1,2],[]], because c1_1 was unreachable. Kiro corrected that test-generator defect after receiving the actual evidence. Codex reviewed the independent model and confirmed the corrected checks pass. No application bug was established or product code changed.

---

## Files changed in this session

| File | Change |
|------|--------|
| `src/domain.test.ts` | Added `describe('mixed choose/back property', …)` block |
| `.kiro/specs/stackback-replay-properties/requirements.md` | Created |
| `.kiro/specs/stackback-replay-properties/design.md` | Created |
| `.kiro/specs/stackback-replay-properties/tasks.md` | Created |

## Files not changed

During this bounded replay-property contribution, all other files in the workspace, including `src/domain.ts`, `src/sample.ts`,
`vite.config.ts`, `tsconfig.json`, `package.json`, and all files under
`docs/`, remain unmodified.
