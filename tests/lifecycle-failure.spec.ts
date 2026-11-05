import {test,expect} from '@playwright/test';

test('a rejected local deletion retains the record and permits a clean retry',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'Edit a copy',exact:true}).click();await page.getByLabel('Guide title',{exact:true}).fill('Deletion failure fixture');await page.getByRole('button',{name:'Save guide',exact:true}).click();await expect(page.getByRole('status')).toContainText('Saved');await page.getByRole('button',{name:'Library',exact:true}).click();
 await page.evaluate(()=>{const original=IDBObjectStore.prototype.delete;let failed=false;IDBObjectStore.prototype.delete=function(key:IDBValidKey){if(!failed){failed=true;throw new DOMException('Synthetic deletion failure','UnknownError')}return original.call(this,key)}});
 page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'Delete guide locally',exact:true}).click();await expect(page.getByRole('alert')).toContainText('not deleted');await expect(page.getByRole('button',{name:'Edit guide',exact:true})).toBeVisible();
 page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'Delete guide locally',exact:true}).click();await expect(page.getByRole('button',{name:'Edit guide',exact:true})).toHaveCount(0);await expect(page.getByRole('heading',{name:'Welcome desk',exact:true})).toBeVisible();
});

test('an editor cannot silently resurrect a guide deleted in another tab',async({page,context})=>{
 await page.goto('/');await page.getByRole('button',{name:'Edit a copy',exact:true}).click();await page.getByLabel('Guide title',{exact:true}).fill('Deleted editor fixture');await page.getByRole('button',{name:'Save guide',exact:true}).click();await expect(page.getByRole('status')).toContainText('Saved');
 const other=await context.newPage();await other.goto('/');other.once('dialog',d=>d.accept());await other.getByRole('button',{name:'Delete guide locally',exact:true}).click();await expect(other.getByRole('button',{name:'Edit guide',exact:true})).toHaveCount(0);
 await page.getByLabel('Guide description',{exact:true}).fill('This stale edit must stay unsaved.');await page.getByRole('button',{name:'Save guide',exact:true}).click();await expect(page.getByRole('status')).toContainText('Not saved');await expect(page.getByRole('alert')).toContainText('changed');await expect(page.getByLabel('Guide description',{exact:true})).toHaveValue('This stale edit must stay unsaved.');
});
