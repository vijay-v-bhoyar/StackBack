# Requirements — StackBack Replay Properties (K-002)

## History note

The initial test generator (K-002 first attempt) had a defect: it used a
variable-size layer 0, which left extra start-layer cards unreachable, and
used a branching formula (`((l+i)%3)+1`) that could yield only one choice on
the start card, leaving layer-1 cards unreachable. The fast-check shrink path
"0:0:1:1" (seed 13003) produced minimized counterexample `[[1,2],[]]`, which
caused `validateGuide` to correctly report `c1_1` unreachable and fail the
`validateGuide(guide) === []` guard. This was a **test-generator defect**; no
product defect was identified. The generator has been corrected (see design.md).

No test was claimed to have passed, and no product code was modified.

---

## Bounded invariants (corrected)

These requirements describe the observable contracts that must hold for any
generated valid acyclic branching `Guide` after the mandatory 3-action prefix
and any further bounded sequence of `choose` and `back` operations.

### REQ-1 Path consistency after every action
After applying any prefix of the action sequence, `replay(run).path` must
equal the path maintained by an independent reference model that never calls
any production function.

### REQ-2 Current-card identity
`replay(run).current.id` must equal `refPath[refPath.length - 1]` at every
step.

### REQ-3 Event history length and kinds
`run.events.length` must equal the number of actions applied so far, and each
event's `kind` must match the action that produced it (`'choose'` or `'back'`).

### REQ-4 Sequential numbering
`run.events[i].seq` must equal `i + 1` for every index.

### REQ-4b Full event field semantics
For every event, `from`, `to`, and `choiceId` must match the values computed
independently by the reference model. The `at` field must be a valid ISO
timestamp (format-checked only; exact value is not predictable).

### REQ-5 Guide snapshot immutability
The `guideSnapshot` embedded in the run must be structurally equal to the
original guide JSON captured **before** `startRun` was called. This must hold
even after the original guide object is mutated (title and body changed)
after `startRun`. Checked after every action.

### REQ-6 Encode/parse round-trip
At every action step the run must survive an `encodePackage` → `parsePackage`
round-trip. The restored run's path, current card, snapshot, and all event
fields must match the reference state.

### REQ-7 Branching coverage (guaranteed per case)
Every generated guide contains a start card with at least two choices (layer 1
has ≥2 cards). The mandatory 3-action prefix uses both `choices[0]` and
`choices[1]` on the start card, ensuring branching is exercised in every case.

### REQ-8 Back-transition coverage (guaranteed per case)
The mandatory 3-action prefix includes one `back` transition (action 2),
ensuring corrected-path behaviour is exercised in every case.

### REQ-9 Terminal-card coverage
Every generated guide contains at least one terminal layer. Action sequences
may reach terminal cards, after which only `back` is valid.

### REQ-10 No reliance on production replay as oracle
The reference model computes expected path and history independently, using
only the captured pre-mutation guide structure. It must not call `replay`,
`choose`, or `stepBack` to derive expected values.

### REQ-11 Generator validity guard
`validateGuide(guide)` must return `[]` for every generated guide before the
test proceeds. Any failure here is a generator bug, not a product bug, and
must fail with a diagnostic message.

---

## Constraints

| Parameter | Value |
|-----------|-------|
| fast-check seed | 13003 |
| Generated cases | 200 |
| Mandatory prefix actions | 3 (choose[0], back, choose[1]) |
| Further actions cap | 37 |
| Total actions per case | ≤ 40 |
| Layer 0 cards | exactly 1 (start card) |
| Layer 1 cards | 2–3 (forced branching) |
| Middle layers | 0–2, each 1–3 cards |
| Terminal layer cards | 1–3 |
| Choices per step card | = next layer size (fan-out-all, ≤ 3 ≤ 6 limit) |
