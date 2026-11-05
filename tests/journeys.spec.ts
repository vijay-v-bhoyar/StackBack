import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {updateServer} from './update-server';

test('opens the native import chooser with mouse and keyboard',async({page})=>{
 const fixture={kind:'stackback.guide',schemaVersion:1,guide:{id:'11111111-1111-4111-8111-111111111111',revisionId:'22222222-2222-4222-8222-222222222222',title:'Chooser integration fixture',description:'Original synthetic input',startCardId:'end',updatedAt:'2026-11-03T12:00:00.000Z',cards:[{id:'end',title:'Finish',body:'Fictional routing only',kind:'terminal',choices:[],outcome:'Done'}]}};
 await page.goto('/');await expect(page.getByRole('heading',{name:'Pick up the thread.'})).toBeVisible();
 for(const activation of ['mouse','keyboard']){
  const chooserEvent=page.waitForEvent('filechooser',{timeout:2500}).catch(()=>null);const trigger=page.getByRole('button',{name:'Import a file',exact:true});
  if(activation==='mouse')await trigger.click();else await trigger.press('Enter');const chooser=await chooserEvent;
  expect(chooser,'The import button must activate the browser chooser for '+activation).not.toBeNull();
  await chooser!.setFiles({name:'chooser.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(fixture))});await expect(page.getByRole('dialog')).toContainText('Chooser integration fixture');
  await page.getByRole('button',{name:'Import as new copy'}).press('Enter');await expect(page.getByLabel('Guide title',{exact:true})).toHaveValue('Chooser integration fixture');
 }
});

test('keeps tertiary actions readable when hovered',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'Start guide',exact:true}).first().click();await expect(page.getByRole('status')).toContainText('Saved');
 for(const name of ['Export handoff','Show session history']){await page.getByRole('button',{name,exact:true}).hover();expect((await new AxeBuilder({page}).withRules(['color-contrast']).analyze()).violations).toEqual([]);}
 await page.getByRole('button',{name:'Show session history'}).click();await page.getByRole('button',{name:'Hide session history'}).hover();expect((await new AxeBuilder({page}).withRules(['color-contrast']).analyze()).violations).toEqual([]);
 await page.getByRole('button',{name:'Library',exact:true}).click();await page.getByRole('button',{name:'Edit a copy'}).first().click();await page.getByRole('button',{name:'Export guide',exact:true}).hover();expect((await new AxeBuilder({page}).withRules(['color-contrast']).analyze()).violations).toEqual([]);
});
test('authors a complete guide and resumes a corrected run',async({page})=>{
 await page.goto('/');await expect(page.getByRole('heading',{name:'Pick up the thread.'})).toBeVisible();
 await page.getByRole('button',{name:'Edit a copy'}).first().click();
 await page.getByLabel('Guide title',{exact:true}).fill('My welcome guide');
 await page.getByRole('button',{name:'Save guide',exact:true}).click();
 await expect(page.getByRole('status')).toContainText('Saved');
 await page.getByRole('button',{name:'Start this guide'}).click();
 await page.getByRole('button',{name:'Find a station',exact:true}).click();
 await page.getByRole('button',{name:'Clothing or textile',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Textile welcome desk'})).toBeVisible();
 await page.getByRole('button',{name:'Previous card'}).click();
 await page.getByRole('button',{name:'I’m not sure',exact:true}).click();
 await page.getByLabel('Current handoff note').fill('Fictional visitor waiting at desk');
 await page.getByRole('button',{name:'Save note'}).click();
 await expect(page.getByRole('status')).toContainText('Saved');
 await page.reload();await page.getByRole('button',{name:'Resume session'}).first().click();
 await expect(page.getByRole('heading',{name:'Ask the coordinator'})).toBeVisible();
 await expect(page.getByLabel('Current handoff note')).toHaveValue('Fictional visitor waiting at desk');
 await page.getByRole('button',{name:'Show session history'}).click();
 await expect(page.getByTestId('history')).toContainText('Clothing or textile');
 await expect(page.getByTestId('history')).toContainText('Previous card');
});
test('validates an author mistake and prevents starting a broken route',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'Edit a copy'}).first().click();
 await page.getByLabel('Choice 1 destination').first().selectOption('');
 await page.getByRole('button',{name:'Validate guide'}).click();
 await expect(page.getByRole('alert')).toContainText('destination');
 await expect(page.getByRole('button',{name:'Start this guide'})).toBeDisabled();
 await page.getByRole('button',{name:'Save guide',exact:true}).click();await expect(page.getByRole('status')).toContainText('Saved');
 await page.reload();const draft=page.getByRole('article').filter({has:page.getByRole('heading',{name:'Welcome desk — copy',exact:true})});
 await expect(draft.getByRole('button',{name:'Start guide',exact:true})).toBeDisabled();await draft.getByRole('button',{name:'Edit guide'}).click();await expect(page.getByLabel('Choice 1 destination').first()).toHaveValue('');
});
test('hands off an exact snapshot to a fresh browser and creates distinct copies',async({page,browser})=>{
 await page.goto('/');await page.getByRole('button',{name:'Start guide',exact:true}).first().click();
 await page.getByRole('button',{name:'Find a station',exact:true}).click();
 await page.getByLabel('Current handoff note').fill('Fictional handoff only');await page.getByRole('button',{name:'Save note'}).click();
 const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Export handoff',exact:true}).click();const download=await downloadPromise;const path=await download.path();expect(path).toBeTruthy();
 const context=await browser.newContext();const next=await context.newPage();await next.goto('/');
 await next.locator('input[type=file]').setInputFiles(path!);
 await expect(next.getByRole('dialog')).toContainText('Fictional handoff only');
 await next.getByRole('button',{name:'Import as new copy'}).click();
 await expect(next.getByLabel('Current handoff note')).toHaveValue('Fictional handoff only');
 await next.getByRole('button',{name:'Clothing or textile',exact:true}).click();await expect(next.getByRole('heading',{name:'Textile welcome desk'})).toBeVisible();
 await next.locator('input[type=file]').setInputFiles(path!);await next.getByRole('button',{name:'Import as new copy'}).click();
 await next.getByRole('button',{name:'Library',exact:true}).click();await expect(next.getByRole('button',{name:'Resume session'})).toHaveCount(2);
 await context.close();
});
test('rejects hostile and malformed input without executing strings or overwriting records',async({page})=>{
 await page.goto('/');
 for(const content of ['{',JSON.stringify({kind:'stackback.guide',schemaVersion:99,guide:{}}),'x'.repeat(1024*1024+1)]){
  await page.locator('input[type=file]').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from(content)});
  await expect(page.getByRole('alert')).toBeVisible();await expect(page.getByRole('dialog')).toHaveCount(0);
 }
 await expect(page.getByRole('button',{name:'Start guide',exact:true})).toHaveCount(1);
});
test('prepares a production shell then cold reloads a saved run offline',async({page,context})=>{
 await page.goto('/');await expect(page.getByTestId('offline-status')).toHaveText('Offline ready',{timeout:15000});
 await page.getByRole('button',{name:'Start guide',exact:true}).first().click();await page.getByRole('button',{name:'Find a station',exact:true}).click();
 await expect(page.getByRole('status')).toContainText('Saved');
 await context.setOffline(true);await page.reload();await page.getByRole('button',{name:'Resume session'}).first().click();
 await expect(page.getByRole('heading',{name:'What kind of help is needed?'})).toBeVisible();await page.getByRole('button',{name:'I’m not sure',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Ask the coordinator'})).toBeVisible();
});
test('retains honest unsaved work when browser storage is unavailable',async({page})=>{
 await page.addInitScript(()=>{Object.defineProperty(window,'indexedDB',{get(){throw new Error('storage unavailable')}})});
 await page.goto('/');await expect(page.getByRole('alert')).toContainText('storage');
 await page.getByRole('button',{name:'Start guide',exact:true}).first().click();
 await expect(page.getByRole('status')).toContainText('Not saved');
 await page.getByRole('button',{name:'Find a station',exact:true}).click();await expect(page.getByRole('heading',{name:'What kind of help is needed?'})).toBeVisible();
 await expect(page.getByRole('status')).toContainText('Not saved');
 const d=page.waitForEvent('download');await page.getByRole('button',{name:'Export handoff',exact:true}).click();expect(await d).toBeTruthy();
});
test('renders desktop and mobile accessibly and exposes no runtime external calls',async({page})=>{
 const external:string[]=[];page.on('request',r=>{if(!r.url().startsWith('http://127.0.0.1:4793')&&!r.url().startsWith('data:'))external.push(r.url())});
 await page.goto('/');await page.getByRole('button',{name:'Start guide',exact:true}).first().click();await page.getByRole('button',{name:'Find a station',exact:true}).click();
 expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);
 await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.getByRole('button',{name:'I’m not sure',exact:true}).focus();await page.keyboard.press('Enter');await expect(page.getByRole('heading',{name:'Ask the coordinator'})).toBeVisible();
 expect(external).toEqual([]);
});
test('protects run snapshots from later guide edits and stale author saves',async({page,context})=>{
 await page.goto('/');await page.getByRole('button',{name:'Edit a copy'}).first().click();await page.getByLabel('Guide title',{exact:true}).fill('Conflict guide');await page.getByRole('button',{name:'Save guide',exact:true}).click();
 await page.getByRole('button',{name:'Library',exact:true}).click();await page.getByRole('article').filter({has:page.getByRole('heading',{name:'Conflict guide',exact:true})}).getByRole('button',{name:'Edit guide'}).click();
 const other=await context.newPage();await other.goto('/');await other.getByRole('article').filter({has:other.getByRole('heading',{name:'Conflict guide',exact:true})}).getByRole('button',{name:'Edit guide'}).click();
 await other.getByLabel('Guide title',{exact:true}).fill('Changed elsewhere');await other.getByRole('button',{name:'Save guide',exact:true}).click();await expect(other.getByRole('status')).toContainText('Saved');
 await page.getByLabel('Guide title',{exact:true}).fill('Stale overwrite');await page.getByRole('button',{name:'Save guide',exact:true}).click();await expect(page.getByRole('alert')).toContainText('another tab');
 await other.close();
});
test('does not discard author or note edits while a delayed save completes',async({page})=>{
 await page.addInitScript(()=>{const descriptor=Object.getOwnPropertyDescriptor(IDBTransaction.prototype,'oncomplete')!;Object.defineProperty(IDBTransaction.prototype,'oncomplete',{...descriptor,set(fn){descriptor.set!.call(this,fn?function(this:IDBTransaction,event:Event){setTimeout(()=>fn.call(this,event),150)}:fn)}})});
 await page.goto('/');await page.getByRole('button',{name:'Edit a copy'}).first().click();await page.getByLabel('Guide title',{exact:true}).fill('Before save');await page.getByRole('button',{name:'Save guide',exact:true}).click();
 await page.getByLabel('Guide title',{exact:true}).fill('After save');await expect(page.getByLabel('Guide title',{exact:true})).toHaveValue('After save');await expect(page.getByRole('status')).toContainText('Not saved');
 await page.getByRole('button',{name:'Save guide',exact:true}).click();await expect(page.getByRole('status')).toContainText('Saved');await page.getByRole('button',{name:'Start this guide'}).click();await page.getByLabel('Current handoff note').fill('First note');await page.getByRole('button',{name:'Save note'}).click();
 await page.getByLabel('Current handoff note').fill('Newer note');await expect(page.getByRole('status')).toContainText('Not saved');await page.getByRole('button',{name:'Save note'}).click();await expect(page.getByRole('status')).toContainText('Saved');await page.reload();await page.getByRole('button',{name:'Resume session'}).first().click();await expect(page.getByLabel('Current handoff note')).toHaveValue('Newer note');
});
test('reports failed offline preparation instead of waiting forever',async({page,context})=>{
 await context.route('**/assets/*.css',route=>route.abort());await page.goto('/');await expect(page.getByTestId('offline-status')).toHaveText('Offline not prepared — reload online to retry',{timeout:20000});
});
test('retains progress and note when a write rejects with quota failure',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'Start guide',exact:true}).first().click();await expect(page.getByRole('status')).toContainText('Saved');
 await page.evaluate(()=>{IDBObjectStore.prototype.put=function(){throw new DOMException('Synthetic quota rejection','QuotaExceededError')}});
 await page.getByRole('button',{name:'Find a station',exact:true}).click();await expect(page.getByRole('status')).toContainText('Not saved');await expect(page.getByRole('heading',{name:'What kind of help is needed?'})).toBeVisible();
 await page.getByLabel('Current handoff note').fill('Keep this temporary fictional note');await page.getByRole('button',{name:'Save note'}).click();await expect(page.getByLabel('Current handoff note')).toHaveValue('Keep this temporary fictional note');await expect(page.getByRole('status')).toContainText('Not saved');
 const d=page.waitForEvent('download');await page.getByRole('button',{name:'Export handoff',exact:true}).click();expect(await d).toBeTruthy();
});
test('renders imported HTML as literal text without execution',async({page})=>{
 const hostile='<img src=x onerror="window.__stackbackXss=1">';const guide={id:'11111111-1111-4111-8111-111111111111',revisionId:'22222222-2222-4222-8222-222222222222',title:'Safe hostile-text fixture',description:'Synthetic input',startCardId:'end',updatedAt:'2026-11-03T12:00:00.000Z',cards:[{id:'end',title:'Literal text card',body:hostile,kind:'terminal',choices:[],outcome:'Done'}]};
 await page.goto('/');await page.locator('input[type=file]').setInputFiles({name:'literal.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({kind:'stackback.guide',schemaVersion:1,guide}))});await page.getByRole('button',{name:'Import as new copy'}).click();await page.getByRole('button',{name:'Start this guide'}).click();await expect(page.getByText(hostile,{exact:true})).toBeVisible();expect(await page.evaluate(()=>Object.hasOwn(window,'__stackbackXss'))).toBe(false);await expect(page.locator('main img')).toHaveCount(0);
});
test('keeps an unsaved session intact while a newer worker waits',async({page,context})=>{
 const hosted=await updateServer();try{
 await page.goto(hosted.url);await expect(page.getByTestId('offline-status')).toHaveText('Offline ready');await page.getByRole('button',{name:'Start guide',exact:true}).first().click();await page.getByRole('button',{name:'Find a station',exact:true}).click();await page.getByLabel('Current handoff note').fill('Unsaved update-protection note');
 hosted.publishNext();await page.evaluate(async()=>{const reg=await navigator.serviceWorker.getRegistration();await reg!.update()});await expect.poll(()=>page.evaluate(async()=>!!(await navigator.serviceWorker.getRegistration())?.waiting)).toBe(true);expect(hosted.versions).toContain(2);
 await expect(page.getByLabel('Current handoff note')).toHaveValue('Unsaved update-protection note');await expect(page.getByRole('status')).toContainText('Not saved');
 await page.getByRole('button',{name:'Save note'}).click();await expect(page.getByRole('status')).toContainText('Saved');await page.getByRole('button',{name:'Apply available update'}).click();await page.getByRole('heading',{name:'Pick up the thread.'}).waitFor();await page.getByRole('button',{name:'Resume session'}).first().click();await expect(page.getByLabel('Current handoff note')).toHaveValue('Unsaved update-protection note');
 }finally{await hosted.close()}
});

