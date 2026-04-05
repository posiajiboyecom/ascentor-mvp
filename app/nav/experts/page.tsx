'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';

// ── Past recordings remain static (no DB table for these yet) ──────────────
const PAST_RECORDINGS = [
  { title: "Building Executive Presence — A Mentor's Framework", speaker: 'Ngozi Adeola', views: 234 },
  { title: 'Managing Up Without Losing Yourself',                speaker: 'Samuel Mensah', views: 187 },
];

export default function ExpertsPage() {
  const supabaseRef              = useRef(createClient());
  const supabase                 = supabaseRef.current;

  const [experts,     setExperts]     = useState<any[]>([]);
  const [registered,  setRegistered]  = useState<Set<string>>(new Set());
  const [spotCounts,  setSpotCounts]  = useState<Record<string, number>>({}); // sessionId → registrant count
  const [loading,     setLoading]     = useState(true);
  const [toggling,    setToggling]    = useState<string | null>(null); // sessionId being toggled
  const [userId,      setUserId]      = useState<string | null>(null);
  const [error,       setError]       = useState<string | null>(null);
  const [isPaid,      setIsPaid]      = useState(false);
  const [userPlan,    setUserPlan]    = useState<string>('free');

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    setError(null);

    // 1. Get current user + payment status
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    setUserId(user.id);

    const { data: profile } = await supabase
      .from('profiles')
      .select('subscription_status, subscription_plan, onboarding_completed')
      .eq('id', user.id)
      .single();

    const paid =
      profile?.onboarding_completed === true ||
      profile?.subscription_status === 'active' ||
      profile?.subscription_status === 'trialing';
    setIsPaid(paid);
    setUserPlan(profile?.subscription_plan || 'free');

    // 2. Fetch upcoming expert sessions from DB — no fallback data
    const { data: sessionsData, error: sessionsError } = await supabase
      .from('expert_sessions')
      .select('*')
      .eq('status', 'scheduled')
      .gte('scheduled_at', new Date().toISOString())
      .order('scheduled_at');

    if (sessionsError) {
      console.error('[ExpertsPage] sessions error:', sessionsError.message);
      setError('Could not load sessions. Please try again.');
      setLoading(false);
      return;
    }

    setExperts(sessionsData || []);

    if (!sessionsData?.length) {
      setLoading(false);
      return;
    }

    const sessionIds = sessionsData.map((s: any) => s.id);

    // 3. Fetch this user's registrations — what have they already signed up for?
    const { data: myRegs } = await supabase
      .from('session_registrations')
      .select('session_id')
      .eq('user_id', user.id)
      .in('session_id', sessionIds);

    setRegistered(new Set(myRegs?.map((r: any) => r.session_id) || []));

    // 4. Fetch live spot counts — count registrants per session
    const { data: allRegs } = await supabase
      .from('session_registrations')
      .select('session_id')
      .in('session_id', sessionIds);

    const counts: Record<string, number> = {};
    sessionIds.forEach((id: string) => { counts[id] = 0; });
    (allRegs || []).forEach((r: any) => {
      counts[r.session_id] = (counts[r.session_id] || 0) + 1;
    });
    setSpotCounts(counts);

    setLoading(false);
  }

  // ── Register / Unregister — writes to session_registrations table ─────────
  async function toggleRegister(sessionId: string) {
    if (!userId || toggling) return;
    setToggling(sessionId);
    setError(null);

    const isCurrentlyRegistered = registered.has(sessionId);

    // Optimistic UI update
    setRegistered(prev => {
      const next = new Set(prev);
      isCurrentlyRegistered ? next.delete(sessionId) : next.add(sessionId);
      return next;
    });
    setSpotCounts(prev => ({
      ...prev,
      [sessionId]: Math.max(0, (prev[sessionId] || 0) + (isCurrentlyRegistered ? -1 : 1)),
    }));

    try {
      if (isCurrentlyRegistered) {
        // Unregister — delete from session_registrations
        const { error } = await supabase
          .from('session_registrations')
          .delete()
          .eq('session_id', sessionId)
          .eq('user_id', userId);

        if (error) throw error;
      } else {
        // Register — check capacity first
        const session = experts.find(e => e.id === sessionId);
        const currentCount = spotCounts[sessionId] || 0;
        const maxParticipants = session?.max_participants ?? 50;

        if (currentCount >= maxParticipants) {
          // Roll back optimistic update — session is full
          setRegistered(prev => { const next = new Set(prev); next.delete(sessionId); return next; });
          setSpotCounts(prev => ({ ...prev, [sessionId]: currentCount }));
          setError('This session is full. Check back for future sessions.');
          setToggling(null);
          return;
        }

        const { error } = await supabase
          .from('session_registrations')
          .insert({ session_id: sessionId, user_id: userId });

        if (error) {
          // Handle duplicate registration gracefully (race condition)
          if (error.code === '23505') {
            setRegistered(prev => new Set([...prev, sessionId]));
          } else {
            throw error;
          }
        }
      }
    } catch (err: any) {
      console.error('[ExpertsPage] toggleRegister error:', err.message);
      // Roll back optimistic update on failure
      setRegistered(prev => {
        const next = new Set(prev);
        isCurrentlyRegistered ? next.add(sessionId) : next.delete(sessionId);
        return next;
      });
      setSpotCounts(prev => ({
        ...prev,
        [sessionId]: Math.max(0, (prev[sessionId] || 0) + (isCurrentlyRegistered ? 1 : -1)),
      }));
      setError('Something went wrong. Please try again.');
    } finally {
      setToggling(null);
    }
  }

  // ── UI ────────────────────────────────────────────────────────────────────
  return (
    <div className="animate-fade-up py-6">
      <h2 className="text-2xl font-semibold mb-1"
        style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: 'var(--text)' }}>
        Mentor Sessions
      </h2>
      <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
        Live sessions with Africa's top mentors
      </p>

      {/* Error banner */}
      {error && (
        <div className="rounded-lg px-4 py-3 mb-4 text-sm"
          style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#EF4444' }}>
          {error}
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="flex flex-col gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="rounded-xl p-5 animate-pulse"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', height: 140 }} />
          ))}
        </div>
      ) : experts.length === 0 ? (
        // ── Empty state — no fallback fake data ──────────────────────────
        <div className="text-center py-16">
          <div className="text-4xl mb-3">📅</div>
          <p className="text-sm font-medium mb-1" style={{ color: 'var(--text)' }}>
            No sessions scheduled yet
          </p>
          <p className="text-xs" style={{ color: 'var(--text-dim)' }}>
            Check back soon — new mentor sessions are added regularly.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {experts.map((expert, i) => {
            const date           = new Date(expert.scheduled_at);
            const initials       = expert.expert_name.split(' ').map((n: string) => n[0]).join('');
            const isRegistered   = registered.has(expert.id);
            const isThisWeek     = (date.getTime() - Date.now()) < 7 * 86400000;
            const spotsUsed      = spotCounts[expert.id] ?? 0;
            const maxSpots       = expert.max_participants ?? 50;
            const spotsLeft      = Math.max(0, maxSpots - spotsUsed);
            const isFull         = spotsLeft === 0 && !isRegistered;
            const isToggling     = toggling === expert.id;
            const fillPct        = Math.min(100, (spotsUsed / maxSpots) * 100);
            // Access control based on admin-set plan_tier
            const tier = expert.plan_tier || (expert.is_free ? 'free' : 'free');

            const canAccess = (() => {
              if (tier === 'free') return true; // everyone
              if (!isPaid) return false;         // all paid tiers require payment
              // Plan rank check for higher tiers
              const planRank: Record<string,number> = { free:0, explorer:1, builder:2, climber:3, standard:2, tester:2, pro:3 };
              const userRank = planRank[userPlan] ?? 0;
              if (tier === 'paid') return userRank >= 1;
              if (tier === 'explorer') return userRank >= 1;
              if (tier === 'builder') return userRank >= 2;
              if (tier === 'climber') return userRank >= 3;
              return false;
            })();

            return (
              <div key={expert.id}
                className="rounded-xl p-5 animate-fade-up"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', animationDelay: `${i * 0.1}s` }}>
                <div className="flex gap-4">
                  {/* Avatar */}
                  <div className="w-12 h-12 rounded-full flex items-center justify-center shrink-0 text-sm font-semibold"
                    style={{
                      background: 'linear-gradient(135deg, rgba(139,92,246,0.13), rgba(139,92,246,0.27))',
                      border: '1.5px solid rgba(139,92,246,0.33)',
                      color: 'var(--purple)',
                    }}>
                    {initials}
                  </div>

                  <div className="flex-1">
                    {/* Title + badge */}
                    <div className="flex justify-between items-start gap-2 flex-wrap">
                      <div>
                        <h3 className="text-base font-semibold" style={{ color: 'var(--text)' }}>
                          {expert.title}
                        </h3>
                        <p className="text-[13px]" style={{ color: 'var(--accent)' }}>
                          {expert.expert_name}
                        </p>
                      </div>
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold"
                        style={{
                          background: isThisWeek ? 'rgba(16,185,129,0.09)' : 'rgba(59,130,246,0.09)',
                          color:      isThisWeek ? 'var(--success)' : 'var(--blue)',
                          border:     `1px solid ${isThisWeek ? 'rgba(16,185,129,0.19)' : 'rgba(59,130,246,0.19)'}`,
                        }}>
                        {isThisWeek ? 'This Week' : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                    </div>

                    {/* Bio */}
                    <p className="text-[13px] mt-2" style={{ color: 'var(--text-muted)' }}>
                      {expert.expert_bio}
                    </p>

                    {/* Meta + Register button */}
                    <div className="flex justify-between items-center mt-3.5">
                      <div className="text-xs" style={{ color: 'var(--text-dim)' }}>
                        📅 {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        {' · '}
                        👥 {isFull ? (
                          <span style={{ color: '#EF4444' }}>Full</span>
                        ) : (
                          `${spotsLeft} spot${spotsLeft !== 1 ? 's' : ''} left`
                        )}
                      </div>
                      {!canAccess && (
                        <div className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold"
                          style={{ background: 'rgba(232,160,32,0.08)', border: '1px solid rgba(232,160,32,0.2)', color: 'var(--accent)', cursor: 'default' }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                          {expert.plan_tier === 'free' || expert.is_free ? 'Open' : `${(expert.plan_tier || 'explorer').charAt(0).toUpperCase() + (expert.plan_tier || 'explorer').slice(1)} plan`}

                        </div>
                      )}
                      {canAccess && <button
                        onClick={() => toggleRegister(expert.id)}
                        disabled={isToggling || (isFull)}
                        className="px-4 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-40"
                        style={{
                          background: isRegistered ? 'transparent' : isFull ? 'transparent' : 'var(--accent)',
                          color:      isRegistered ? 'var(--text)' : isFull ? 'var(--text-dim)' : '#000',
                          border:     isRegistered || isFull ? '1px solid var(--border)' : 'none',
                        }}>
                        {isToggling
                          ? '...'
                          : isRegistered
                            ? '✓ Reserved'
                            : isFull
                              ? 'Full'
                              : 'Reserve Spot'}
                      </button>}
                    </div>

                    {/* Capacity bar — real data */}
                    <div className="w-full h-0.5 rounded-full mt-2.5 overflow-hidden"
                      style={{ background: 'var(--bg-input)' }}>
                      <div className="h-full rounded-full transition-all"
                        style={{
                          width: `${fillPct}%`,
                          background: fillPct >= 90 ? '#EF4444' : 'var(--purple)',
                        }} />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Past Recordings */}
      <h3 className="text-base font-semibold mt-8 mb-3.5" style={{ color: 'var(--text)' }}>
        Past Recordings
      </h3>
      {PAST_RECORDINGS.map((r, i) => (
        <div key={i} className="rounded-xl p-3.5 mb-2.5"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>{r.title}</p>
              <p className="text-xs" style={{ color: 'var(--text-dim)' }}>by {r.speaker} · {r.views} views</p>
            </div>
            <button className="text-xs px-3 py-1.5 rounded-lg" style={{ color: 'var(--text-muted)' }}>
              Watch →
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
