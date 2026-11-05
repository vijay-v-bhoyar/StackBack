import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';

/** Native worker updates bypass Playwright route interception. Serve real script versions. */
export async function updateServer(){
 let next=false;const versions:number[]=[];const dist=process.env.STACKBACK_TEST_DIST||path.join(process.cwd(),'dist');
 const server=createServer(async(req,res)=>{
  const name=new URL(req.url!,'http://127.0.0.1').pathname;
  const allowed=name==='/'||name==='/index.html'||name==='/sw.js'||/^\/assets\/[A-Za-z0-9_-]+\.(js|css)$/.test(name);
  if(!allowed){res.writeHead(404);res.end();return}
  try{let bytes=await readFile(path.join(dist,name==='/'?'index.html':name.slice(1)));
   if(name==='/sw.js'){versions.push(next?2:1);if(next)bytes=Buffer.concat([bytes,Buffer.from("\nself.addEventListener('message',e=>{if(e.data==='C04_ID')e.ports[0]?.postMessage('C04_UPDATED')});")])}
   const type=name.endsWith('.js')?'application/javascript':name.endsWith('.css')?'text/css':'text/html';res.writeHead(200,{'Content-Type':type,'Cache-Control':'no-store'});res.end(bytes);
  }catch{res.writeHead(404);res.end()}
 });
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));const address=server.address();if(!address||typeof address==='string')throw new Error('Fixture server did not bind');
 return {url:'http://127.0.0.1:'+address.port+'/',versions,publishNext(){next=true},async close(){server.closeAllConnections();await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()))}};
}
