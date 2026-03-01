'use client';

// ─────────────────────────────────────────────────────────────
// PushPermission.tsx
// Renders a subtle banner asking the user to enable push
// notifications. Only shown once; dismissed state is remembered.
// Also exports usePush() hook for use in other components.
// ─────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback } from 'react';

export type PushState = 'idle' | 'requesting' | 'granted' | 'denied' | 'unsupported';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw     = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

// ── Hook ─────────────────────────────────────────────────────
export function usePush() {
  const [state, setState] = useState<PushState>('idle');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    // Guard: Notification API missing in some mobile browsers / WebViews
    if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      setState('unsupported'); return;
    }
    try {
      if ((window as any).Notification.permission === 'granted') setState('granted');
      else if ((window as any).Notification.permission === 'denied') setState('denied');
    } catch {
      setState('unsupported');
    }
  }, []);

  const subscribe = useCallback(async (): Promise<boolean> => {
    try {
      setState('requesting');
      const permission = await (window as any).Notification.requestPermission();
      if (permission !== 'granted') { setState('denied'); return false; }

      const reg = await navigator.serviceWorker.ready;
      const existing = await reg.pushManager.getSubscription();
      if (existing) { setState('granted'); return true; }

      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidKey) { console.error('NEXT_PUBLIC_VAPID_PUBLIC_KEY not set'); setState('idle'); return false; }

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly:      true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey).buffer as ArrayBuffer,
      });

      const res = await fetch('/api/push/subscribe', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ subscription: sub.toJSON() }),
      });

      if (!res.ok) throw new Error('Failed to save subscription');
      setState('granted');
      localStorage.setItem('push_subscribed', '1');
      return true;
    } catch (err) {
      console.error('[push] subscribe error:', err);
      setState('idle');
      return false;
    }
  }, []);

  const unsubscribe = useCallback(async () => {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (!sub) return;
    await sub.unsubscribe();
    await fetch('/api/push/unsubscribe', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ endpoint: sub.endpoint }),
    });
    setState('idle');
    localStorage.removeItem('push_subscribed');
  }, []);

  return { state, subscribe, unsubscribe };
}

// ── Banner Component ─────────────────────────────────────────
export default function PushPermission() {
  const { state, subscribe } = usePush();
  const [dismissed, setDismissed] = useState(true); // start hidden, reveal after check

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const alreadySubscribed = localStorage.getItem('push_subscribed');
    const alreadyDismissed  = localStorage.getItem('push_dismissed');
    if (alreadySubscribed || alreadyDismissed) { setDismissed(true); return; }
    // Show banner only if permission not yet decided
    // Guard: Notification may not exist on this browser
    try {
      if (
        'Notification' in window &&
        'serviceWorker' in navigator &&
        'PushManager' in window &&
        (window as any).Notification.permission === 'default'
      ) {
        setDismissed(false);
      }
    } catch {
      // Notification API not supported — stay dismissed
    }
  }, []);

  const handleEnable = async () => {
    const ok = await subscribe();
    if (ok || !ok) setDismissed(true); // dismiss regardless of outcome
  };

  const handleDismiss = () => {
    localStorage.setItem('push_dismissed', '1');
    setDismissed(true);
  };

  if (dismissed || state === 'unsupported' || state === 'granted' || state === 'denied') return null;

  return (
    <>
      <style>{`
        @keyframes push-slide-up {
          from { opacity:0; transform:translateY(100%); }
          to   { opacity:1; transform:translateY(0); }
        }
      `}</style>
      <div style={{
        position:   'fixed',
        bottom:     0,
        left:       0,
        right:      0,
        background: '#1A1814',
        borderTop:  '1px solid rgba(232,160,32,0.2)',
        padding:    '12px 16px',
        paddingBottom: 'calc(12px + env(safe-area-inset-bottom))',
        zIndex:     9990,
        boxShadow:  '0 -8px 32px rgba(0,0,0,0.5)',
        animation:  'push-slide-up 0.35s ease both',
        display:    'flex',
        gap:        '12px',
        alignItems: 'center',
      }}>
        {/* Bell icon */}
        <div style={{
          width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
          background: 'rgba(232,160,32,0.1)',
          border: '1px solid rgba(232,160,32,0.25)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
            stroke="#E8A020" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{
            fontFamily: "'Syne', sans-serif",
            fontSize: 13, fontWeight: 600, color: '#FEF9EC', marginBottom: 1,
          }}>
            Enable notifications
          </p>
          <p style={{
            fontFamily: "'DM Mono', monospace",
            fontSize: 10, color: '#7A7260', lineHeight: 1.4,
            letterSpacing: '0.02em',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            Get notified when someone likes or replies to you
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <button
            onClick={handleEnable}
            disabled={state === 'requesting'}
            style={{
              padding: '8px 14px',
              background: '#E8A020', color: '#000',
              border: 'none', borderRadius: 8,
              fontFamily: "'Syne', sans-serif",
              fontSize: 12, fontWeight: 700, cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}>
            {state === 'requesting' ? '…' : 'Enable'}
          </button>
          <button
            onClick={handleDismiss}
            style={{
              padding: '8px 12px',
              background: 'transparent', color: '#4A4438',
              border: '1px solid #2E2A22', borderRadius: 8,
              fontFamily: "'DM Mono', monospace",
              fontSize: 11, cursor: 'pointer',
            }}>
            ✕
          </button>
        </div>
      </div>
    </>
  );
}
