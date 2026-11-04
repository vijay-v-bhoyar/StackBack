# Design — StackBack Replay Properties (K-002 — corrected)

## Correction summary

The initial generator produced guides with unreachable cards, causing the
`validateGuide(guide) === []` guard to fire immediately. The minimized
counterexample (seed 13003, shrink "0:0:1:1") was `[[1,2],[]]`:
`layerSizes=[1,2]` with the branching formula producing only one choice on the
start card, leaving `c1_1` unreachable. This was a test-generator defect; the
product correctly detected the invalid guide.

The corrected generator eliminates both failure modes:
1. Layer 0 is now always exactly one card, so no extra start-layer cards exist.
2. Every step card fans out to ALL cards in the next layer, so every next-layer
   card is reachable by induction.

---

## Guide generator

### Shape

```
Layer 0: 1 card  (start card, always c0_0)
Layer 1: 2–3 cards  (forced; start card has 2–3 choices)
Layer 2…L-1: 0–2 middle layers, each 1–3 step cards
Layer L: 1–3 terminal cards
```

### Fan-out-all edge rule

Every step card at layer `l` gets exactly `layerSizes[l+1]` choices, one for
each card in the next layer (`ch0 → c(l+1)_0`, `ch1 → c(l+1)_1`, …).

**Reachability proof by induction:**
- Base: `c0_0` is the `startCardId`; always reachable.
- Step: if any card in layer `l` is reachable, then for every `k` in
  `[0, layerSizes[l+1])`, there is a choice `chk → c(l+1)_k` on that card,
  so `c(l+1)_k` is reachable. Since layer 1 has ≥1 card and the start card
  fans out to all of layer 1, all layer-1 cards are reachable. By induction
  all cards in all layers are reachable. ∎

**Choice ID uniqueness:** choice IDs within a card are `ch0, ch1, …` — one
per next-layer card — so they are trivially unique (distinct indices).

**Domain limit compliance:** next layer ≤ 3 cards ≤ 6-choice limit. ✓

### fast-check arbitraries

| Symbol | Arbitrary | Range |
|--------|-----------|-------|
| `layer1Size` | `fc.integer` | 2–3 |
| `midLayerSizes` | `fc.array(fc.integer(1–3))` | 0–2 elements |
| `termLayerSize` | `fc.integer` | 1–3 |
| `furtherRaw` | `fc.array(oneof(choose,back))` | 0–60 elements |

Card and choice IDs are deterministic strings (`c${l}_${i}`, `ch${k}`).
Guide UUID fields (`id`, `revisionId`) are fixed valid strings reused across
all generated guides (format-only validation in the domain).

---

## Independent reference model

```ts
interface RefEvent {
  seq: number;
  kind: 'choose' | 'back';
  from: string;
  to: string;
  choiceId: string | undefined;
}
interface RefState {
  path: string[];       // card-ID stack
  events: RefEvent[];   // expected events, never read from production run
}
```

`applyChoose(run, ref, cardMap, choiceIdx)`:
- Reads `card.choices[choiceIdx % card.choices.length]` from `cardMap` (the
  pre-mutation card map — not the live run or its snapshot).
- Pushes `choice.to` onto `ref.path`.
- Appends a `RefEvent` with `kind:'choose'`, `from`, `to`, `choiceId`.
- Calls production `choose(run, ch.id)` and returns the new run.

`applyBack(run, ref)`:
- Records `fromId = ref.path.at(-1)`, `toId = ref.path.at(-2)`.
- Pops `ref.path`.
- Appends a `RefEvent` with `kind:'back'`, `from`, `to`, `choiceId:undefined`.
- Calls production `stepBack(run)` and returns the new run.

The card map is built from `JSON.parse(snapshotJSON)` — the pre-mutation guide
captured before `startRun`. This ensures the oracle never sees mutated state.

---

## Mandatory 3-action prefix

Executed unconditionally before any random further actions:

1. `applyChoose(…, 0)` — choose first branch from start card.
2. `applyBack(…)` — step back to start.
3. `applyChoose(…, 1)` — choose second branch from start card.

Layer 1 always has ≥2 cards, so `choices[0]` and `choices[1]` always exist.
This guarantees branching and back-transition coverage in every generated case,
satisfying REQ-7 and REQ-8 without relying on random action sequences.

---

## Snapshot immutability proof mechanism

```
snapshotJSON = JSON.stringify(guide)   // ← before startRun, before mutation
run = startRun(guide)
guide.title = 'MUTATED'               // ← mutate original
guide.cards[0].body = 'MUTATED'
// …
// At each assertInvariants call:
expect(JSON.stringify(run.guideSnapshot)).toBe(snapshotJSON)
```

The captured `snapshotJSON` reflects the original guide. After mutation it no
longer equals `JSON.stringify(guide)`. If `startRun` stored a live reference
instead of a deep clone, the assertion would fail.

---

## `assertInvariants` invariant check set

Called at `prefix[1]`, `prefix[2]`, `prefix[3]`, `further[1..37]`, `final`.

1. `replay(run).path` deep-equals `ref.path` (REQ-1)
2. `replay(run).current.id === ref.path.at(-1)` (REQ-2)
3. `run.events.length === ref.events.length` (REQ-3a)
4. For each `i`: `run.events[i].{seq,kind,from,to,choiceId}` equals `ref.events[i]` (REQ-3b, REQ-4, REQ-4b)
5. For each `i`: `run.events[i].at` matches ISO regex (REQ-4b timestamp format)
6. `JSON.stringify(run.guideSnapshot) === snapshotJSON` (REQ-5)
7. `encodePackage → parsePackage` round-trip: restored `path`, `current.id`, `guideSnapshot`, and all event fields match ref (REQ-6)

---

## Coverage analysis

| Coverage target | How achieved |
|-----------------|--------------|
| Branching choices | Mandatory prefix actions 1 & 3 (different branches) + random further chooses |
| Back transitions | Mandatory prefix action 2 + random further backs |
| Terminal cards | Guide always has a terminal layer; random sequences may reach it |
| Multi-step paths | 3 prefix + up to 37 further = 40 max applied actions |
| Snapshot isolation | Mutation after startRun; snapshotJSON pre-dates mutation |
| Round-trip fidelity | Every assertInvariants call includes encode/parse check |
| Event field semantics | seq, kind, from, to, choiceId all compared against ref |

---

## Isolation from existing tests

The new `describe` block is appended after the existing four `describe` blocks.
Seed 11303 (existing) is untouched; seed 13003 (new) is independent.
No shared mutable state between the blocks.
