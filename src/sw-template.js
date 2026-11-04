/* Build injects CACHE_NAME and ASSETS. No user files or remote resources are cached. */
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(ASSETS))));
self.addEventListener('activate',event=>event.waitUntil((async()=>{for(const k of await caches.keys())if(k.startsWith('stackback-')&&k!==CACHE_NAME)await caches.delete(k);await self.clients.claim()})()));
self.addEventListener('message',event=>{if(event.data==='APPLY_UPDATE')self.skipWaiting();if(event.data==='CACHE_STATUS')event.ports[0]?.postMessage({ready:true,cache:CACHE_NAME})});
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url);
 if(event.request.method!=='GET'||url.origin!==self.location.origin)return;
 event.respondWith((async()=>{const cache=await caches.open(CACHE_NAME);if(event.request.mode==='navigate')return (await cache.match('/index.html'))||fetch(event.request);return (await cache.match(event.request,{ignoreSearch:true,ignoreVary:true}))||fetch(event.request)})());
});

