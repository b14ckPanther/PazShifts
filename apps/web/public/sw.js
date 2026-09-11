/* global self, caches, URL, fetch, Response */
/* Offline help only. Never cache authenticated pages, API responses, or attendance writes. */
const OFFLINE_CACHE = 'yellowshifts-offline-v1';
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(OFFLINE_CACHE).then((cache) => cache.add('/offline.html')));
});
self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      caches
        .keys()
        .then((keys) =>
          Promise.all(
            keys
              .filter((key) => key.startsWith('yellowshifts-offline-') && key !== OFFLINE_CACHE)
              .map((key) => caches.delete(key))
          )
        ),
      self.clients.claim(),
    ])
  );
});
self.addEventListener('fetch', (event) => {
  if (
    event.request.method !== 'GET' ||
    event.request.mode !== 'navigate' ||
    new URL(event.request.url).origin !== self.location.origin
  )
    return;
  event.respondWith(
    fetch(event.request).catch(
      async () =>
        (await caches.match('/offline.html')) ||
        new Response('אין חיבור. התחברו ונסו שוב.', {
          status: 503,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        })
    )
  );
});
