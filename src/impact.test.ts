import {describe,it,expect} from 'vitest';
import {sample} from './sample';
import {startRun,choose,stepBack,requireGuide} from './domain';
import {handoffBrief} from './brief';
import {practiceGuide} from './practice';
import {guideMetadataChanges} from './stack';

describe('readable handoff and a concrete shift-change case',()=>{
 it('carries the exact snapshot, active path and full correction history without modifying the run',()=>{
  let run=startRun(sample());run=choose(run,'begin');run=choose(run,'textile');run=stepBack(run);run=choose(run,'uncertain');run.note='Fictional waiting visitor; ask coordinator.';const before=structuredClone(run),text=handoffBrief(run,true);
  expect(text).toContain('Save status: SAVED CHECKPOINT');expect(text).toContain(run.guideSnapshot.revisionId);expect(text).toContain('Current card: Ask the coordinator');expect(text).toContain('Clothing or textile');expect(text).toContain('Previous card');expect(text).toContain(run.note);expect(text).toContain('readable brief cannot be imported');expect(run).toEqual(before);
 });
 it('labels unsaved work and emits literal UTF-8 text rather than a runnable document',()=>{
  const run=startRun(sample());run.note='<script>literal only</script> — 界';const text=handoffBrief(run,false);expect(text).toContain('Save status: UNSAVED WORK');expect(text).toContain(run.note);expect(text).toContain('Confirm current instructions with the guide owner');expect(text).not.toContain('<!doctype');
 });
 it('rejects inconsistent history instead of inventing a readable current state',()=>{
  const run=startRun(sample());run.events.push({seq:1,kind:'choose',from:'missing',to:'station',choiceId:'begin',at:run.createdAt});expect(()=>handoffBrief(run,true)).toThrow();
 });
 it('creates a fresh valid original fictional practice guide with an explicit changing-station task',()=>{
  const one=practiceGuide(),two=practiceGuide();expect(requireGuide(one)).toEqual(one);expect(one.id).not.toBe(two.id);expect(one.title).toBe('Fictional shift handoff');expect(one.cards).toHaveLength(6);expect(one.cards[2].body).toContain('Blue table');expect(one.description).toContain('Fictional');
 });
 it('reports exact changed guide fields including identifiable start cards',()=>{
  const before=sample(),after=structuredClone(before);after.title='New title';after.description='New description';after.startCardId='station';expect(guideMetadataChanges(before,after)).toEqual([{name:'Guide title',before:before.title,after:'New title'},{name:'Description',before:before.description,after:'New description'},{name:'Start card',before:'Welcome to the repair café (welcome)',after:'What kind of help is needed? (station)'}]);expect(before.startCardId).toBe('welcome');
 });
 it('does not invent metadata changes for a new revision of the same content',()=>{
  const before=sample(),after=structuredClone(before);after.revisionId=crypto.randomUUID();expect(guideMetadataChanges(before,after)).toEqual([]);
 });
});
