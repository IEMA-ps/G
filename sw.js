// سيرفس وركر بسيط لتطبيق "على بابك" — بيخزن هيكل التطبيق الأساسي (app shell) عشان يفتح بسرعة
// وميعتبرش قابل للتثبيت (installable) على المتصفح. البيانات نفسها (منتجات، طلبات...) لسه بتيجي لايف من Firestore.

const CACHE_NAME = 'ala-babak-shell-v1';
const APP_SHELL = [
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// استراتيجية: الشبكة أولًا لأي طلب (عشان بيانات Firestore والصور تفضل محدّثة)،
// ولو الشبكة مش متاحة (offline) نرجع للنسخة المخزنة من هيكل التطبيق لو موجودة
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request).then((res) => res || caches.match('./index.html')))
  );
});
