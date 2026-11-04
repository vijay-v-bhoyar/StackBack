import {describe,it,expect} from 'vitest';
import {sample} from './sample';
import {stackOutline,compareStacks} from './stack';

describe('linked-card stack interpretation',()=>{
 it('indexes connections by reachability without changing the source guide',()=>{
  const g=sample(),original=structuredClone(g),outline=stackOutline(g);
  expect(outline.map(x=>[x.card.id,x.depth])).toEqual([['welcome',0],['station',1],['textile',2],['item',2],['coordinator',2]]);
  expect(g).toEqual(original);
 });
 it('distinguishes card-content drift from a new revision with identical content',()=>{
  const frozen=sample(),latest=structuredClone(frozen);latest.revisionId=crypto.randomUUID();
  expect(compareStacks(frozen,latest)).toEqual({guideDetailsChanged:false,changes:[]});
  latest.cards[1].body='Fictional station update';latest.cards[0].choices[0].label='Start updated route';
  const diff=compareStacks(frozen,latest);
  expect(diff.changes.map(x=>[x.id,x.kind])).toEqual([['welcome','changed'],['station','changed']]);
  expect(diff.changes[1].before?.body).toBe(frozen.cards[1].body);expect(diff.changes[1].after?.body).toBe('Fictional station update');
  expect(frozen.cards[1].body).not.toBe('Fictional station update');
 });
 it('identifies additions, removals and changed guide entry details',()=>{
  const frozen=sample(),latest=structuredClone(frozen);latest.title='Changed title';latest.cards=latest.cards.filter(c=>c.id!=='textile');latest.cards.push({id:'added',title:'New destination',body:'',kind:'terminal',choices:[],outcome:'Done'});
  const diff=compareStacks(frozen,latest);expect(diff.guideDetailsChanged).toBe(true);expect(diff.changes.map(x=>[x.id,x.kind])).toEqual([['textile','removed'],['added','added']]);
 });
});
