import {test,expect} from '@playwright/test';
import {createServer,type Server} from 'node:http';
import {readFile,readdir} from 'node:fs/promises';
import path from 'node:path';

let server:Server,url:string;
test.beforeAll(async()=>{
 const dist=path.resolve(process.env.STACKBACK_TEST_DIST??'dist'),files=new Map<string,Buffer>();
 async function load(dir:string){for(const f of await readdir(dir,{withFileTypes:true})){const p=path.join(dir,f.name);if(f.isDirectory())await load(p);else files.set('/StackBack/'+path.relative(dist,p).split(path.sep).join('/'),await readFile(p))}}await load(dist);
 server=createServer((request,response)=>{let pathname=new URL(request.url!,'http://localhost').pathname;if(pathname==='/StackBack/')pathname+='index.html';const data=files.get(pathname);if(!data){response.writeHead(404);response.end();return}response.setHeader('Content-Type',pathname.endsWith('.html')?'text/html':pathname.endsWith('.css')?'text/css':'application/javascript');response.end(data)});
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));const address=server.address();if(!address||typeof address==='string')throw Error('No static test port');url='http://127.0.0.1:'+address.port+'/StackBack/';
});
test.afterAll(async()=>{if(server)await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()))});

test('runs and cold reloads offline under a repository subpath',async({page,context})=>{
 await page.goto(url);await expect(page.getByRole('heading',{name:'Pick up the thread.'})).toBeVisible();await expect(page.getByTestId('offline-status')).toHaveText('Offline ready');
 await page.getByRole('button',{name:'Start guide',exact:true}).click();await page.getByRole('button',{name:'Find a station',exact:true}).click();
 const paths=await page.evaluate(async()=>({scope:(await navigator.serviceWorker.getRegistration())!.scope,assets:await Promise.all((await caches.keys()).map(async key=>(await(await caches.open(key)).keys()).map(request=>new URL(request.url).pathname)))}));
 expect(paths.scope).toBe(url);expect(paths.assets.flat().length).toBeGreaterThanOrEqual(3);expect(paths.assets.flat().every(p=>p.startsWith('/StackBack/'))).toBe(true);
 await context.setOffline(true);await page.reload();await page.getByRole('button',{name:'Resume session'}).click();await expect(page.getByRole('heading',{name:'What kind of help is needed?'})).toBeVisible();
});
