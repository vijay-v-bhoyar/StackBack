import {test,expect,type Page} from '@playwright/test';
import {readFile} from 'node:fs/promises';

const saved=(p:Page)=>expect(p.getByRole('status')).toContainText('Saved on this device');
async function author(p:Page,title='Copy recovery fixture'){
 await p.goto('/');await p.getByRole('button',{name:'Edit a copy',exact:true}).click();await p.getByLabel('Guide title',{exact:true}).fill(title);await p.getByRole('button',{name:'Save guide',exact:true}).click();await saved(p);
}
async function records(p:Page,name:'guides'|'runs'){
 return p.evaluate(store=>new Promise<any[]>((resolve,reject)=>{const q=indexedDB.open('stackback-v1',1);q.onerror=()=>reject(q.error);q.onsuccess=()=>{const db=q.result,tx=db.transaction(store,'readonly'),r=tx.objectStore(store).getAll();r.onsuccess=()=>{db.close();resolve(r.result)};r.onerror=()=>reject(r.error)}}),name);
}

test('ordinary guide save retries after one failed copy without inventing a concurrent edit',async({page})=>{
 await author(page);const before=(await records(page,'guides')).find(g=>g.title==='Copy recovery fixture');
 await page.getByLabel('Guide description',{exact:true}).fill('Retain this synthetic edit.');
 await page.evaluate(()=>{const original=IDBObjectStore.prototype.put;let failed=false;IDBObjectStore.prototype.put=function(...args:Parameters<IDBObjectStore['put']>){if(!failed){failed=true;throw new DOMException('Synthetic one-shot failure','QuotaExceededError')}return original.apply(this,args)}});
 await page.getByRole('button',{name:'Save as new copy',exact:true}).click();await expect(page.getByRole('status')).toContainText('Not saved');
 await page.getByRole('button',{name:'Save guide',exact:true}).click();await saved(page);
 const after=await records(page,'guides');expect(after).toHaveLength(2);expect(after.find(g=>g.id===before.id).description).toBe('Retain this synthetic edit.');await expect(page.getByRole('alert')).toHaveCount(0);
});

test('editor card map lands keyboard focus on the selected title and continues within that card',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'Edit a copy',exact:true}).click();await page.getByText('Card stack map',{exact:true}).click();await page.getByRole('button',{name:'Level 3 · Household-item welcome desk',exact:true}).click();
 await expect(page.getByLabel('Card 4 title',{exact:true})).toBeFocused();await page.keyboard.press('Tab');await expect(page.getByLabel('Card 4 body',{exact:true})).toBeFocused();
});

test('a fresh activated worker does not advertise a waiting update',async({page})=>{
 await page.goto('/');await expect(page.getByTestId('offline-status')).toHaveText('Offline ready');
 const waiting=await page.evaluate(async()=>(await navigator.serviceWorker.getRegistration())?.waiting?.state??null);expect(waiting).toBeNull();await expect(page.getByRole('button',{name:'Apply available update',exact:true})).toHaveCount(0);
});

test('version comparison shows the exact old and new description without changing the saved snapshot',async({page})=>{
 await author(page,'Metadata fixture');const original=await page.getByLabel('Guide description',{exact:true}).inputValue();await page.getByRole('button',{name:'Start this guide',exact:true}).click();await saved(page);
 await page.getByRole('button',{name:'Library',exact:true}).click();await page.getByRole('button',{name:'Edit guide',exact:true}).click();await page.getByLabel('Guide description',{exact:true}).fill('New synthetic shift description');await page.getByRole('button',{name:'Save guide',exact:true}).click();await saved(page);
 await page.getByRole('button',{name:'Library',exact:true}).click();await page.getByRole('button',{name:'Resume session',exact:true}).click();await page.getByText('Compare guide versions',{exact:true}).click();const comparison=page.getByRole('region',{name:'Guide metadata changes'});await expect(comparison).toContainText(original);await expect(comparison).toContainText('New synthetic shift description');expect((await records(page,'runs'))[0].guideSnapshot.description).toBe(original);
});

test('readable brief carries the corrected context as plain text and discloses unsaved work',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'Start guide',exact:true}).click();await page.getByRole('button',{name:'Find a station',exact:true}).click();await page.getByRole('button',{name:'Clothing or textile',exact:true}).click();await page.getByRole('button',{name:'Previous card',exact:true}).click();await page.getByRole('button',{name:'I’m not sure',exact:true}).click();
 await page.getByLabel('Current handoff note').fill('Fictional handoff <img src=x> — confirm with coordinator.');const downloaded=page.waitForEvent('download');await page.getByRole('button',{name:'Export readable brief (.txt)',exact:true}).click();const file=await downloaded;expect(file.suggestedFilename()).toBe('stackback-handoff-brief.txt');const text=await readFile((await file.path())!,'utf8');
 expect(text).toContain('Save status: UNSAVED WORK');expect(text).toContain('Current card: Ask the coordinator');expect(text).toContain('Clothing or textile');expect(text).toContain('Previous card');expect(text).toContain('Fictional handoff <img src=x>');expect(text).toContain('readable brief cannot be imported');await expect(page.locator('main img')).toHaveCount(0);
});

test('practice guide uses real authoring, correction, version comparison and readable handoff',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'Create shift-change practice guide',exact:true}).click();await expect(page.getByLabel('Guide title',{exact:true})).toHaveValue('Fictional shift handoff');await expect(page.getByRole('status')).toContainText('Not saved');
 await page.getByRole('button',{name:'Save guide',exact:true}).click();await saved(page);await page.getByRole('button',{name:'Start this guide',exact:true}).click();await page.getByRole('button',{name:'Review waiting handoff',exact:true}).click();await page.getByRole('button',{name:'Textile desk',exact:true}).click();await page.getByRole('button',{name:'Previous card',exact:true}).click();await page.getByRole('button',{name:'Ask coordinator',exact:true}).click();await page.getByLabel('Current handoff note').fill('Fictional: waiting visitor; coordinator must confirm station.');await page.getByRole('button',{name:'Save note',exact:true}).click();await saved(page);
 await page.getByRole('button',{name:'Library',exact:true}).click();await page.getByRole('button',{name:'Edit guide',exact:true}).click();await page.getByLabel('Card 3 body',{exact:true}).fill('Fictional next shift: textile desk moved to Green table. Confirm with the coordinator.');await page.getByRole('button',{name:'Save guide',exact:true}).click();await saved(page);await page.getByRole('button',{name:'Library',exact:true}).click();await page.getByRole('button',{name:'Resume session',exact:true}).click();await page.getByText('Compare guide versions',{exact:true}).click();await expect(page.getByLabel('Guide version comparison')).toContainText('Blue table');await expect(page.getByLabel('Guide version comparison')).toContainText('Green table');
 const next=page.waitForEvent('download');await page.getByRole('button',{name:'Export readable brief (.txt)',exact:true}).click();const text=await readFile((await(await next).path())!,'utf8');expect(text).toContain('Current card: Coordinator review');expect(text).toContain('Fictional: waiting visitor');expect(text).toContain('Textile desk');expect(text).not.toContain('Green table');
});

test('selected guide deletion requires confirmation and leaves its session snapshot resumable',async({page})=>{
 await author(page,'Local lifecycle fixture');await page.getByRole('button',{name:'Start this guide',exact:true}).click();await saved(page);await page.getByRole('button',{name:'Library',exact:true}).click();
 page.once('dialog',d=>d.dismiss());await page.getByRole('button',{name:'Delete guide locally',exact:true}).click();expect((await records(page,'guides')).some(g=>g.title==='Local lifecycle fixture')).toBe(true);
 page.once('dialog',async d=>{expect(d.message()).toContain('Local lifecycle fixture');expect(d.message()).toContain('Saved sessions keep their snapshots');await d.accept()});await page.getByRole('button',{name:'Delete guide locally',exact:true}).click();await expect(page.getByRole('button',{name:'Edit guide',exact:true})).toHaveCount(0);expect((await records(page,'runs'))).toHaveLength(1);await page.getByRole('button',{name:'Resume session',exact:true}).click();await expect(page.getByRole('heading',{name:'Welcome to the repair café',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Library',exact:true}).click();page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'Delete session locally',exact:true}).click();await expect(page.getByRole('button',{name:'Resume session',exact:true})).toHaveCount(0);expect(await records(page,'guides')).toHaveLength(1);
});

test('stale guide deletion cannot erase a newer saved revision',async({page,context})=>{
 await author(page,'Stale delete fixture');await page.getByRole('button',{name:'Library',exact:true}).click();const other=await context.newPage();await other.goto('/');await other.getByRole('button',{name:'Edit guide',exact:true}).click();await other.getByLabel('Guide description',{exact:true}).fill('Newer revision must remain');await other.getByRole('button',{name:'Save guide',exact:true}).click();await saved(other);
 page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'Delete guide locally',exact:true}).click();await expect(page.getByRole('alert')).toContainText('changed');expect((await records(page,'guides')).find(g=>g.title==='Stale delete fixture').description).toBe('Newer revision must remain');
});

test('stale session deletion cannot erase a newer checkpoint',async({page,context})=>{
 await page.goto('/');await page.getByRole('button',{name:'Start guide',exact:true}).click();await saved(page);await page.getByRole('button',{name:'Library',exact:true}).click();const other=await context.newPage();await other.goto('/');await other.getByRole('button',{name:'Resume session',exact:true}).click();await other.getByLabel('Current handoff note').fill('Newer checkpoint retained');await other.getByRole('button',{name:'Save note',exact:true}).click();await saved(other);
 page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'Delete session locally',exact:true}).click();await expect(page.getByRole('alert')).toContainText('changed');expect((await records(page,'runs'))[0].note).toBe('Newer checkpoint retained');
});
