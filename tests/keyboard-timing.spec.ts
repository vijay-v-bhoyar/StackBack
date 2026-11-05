import {test,expect} from '@playwright/test';

test('a pending automatic heading focus cannot steal an intentional keyboard activation',async({page})=>{
 await page.addInitScript(()=>{
  const native=window.requestAnimationFrame.bind(window),state={hold:false,frames:[] as FrameRequestCallback[]};(window as any).__focusTiming=state;
  window.requestAnimationFrame=callback=>{if(state.hold){state.frames.push(callback);return state.frames.length}return native(callback)};
 });
 await page.goto('/');await page.getByRole('button',{name:'Explore stack',exact:true}).click();await expect(page.getByRole('heading',{name:'Welcome desk · card stack',exact:true})).toBeFocused();
 await page.evaluate(()=>{(window as any).__focusTiming.hold=true});await page.getByRole('button',{name:'Follow: Find a station',exact:true}).click();
 expect(await page.evaluate(()=>(window as any).__focusTiming.frames.length)).toBeGreaterThan(0);
 const choice=page.getByRole('button',{name:'Follow: I’m not sure',exact:true});await choice.focus();await expect(choice).toBeFocused();
 await page.evaluate(()=>{const state=(window as any).__focusTiming;state.hold=false;for(const frame of state.frames.splice(0))frame(performance.now())});
 await expect(choice).toBeFocused();await choice.press('Enter');await expect(page.getByRole('heading',{name:'Ask the coordinator',exact:true})).toBeVisible();await page.getByRole('button',{name:'Library',exact:true}).click();await expect(page.getByRole('button',{name:'Resume session'})).toHaveCount(0);
});
