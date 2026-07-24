const CACHE = 'baankuptan-v4';
const ASSETS = [
  '/delivery-note/',
  '/delivery-note/index.html',
  '/delivery-note/history.html',
  '/delivery-note/settings.html',
  '/delivery-note/print.html',
  '/delivery-note/css/style.css',
  '/delivery-note/css/print.css',
  '/delivery-note/js/app.js',
  '/delivery-note/js/api.js',
  '/delivery-note/js/bill.js',
  '/delivery-note/js/print.js',
  '/delivery-note/js/history.js',
  '/delivery-note/js/settings.js',
  '/delivery-note/icon.svg',
  '/delivery-note/manifest.json'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});

// Network-first: ใช้ข้อมูลสด, fallback cache ถ้า offline
// ข้าม Apps Script API ไม่ให้ถูก cache
self.addEventListener('fetch', e => {
  if (e.request.url.includes('script.google.com') ||
      e.request.url.includes('script.googleusercontent.com') ||
      e.request.url.includes('googleapis.com')) return;

  e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
});
