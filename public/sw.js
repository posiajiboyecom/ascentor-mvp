// Ascentor Service Worker v2 — with Web Push
const CACHE_NAME  = 'ascentor-v2';
const OFFLINE_URL = '/offline';

const PRECACHE_URLS = ['/', '/dashboard', '/coach', '/offline', '/manifest.json'];

// ═══ INSTALL ═══
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

// ═══ ACTIVATE ═══
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    )
  );
  self.clients.claim();
});

// ═══ FETCH ═══
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (
    request.method !== 'GET' ||
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/auth/') ||
    url.hostname.includes('supabase') ||
    url.hostname.includes('anthropic')
  ) return;

  if (url.pathname.match(/\.(js|css|png|jpg|jpeg|svg|gif|webp|woff2?|ttf|ico)$/)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((res) => {
          if (res.ok) caches.open(CACHE_NAME).then((c) => c.put(request, res.clone()));
          return res;
        });
      })
    );
    return;
  }

  if (request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok) caches.open(CACHE_NAME).then((c) => c.put(request, res.clone()));
          return res;
        })
        .catch(() => caches.match(request).then((c) => c || caches.match(OFFLINE_URL)))
    );
    return;
  }

  event.respondWith(fetch(request).catch(() => caches.match(request)));
});

// ═══ PUSH — fires when server sends a push message ═══
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let data = {};
  try { data = event.data.json(); } catch { data = { title: 'Ascentor', body: event.data.text() }; }

  const { title = 'Ascentor', body = '', icon, url, tag, badge } = data;

  const options = {
    body,
    icon:    icon  || '/icons/icon-192.png',
    badge:         '/icons/icon-96.png',
    tag:     tag   || 'ascentor-default',
    data:    { url: url || '/dashboard' },
    vibrate: [100, 50, 100],
    requireInteraction: false,
    actions: url ? [{ action: 'open', title: 'View' }] : [],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// ═══ NOTIFICATION CLICK ═══
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/dashboard';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If app is already open, focus it and navigate
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus();
          client.navigate(targetUrl);
          return;
        }
      }
      // Otherwise open a new window
      if (clients.openWindow) return clients.openWindow(targetUrl);
    })
  );
});

// ═══ PUSH SUBSCRIPTION CHANGE (auto-renew) ═══
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    self.registration.pushManager.subscribe({ userVisibleOnly: true })
      .then((sub) =>
        fetch('/api/push/subscribe', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ subscription: sub }),
        })
      )
  );
});
