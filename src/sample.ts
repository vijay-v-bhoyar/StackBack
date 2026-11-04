import type {Guide} from './domain';
export const SAMPLE_ID='a1111111-1111-4111-8111-111111111111';
export function sample():Guide{return {id:SAMPLE_ID,revisionId:'a2222222-2222-4222-8222-222222222222',title:'Welcome desk',description:'Fictional repair-café routing. No repair or safety advice.',startCardId:'welcome',updatedAt:'2026-11-03T12:00:00.000Z',cards:[
{id:'welcome',title:'Welcome to the repair café',body:'This fictional guide helps a welcome volunteer find the right station. Use made-up notes only; do not record visitor names or contact details.',kind:'step',choices:[{id:'begin',label:'Find a station',to:'station'}]},
{id:'station',title:'What kind of help is needed?',body:'Ask which station the visitor is looking for. This guide routes visitors; it does not provide repair instructions.',kind:'step',choices:[{id:'textile',label:'Clothing or textile',to:'textile'},{id:'item',label:'Small household item',to:'item'},{id:'uncertain',label:'I’m not sure',to:'coordinator'}]},
{id:'textile',title:'Textile welcome desk',body:'Direct the fictional visitor to the textile welcome volunteer.',kind:'terminal',choices:[],outcome:'Routing complete: textile welcome desk.'},
{id:'item',title:'Household-item welcome desk',body:'Direct the fictional visitor to the household-item welcome volunteer. Repair decisions belong to the responsible team.',kind:'terminal',choices:[],outcome:'Routing complete: household-item welcome desk.'},
{id:'coordinator',title:'Ask the coordinator',body:'Ask the welcome coordinator for routing help. Do not guess a repair procedure.',kind:'terminal',choices:[],outcome:'Handoff to the welcome coordinator.'}
]}}

