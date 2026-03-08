'use client';

// ─────────────────────────────────────────────────────────────────
// ASCENTOR · Experts Page — Supabase-connected
//
// WHAT CHANGED (registration was fake):
//   - toggleRegister() now INSERTs / DELETEs from session_registrations
//   - Increments / decrements expert_sessions.current_attendees
//   - Spots remaining uses real current_attendees from DB
//   - Past recordings fetched from DB (status past session_date)
//   - Capacity bar reflects real data, not Math.random()
//   - Full / sold-out state handled
//   - Plan gate enforced before allowing registration
// ─────────────────────────────────────────────────────────────────

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';

interface ExpertSession {
  id:                string;
  title:             string;
  expert_name:       string;
  expert_bio:        string | null;
  session_date:      string;
  duration_minutes:  number | null;
  max_attendees:     number | null;
  current_attendees: number;
  is_published:      boolean;
  meeting_url:       string | null;
}


function Skeleton() {
  return (
    <div className="rounded-xl p-5 animate-pulse"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
      <div className="flex gap-4">
        <div className="w-12 h-12 rounded-full shrink-0" style={{ background: 'var(--bg-input)' }} />
        <div className="flex-1 space-y-2">
          <div className="h-4 rounded w-2/3" style={{ background: 'var(--bg-input)' }} />
          <div className="h-3 rounded w-1/3" style={{ background: 'var(--bg-input)' }} />
          <div className="h-3 rounded w-full" style={{ background: 'var(--bg-input)' }} />
        </div>
      </div>
    </div>
  );
}

export default function ExpertsPage() {
  const supabase = createClient();
  const [sessions,    setSessions]    = useState<ExpertSession[]>([]);
  const [past,        setPast]        = useState<ExpertSession[]>([]);
  const [registered,  setRegistered]  = useState<Set<string>>(new Set());
  const [loading,     setLoading]     = useState(true);
  const [toggling,    setToggling]    = useState<string | null>(null);
  const [userId,      setUserId]      = useState<string | null>(null);
  const [canAccess,   setCanAccess]   = useState(false);
  const [errors,      setErrors]      = useState<Record<string, string>>({});
  const [fetchError,  setFetchError]  = useState(false);

  useEffect(() => { loadData(); }, []); // eslint-disable-line

  async function loadData() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    setUserId(user.id);

    const { data: profile } = await supabase
      .from('profiles').select('subscription_plan, subscription_status, subscription_end').eq('id', user.id).single();
    setCanAccess(checkAccess(profile));

    const [upRes, pastRes, regRes] = await Promise.all([
      supabase.from('expert_sessions').select('*').eq('is_published', true)
        .gte('session_date', new Date().toISOString()).order('session_date'),
      supabase.from('expert_sessions').select('*').eq('is_published', true)
        .lt('session_date', new Date().toISOString()).order('session_date', { ascending: false }).limit(5),
      supabase.from('session_registrations').select('session_id').eq('user_id', user.id),
    ]);

    // Show real data only — never fake data. Empty state is handled in the UI.
    if (upRes.error) {
      console.error('[experts] fetch error:', upRes.error.message);
      setFetchError(true);
    }
    setSessions((upRes.data ?? []) as ExpertSession[]);
    setPast((pastRes.data ?? []) as ExpertSession[]);
    setRegistered(new Set((regRes.data ?? []).map((r: any) => r.session_id)));
    setLoading(false);
  }

  async function toggleRegister(sessionId: string, isRegistered: boolean) {
    if (!userId || toggling) return;
    setToggling(sessionId);
    setErrors((p) => { const n = { ...p }; delete n[sessionId]; return n; });

    if (isRegistered) {
      const { error } = await supabase.from('session_registrations')
        .delete().eq('user_id', userId).eq('session_id', sessionId);
      if (!error) {
        setSessions((prev) => prev.map((s) =>
          s.id === sessionId ? { ...s, current_attendees: Math.max(0, s.current_attendees - 1) } : s
        ));
        if (!sessionId.startsWith('f')) {
          const s = sessions.find((x) => x.id === sessionId);
          if (s) await supabase.from('expert_sessions').update({ current_attendees: Math.max(0, s.current_attendees - 1) }).eq('id', sessionId);
        }
        setRegistered((p) => { const n = new Set(p); n.delete(sessionId); return n; });
      }
    } else {
      if (!canAccess) {
        setErrors((p) => ({ ...p, [sessionId]: 'Upgrade your plan to register for expert sessions.' }));
        setToggling(null);
        return;
      }
      const session = sessions.find((s) => s.id === sessionId);
      const max = session?.max_attendees ?? 50;
      const cur = session?.current_attendees ?? 0;
      if (cur >= max) {
        setErrors((p) => ({ ...p, [sessionId]: 'This session is fully booked.' }));
        setToggling(null);
        return;
      }

      const { error } = await supabase.from('session_registrations')
        .insert({ session_id: sessionId, user_id: userId, registered_at: new Date().toISOString() });
      if (!error || error.code === '23505') {
        setSessions((prev) => prev.map((s) =>
          s.id === sessionId ? { ...s, current_attendees: s.current_attendees + 1 } : s
        ));
        if (!sessionId.startsWith('f')) {
          await supabase.from('expert_sessions').update({ current_attendees: cur + 1 }).eq('id', sessionId);
        }
        setRegistered((p) => new Set([...p, sessionId]));
      } else {
        setErrors((p) => ({ ...p, [sessionId]: 'Registration failed. Please try again.' }));
      }
    }
    setToggling(null);
  }

  return (
    <div className="animate-fade-up py-6">
      <h2 className="text-2xl font-semibold mb-1"
        style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: 'var(--text)' }}>
        Mentor Sessions
      </h2>
      <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
        Live sessions with Africa&apos;s top mentors
      </p>

      {!canAccess && !loading && (
        <Link href="/checkout">
          <div className="rounded-xl p-4 mb-5 cursor-pointer"
            style={{ background: 'rgba(139,92,246,0.07)', border: '1px solid rgba(139,92,246,0.25)' }}>
            <p className="text-sm font-semibold" style={{ color: 'var(--purple)' }}>Upgrade to register for expert sessions</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Explorer plan and above includes expert session access.</p>
          </div>
        </Link>
      )}

      <div className="flex flex-col gap-4">
        {loading
          ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} />)
          : fetchError
          ? (
            <div className="rounded-xl p-6 text-center"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
              <p className="text-sm font-medium mb-1" style={{ color: 'var(--text)' }}>
                Could not load sessions
              </p>
              <p className="text-xs" style={{ color: 'var(--text-dim)' }}>
                Check your connection and refresh the page.
              </p>
            </div>
          )
          : sessions.length === 0
          ? (
            <div className="rounded-xl p-6 text-center"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
              <p className="text-sm font-medium mb-1" style={{ color: 'var(--text)' }}>
                No upcoming sessions yet
              </p>
              <p className="text-xs" style={{ color: 'var(--text-dim)' }}>
                New expert sessions are added regularly — check back soon.
              </p>
            </div>
          )
          : sessions.map((s, i) => {
              const isReg    = registered.has(s.id);
              const isTogg   = toggling === s.id;
              const date     = new Date(s.session_date);
              const initials = s.expert_name.split(' ').map((n) => n[0]).join('').substring(0, 2);
              const max      = s.max_attendees ?? 50;
              const cur      = s.current_attendees;
              const left     = Math.max(0, max - cur);
              const isFull   = left === 0;
              const fill     = Math.min(100, (cur / max) * 100);
              const days     = Math.floor((date.getTime() - Date.now()) / 86400000);
              const badge    = days <= 7
                ? { label: 'This Week', bg: 'rgba(16,185,129,0.09)', color: 'var(--success)', bdr: 'rgba(16,185,129,0.19)' }
                : { label: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), bg: 'rgba(59,130,246,0.09)', color: 'var(--blue)', bdr: 'rgba(59,130,246,0.19)' };

              return (
                <div key={s.id} className="rounded-xl p-5 animate-fade-up"
                  style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', animationDelay: `${i * 0.1}s` }}>
                  <div className="flex gap-4">
                    <div className="w-12 h-12 rounded-full flex items-center justify-center shrink-0 text-sm font-semibold"
                      style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.13), rgba(139,92,246,0.27))', border: '1.5px solid rgba(139,92,246,0.33)', color: 'var(--purple)' }}>
                      {initials}
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-start gap-2 flex-wrap">
                        <div>
                          <h3 className="text-base font-semibold" style={{ color: 'var(--text)' }}>{s.title}</h3>
                          <p className="text-[13px]" style={{ color: 'var(--accent)' }}>{s.expert_name}</p>
                        </div>
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold shrink-0"
                          style={{ background: badge.bg, color: badge.color, border: `1px solid ${badge.bdr}` }}>
                          {badge.label}
                        </span>
                      </div>
                      {s.expert_bio && (
                        <p className="text-[13px] mt-2" style={{ color: 'var(--text-muted)' }}>{s.expert_bio}</p>
                      )}
                      {errors[s.id] && (
                        <p className="text-xs mt-1.5" style={{ color: 'var(--error)' }}>{errors[s.id]}</p>
                      )}
                      <div className="flex justify-between items-center mt-3.5">
                        <div className="text-xs" style={{ color: 'var(--text-dim)' }}>
                          📅 {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          {s.duration_minutes && ` · ${s.duration_minutes}min`}
                          {' · '}
                          {isFull
                            ? <span style={{ color: 'var(--error)' }}>Full</span>
                            : <>👥 {left} {left === 1 ? 'spot' : 'spots'} left</>
                          }
                        </div>
                        <button
                          onClick={() => toggleRegister(s.id, isReg)}
                          disabled={isTogg || (isFull && !isReg)}
                          className="px-4 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-50"
                          style={{
                            background: isReg ? 'transparent' : isFull ? 'transparent' : 'var(--accent)',
                            color:      isReg ? 'var(--text)'  : isFull ? 'var(--text-muted)' : '#000',
                            border:     isReg || isFull ? '1px solid var(--border)' : 'none',
                          }}>
                          {isTogg ? '…' : isReg ? '✓ Reserved' : isFull ? 'Full' : 'Reserve Spot'}
                        </button>
                      </div>
                      <div className="w-full h-0.5 rounded-full mt-2.5 overflow-hidden" style={{ background: 'var(--bg-input)' }}>
                        <div className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${fill}%`, background: isFull ? 'var(--error)' : 'var(--purple)' }} />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
        }
      </div>

      {past.length > 0 && (
        <>
          <h3 className="text-base font-semibold mt-8 mb-3.5" style={{ color: 'var(--text)' }}>Past Recordings</h3>
          {past.map((s, i) => (
            <div key={s.id} className="rounded-xl p-3.5 mb-2.5"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>{s.title}</p>
                  <p className="text-xs" style={{ color: 'var(--text-dim)' }}>
                    by {s.expert_name} · {new Date(s.session_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                  </p>
                </div>
                <button className="text-xs px-3 py-1.5 rounded-lg" style={{ color: 'var(--text-muted)' }}>
                  Watch →
                </button>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

function checkAccess(profile: any): boolean {
  if (!profile) return false;
  if (!['active', 'trialing'].includes(profile.subscription_status ?? '')) return false;
  if (profile.subscription_end && new Date(profile.subscription_end) < new Date()) return false;
  return profile.subscription_plan !== 'free';
}
