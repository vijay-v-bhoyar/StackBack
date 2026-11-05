import type {Card,Guide} from './domain';

export function stackOutline(g:Guide):{card:Card;depth:number}[]{
 const depths=new Map<string,number>([[g.startCardId,0]]),queue=[g.startCardId];
 const cards=new Map(g.cards.map(c=>[c.id,c]));
 for(let i=0;i<queue.length;i++)for(const choice of cards.get(queue[i])?.choices??[]){
  if(cards.has(choice.to)&&!depths.has(choice.to)){depths.set(choice.to,depths.get(queue[i])!+1);queue.push(choice.to)}
 }
 return g.cards.map(card=>({card,depth:depths.get(card.id)??-1}));
}

const cardContent=(c:Card)=>JSON.stringify([c.title,c.body,c.kind,c.outcome??'',c.choices.map(ch=>[ch.id,ch.label,ch.to])]);
export function compareStacks(snapshot:Guide,current:Guide){
 const before=new Map(snapshot.cards.map(c=>[c.id,c])),after=new Map(current.cards.map(c=>[c.id,c]));
 const changes:{id:string;kind:'added'|'removed'|'changed';before?:Card;after?:Card}[]=[];
 for(const card of snapshot.cards){const next=after.get(card.id);if(!next)changes.push({id:card.id,kind:'removed',before:card});else if(cardContent(card)!==cardContent(next))changes.push({id:card.id,kind:'changed',before:card,after:next})}
 for(const card of current.cards)if(!before.has(card.id))changes.push({id:card.id,kind:'added',after:card});
 const guideDetailsChanged=JSON.stringify([snapshot.title,snapshot.description,snapshot.startCardId])!==JSON.stringify([current.title,current.description,current.startCardId]);
 return {guideDetailsChanged,changes};
}

export function guideMetadataChanges(snapshot:Guide,current:Guide){
 const start=(g:Guide)=>(g.cards.find(c=>c.id===g.startCardId)?.title??'Missing card')+' ('+g.startCardId+')';
 const fields=[['Guide title',snapshot.title,current.title],['Description',snapshot.description,current.description],['Start card',start(snapshot),start(current)]];
 return fields.filter(([,before,after])=>before!==after).map(([name,before,after])=>({name,before,after}));
}
