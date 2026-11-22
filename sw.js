// Cache only public local app files. Never cache Firebase data, auth requests or external resources.
const CACHE='alababak-v5-tools-pwa';
const SHELL=['/','/index.html','/manifest.webmanifest','/icon-192.png','/icon-512.png','/maskable-512.png','/apple-touch-icon.png','/icon.svg','/qrcode.js','/marketer-tools.js','/marketing-config.js','/pwa-install.js'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('alababak-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
 const req=event.request,url=new URL(req.url);
 if(req.method!=='GET'||url.origin!==self.location.origin) return;
 if(req.mode==='navigate'){
  event.respondWith(fetch(req).then(res=>{if(res.ok){const copy=res.clone();event.waitUntil(caches.open(CACHE).then(c=>c.put('/index.html',copy)));}return res;}).catch(()=>caches.match('/index.html')));
  return;
 }
 if(!SHELL.includes(url.pathname)) return;
 // Network-first prevents an old HTML/new module mix during updates.
 event.respondWith(fetch(req).then(res=>{if(res.ok){const copy=res.clone();event.waitUntil(caches.open(CACHE).then(c=>c.put(req,copy)));}return res;}).catch(()=>caches.match(req)));
});
