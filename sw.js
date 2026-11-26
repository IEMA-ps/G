// Cache only public local app files. Never cache Firebase data, auth requests or external resources.
const CACHE='alababak-services-v42';
const SHELL=['/terms.html','/terms-consent.js','/terms-consent.css','/marketer-benefits.js','/services.js','/ad-slots.js','/store-hours.js','/favorites.js','/marketer-contest.js','/marketer-insights.js','/order-timeline.js','/merchant-ratings.js','/feature-flags.js','/push-client.js','/broadcast-audience.js','/order-tx.js','/order-money.js','/delivery-batch.js','/admin-panel.js','/admin-panel.css','/shared-catalog.js','/shared-catalog-ui.js','/shared-catalog.css','/product-list.js','/product-sheet.js','/product-sheet-ui.js','/product-list.css','/marketer-program.js','/marketer-program-ui.js','/referral-report.js','/navigation-history.js','/store-link-codes.js','/store-sharing.js','/store-types.js','/app-routes.js','/nearby-stores.js','/egypt-locations.js','/egypt-locations-data.js','/password-policy.js','/founding-merchants.js','/member-roles.js','/support-requests.js','/telegram-notify.js','/auth-policy.js','/store.html','/merchant-plans.js','/','/index.html','/manifest.webmanifest','/icon-192.png','/icon-512.png','/maskable-512.png','/apple-touch-icon.png','/icon.svg','/qrcode.js','/marketer-tools.js','/marketing-config.js','/pwa-install.js','/brand.css','/brand.js','/logo.svg','/logo-reverse.svg'];
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

self.addEventListener('push',event=>{
 let d={};try{d=event.data?event.data.json():{};}catch(e){try{d={message:event.data.text()};}catch(_){}}
 const title=String(d.title||'على بابك').slice(0,100),body=String(d.message||d.body||'').slice(0,300);
 event.waitUntil(self.registration.showNotification(title,{body,icon:'/icon-192.png',badge:'/icon-192.png',dir:'rtl',lang:'ar',tag:d.tag||undefined}));
});
self.addEventListener('notificationclick',event=>{
 event.notification.close();
 event.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(list=>{for(const c of list){if('focus' in c) return c.focus();}return self.clients.openWindow('/');}));
});
