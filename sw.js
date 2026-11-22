/*
 * Retired service worker.
 *
 * Earlier versions of this site registered a service worker that cached pages
 * for offline use and could serve stale content. Browsers that still have it
 * installed will fetch this file on their next update check; this version
 * deletes the old caches and unregisters itself. It has no fetch handler, so
 * all requests go straight to the network.
 *
 * Keep this file at /sw.js until old registrations have aged out.
 */
self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
      .then(() => self.registration.unregister())
  );
});
