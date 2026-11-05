import {type Run,readStoredRun,replay} from './domain';

/** Readable context only. Validated JSON remains the resumable format. */
export function handoffBrief(input:Run,saved:boolean):string{
 const run=readStoredRun(input),{path,current}=replay(run),g=run.guideSnapshot;
 const title=(id:string)=>g.cards.find(c=>c.id===id)!.title;
 return [
  'STACKBACK — READABLE HANDOFF BRIEF',
  'This readable brief cannot be imported or resumed in StackBack. Use the JSON handoff for continuation.',
  'It can be read in a text viewer without installing or preparing StackBack.',
  'Editable, unsigned and unencrypted. Use benign notes only; this is not an authenticated audit log.',
  'Confirm current instructions with the guide owner. A snapshot records what was followed, not what is currently approved.',
  '',
  'Save status: '+(saved?'SAVED CHECKPOINT':'UNSAVED WORK — this export may differ from the last saved checkpoint'),
  'Guide: '+g.title,'Snapshot revision: '+g.revisionId,'Session: '+run.id,'Session updated: '+run.updatedAt,
  '', 'CURRENT STEP','Current card: '+current.title,current.body,
  ...(current.kind==='terminal'?['Outcome: '+current.outcome]:['Available choices:',...current.choices.map(c=>'• '+c.label+' → '+title(c.to))]),
  '', 'CURRENT NOTE',run.note||'(No note)',
  '', 'ACTIVE PATH',...path.map((id,i)=>(i+1)+'. '+title(id)),
  '', 'CHOICE AND CORRECTION HISTORY',
  ...(run.events.length?run.events.map(e=>{
   const from=g.cards.find(c=>c.id===e.from)!;
   const action=e.kind==='back'?'Previous card':from.choices.find(c=>c.id===e.choiceId)!.label;
   return e.seq+'. '+action+' → '+title(e.to)+' · '+e.at;
  }):['(No choices recorded)']),
  '', 'History includes corrected choices. Current note edits are not a complete note audit.',
  'Only this frozen snapshot is represented; later library changes are not included.', ''
 ].join('\n');
}
