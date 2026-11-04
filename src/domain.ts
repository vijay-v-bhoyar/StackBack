export type Issue = { code: string; message: string; cardId?: string; choiceId?: string };
export type Choice = { id: string; label: string; to: string };
export type Card = { id: string; title: string; body: string; kind: 'step' | 'terminal'; choices: Choice[]; outcome?: string };
export type Guide = { id: string; revisionId: string; title: string; description: string; startCardId: string; cards: Card[]; updatedAt: string };
export type Event = { seq: number; kind: 'choose' | 'back'; from: string; to: string; choiceId?: string; at: string };
export type Run = { id: string; sourceRunId?: string; guideSnapshot: Guide; events: Event[]; note: string; createdAt: string; updatedAt: string };
export type Package = { kind: 'stackback.guide'; schemaVersion: 1; guide: Guide } | { kind: 'stackback.handoff'; schemaVersion: 1; run: Run };
export const MAX_FILE_BYTES = 1024 * 1024;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const object = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x) && [Object.prototype, null].includes(Object.getPrototypeOf(x));
const text = (x: unknown, max: number, required = false): x is string => typeof x === 'string' && x.length <= max && (!required || x.trim().length > 0);
const iso = (x: unknown): x is string => typeof x === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(x) && Number.isFinite(Date.parse(x));
const keys = (o: Record<string, unknown>, allowed: string[]) => Object.keys(o).every(k => allowed.includes(k));
const now = () => new Date().toISOString();
const identifier=(x:unknown):x is string=>typeof x==='string'&&/^[a-zA-Z0-9_-]{1,64}$/.test(x);
export const clone = <T>(x: T): T => structuredClone(x);

export function validateGuide(input: unknown): Issue[] {
  const issues: Issue[] = [];
  const add = (code: string, message: string, cardId?: string, choiceId?: string) => issues.push({ code, message, ...(cardId ? { cardId } : {}), ...(choiceId ? { choiceId } : {}) });
  if (!object(input)) return [{ code: 'schema', message: 'Guide must be an object.' }];
  if (!keys(input, ['id', 'revisionId', 'title', 'description', 'startCardId', 'cards', 'updatedAt'])) add('schema', 'Guide contains unsupported fields.');
  if (!text(input.id, 36) || !uuid.test(input.id) || !text(input.revisionId, 36) || !uuid.test(input.revisionId)) add('schema', 'Guide and revision must have valid UUIDs.');
  if (!text(input.title, 100, true)) add('title', 'Give the guide a title of 1–100 characters.');
  if (!text(input.description, 500)) add('description', 'Description must be at most 500 characters.');
  if (!identifier(input.startCardId) || !iso(input.updatedAt)) add('schema', 'Guide start or timestamp is invalid. Use structural IDs of 1–64 letters, digits, underscores or hyphens.');
  if (!Array.isArray(input.cards) || input.cards.length < 1 || input.cards.length > 100) return [...issues, { code: 'cards', message: 'Use between 1 and 100 cards.' }];
  for (const raw of input.cards) {
    if (!object(raw)) { add('schema', 'Every card must be an object.'); continue; }
    const id = typeof raw.id === 'string' ? raw.id : undefined;
    if (!keys(raw, ['id', 'title', 'body', 'kind', 'choices', 'outcome']) || !identifier(raw.id)) add('schema', 'Card fields or ID are invalid. Use IDs of 1–64 letters, digits, underscores or hyphens.', id);
    if (!text(raw.title, 100, true)) add('title', 'Card title must have 1–100 characters.', id);
    if (!text(raw.body, 2000)) add('body', 'Card body must be at most 2000 characters.', id);
    if (raw.kind !== 'step' && raw.kind !== 'terminal') add('kind', 'Choose step or terminal for the card.', id);
    if (!Array.isArray(raw.choices) || raw.choices.length > 6) { add('choices', 'Use at most six choices per card.', id); continue; }
    if (raw.kind === 'terminal' && (raw.choices.length !== 0 || !text(raw.outcome, 200, true))) add('terminal', 'A terminal needs an outcome of 1–200 characters and no choices.', id);
    if (raw.kind === 'step' && (raw.choices.length === 0 || raw.outcome !== undefined)) add('step', 'A step needs a choice and must not contain a terminal outcome.', id);
    const choiceIds = new Set<string>();
    for (const c of raw.choices) {
      if (!object(c) || !keys(c, ['id', 'label', 'to']) || !identifier(c.id) || !text(c.label, 120, true) || !identifier(c.to)) { add('choice', 'Each choice needs a bounded ID, a label of 1–120 characters and a destination.', id); continue; }
      if (choiceIds.has(c.id)) add('duplicate', 'Choice IDs must be unique within a card.', id, c.id);
      choiceIds.add(c.id);
    }
  }
  if (issues.length) return issues;
  const g = input as unknown as Guide;
  const map = new Map(g.cards.map(c => [c.id, c]));
  if (map.size !== g.cards.length) add('duplicate', 'Card IDs must be unique.');
  if (!map.has(g.startCardId)) add('start', 'The start card does not exist.');
  for (const c of g.cards) for (const ch of c.choices) if (!map.has(ch.to)) add('destination', 'Choose an existing destination card.', c.id, ch.id);
  if (issues.length) return issues;
  const visited = new Set<string>(), visiting = new Set<string>();
  function visit(id: string) {
    if (visiting.has(id)) { add('cycle', 'A route loops back. Remove the cycle before starting.', id); return; }
    if (visited.has(id)) return;
    visiting.add(id);
    for (const ch of map.get(id)!.choices) visit(ch.to);
    visiting.delete(id); visited.add(id);
  }
  visit(g.startCardId);
  for (const c of g.cards) if (!visited.has(c.id)) add('unreachable', 'This card cannot be reached from the start.', c.id);
  return issues;
}
export function canReadDraft(g:unknown):g is Guide {
 if(!object(g)||!keys(g,['id','revisionId','title','description','startCardId','cards','updatedAt'])||!text(g.id,36)||!uuid.test(g.id)||!text(g.revisionId,36)||!uuid.test(g.revisionId)||!text(g.title,100)||!text(g.description,500)||!text(g.startCardId,MAX_FILE_BYTES)||!iso(g.updatedAt)||!Array.isArray(g.cards)||g.cards.length>100)return false;
 return g.cards.every(c=>object(c)&&keys(c,['id','title','body','kind','choices','outcome'])&&text(c.id,MAX_FILE_BYTES,true)&&text(c.title,100)&&text(c.body,2000)&&(c.kind==='step'||c.kind==='terminal')&&(c.outcome===undefined||text(c.outcome,200))&&Array.isArray(c.choices)&&c.choices.length<=6&&c.choices.every(ch=>object(ch)&&keys(ch,['id','label','to'])&&text(ch.id,MAX_FILE_BYTES,true)&&text(ch.label,120)&&text(ch.to,MAX_FILE_BYTES)));
}
export function requireGuide(g: unknown): Guide {
  const issues = validateGuide(g);
  if (issues.length) throw new Error(issues.map(x => x.message).join(' '));
  return clone(g as Guide);
}
export function startRun(g: unknown): Run {
  const at = now();
  const run:Run={ id: crypto.randomUUID(), guideSnapshot: requireGuide(g), events: [], note: '', createdAt: at, updatedAt: at };
  encodePackage({kind:'stackback.handoff',schemaVersion:1,run});return run;
}
export function replay(r: Run): { path: string[]; current: Card } {
  const g = requireGuide(r.guideSnapshot), map = new Map(g.cards.map(c => [c.id, c]));
  if (!Array.isArray(r.events) || r.events.length > 1000) throw new Error('Session history exceeds 1000 events.');
  const path = [g.startCardId];
  for (const [i, e] of r.events.entries()) {
    if (!object(e) || !keys(e, ['seq', 'kind', 'from', 'to', 'choiceId', 'at']) || e.seq !== i + 1 || !iso(e.at) || e.from !== path.at(-1)) throw new Error('Session history event is inconsistent.');
    if (e.kind === 'choose') {
      const choice = map.get(e.from)!.choices.find(c => c.id === e.choiceId);
      if (!choice || choice.to !== e.to) throw new Error('Session history transition is inconsistent.');
      path.push(e.to);
    } else if (e.kind === 'back') {
      if (e.choiceId !== undefined || path.length < 2 || e.to !== path.at(-2)) throw new Error('Session history back event is inconsistent.');
      path.pop();
    } else throw new Error('Unsupported session history event.');
  }
  return { path, current: map.get(path.at(-1)!)! };
}
function append(r: Run, e: Omit<Event, 'seq' | 'at'>): Run {
  if (r.events.length >= 1000) throw new Error('Session history limit reached. Export a handoff before starting a new session.');
  const result = clone(r), at = now();
  result.events.push({ ...e, seq: result.events.length + 1, at });
  result.updatedAt = at; replay(result);
  try{encodePackage({kind:'stackback.handoff',schemaVersion:1,run:result})}catch{throw new Error('Session would exceed the portable handoff limit. Export the current session before starting another.');}
  return result;
}
export function choose(r: Run, choiceId: string): Run {
  const { current } = replay(r), c = current.choices.find(x => x.id === choiceId);
  if (!c) throw new Error('That choice is not available on the current card.');
  return append(r, { kind: 'choose', from: current.id, to: c.to, choiceId });
}
export function stepBack(r: Run): Run {
  const { path, current } = replay(r);
  if (path.length < 2) throw new Error('Already at the start card.');
  return append(r, { kind: 'back', from: current.id, to: path.at(-2)! });
}
function requireRun(x: unknown): Run {
  if (!object(x) || !keys(x, ['id', 'sourceRunId', 'guideSnapshot', 'events', 'note', 'createdAt', 'updatedAt']) || !text(x.id, 36) || !uuid.test(x.id) || (x.sourceRunId !== undefined && (!text(x.sourceRunId, 36) || !uuid.test(x.sourceRunId))) || !text(x.note, 1000) || !iso(x.createdAt) || !iso(x.updatedAt)) throw new Error('Handoff session fields are invalid.');
  requireGuide(x.guideSnapshot); replay(x as unknown as Run);
  return clone(x as unknown as Run);
}
/** Read an existing stored Run for listing or resumption.
 *  Validates schema structure and replay integrity only.
 *  Does NOT check canonical portable byte size — over-capacity legacy records are readable.
 *  Use parsePackage for file import, which enforces canonical output size. */
export function readStoredRun(input: unknown): Run {
  return requireRun(input);
}
function canonicalPackageBytes(pkg: Package): number {
  return new TextEncoder().encode(JSON.stringify(pkg, null, 2)).byteLength;
}
export function parsePackage(s: string): Package {
  if (new TextEncoder().encode(s).byteLength > MAX_FILE_BYTES) throw new Error('File is larger than 1 MiB.');
  let x: unknown;
  try { x = JSON.parse(s); } catch { throw new Error('File is not valid JSON.'); }
  if (!object(x) || x.schemaVersion !== 1) throw new Error('Unsupported file format or schema version.');
  if (x.kind === 'stackback.guide' && keys(x, ['kind', 'schemaVersion', 'guide'])) {
    const pkg: Package = { kind: x.kind, schemaVersion: 1, guide: requireGuide(x.guide) };
    if (canonicalPackageBytes(pkg) > MAX_FILE_BYTES) throw new Error('Guide canonical form is larger than 1 MiB.');
    return pkg;
  }
  if (x.kind === 'stackback.handoff' && keys(x, ['kind', 'schemaVersion', 'run'])) {
    const pkg: Package = { kind: x.kind, schemaVersion: 1, run: requireRun(x.run) };
    if (canonicalPackageBytes(pkg) > MAX_FILE_BYTES) throw new Error('Handoff canonical form is larger than 1 MiB. Shorten the note and export again.');
    return pkg;
  }
  throw new Error('Unsupported file kind or fields.');
}
export function encodePackage(p: unknown): string {
  const s = JSON.stringify(p, null, 2);
  if (typeof s !== 'string') throw new Error('Cannot export this record.');
  parsePackage(s);
  return s;
}

