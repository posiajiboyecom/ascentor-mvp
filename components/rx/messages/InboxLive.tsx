'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

// Keeps the Messages inbox live: when a message arrives in any conversation this member can read (the database only sends events
// they are allowed to see), the list re-renders so previews, order and unread counts change without a reload.
// A slow poll and a refresh when the tab comes back are the safety net if the live connection is unavailable.
const TABLES = ['dm_messages', 'circle_messages', 'rx_group_messages'] as const;

export default function InboxLive() {
  const router = useRouter();
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | null = null;
    const soon = () => { if (t) clearTimeout(t); t = setTimeout(() => router.refresh(), 700); };
    const poll = setInterval(() => { if (document.visibilityState === 'visible') router.refresh(); }, 30000);
    const onVis = () => { if (document.visibilityState === 'visible') router.refresh(); };
    document.addEventListener('visibilitychange', onVis);
    let cleanup = () => {};
    try {
      const sb = createClient();
      let ch = sb.channel('rxm-inbox-live');
      for (const table of TABLES) ch = ch.on('postgres_changes', { event: 'INSERT', schema: 'public', table }, soon);
      ch.subscribe();
      cleanup = () => { void sb.removeChannel(ch); };
    } catch { /* polling covers it */ }
    return () => { if (t) clearTimeout(t); clearInterval(poll); document.removeEventListener('visibilitychange', onVis); cleanup(); };
  }, [router]);
  return null;
}
