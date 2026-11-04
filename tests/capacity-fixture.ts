import type {Guide,Run} from '../src/domain';

// Original synthetic fixture from the preserved capacity reproduction; no real data.
export function capacityRun():Run{
 const cid=(i:number)=>'c'+String(i).padStart(63,'0'),qid=(i:number)=>'q'+String(i).padStart(63,'0');
 const guide:Guide={id:'11111111-1111-4111-8111-111111111111',revisionId:'22222222-2222-4222-8222-222222222222',title:'Synthetic capacity fixture',description:'Original synthetic CJK text; no real user data',startCardId:cid(0),updatedAt:'2026-11-03T12:00:00.000Z',cards:Array.from({length:100},(_,i)=>({id:cid(i),title:'Card '+i,body:'界'.repeat(2000),kind:i===99?'terminal':'step',choices:i===99?[]:Array.from({length:6},(_,j)=>({id:qid(j),label:'路'.repeat(120),to:cid(i+1)})),...(i===99?{outcome:'Complete'}:{})}))};
 const run:Run={id:'33333333-3333-4333-8333-333333333333',sourceRunId:'33333333-3333-4333-8333-333333333333',guideSnapshot:guide,events:[],note:'',createdAt:'2026-11-03T12:00:00.000Z',updatedAt:'2026-11-03T12:00:00.000Z'};
 while(run.events.length<998){const i=run.events.length,back=i%2===1;run.events.push({seq:i+1,kind:back?'back':'choose',from:cid(back?1:0),to:cid(back?0:1),...(!back?{choiceId:qid(0)}:{}),at:'2026-11-03T12:00:00.000Z'});if(canonicalBytes(run)>1048576){run.events.pop();break;}}
 return run;
}
export function handoff(run:Run){return {kind:'stackback.handoff',schemaVersion:1,run}}
export function canonicalBytes(run:Run){return Buffer.byteLength(JSON.stringify(handoff(run),null,2))}
