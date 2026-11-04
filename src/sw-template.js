/* Build injects CACHE_NAME and ASSETS. No user files or remote resources are cached. */
const shellURLs=ASSETS.map(asset=>new URL(asset,self.location.href).href);
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(shellURLs))));
self.addEventListener('activate',event=>event.waitUntil((async()=>{for(const k of await caches.keys())if(k.startsWith('stackback-')&&k!==CACHE_NAME)await caches.delete(k);await self.clients.claim()})()));
self.addEventListener('message',event=>{
 if(event.data==='APPLY_UPDATE')self.skipWaiting();
 if(event.data==='PREPARE_CACHE'||event.data==='CACHE_STATUS')event.waitUntil((async()=>{
  try{
   const cache=await caches.open(CACHE_NAME);
   const missing=[];for(const url of shellURLs)if(!await cache.match(url))missing.push(url);
   if(missing.length&&event.data==='PREPARE_CACHE')await cache.addAll(missing);
   let ready=true;for(const url of shellURLs)if(!await cache.match(url))ready=false;
   event.ports[0]?.postMessage({ready,cache:CACHE_NAME});
  }catch{event.ports[0]?.postMessage({ready:false,cache:CACHE_NAME})}
 })());
});
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url);
 if(event.request.method!=='GET'||url.origin!==self.location.origin)return;
 event.respondWith((async()=>{const cache=await caches.open(CACHE_NAME);if(event.request.mode==='navigate')return (await cache.match(new URL('index.html',self.location.href).href))||fetch(event.request);return (await cache.match(event.request,{ignoreSearch:true,ignoreVary:true}))||fetch(event.request)})());
});

