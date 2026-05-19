// ===== Service Worker — Cache & Offline =====
const CACHE = 'portfolio-v1';
const SHELL = [
  './',
  './index.html',
  './dashboard.html',
  './transactions.html',
  './investments.html',
  './goals.html',
  './css/style.css',
  './js/storage.js',
  './js/firebase-config.js',
  './js/firebase-sync.js',
  './js/transactions.js',
  './js/dashboard.js',
  './js/investments.js',
  './js/goals.js',
  './manifest.webmanifest',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL).catch(() => {}))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  // Network-first for Firebase + chart libs + stocks data
  if (url.hostname.includes('firebase') || url.hostname.includes('gstatic') || url.hostname.includes('googleapis')) {
    return; // let network handle
  }
  // Cache-first for own assets
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then((cached) => {
      const fetchPromise = fetch(e.request).then((res) => {
        if (res && res.status === 200 && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return res;
      }).catch(() => cached);
      return cached || fetchPromise;
    })
  );
});
