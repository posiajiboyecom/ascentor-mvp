'use client';

// Who is online right now, from Supabase Realtime Presence on one shared channel. Nothing is stored.
// The member's own id is announced on the channel; components only ever look up people they may message
// (their accepted conversations), so a dot never appears for a stranger.

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { createClient } from '@/lib/supabase/client';

const Ctx = createContext<ReadonlySet<string>>(new Set());

export function PresenceProvider({ userId, children }: { userId: string; children: ReactNode }) {
  const [online, setOnline] = useState<ReadonlySet<string>>(new Set());

  useEffect(() => {
    let cleanup = () => {};
    try {
      const sb = createClient();
      const ch = sb.channel('presence', { config: { presence: { key: userId } } });
      const sync = () => { setOnline(new Set(Object.keys(ch.presenceState()))); };
      ch.on('presence', { event: 'sync' }, sync)
        .subscribe((status) => { if (status === 'SUBSCRIBED') void ch.track({ at: Date.now() }); });
      cleanup = () => { void sb.removeChannel(ch); };
    } catch { /* presence is optional */ }
    return () => cleanup();
  }, [userId]);

  const value = useMemo(() => online, [online]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** True when this member is online. Pass only ids the viewer is allowed to message. */
export function useOnline(): ReadonlySet<string> { return useContext(Ctx); }

/** The green dot from the design, to sit inside a `.rxm-avw` wrapper. */
export function OnlineDot() { return <span className="rxm-ond" aria-hidden />; }
