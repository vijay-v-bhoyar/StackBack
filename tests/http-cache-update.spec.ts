import {test,expect} from '@playwright/test';
import {updateServer} from './update-server';

test('a waiting update bypasses warm HTTP cache and preserves the committed handoff',async({page,context})=>{
 const hosted=await updateServer({httpCache:true});
 const records=()=>page.evaluate(()=>new Promise<any[]>((resolve,reject)=>{const q=indexedDB.open('stackback-v1',1);q.onerror=()=>reject(q.error);q.onsuccess=()=>{const db=q.result,r=db.transaction('runs','readonly').objectStore('runs').getAll();r.onsuccess=()=>{db.close();resolve(r.result)};r.onerror=()=>reject(r.error)}}));
 try{
  await page.goto(hosted.url);await expect(page.getByTestId('offline-status')).toHaveText('Offline ready');await expect(page).toHaveTitle('StackBack shell fixture 1');
  await page.getByRole('button',{name:'Start guide',exact:true}).first().click();await page.getByRole('button',{name:'Find a station',exact:true}).click();
  await page.getByLabel('Current handoff note').fill('Synthetic committed handoff.');await page.getByRole('button',{name:'Save note',exact:true}).click();await expect(page.getByRole('status')).toContainText('Saved on this device');const before=(await records())[0];
  hosted.publishNext();await page.evaluate(async()=>{await(await navigator.serviceWorker.getRegistration())!.update()});await expect.poll(()=>page.evaluate(async()=>!!(await navigator.serviceWorker.getRegistration())?.waiting)).toBe(true);
  await page.getByLabel('Current handoff note').fill('Synthetic pending note requires a user save.');await page.getByRole('button',{name:'Apply available update',exact:true}).click();
  await expect(page.getByRole('status')).toContainText('Not saved');await expect(page).toHaveTitle('StackBack shell fixture 1');await expect(page.getByLabel('Current handoff note')).toHaveValue('Synthetic pending note requires a user save.');
  await page.getByRole('button',{name:'Save note',exact:true}).click();await expect(page.getByRole('status')).toContainText('Saved on this device');
  await page.getByRole('button',{name:'Apply available update',exact:true}).click();await expect(page).toHaveTitle('StackBack shell fixture 2');
  await page.getByRole('button',{name:'Resume session',exact:true}).first().click();const after=(await records())[0];expect(after.id).toBe(before.id);expect(after.guideSnapshot).toEqual(before.guideSnapshot);expect(after.events).toEqual(before.events);expect(after.note).toBe('Synthetic pending note requires a user save.');
  await context.setOffline(true);await page.reload();await page.getByRole('button',{name:'Resume session',exact:true}).first().click();await expect(page.getByLabel('Current handoff note')).toHaveValue(after.note);expect((await records())[0]).toEqual(after);
 }finally{await hosted.close()}
});
