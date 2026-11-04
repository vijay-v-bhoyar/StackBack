import {describe,it,expect} from 'vitest';
import fc from 'fast-check';
import {validateGuide,canReadDraft,startRun,choose,stepBack,replay,parsePackage,encodePackage} from './domain';
const guide=()=>({id:'11111111-1111-4111-8111-111111111111',revisionId:'22222222-2222-4222-8222-222222222222',title:'Welcome guide',description:'Fictional routing',startCardId:'start',updatedAt:'2026-11-03T12:00:00.000Z',cards:[{id:'start',title:'Choose station',body:'Where do you need help?',kind:'step',choices:[{id:'cloth',label:'Textiles',to:'textile'},{id:'help',label:'Not sure',to:'help'}]},{id:'textile',title:'Textile desk',body:'',kind:'terminal',choices:[],outcome:'Go to textile welcome desk'},{id:'help',title:'Ask coordinator',body:'',kind:'terminal',choices:[],outcome:'Ask the welcome coordinator'}]});
describe('guide contract',()=>{
it('accepts a complete authored guide',()=>expect(validateGuide(guide())).toEqual([]));
it('diagnoses dangling choices and rejects a new run',()=>{const g=guide();g.cards[0].choices[0].to='missing';expect(validateGuide(g).map(x=>x.code)).toContain('destination');expect(()=>startRun(g)).toThrow();});
it('rejects cycles, duplicate IDs, unreachable cards and terminal edges',()=>{for(const mutate of [(g:any)=>g.cards[0].choices[0].to='start',(g:any)=>g.cards[1].id='start',(g:any)=>g.cards.push({...g.cards[1],id:'orphan'}),(g:any)=>g.cards[1].choices.push({id:'bad',label:'Bad',to:'start'})]){const g=guide();mutate(g);expect(validateGuide(g).length).toBeGreaterThan(0);}});
it('rejects hostile/unknown keys and oversized fields',()=>{expect(validateGuide({...guide(),unexpected:1}).length).toBeGreaterThan(0);expect(validateGuide({...guide(),title:'x'.repeat(101)}).length).toBeGreaterThan(0);expect(validateGuide(JSON.parse('{"__proto__":{}}')).length).toBeGreaterThan(0);});
it('validates generated finite paths and catches each broken destination',()=>fc.assert(fc.property(fc.integer({min:2,max:50}),n=>{const g=guide();g.cards=Array.from({length:n},(_,i)=>({id:'c'+i,title:'Card '+i,body:'',kind:i===n-1?'terminal':'step',choices:i===n-1?[]:[{id:'next',label:'Next',to:'c'+(i+1)}],...(i===n-1?{outcome:'Done'}:{})})) as any;g.startCardId='c0';expect(validateGuide(g)).toEqual([]);g.cards[0].choices[0].to='lost';expect(validateGuide(g).map(x=>x.code)).toContain('destination');}),{numRuns:100,seed:11303}));
});
describe('portable structural bounds',()=>{
 it('rejects oversized structural identifiers before an imported guide can run',()=>{const g=guide();const huge='x'.repeat(400000);g.cards[1].id=huge;g.cards[0].choices[0].to=huge;expect(new TextEncoder().encode(JSON.stringify({kind:'stackback.guide',schemaVersion:1,guide:g})).length).toBeLessThan(1024*1024);expect(validateGuide(g).length).toBeGreaterThan(0);expect(()=>startRun(g)).toThrow();});
});
describe('editable draft recovery',()=>{
 it('keeps safe incomplete drafts readable without allowing them to run',()=>{const g=guide();g.title='';g.cards[0].choices[0].to='';expect(canReadDraft(g)).toBe(true);expect(validateGuide(g).length).toBeGreaterThan(0);expect(()=>startRun(g)).toThrow();g.cards=[];expect(canReadDraft(g)).toBe(true);expect(canReadDraft({...g,hidden:'unsupported'})).toBe(false);expect(canReadDraft({...g,cards:[null]})).toBe(false);});
});
describe('snapshot and handoff semantics',()=>{
it('retains corrected history and never mutates the original snapshot',()=>{const g=guide();let r=startRun(g);g.cards[0].title='Edited later';r=choose(r,'cloth');r=stepBack(r);r=choose(r,'help');expect(replay(r).path).toEqual(['start','help']);expect(r.events.map(x=>x.kind)).toEqual(['choose','back','choose']);expect(r.guideSnapshot.cards[0].title).toBe('Choose station');expect(()=>stepBack(startRun(guide()))).toThrow();});
it('round-trips a handoff and rejects inconsistent replay before import',()=>{let r=choose(startRun(guide()),'cloth');r.note='Fictional note';const p=parsePackage(encodePackage({kind:'stackback.handoff',schemaVersion:1,run:r}));expect(p.kind).toBe('stackback.handoff');if(p.kind==='stackback.handoff')expect(replay(p.run).current.id).toBe('textile');const bad=JSON.parse(encodePackage({kind:'stackback.handoff',schemaVersion:1,run:r}));bad.run.events[0].to='help';expect(()=>parsePackage(JSON.stringify(bad))).toThrow(/history|event|transition/i);});
it('rejects malformed, oversized and unsupported-version packages',()=>{for(const s of ['{','x'.repeat(1024*1024+1),JSON.stringify({kind:'stackback.guide',schemaVersion:2,guide:guide()})])expect(()=>parsePackage(s)).toThrow();});
it('does not treat HTML strings as executable or erase them in the portable data',()=>{const g=guide();g.cards[0].body='<img src=x onerror=alert(1)>';const p=parsePackage(encodePackage({kind:'stackback.guide',schemaVersion:1,guide:g}));expect(p.kind).toBe('stackback.guide');if(p.kind==='stackback.guide')expect(p.guide.cards[0].body).toBe(g.cards[0].body);});
});

// ---------------------------------------------------------------------------
// Mixed choose/back property (K-002 — corrected generator)
//
// Initial attempt used a variable-size layer 0, which left extra start-layer
// cards unreachable, and used a branching formula that could produce only one
// choice on the start card, leaving layer-1 cards unreachable. Minimized
// counterexample from seed 13003, shrink path "0:0:1:1": [[1,2],[]] caused
// validateGuide to report c1_1 unreachable. This is a test-generator defect;
// no product defect was identified.
//
// Corrected design:
//   - Layer 0 is exactly one card (the start card). No unreachable extras.
//   - Layer 1 has 2–3 cards (forced). Start card gets one choice per layer-1
//     card, guaranteeing ≥2 choices and real branching coverage.
//   - Layers 2…L−1 (step layers): each card gets one choice per card in the
//     next layer (fan-out-all), so every next-layer card is reachable from
//     every card in the current layer. Layer sizes 1–3, choices ≤ 6 limit.
//   - Layer L (terminal layer): 1–3 terminal cards, no choices.
//   - Reachability proof by induction: start reachable → all layer-1 cards
//     reachable (start fans out to all) → all layer-2+ cards reachable (each
//     step card fans out to all of next layer).
//
// Independent reference model tracks full expected event records
// (seq, kind, from, to, choiceId) without calling any production function.
//
// Mandatory 3-action prefix per case guarantees both branching-choice and
// back-transition coverage: choose choices[0], back, choose choices[1].
// Up to 37 further valid actions follow; total applied ≤ 40.
//
// Snapshot immutability is verified against a pre-startRun JSON capture after
// the original guide object is mutated (title + body change post-startRun).
//
// Seed 13003, 200 cases. Execution verification: PENDING (Codex will run).
// ---------------------------------------------------------------------------
describe('mixed choose/back property', () => {
  // Fixed valid UUIDs — format is all that validateGuide checks.
  const G_ID  = '33333333-3333-4333-8333-333333333333';
  const G_REV = '44444444-4444-4444-8444-444444444444';
  const TS    = '2026-11-03T12:00:00.000Z';
  const ISO_RE = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/;

  // ---- Guide generator ----
  //
  // layerOneSizes : number of cards in layer 1 (2–3, forced branching)
  // midLayerSizes : number of cards per middle layer (layers 2…L−1), 0–2 items
  // termLayerSize : number of terminal cards in the last layer (1–3)
  //
  // Structure: [layer0=1 start card] → [layer1] → [midLayers…] → [termLayer]
  // Every step card fans out to ALL cards in the next layer (≤3 choices each).
  function buildGuide(layer1Size: number, midLayerSizes: number[], termLayerSize: number) {
    type CardShape = {
      id: string; title: string; body: string;
      kind: 'step' | 'terminal';
      choices: Array<{ id: string; label: string; to: string }>;
      outcome?: string;
    };
    const cid = (l: number, i: number) => `c${l}_${i}`;

    // Assemble layer sizes: layer0=1, layer1, mids, term.
    const layerSizes = [1, layer1Size, ...midLayerSizes, termLayerSize];
    const L = layerSizes.length; // number of layers (0-indexed, last = terminal)

    const cards: CardShape[] = [];

    for (let l = 0; l < L; l++) {
      const isTerminal = l === L - 1;
      const nCards = layerSizes[l];
      for (let i = 0; i < nCards; i++) {
        if (isTerminal) {
          cards.push({
            id: cid(l, i), title: `Term${l}_${i}`, body: '',
            kind: 'terminal' as const, choices: [], outcome: 'Done',
          });
        } else {
          // Fan out to ALL cards in next layer — guarantees every next-layer
          // card is reachable and choice IDs ch0…ch(nextSize-1) are unique.
          const nextSize = layerSizes[l + 1];
          const choices: Array<{ id: string; label: string; to: string }> = [];
          for (let k = 0; k < nextSize; k++) {
            choices.push({ id: `ch${k}`, label: `Go ${k}`, to: cid(l + 1, k) });
          }
          cards.push({
            id: cid(l, i), title: `Step${l}_${i}`, body: '',
            kind: 'step' as const, choices,
          });
        }
      }
    }

    return {
      id: G_ID, revisionId: G_REV,
      title: 'Generated guide', description: '',
      startCardId: cid(0, 0),
      cards,
      updatedAt: TS,
    };
  }

  // ---- Independent reference model ----
  //
  // Tracks the full expected event list independently of any production
  // function. seq is 1-based position; at is not predicted (ISO format only).
  interface RefEvent {
    seq: number;
    kind: 'choose' | 'back';
    from: string;
    to: string;
    choiceId: string | undefined;
  }
  interface RefState {
    path: string[];          // card-ID stack, starts with [startCardId]
    events: RefEvent[];      // expected events parallel to run.events
  }

  // Helper: assert all invariants at a given prefix without using production
  // replay, choose, or stepBack as oracles.
  function assertInvariants(
    run: ReturnType<typeof startRun>,
    ref: RefState,
    snapshotJSON: string,
    label: string,
  ) {
    const applied = ref.events.length;

    // REQ-1 / REQ-2: path and current card.
    const { path: prodPath, current: prodCurrent } = replay(run);
    expect(prodPath, `${label} path`).toEqual(ref.path);
    expect(prodCurrent.id, `${label} current`).toBe(ref.path[ref.path.length - 1]);

    // REQ-3a: event count.
    expect(run.events.length, `${label} event count`).toBe(applied);

    // REQ-3b / REQ-4 / full event semantics: seq, kind, from, to, choiceId, at.
    for (let i = 0; i < applied; i++) {
      const actual = run.events[i];
      const expected = ref.events[i];
      expect(actual.seq,      `${label} events[${i}].seq`     ).toBe(expected.seq);
      expect(actual.kind,     `${label} events[${i}].kind`    ).toBe(expected.kind);
      expect(actual.from,     `${label} events[${i}].from`    ).toBe(expected.from);
      expect(actual.to,       `${label} events[${i}].to`      ).toBe(expected.to);
      expect(actual.choiceId, `${label} events[${i}].choiceId`).toBe(expected.choiceId);
      // at: can't predict timestamp, but must be ISO format.
      expect(actual.at,       `${label} events[${i}].at`      ).toMatch(ISO_RE);
    }

    // REQ-5: guide snapshot equals the pre-mutation capture, not the mutated guide.
    expect(JSON.stringify(run.guideSnapshot), `${label} snapshot`).toBe(snapshotJSON);

    // REQ-6: encode/parse round-trip — restored run must match ref state.
    const encoded = encodePackage({ kind: 'stackback.handoff', schemaVersion: 1, run });
    const restored = parsePackage(encoded);
    expect(restored.kind, `${label} round-trip kind`).toBe('stackback.handoff');
    if (restored.kind === 'stackback.handoff') {
      const { path: rPath, current: rCurrent } = replay(restored.run);
      expect(rPath,      `${label} round-trip path`   ).toEqual(ref.path);
      expect(rCurrent.id,`${label} round-trip current`).toBe(ref.path[ref.path.length - 1]);
      // Round-trip snapshot must also equal the pre-mutation original.
      expect(JSON.stringify(restored.run.guideSnapshot), `${label} round-trip snapshot`).toBe(snapshotJSON);
      // Round-trip events must equal ref events.
      expect(restored.run.events.length, `${label} round-trip event count`).toBe(applied);
      for (let i = 0; i < applied; i++) {
        const ra = restored.run.events[i];
        const re = ref.events[i];
        expect(ra.seq,      `${label} rt events[${i}].seq`     ).toBe(re.seq);
        expect(ra.kind,     `${label} rt events[${i}].kind`    ).toBe(re.kind);
        expect(ra.from,     `${label} rt events[${i}].from`    ).toBe(re.from);
        expect(ra.to,       `${label} rt events[${i}].to`      ).toBe(re.to);
        expect(ra.choiceId, `${label} rt events[${i}].choiceId`).toBe(re.choiceId);
      }
    }
  }

  // Helper: apply a choose action against both the ref model and the run.
  function applyChoose(
    run: ReturnType<typeof startRun>,
    ref: RefState,
    cardMap: Map<string, ReturnType<typeof buildGuide>['cards'][number]>,
    choiceIdx: number,
  ): ReturnType<typeof startRun> {
    const fromId = ref.path[ref.path.length - 1];
    const card = cardMap.get(fromId)!;
    const idx = choiceIdx % card.choices.length;
    const ch = card.choices[idx];
    // Update ref model independently.
    ref.path.push(ch.to);
    ref.events.push({ seq: ref.events.length + 1, kind: 'choose', from: fromId, to: ch.to, choiceId: ch.id });
    // Apply to production run.
    return choose(run, ch.id);
  }

  // Helper: apply a back action against both the ref model and the run.
  function applyBack(
    run: ReturnType<typeof startRun>,
    ref: RefState,
  ): ReturnType<typeof startRun> {
    const fromId = ref.path[ref.path.length - 1];
    const toId   = ref.path[ref.path.length - 2];
    ref.path.pop();
    ref.events.push({ seq: ref.events.length + 1, kind: 'back', from: fromId, to: toId, choiceId: undefined });
    return stepBack(run);
  }

  it('preserves path, history, snapshot and round-trip across bounded mixed sequences', () => {
    // layer1Size: 2–3 cards in layer 1 (forces ≥2 choices on start card).
    const arbLayer1 = fc.integer({ min: 2, max: 3 });
    // midLayerSizes: 0–2 middle layers, each 1–3 cards.
    const arbMidLayers = fc.array(fc.integer({ min: 1, max: 3 }), { minLength: 0, maxLength: 2 });
    // termLayerSize: 1–3 terminal cards.
    const arbTerm = fc.integer({ min: 1, max: 3 });
    // Raw further actions (after mandatory prefix): up to 60 candidates,
    // filtered to ≤37 valid applied actions so total ≤ 3+37 = 40.
    const arbFurtherActions = fc.array(
      fc.oneof(
        fc.record({ kind: fc.constant('choose' as const), choiceIdx: fc.integer({ min: 0, max: 5 }) }),
        fc.record({ kind: fc.constant('back'   as const) }),
      ),
      { minLength: 0, maxLength: 60 },
    );

    fc.assert(
      fc.property(
        arbLayer1, arbMidLayers, arbTerm, arbFurtherActions,
        (layer1Size, midLayerSizes, termLayerSize, furtherRaw) => {
          const guide = buildGuide(layer1Size, midLayerSizes, termLayerSize);

          // Construction must be valid — any failure here is a generator bug.
          const issues = validateGuide(guide);
          expect(issues, `Guide construction error: ${JSON.stringify(issues)}`).toEqual([]);

          // Capture guide JSON BEFORE startRun and BEFORE mutation.
          const snapshotJSON = JSON.stringify(guide);

          // Start the production run.
          let run = startRun(guide);

          // Mutate the original guide object after startRun to confirm the
          // embedded snapshot is a deep clone, not a live reference.
          guide.title = 'MUTATED';
          guide.cards[0].body = 'MUTATED';

          // Build card map for the reference model (from the original structure
          // embedded in the pre-mutation snapshot, which we already captured).
          const snapshotGuide = JSON.parse(snapshotJSON) as ReturnType<typeof buildGuide>;
          const cardMap = new Map(snapshotGuide.cards.map(c => [c.id, c]));

          // Reference state — never calls any production function for oracle values.
          const ref: RefState = { path: [snapshotGuide.startCardId], events: [] };

          // ---- Mandatory 3-action prefix ----
          // Guarantees both branching-choice and back-transition coverage in
          // every generated case. Layer 1 has ≥2 cards so choices[0] and
          // choices[1] always exist on the start card.
          //
          // Action 1: choose choices[0] from start card.
          run = applyChoose(run, ref, cardMap, 0);
          assertInvariants(run, ref, snapshotJSON, 'prefix[1]');

          // Action 2: back to start.
          run = applyBack(run, ref);
          assertInvariants(run, ref, snapshotJSON, 'prefix[2]');

          // Action 3: choose choices[1] from start card (different branch).
          run = applyChoose(run, ref, cardMap, 1);
          assertInvariants(run, ref, snapshotJSON, 'prefix[3]');

          // ---- Up to 37 further valid actions ----
          let furtherApplied = 0;
          for (const raw of furtherRaw) {
            if (furtherApplied >= 37) break;

            const currentId = ref.path[ref.path.length - 1];
            const currentCard = cardMap.get(currentId)!;

            if (raw.kind === 'back') {
              if (ref.path.length < 2) continue; // at start, skip
              run = applyBack(run, ref);
              furtherApplied++;
            } else {
              if (currentCard.kind !== 'step' || currentCard.choices.length === 0) continue;
              run = applyChoose(run, ref, cardMap, raw.choiceIdx);
              furtherApplied++;
            }

            assertInvariants(run, ref, snapshotJSON, `further[${furtherApplied}]`);
          }

          // Final cross-check after all actions.
          assertInvariants(run, ref, snapshotJSON, 'final');
        }
      ),
      { numRuns: 200, seed: 13003 },
    );
  });
});
