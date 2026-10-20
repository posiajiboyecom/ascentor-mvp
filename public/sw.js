// Ascentor Service Worker v5
//
// v5 (weak network and offline):
//  - Precaches only the static shell (/offline, manifest, icons). Never '/' or '/dashboard': that HTML is per user.
//  - Member pages: network first with a 3 second timeout, then the last saved copy of that page, then /offline.
//  - Saved member pages are private to the signed-in person. The app posts 'clear-user-cache' on sign-out and on
//    account switch, which deletes them. They are also dropped on every version bump.
//  - Static assets: cache first with a size cap. Hashed /_next/static files are immutable.
//  - Never touches: non-GET, /api, /auth, sign-in and payment routes, RSC / prefetch requests, Range requests,
//    third-party hosts, or any asset marked no-store. (Member pages are the one deliberate exception to no-store:
//    Next marks every signed-in page no-store, and saving them is the point. See clear-user-cache.)
//  - Writes are never timed out, retried or queued here. The 3 second limit applies to page navigation only.
// v4 (kept): non-GET requests and js.paystack.co are never intercepted.

const VERSION      = 'v5';
const STATIC_CACHE = `ascentor-static-${VERSION}`;
const PAGES_CACHE  = `ascentor-pages-${VERSION}`;
const KEEP_CACHES  = [STATIC_CACHE, PAGES_CACHE];
const OFFLINE_URL  = '/offline';
const APP_ICON     = '/icons/icon-192.png';
const BADGE_ICON   = '/icons/icon-96.png';

const PRECACHE = [OFFLINE_URL, '/manifest.json', APP_ICON, BADGE_ICON];
const NAV_TIMEOUT_MS = 3000;
const MAX_STATIC_ENTRIES = 150;
const MAX_PAGE_ENTRIES = 30;

// Per-user member pages that may be saved on the device (first path segment).
const MEMBER_ROOTS = ['dashboard', 'circle', 'learn', 'sessions', 'community', 'store', 'growth', 'settings', 'announcements', 'messages'];

// Never cached and never answered from cache.
const NEVER_PREFIXES = [
  '/api', '/auth', '/admin', '/admin-login', '/login', '/signup', '/forgot-password', '/reset-password',
  '/checkout', '/payment', '/shop/thanks', '/call',
];

const PASSTHROUGH_HOSTS = [
  'supabase.co', 'anthropic.com', 'googleapis.com', 'gstatic.com', 'paystack.co',
  'plausible.io', 'bufferapp.com', 'cloudflare.com',
];

// Pages where a member may be paying: do not swap the service worker under them.
const PAYMENT_PATH = /^\/(checkout|payment|pay|shop|settings\/billing)(\/|$)/;

function underPrefix(path, prefix) { return path === prefix || path.startsWith(prefix + '/'); }
function isNever(path) { return NEVER_PREFIXES.some((p) => underPrefix(path, p)); }
function isMemberPage(path) {
  const seg = path.split('/')[1] || '';
  return MEMBER_ROOTS.includes(seg);
}
function isRscOrPrefetch(request, url) {
  const h = request.headers;
  return (
    h.has('rsc') || h.has('next-router-prefetch') || h.has('next-router-state-tree') ||
    (h.get('accept') || '').includes('text/x-component') ||
    url.searchParams.has('_rsc') || h.get('purpose') === 'prefetch'
  );
}
function noStore(res) { return /no-store/i.test(res.headers.get('cache-control') || ''); }

async function trim(cacheName, max) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - max; i++) await cache.delete(keys[i]);
}

// ── Install ───────────────────────────────────────────────────
self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(STATIC_CACHE);
    // One bad asset must not fail the install.
    await Promise.all(PRECACHE.map((u) => cache.add(u).catch(() => undefined)));
    // Replace v4 straight away unless someone is on a checkout or payment page; then wait for them to finish.
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const paying = wins.some((w) => { try { return PAYMENT_PATH.test(new URL(w.url).pathname); } catch { return false; } });
    if (!paying) await self.skipWaiting();
  })());
});

// ── Activate ──────────────────────────────────────────────────
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter((n) => !KEEP_CACHES.includes(n)).map((n) => caches.delete(n)));
    await self.clients.claim();
  })());
});

// ── Messages from the app ─────────────────────────────────────
self.addEventListener('message', (e) => {
  const type = e.data && e.data.type;
  if (type === 'clear-user-cache') {
    e.waitUntil(caches.delete(PAGES_CACHE));
  } else if (type === 'skip-waiting') {
    self.skipWaiting();
  }
});

// ── Fetch ─────────────────────────────────────────────────────
self.addEventListener('fetch', (e) => {
  const { request } = e;

  // CRITICAL: never intercept non-GET (POST /api/pay/start etc. must go straight to the network).
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (PASSTHROUGH_HOSTS.some((h) => url.hostname.includes(h))) return;
  if (request.headers.has('range')) return;            // audio / video
  if (isRscOrPrefetch(request, url)) return;            // Next.js client navigations and prefetches
  if (isNever(url.pathname)) return;

  // Static assets: cache first.
  if (url.pathname.startsWith('/_next/static/') || /\.(js|css|png|jpg|jpeg|svg|gif|webp|avif|woff2?|ttf|ico)$/.test(url.pathname)) {
    e.respondWith(staticAsset(request));
    return;
  }

  const wantsHtml = request.mode === 'navigate' || (request.headers.get('accept') || '').includes('text/html');
  if (!wantsHtml) return;

  if (isMemberPage(url.pathname)) {
    e.respondWith(memberPage(e, request));
    return;
  }

  // Any other page (marketing, public): straight to the network, the offline page if there is none.
  e.respondWith(fetch(request).catch(async () => (await caches.match(OFFLINE_URL)) || Response.error()));
});

async function staticAsset(request) {
  const hit = await caches.match(request, { cacheName: STATIC_CACHE });
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok && res.type === 'basic' && !noStore(res)) {
    const copy = res.clone();   // clone synchronously, before the body is consumed
    caches.open(STATIC_CACHE).then((c) => c.put(request, copy)).then(() => trim(STATIC_CACHE, MAX_STATIC_ENTRIES)).catch(() => undefined);
  }
  return res;
}

async function memberPage(e, request) {
  const cache = await caches.open(PAGES_CACHE);
  const cached = await cache.match(request);

  const network = fetch(request).then((res) => {
    // Save only a plain 200 HTML page for this exact URL. A redirect (for example to /login) is never saved.
    const type = res.headers.get('content-type') || '';
    if (res.ok && res.status === 200 && !res.redirected && type.includes('text/html')) {
      const copy = res.clone();
      cache.put(request, copy).then(() => trim(PAGES_CACHE, MAX_PAGE_ENTRIES)).catch(() => undefined);
    }
    return res;
  });
  // Let a slow request finish and refresh the saved copy even when we answered from the cache.
  e.waitUntil(network.catch(() => undefined));

  if (!cached) {
    return network.catch(async () => (await caches.match(OFFLINE_URL)) || Response.error());
  }
  const timeout = new Promise((resolve) => setTimeout(() => resolve(cached), NAV_TIMEOUT_MS));
  return Promise.race([network.then((r) => (r.status >= 500 ? cached : r)), timeout]).catch(() => cached);
}

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
