// Ascentor Service Worker v4
// v4 changes: explicitly skip ALL non-GET requests (fixes POST /api/pay/start being swallowed)
//             explicitly skip js.paystack.co (fixes CSP violation on SW fetch intercept)
//             bumped CACHE_NAME so all v3 clients re-install immediately

const CACHE_NAME  = 'ascentor-v4';   // <-- bumped from v3 — forces old SW to die
const OFFLINE_URL = '/offline';
const APP_ICON    = '/icons/icon-192.png';
const BADGE_ICON  = '/icons/icon-96.png';

const PRECACHE = ['/', '/dashboard', '/coach', '/offline', '/manifest.json'];

// ── Install ───────────────────────────────────────────────────
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then((c) => c.addAll(PRECACHE)));
  self.skipWaiting();   // activate immediately, replacing any v3 SW
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

  // ── CRITICAL: Never intercept non-GET requests ────────────────
  // POST /api/pay/start (and any other mutations) must go straight
  // to the network. If the SW intercepts them it either returns a
  // cached GET response or a body-already-used error, which the
  // server receives as an empty body → planCode undefined →
  // Paystack returns "Invalid Amount Sent".
  if (request.method !== 'GET') return;

  // ── Skip all API / auth routes ────────────────────────────────
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/auth/')
  ) return;

  // ── Skip all external third-party origins ─────────────────────
  // js.paystack.co must be fetched directly — the SW has no
  // permission to cache cross-origin scripts and attempting to do
  // so triggers a CSP violation that blocks the Paystack popup.
  const PASSTHROUGH_HOSTS = [
    'supabase.co',
    'anthropic.com',
    'googleapis.com',
    'gstatic.com',
    'paystack.co',     // <-- was missing in v3 — caused CSP violation
    'plausible.io',
    'bufferapp.com',
    'cloudflare.com',
  ];
  if (PASSTHROUGH_HOSTS.some((h) => url.hostname.includes(h))) return;

  // ── Static assets → cache-first ──────────────────────────────
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

  // ── HTML pages → network-first, fallback to cache / offline ──
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

  // ── Everything else → network, fallback to cache ──────────────
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
