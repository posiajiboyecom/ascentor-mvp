'use client';
// lib/rx/live-client.ts
// Listen for server nudges (lib/rx/live.ts) on a Realtime broadcast topic, and keep listening: attach the session,
// reconnect with backoff when the channel drops (phones drop sockets in the background), and reconnect at once when
// the app comes back to the foreground or online. Calls onNudge for each nudge and after every (re)connect, so
// anything missed while disconnected is fetched.

import { useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';

export function useLiveNudge(topic: string | null | undefined, onNudge: () => void): void {
  const cb = useRef(onNudge);
  cb.current = onNudge;
  useEffect(() => {
    if (!topic) return;
    let stopped = false;
    let gen = 0;
    let attempt = 0;
    let retry: ReturnType<typeof setTimeout> | undefined;
    const sb = createClient();
    let ch: ReturnType<typeof sb.channel> | null = null;

    const connect = async () => {
      const mine = ++gen;
      if (ch) { void sb.removeChannel(ch); ch = null; }
      try {
        const { data: { session } } = await sb.auth.getSession();
        if (session?.access_token) await sb.realtime.setAuth(session.access_token);
      } catch { /* broadcast nudges do not need the session */ }
      if (stopped || mine !== gen) return;
      ch = sb.channel(topic, { config: { broadcast: { self: false } } })
        .on('broadcast', { event: 'new' }, () => cb.current())
        .subscribe((status) => {
          if (stopped || mine !== gen) return;
          if (status === 'SUBSCRIBED') { attempt = 0; cb.current(); }
          else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
            clearTimeout(retry);
            retry = setTimeout(() => { void connect(); }, Math.min(30_000, 1_000 * 2 ** attempt++));
          }
        });
    };
    const wake = () => { if (document.visibilityState === 'visible') { attempt = 0; clearTimeout(retry); void connect(); } };

    void connect();
    document.addEventListener('visibilitychange', wake);
    window.addEventListener('online', wake);
    return () => {
      stopped = true; gen++; clearTimeout(retry);
      if (ch) void sb.removeChannel(ch);
      document.removeEventListener('visibilitychange', wake);
      window.removeEventListener('online', wake);
    };
  }, [topic]);
}
