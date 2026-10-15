'use client';

// Registers the service worker for the member app. Without it a phone cannot receive a push notification or be installed
// as an app. It does nothing in development (a service worker there only gets in the way of hot reload).

import { useEffect } from 'react';

export default function PushBootstrap() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js').catch((err) => console.error('[sw] registration failed:', err));
  }, []);
  return null;
}
