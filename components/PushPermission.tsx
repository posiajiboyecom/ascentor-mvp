'use client';

// PushPermission.tsx
// Asks the user to enable native phone notifications.
// Shows a card that slides up above the bottom nav.
// Only displayed when:
//   - browser supports push (serviceWorker + PushManager + Notification)
//   - permission is 'default' (not yet decided)
//   - user hasn't previously dismissed or subscribed
//
// Exports usePush() hook for use in settings pages.

import { useState, useEffect, useCallback } from 'react';

export type PushState = 'idle' | 'requesting' | 'granted' | 'denied' | 'unsupported';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw     = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

// ── usePush hook ─────────────────────────────────────────────
// Can be used in settings pages to show a toggle.
export function usePush() {
  const [state, setState] = useState<PushState>('idle');

  // Read current permission state on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (
      !('Notification' in window) ||
      !('serviceWorker' in navigator) ||
      !('PushManager' in window)
    ) {
      setState('unsupported');
      return;
    }
    try {
      const p = (window as any).Notification.permission;
      if (p === 'granted') setState('granted');
      else if (p === 'denied') setState('denied');
      // else stays 'idle'
    } catch {
      setState('unsupported');
    }
  }, []);

  const subscribe = useCallback(async (): Promise<boolean> => {
    try {
      setState('requesting');

      // Step 1: ask OS permission
      const permission = await (window as any).Notification.requestPermission();
      if (permission !== 'granted') {
        setState('denied');
        return false;
      }

      // Step 2: get or create push subscription
      const reg      = await navigator.serviceWorker.ready;
      const existing = await reg.pushManager.getSubscription();

      let sub = existing;
      if (!sub) {
        const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
        if (!vapidKey) {
          console.error('[push] NEXT_PUBLIC_VAPID_PUBLIC_KEY is not set');
          setState('idle');
          return false;
        }
        sub = await reg.pushManager.subscribe({
          userVisibleOnly:      true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey).buffer as ArrayBuffer,
        });
      }

      // Step 3: save subscription to DB via API route
      const res = await fetch('/api/push/subscribe', {
        method:      'POST',
        headers:     { 'Content-Type': 'application/json' },
        credentials: 'include',
        body:        JSON.stringify({ subscription: sub.toJSON() }),
      });

      if (!res.ok) throw new Error(`subscribe API returned ${res.status}`);

      setState('granted');
      localStorage.setItem('push_granted', '1');
      return true;
    } catch (err: any) {
      console.error('[push] subscribe error:', err?.message);
      setState('idle');
      return false;
    }
  }, []);

  const unsubscribe = useCallback(async (): Promise<void> => {
    try {
      if (!('serviceWorker' in navigator)) return;
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await sub.unsubscribe();
        await fetch('/api/push/unsubscribe', {
          method:      'POST',
          headers:     { 'Content-Type': 'application/json' },
          credentials: 'include',
          body:        JSON.stringify({ endpoint: sub.endpoint }),
        });
      }
      setState('idle');
      localStorage.removeItem('push_granted');
    } catch (err: any) {
      console.error('[push] unsubscribe error:', err?.message);
    }
  }, []);

  return { state, subscribe, unsubscribe };
}

// ── Banner component ─────────────────────────────────────────
export default function PushPermission() {
  const { state, subscribe } = usePush();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Must support push
    if (
      !('Notification' in window) ||
      !('serviceWorker' in navigator) ||
      !('PushManager' in window)
    ) return;

    // Must not have already decided
    try {
      if ((window as any).Notification.permission !== 'default') return;
    } catch { return; }

    // Must not have already subscribed or permanently dismissed
    if (localStorage.getItem('push_granted'))    return;
    if (localStorage.getItem('push_snoozed')) {
      const until = parseInt(localStorage.getItem('push_snoozed')!, 10);
      if (Date.now() < until) return;
      localStorage.removeItem('push_snoozed');
    }

    // Show sooner when running as installed PWA (standalone)
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as any).standalone === true;

    const delay = isStandalone ? 3000 : 8000;
    const timer = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(timer);
  }, []);

  const handleEnable = async () => {
    setVisible(false);
    await subscribe();
    // If denied, snooze for 30 days so we don't nag
    if ((window as any).Notification?.permission === 'denied') {
      localStorage.setItem('push_snoozed', String(Date.now() + 30 * 86_400_000));
    }
  };

  const handleSnooze = () => {
    // Snooze for 3 days
    localStorage.setItem('push_snoozed', String(Date.now() + 3 * 86_400_000));
    setVisible(false);
  };

  if (!visible) return null;
  if (state === 'unsupported' || state === 'granted' || state === 'denied') return null;

  return (
    <>
      <style>{`
        @keyframes _push-in {
          from { opacity: 0; transform: translateX(-50%) translateY(16px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>
      <div
        role="dialog"
        aria-label="Enable push notifications"
        style={{
          position:    'fixed',
          // Sit above the 72 px bottom nav + safe area
          bottom:      'calc(80px + env(safe-area-inset-bottom, 0px))',
          left:        '50%',
          transform:   'translateX(-50%)',
          width:       'min(420px, calc(100vw - 20px))',
          background:  'var(--bg-card, #1E1C17)',
          border:      '1px solid rgba(232,160,32,0.28)',
          borderRadius: 14,
          padding:     '13px 14px',
          zIndex:      9900,
          boxShadow:   '0 8px 40px rgba(0,0,0,0.6)',
          animation:   '_push-in 0.38s cubic-bezier(0.16,1,0.3,1) both',
          display:     'flex',
          alignItems:  'center',
          gap:         12,
        }}
      >
        {/* Bell */}
        <div style={{
          flexShrink:      0,
          width:           40,
          height:          40,
          borderRadius:    '50%',
          background:      'rgba(232,160,32,0.10)',
          border:          '1px solid rgba(232,160,32,0.25)',
          display:         'flex',
          alignItems:      'center',
          justifyContent:  'center',
        }}>
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none"
            stroke="#E8A020" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
          </svg>
        </div>

        {/* Text */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{
            margin: '0 0 2px',
            fontFamily: "'Syne', system-ui, sans-serif",
            fontSize: 13, fontWeight: 700,
            color: 'var(--text, #F5F3EE)',
          }}>
            Stay in the loop
          </p>
          <p style={{
            margin: 0,
            fontFamily: "'DM Mono', monospace",
            fontSize: 10,
            color: 'var(--text-dim, #7A7260)',
            letterSpacing: '0.02em',
            lineHeight: 1.5,
          }}>
            Replies, upvotes &amp; circle activity — straight to your phone
          </p>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <button
            onClick={handleEnable}
            disabled={state === 'requesting'}
            style={{
              padding:     '8px 15px',
              background:  '#E8A020',
              color:       '#000',
              border:      'none',
              borderRadius: 9,
              fontFamily:  "'Syne', system-ui, sans-serif",
              fontSize:    12,
              fontWeight:  700,
              cursor:      'pointer',
              whiteSpace:  'nowrap',
              opacity:     state === 'requesting' ? 0.7 : 1,
            }}
          >
            {state === 'requesting' ? '…' : 'Enable'}
          </button>
          <button
            onClick={handleSnooze}
            aria-label="Dismiss"
            style={{
              width:        34,
              height:       34,
              background:   'transparent',
              border:       '1px solid var(--border, rgba(212,207,195,0.10))',
              borderRadius: 8,
              color:        'var(--text-dim, #4A4438)',
              fontSize:     15,
              cursor:       'pointer',
              display:      'flex',
              alignItems:   'center',
              justifyContent: 'center',
              fontFamily:   'system-ui',
            }}
          >
            ✕
          </button>
        </div>
      </div>
    </>
  );
}
