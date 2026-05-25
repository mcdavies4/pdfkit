// RightPDFKit Service Worker
// Bump this version number on every deploy to clear old cache
const CACHE_VERSION = 'rpk-v51-2026-05-24';
const CACHE_NAME = CACHE_VERSION;

const CORE_FILES = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.ico',
  '/apple-touch-icon.png',
  '/og-image.png',
];

// Install — cache core files
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(CORE_FILES))
      .then(() => self.skipWaiting()) // activate immediately
  );
});

// Activate — delete ALL old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => {
            console.log('[SW] Deleting old cache:', key);
            return caches.delete(key);
          })
      )
    ).then(() => self.clients.claim()) // take control immediately
  );
});

// Fetch — network first, cache fallback
// This ensures users always get the latest version if online
self.addEventListener('fetch', event => {
  // Skip non-GET and cross-origin requests
  if (event.request.method !== 'GET') return;
  if (!event.request.url.startsWith(self.location.origin)) return;

  // For index.html — always try network first
  // This ensures new tool versions are seen immediately
  if (event.request.url.endsWith('/') ||
      event.request.url.endsWith('/index.html') ||
      event.request.url.includes('/?') ||
      event.request.url.match(/rightpdfkit\.com\/?$/)) {

    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Cache the fresh version
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        })
        .catch(() => {
          // Network failed — serve cached version (offline mode)
          return caches.match('/index.html') || caches.match('/');
        })
    );
    return;
  }

  // For everything else — cache first, network fallback
  event.respondWith(
    caches.match(event.request)
      .then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        });
      })
  );
});
