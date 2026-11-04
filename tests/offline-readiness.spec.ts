import {test,expect} from '@playwright/test';

test('repairs a lost shell cache before reporting offline ready again',async({page,context})=>{
 await page.goto('/');await expect(page.getByTestId('offline-status')).toHaveText('Offline ready');
 await page.getByRole('button',{name:'Start guide',exact:true}).click();await page.getByRole('button',{name:'Find a station',exact:true}).click();
 await page.evaluate(async()=>{for(const name of await caches.keys())await caches.delete(name)});
 await page.reload();await expect(page.getByTestId('offline-status')).toHaveText('Offline ready');
 const counts=await page.evaluate(async()=>Promise.all((await caches.keys()).map(async name=>(await(await caches.open(name)).keys()).length)));
 expect(counts.some(count=>count>=3),'Offline ready must mean the actual shell was restored').toBe(true);
 await context.setOffline(true);await page.reload();await page.getByRole('button',{name:'Resume session'}).click();await expect(page.getByRole('heading',{name:'What kind of help is needed?'})).toBeVisible();
});

test('does not claim offline readiness when a lost shell cannot be repaired',async({page,context})=>{
 await page.goto('/');await expect(page.getByTestId('offline-status')).toHaveText('Offline ready');
 await page.evaluate(async()=>{for(const name of await caches.keys())await caches.delete(name)});
 await context.route('**/assets/*.css',route=>route.abort());await page.reload();
 await expect(page.getByTestId('offline-status')).toHaveText('Offline not prepared — reload online to retry');
});
