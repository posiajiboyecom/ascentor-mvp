'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useLiveNudge } from '@/lib/rx/live-client';

// Keeps the Messages inbox live, so previews, order and unread counts change without a reload:
//  - a server nudge on this member's private inbox topic the moment a message reaches them (lib/rx/live.ts),
//  - the database change feed as a second signal (it only sends rows the member may read),
//  - a poll every 15 seconds while visible, and a refresh when the app comes back.
const TABLES = ['dm_messages', 'circle_messages', 'rx_group_messages'] as const;

export default function InboxLive({ topic }: { topic?: string | null }) {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const soon = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => router.refresh(), 400);
  }, [router]);

  useLiveNudge(topic, soon);

  useEffect(() => {
    const poll = setInterval(() => { if (document.visibilityState === 'visible') router.refresh(); }, 15000);
    const onVis = () => { if (document.visibilityState === 'visible') router.refresh(); };
    document.addEventListener('visibilitychange', onVis);
    let cleanup = () => {};
    try {
      const sb = createClient();
      let ch = sb.channel('rxm-inbox-live');
      for (const table of TABLES) ch = ch.on('postgres_changes', { event: 'INSERT', schema: 'public', table }, soon);
      void sb.auth.getSession().then(({ data: { session } }) => (session?.access_token ? sb.realtime.setAuth(session.access_token) : undefined)).finally(() => ch.subscribe());
      cleanup = () => { void sb.removeChannel(ch); };
    } catch { /* polling covers it */ }
    return () => { if (timer.current) clearTimeout(timer.current); clearInterval(poll); document.removeEventListener('visibilitychange', onVis); cleanup(); };
  }, [router, soon]);
  return null;
}
