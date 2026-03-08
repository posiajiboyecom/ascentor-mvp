// Ascentor Service Worker v3
// v3 changes: push + notificationclick handlers, subscription rotation
const CACHE_NAME  = 'ascentor-v3';
const OFFLINE_URL = '/offline';
const APP_ICON    = '/icons/icon-192.png';
const BADGE_ICON  = '/icons/icon-96.png';

const PRECACHE = ['/', '/dashboard', '/coach', '/offline', '/manifest.json'];

// ── Install ───────────────────────────────────────────────────
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then((c) => c.addAll(PRECACHE)));
  self.skipWaiting();
});

// ── Activate ──────────────────────────────────────────────────
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    )
  );
  self.clients.claim();
});

// ── Fetch — network-first for HTML, cache-first for assets ────
self.addEventListener('fetch', (e) => {
  const { request } = e;
  const url = new URL(request.url);

  // Skip: non-GET, API, auth, external services
  if (
    request.method !== 'GET' ||
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/auth/') ||
    url.hostname.includes('supabase') ||
    url.hostname.includes('anthropic') ||
    url.hostname.includes('googleapis')
  ) return;

  // Static assets → cache-first
  if (/\.(js|css|png|jpg|jpeg|svg|gif|webp|woff2?|ttf|ico)$/.test(url.pathname)) {
    e.respondWith(
      caches.match(request).then((hit) => {
        if (hit) return hit;
        return fetch(request).then((res) => {
          if (res.ok) caches.open(CACHE_NAME).then((c) => c.put(request, res.clone()));
          return res;
        });
      })
    );
    return;
  }

  // HTML pages → network-first, fallback to cache, then offline page
  if (request.headers.get('accept')?.includes('text/html')) {
    e.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok) caches.open(CACHE_NAME).then((c) => c.put(request, res.clone()));
          return res;
        })
        .catch(() =>
          caches.match(request).then((hit) => hit || caches.match(OFFLINE_URL))
        )
    );
    return;
  }

  e.respondWith(fetch(request).catch(() => caches.match(request)));
});

// ── Push — show a native OS notification ──────────────────────
// The server sends a JSON payload: { title, body, url, icon, tag }
self.addEventListener('push', (e) => {
  let payload = {
    title: 'Ascentor',
    body:  'You have a new update',
    url:   '/dashboard',
    icon:  APP_ICON,
    tag:   'ascentor',
  };

  try {
    if (e.data) Object.assign(payload, e.data.json());
  } catch {
    if (e.data) payload.body = e.data.text();
  }

  e.waitUntil(
    self.registration.showNotification(payload.title, {
      body:               payload.body,
      icon:               payload.icon || APP_ICON,
      badge:              BADGE_ICON,
      tag:                payload.tag,
      renotify:           true,
      requireInteraction: false,
      data:               { url: payload.url },
      vibrate:            [100, 60, 100],
      // action buttons (visible on Android, ignored on iOS)
      actions: [
        { action: 'open',    title: 'Open'    },
        { action: 'dismiss', title: 'Dismiss' },
      ],
    })
  );
});

// ── Notification click — focus/open the app ───────────────────
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  if (e.action === 'dismiss') return;

  const target = e.notification.data?.url || '/dashboard';

  e.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((wins) => {
        // Focus any open window from this origin
        const existing = wins.find((w) => {
          try { return new URL(w.url).origin === self.location.origin; }
          catch { return false; }
        });

        if (existing) {
          existing.navigate(target);
          return existing.focus();
        }
        return clients.openWindow(target);
      })
  );
});

// ── Push subscription change — browser rotated keys ──────────
// This fires when the browser invalidates the old subscription
// (rare but happens). We re-subscribe and save the new endpoint.
self.addEventListener('pushsubscriptionchange', (e) => {
  e.waitUntil(
    self.registration.pushManager
      .subscribe({ userVisibleOnly: true })
      .then((sub) =>
        fetch('/api/push/subscribe', {
          method:      'POST',
          headers:     { 'Content-Type': 'application/json' },
          credentials: 'include',
          body:        JSON.stringify({ subscription: sub.toJSON() }),
        })
      )
      .catch((err) => console.error('[sw] pushsubscriptionchange error:', err))
  );
});
