// Cache only public local app files. Never cache Firebase data, auth requests or external resources.
const CACHE='alababak-short-store-v1';
const SHELL=['/navigation-history.js','/store-link-codes.js','/store-sharing.js','/store-types.js','/app-routes.js','/nearby-stores.js','/egypt-locations.js','/egypt-locations-data.js','/password-policy.js','/founding-merchants.js','/member-roles.js','/support-requests.js','/auth-policy.js','/store.html','/merchant-plans.js','/','/index.html','/manifest.webmanifest','/icon-192.png','/icon-512.png','/maskable-512.png','/apple-touch-icon.png','/icon.svg','/qrcode.js','/marketer-tools.js','/marketing-config.js','/pwa-install.js','/brand.css','/brand.js','/logo.svg','/logo-reverse.svg'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('alababak-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
 const req=event.request,url=new URL(req.url);
 if(req.method!=='GET'||url.origin!==self.location.origin) return;
 if(req.mode==='navigate' && (url.pathname==='/' || url.pathname==='/index.html' || /^\/(customer|merchant|delivery|marketer|admin)\//.test(url.pathname) || /^\/(login|register)\/?$/.test(url.pathname))){
  event.respondWith(fetch(req).then(res=>{if(res.ok){const copy=res.clone();event.waitUntil(caches.open(CACHE).then(c=>c.put('/index.html',copy)));}return res;}).catch(()=>caches.match('/index.html')));
  return;
 }
 if(!SHELL.includes(url.pathname)) return;
 // Network-first prevents an old HTML/new module mix during updates.
 event.respondWith(fetch(req).then(res=>{if(res.ok){const copy=res.clone();event.waitUntil(caches.open(CACHE).then(c=>c.put(req,copy)));}return res;}).catch(()=>caches.match(req)));
});
