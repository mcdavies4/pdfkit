// RightPDFKit Service Worker
// v2 — self-destructing: wipes all old caches (including any stale
// cached HTML that may have contained outdated ad scripts), then
// unregisters itself so the browser always fetches fresh from network.

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    (async () => {
      // Delete every cache this origin has ever created
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));

      // Unregister this service worker entirely
      await self.registration.unregister();

      // Force every open tab to reload with a fresh, uncached copy
      const clientsList = await self.clients.matchAll({ type: 'window' });
      clientsList.forEach(client => client.navigate(client.url));
    })()
  );
});

// No fetch handler — all requests go straight to network.
