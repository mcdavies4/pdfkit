// RightPDFKit Service Worker v2
// Cloudflare Pages handles caching — SW only handles offline for main app
const CACHE_VERSION = 'rpk-v51-2026-05-29';
const CACHE_NAME = CACHE_VERSION;

self.addEventListener('install', event => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // NEVER intercept blog pages — pass straight to network
  if (url.pathname.startsWith('/blog')) return;

  // NEVER intercept API calls
  if (url.pathname.startsWith('/api')) return;

  // Only handle the main app page
  if (url.pathname === '/' || url.pathname === '/index.html') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match('/index.html'))
    );
  }
  // Everything else goes to network directly
});
