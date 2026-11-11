'use client';

// Connection awareness: is the network offline, weak, or fine? Plus a data-saver flag and an "Updated 9:41 PM" label.
// Reads only. Nothing here changes how a write is sent.

import { useEffect, useState } from 'react';

export type NetState = 'good' | 'weak' | 'offline';

interface NetInfo {
  effectiveType?: string;
  rtt?: number;
  downlink?: number;
  saveData?: boolean;
  addEventListener?: (t: string, cb: () => void) => void;
  removeEventListener?: (t: string, cb: () => void) => void;
}

function connection(): NetInfo | undefined {
  if (typeof navigator === 'undefined') return undefined;
  const n = navigator as Navigator & { connection?: NetInfo; mozConnection?: NetInfo; webkitConnection?: NetInfo };
  return n.connection ?? n.mozConnection ?? n.webkitConnection;
}

/**
 * Weak by the browser's own estimate: only 2g or slower. Chrome's rtt and downlink figures are rough, rounded guesses
 * (a fast 4G connection in Lagos can report a downlink under 0.4 Mbps), so they never decide on their own; the app's
 * own pings below do.
 */
export function looksWeak(c: Pick<NetInfo, 'effectiveType' | 'rtt' | 'downlink'> | undefined): boolean {
  if (!c) return false;
  return c.effectiveType === 'slow-2g' || c.effectiveType === '2g';
}

const PING_TIMEOUT_MS = 3000;
const PING_EVERY_MS = 30000;

/** One ping to /api/health/ping. 'slow' covers both a timeout and a network error. */
async function ping(): Promise<'ok' | 'slow'> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), PING_TIMEOUT_MS);
  try {
    const res = await fetch(`/api/health/ping?t=${Date.now()}`, { cache: 'no-store', signal: ctrl.signal, credentials: 'omit' });
    return res.status === 204 || res.ok ? 'ok' : 'slow';
  } catch { return 'slow'; } finally { clearTimeout(timer); }
}

export function useNetState(): NetState {
  const [state, setState] = useState<NetState>('good');

  useEffect(() => {
    let alive = true;
    let slowStreak = 0;     // two slow pings in a row before calling it weak, so one blip does not flash a banner
    let pinging = false;

    const compute = () => {
      if (!alive) return;
      if (!navigator.onLine) { setState('offline'); return; }
      setState(looksWeak(connection()) || slowStreak >= 2 ? 'weak' : 'good');
    };

    const check = async () => {
      if (pinging || !navigator.onLine || document.visibilityState !== 'visible') return;
      pinging = true;
      const r = await ping();
      pinging = false;
      slowStreak = r === 'ok' ? 0 : slowStreak + 1;
      compute();
    };

    const onOnline = () => { slowStreak = 0; compute(); void check(); };
    const onVisible = () => { if (document.visibilityState === 'visible') { compute(); void check(); } };

    compute();
    void check();
    const timer = setInterval(() => void check(), PING_EVERY_MS);
    const c = connection();
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', compute);
    document.addEventListener('visibilitychange', onVisible);
    c?.addEventListener?.('change', compute);
    return () => {
      alive = false;
      clearInterval(timer);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', compute);
      document.removeEventListener('visibilitychange', onVisible);
      c?.removeEventListener?.('change', compute);
    };
  }, []);

  return state;
}

/** True when the phone asks for less data (Data Saver) or the connection is 2g. Use it to skip video previews and big images. */
export function useSaveData(): boolean {
  const [save, setSave] = useState(false);
  useEffect(() => {
    const c = connection();
    const read = () => setSave(!!c?.saveData || c?.effectiveType === 'slow-2g' || c?.effectiveType === '2g');
    read();
    c?.addEventListener?.('change', read);
    return () => c?.removeEventListener?.('change', read);
  }, []);
  return save;
}

/** "Updated 9:41 PM", or "Updated Mon 9:41 PM" when it is from another day. Empty string for a missing or invalid time. */
export function updatedLabel(at: Date | number | string | null | undefined, now: Date = new Date()): string {
  if (at == null) return '';
  const d = at instanceof Date ? at : new Date(at);
  if (Number.isNaN(d.getTime())) return '';
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  if (d.toDateString() === now.toDateString()) return `Updated ${time}`;
  const day = d.toLocaleDateString('en-US', { weekday: 'short' });
  return `Updated ${day} ${time}`;
}
