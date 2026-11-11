'use client';

// Registers the service worker for the member app. Without it a phone cannot receive a push notification or be installed
// as an app. It does nothing in development (a service worker there only gets in the way of hot reload).
//
// It also re-syncs this device's push subscription once per app open, when notifications are already allowed:
//  - the server may have dropped the device (an expired endpoint, or an older bug that deleted devices on any error),
//  - the phone may have switched accounts, so the device must belong to whoever is signed in now,
//  - the browser may have replaced the subscription without telling us.
// Permission is never asked for here; that only happens when the member turns notifications on in Settings.

import { useEffect } from 'react';

function keyBytes(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

const SYNCED = 'ascentor-push-synced';

async function syncPush(reg: ServiceWorkerRegistration) {
  if (!('PushManager' in window) || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  try { if (sessionStorage.getItem(SYNCED)) return; } catch { /* storage blocked: sync anyway */ }
  const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  let sub = await reg.pushManager.getSubscription();
  if (!sub && vapid) {
    // Allowed before, but no subscription on this device any more: make a new one (no prompt, permission stands).
    sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(vapid).buffer as ArrayBuffer });
  }
  if (!sub) return;
  const res = await fetch('/api/push/subscribe', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
    body: JSON.stringify({ subscription: sub.toJSON() }),
  });
  if (res.ok) { try { sessionStorage.setItem(SYNCED, '1'); } catch { /* fine */ } }
}

export default function PushBootstrap() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js')
      .then(() => navigator.serviceWorker.ready)
      .then((reg) => syncPush(reg))
      .catch((err) => console.error('[sw] registration or push sync failed:', err));
  }, []);
  return null;
}
