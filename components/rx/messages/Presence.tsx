'use client';

// Who is online right now. Each browser writes its own "last seen" row (public.member_presence) about every 45 seconds
// while the tab is visible, and reads the table back. Row-level security decides what the read returns: only the rows of
// people the viewer may message (Circle mates and accepted conversations, never blocked people), so a stranger's presence
// is not merely hidden in the UI, it is not in the query result at all. See database/migrations/20261023_member_presence.sql.
// If the table does not exist yet, presence is simply off.

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { createClient } from '@/lib/supabase/client';

const Ctx = createContext<ReadonlySet<string>>(new Set());

const BEAT_MS = 45_000;
const READ_MS = 30_000;
const FRESH_MS = 120_000;

export function PresenceProvider({ userId, children }: { userId: string; children: ReactNode }) {
  const [online, setOnline] = useState<ReadonlySet<string>>(new Set());

  useEffect(() => {
    let off = false;
    let disabled = false;
    let sb: ReturnType<typeof createClient>;
    try { sb = createClient(); } catch { return; }

    const beat = async () => {
      if (disabled || document.visibilityState !== 'visible') return;
      const { error } = await sb.from('member_presence').upsert({ user_id: userId, last_seen_at: new Date().toISOString() });
      if (error) disabled = true; // table missing or not allowed: presence stays off, nothing breaks
    };
    const read = async () => {
      if (disabled || document.visibilityState !== 'visible') return;
      const since = new Date(Date.now() - FRESH_MS).toISOString();
      const { data, error } = await sb.from('member_presence').select('user_id').gt('last_seen_at', since).neq('user_id', userId);
      if (error) { disabled = true; return; }
      if (!off) setOnline(new Set((data ?? []).map((r: { user_id: string }) => r.user_id)));
    };
    const tick = () => { void beat().then(read); };

    tick();
    const a = setInterval(() => { void beat(); }, BEAT_MS);
    const b = setInterval(() => { void read(); }, READ_MS);
    const vis = () => { if (document.visibilityState === 'visible') tick(); };
    document.addEventListener('visibilitychange', vis);
    return () => { off = true; clearInterval(a); clearInterval(b); document.removeEventListener('visibilitychange', vis); };
  }, [userId]);

  const value = useMemo(() => online, [online]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** True when this member is online. Pass only ids the viewer is allowed to message. */
export function useOnline(): ReadonlySet<string> { return useContext(Ctx); }

/** The green dot from the design, to sit inside a `.rxm-avw` wrapper. */
export function OnlineDot() { return <span className="rxm-ond" aria-hidden />; }
