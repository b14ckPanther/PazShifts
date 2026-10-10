/* global self, caches, URL, fetch, Response, clients */
/* Offline help only. Never cache authenticated pages, API responses, or attendance writes. */
const OFFLINE_CACHE = 'yellowshifts-offline-v1';
self.addEventListener('install', (event) => {
  // Take over at once so a new push handler is live without waiting for every tab to close.
  self.skipWaiting?.();
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

/* Web Push: show the worker's notification; a tap opens (or focuses) the app on its screen. */
self.addEventListener('push', (event) => {
  let data;
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }
  const url =
    typeof data.url === 'string' && data.url.startsWith('/') && !data.url.startsWith('//')
      ? data.url
      : '/home';
  event.waitUntil(
    self.registration.showNotification(data.title || 'YellowShifts', {
      body: data.body || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      dir: 'rtl',
      lang: 'he',
      tag: data.tag || undefined,
      data: { url },
    })
  );
});
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || '/home', self.location.origin).href;
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      const open = windows.find((w) => new URL(w.url).origin === self.location.origin);
      if (open) return open.focus().then((w) => (w || open).navigate?.(target));
      return clients.openWindow(target);
    })
  );
});
