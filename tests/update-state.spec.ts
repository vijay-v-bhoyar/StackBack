import {test,expect} from '@playwright/test';
import {updateServer} from './update-server';

test('only a real waiting worker can activate and the replacement runs after reload',async({page,context})=>{
 const hosted=await updateServer();try{
 await page.goto(hosted.url);await expect(page.getByTestId('offline-status')).toHaveText('Offline ready');await expect(page.getByRole('button',{name:'Apply available update'})).toHaveCount(0);
 await page.getByRole('button',{name:'Start guide',exact:true}).click();await page.getByLabel('Current handoff note').fill('Saved before the real update.');
 hosted.publishNext();await page.evaluate(async()=>{await(await navigator.serviceWorker.getRegistration())!.update()});await expect.poll(()=>page.evaluate(async()=>!!(await navigator.serviceWorker.getRegistration())?.waiting)).toBe(true);expect(hosted.versions).toContain(2);
 await page.getByRole('button',{name:'Save note',exact:true}).click();await expect(page.getByRole('status')).toContainText('Saved');await page.getByRole('button',{name:'Apply available update',exact:true}).click();await expect(page.getByRole('heading',{name:'Pick up the thread.'})).toBeVisible();
 const state=await page.evaluate(async()=>{const r=(await navigator.serviceWorker.getRegistration())!;const marker=await new Promise(resolve=>{const ch=new MessageChannel();const timer=setTimeout(()=>resolve('NO_MARKER'),2000);ch.port1.onmessage=e=>{clearTimeout(timer);ch.port1.close();resolve(e.data)};r.active!.postMessage('C04_ID',[ch.port2])});return {waiting:r.waiting?.state??null,marker}});
 expect(state).toEqual({waiting:null,marker:'C04_UPDATED'});await expect(page.getByRole('button',{name:'Apply available update'})).toHaveCount(0);await page.getByRole('button',{name:'Resume session',exact:true}).click();await expect(page.getByLabel('Current handoff note')).toHaveValue('Saved before the real update.');
 }finally{await hosted.close()}
});
