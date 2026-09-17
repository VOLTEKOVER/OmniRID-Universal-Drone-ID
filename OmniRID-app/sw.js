'use strict';

const CACHE = 'omnirid-v1';
const CORE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './src/decoder.js',
  './src/tracker.js',
  './src/capture.js',
  './src/app.js',
  './renderer/style.css',
  './images/logo.svg',
  './images/logo_with_text.svg',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  e.respondWith(
    caches.match(req).then((cached) => {
      const fetched = fetch(req)
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(req, clone)).catch(() => {});
          return res;
        })
        .catch(() => cached || caches.match('./'));
      return cached || fetched;
    })
  );
});