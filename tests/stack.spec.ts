import {test,expect} from '@playwright/test';

test('browses a linked card stack and follows its connections without recording a session',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'Explore stack',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Welcome desk · card stack',exact:true})).toBeVisible();
 await expect(page.getByText('Stack preview — no session is being recorded.',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Follow: Find a station',exact:true}).click();await expect(page.getByRole('heading',{name:'What kind of help is needed?',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Follow: I’m not sure',exact:true}).press('Enter');await expect(page.getByRole('heading',{name:'Ask the coordinator',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Library',exact:true}).click();await expect(page.getByRole('button',{name:'Resume session'})).toHaveCount(0);
});

test('shows library-version drift while retaining the exact running card snapshot',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'Edit a copy'}).click();await page.getByLabel('Guide title',{exact:true}).fill('Shift change fixture');await page.getByRole('button',{name:'Save guide',exact:true}).click();
 await page.getByRole('button',{name:'Start this guide'}).click();await page.getByRole('button',{name:'Find a station',exact:true}).click();await page.getByLabel('Current handoff note').fill('Synthetic handoff awaiting a station decision.');await page.getByRole('button',{name:'Save note'}).click();
 await page.getByRole('button',{name:'Library',exact:true}).click();await page.getByRole('article').filter({has:page.getByRole('heading',{name:'Shift change fixture',exact:true})}).getByRole('button',{name:'Edit guide',exact:true}).click();
 await page.getByLabel('Card 2 body',{exact:true}).fill('Fictional update: ask the coordinator before routing this shift.');await page.getByRole('button',{name:'Save guide',exact:true}).click();await page.getByRole('button',{name:'Library',exact:true}).click();await page.getByRole('button',{name:'Resume session'}).click();
 await expect(page.getByText('Library guide has a newer revision.',{exact:true})).toBeVisible();await page.getByText('Compare guide versions',{exact:true}).click();
 await expect(page.getByLabel('Guide version comparison')).toContainText('Fictional update: ask the coordinator before routing this shift.');
 await expect(page.getByLabel('Current handoff note')).toHaveValue('Synthetic handoff awaiting a station decision.');await expect(page.getByRole('heading',{name:'What kind of help is needed?',exact:true})).toBeVisible();
 await expect(page.getByRole('main')).toContainText('Ask which station the visitor is looking for.');
});
