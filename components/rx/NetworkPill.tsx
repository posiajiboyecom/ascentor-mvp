'use client';

// Shows "Weak connection" or "Offline" the way the prototype does. Mounted once in the member shell.
// It also watches the session: when someone signs out, or a different account signs in on this device,
// the saved pages and unsent items of the previous account are deleted.

import { useEffect } from 'react';
import '@/styles/rx.css';
import '@/styles/rx-net.css';
import { useNetState } from '@/lib/net';
import { createClient } from '@/lib/supabase/client';
import { clearUserCache, noteSignedInUser } from '@/lib/sw-cache';
import { startOutbox, setOutboxUser } from '@/lib/outbox';
import { registerOutboxHandlers } from '@/lib/outbox-handlers';

export default function NetworkPill() {
  const net = useNetState();

  useEffect(() => {
    const supabase = createClient();
    registerOutboxHandlers();
    let stop = () => {};
    void supabase.auth.getSession().then(({ data }) => {
      const id = data.session?.user.id;
      noteSignedInUser(id);
      stop = startOutbox(id ?? null);   // sends anything waiting: on start, on 'online', when the tab returns
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') { setOutboxUser(null); void clearUserCache(); }
      else if (event === 'SIGNED_IN') { noteSignedInUser(session?.user.id); setOutboxUser(session?.user.id ?? null); }
    });
    return () => { sub.subscription.unsubscribe(); stop(); };
  }, []);

  if (net === 'weak') {
    return <div className="rx rx-netpill" role="status"><span className="rx-netdot" />Weak connection · saved data shown</div>;
  }
  if (net === 'offline') {
    return (
      <div className="rx rx-netpill off" role="status">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18M8.5 16.5a5 5 0 0 1 7 0M5 12.5a10 10 0 0 1 5-2.7M14.5 9.9A10 10 0 0 1 19 12.5M12 20h.01" /></svg>
        Offline · saved data · changes send later
      </div>
    );
  }
  return null;
}
