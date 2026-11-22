// Service Worker لتطبيق «على بابك»: يخزّن هيكل التطبيق لتشغيل أسرع وصفحة بديلة عند انقطاع الإنترنت.
// لا يخزّن أي طلبات لـ Firebase أو Google (البيانات دايمًا طازجة من الخادم).
// عند تعديل index.html غيّر رقم VERSION ليتحدّث الكاش عند المستخدمين.
const VERSION = 'v3-marketer-fixes';
const CACHE = 'alababak-' + VERSION;
const SHELL = ['/', '/index.html', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png', '/icons/apple-touch-icon.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => Promise.all(SHELL.map((u) => cache.add(u).catch(() => null)))).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('alababak-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // Firebase / Google Fonts / Maps: مباشرة من الشبكة

  // تنقّل بين الصفحات: الشبكة أولًا (آخر نسخة)، وعند الانقطاع نعرض نسخة التطبيق المخزّنة
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put('/index.html', copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match('/index.html').then((r) => r || caches.match('/')))
    );
    return;
  }

  // ملفات ثابتة (أيقونات، manifest): من الكاش مع تحديث في الخلفية
  event.respondWith(
    caches.match(req).then((cached) => {
      const fresh = fetch(req).then((res) => {
        if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {}); }
        return res;
      }).catch(() => cached);
      return cached || fresh;
    })
  );
});
