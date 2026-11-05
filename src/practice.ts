import type {Guide} from './domain';

/** Original fictional content. Opens unsaved; normal author/run commands do the work. */
export function practiceGuide():Guide{return {
 id:crypto.randomUUID(),revisionId:crypto.randomUUID(),updatedAt:new Date().toISOString(),title:'Fictional shift handoff',
 description:'Fictional practice: a visitor is waiting while desk assignments change between shifts. Preserve the earlier route and note, then confirm which instructions apply.',startCardId:'intake',cards:[
  {id:'intake',title:'Welcome-desk shift change',body:'Fictional practice only. The incoming volunteer needs the waiting task, previous choices and the guide version used. Do not record real visitor details or give repair advice.',kind:'step',choices:[{id:'review',label:'Review waiting handoff',to:'desk'}]},
  {id:'desk',title:'Which desk was selected?',body:'Choose a fictional desk. You can go back to correct it; the earlier choice remains in history. A later library edit must be reviewed with the coordinator before treating it as current instructions.',kind:'step',choices:[{id:'textile',label:'Textile desk',to:'textile'},{id:'item',label:'Household-item desk',to:'item'},{id:'coordinator',label:'Ask coordinator',to:'coordinator'},{id:'none',label:'No open handoff',to:'complete'}]},
  {id:'textile',title:'Textile desk — first shift',body:'Fictional first shift: textile welcome desk is at Blue table. Before handing over, record whether the visitor is still waiting. Desk assignments may change; confirm with the coordinator.',kind:'terminal',choices:[],outcome:'Waiting for the textile welcome volunteer; coordinator confirms the current station.'},
  {id:'item',title:'Household-item welcome desk',body:'Fictional first shift: household-item welcome desk is at Red table. The responsible team makes repair decisions; this guide only routes the handoff.',kind:'terminal',choices:[],outcome:'Handoff to the household-item welcome volunteer.'},
  {id:'coordinator',title:'Coordinator review',body:'Keep the earlier choices and current note. Ask the coordinator which station instructions apply now; a frozen snapshot alone does not confirm current instructions.',kind:'terminal',choices:[],outcome:'Coordinator must confirm the current station before continuing.'},
  {id:'complete',title:'No waiting task',body:'No fictional visitor is waiting. This practice session can still be exported as a record of that state.',kind:'terminal',choices:[],outcome:'No open handoff.'}
 ]
}}
