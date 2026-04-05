'use client';

import SageLoader from '@/components/SageLoader';
import TierUpgradeModal from '@/components/TierUpgradeModal';
import { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { canAccess, effectivePlan, TIER_META, type PlanTier } from '@/lib/planTier';

export default function ExpertsPage() {
  const [experts,    setExperts]    = useState<any[]>([]);
  const [registered, setRegistered] = useState<Set<string>>(new Set());
  const [loading,    setLoading]    = useState(true);
  const [userPlan,   setUserPlan]   = useState<PlanTier>('free');
  const [lockedItem, setLockedItem] = useState<any>(null);
  const supabaseRef = useRef(createClient());
  const supabase    = supabaseRef.current;

  const loadData = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const [sessionsRes, regsRes, profileRes] = await Promise.all([
        supabase
          .from('expert_sessions')
          .select('*')
          .in('status', ['scheduled', 'live'])
          .order('scheduled_at', { ascending: true }),
        supabase
          .from('session_registrations')
          .select('session_id')
          .eq('user_id', user.id),
        supabase
          .from('profiles')
          .select('subscription_plan, subscription_status, subscription_end')
          .eq('id', user.id)
          .single(),
      ]);

      setExperts(sessionsRes.data || []);
      setRegistered(new Set(regsRes.data?.map((r: any) => r.session_id) || []));
      setUserPlan(effectivePlan(profileRes.data));
    } catch (err) {
      console.error('Error loading data:', err);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => { loadData(); }, [loadData]);

  async function handleRegister(session: any) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // ── Tier gate ──────────────────────────────────────────────
    const required = (session.plan_tier || 'free') as PlanTier;
    if (!canAccess(userPlan, required)) {
      setLockedItem(session);
      return;
    }

    const isCurrentlyReg = registered.has(session.id);
    if (isCurrentlyReg) {
      const { error } = await supabase
        .from('session_registrations')
        .delete()
        .eq('session_id', session.id)
        .eq('user_id', user.id);
      if (!error) {
        setRegistered(prev => { const n = new Set(prev); n.delete(session.id); return n; });
      }
    } else {
      const { error } = await supabase
        .from('session_registrations')
        .insert({ session_id: session.id, user_id: user.id });
      if (!error) {
        setRegistered(prev => new Set([...prev, session.id]));
        if (session.registration_url) window.open(session.registration_url, '_blank');
      }
    }
  }

  function isLive(s: string) {
    const t = new Date(s).getTime(), now = Date.now();
    return now >= t - 300000 && now <= t + 7200000;
  }
  function isToday(s: string) {
    return new Date(s).toDateString() === new Date().toDateString();
  }

  if (loading) return <SageLoader message="Loading sessions…" />;

  return (
    <div className="animate-fade-up py-6">

      {/* Upgrade modal */}
      {lockedItem && (
        <TierUpgradeModal
          requiredTier={(lockedItem.plan_tier || 'explorer') as PlanTier}
          contentType="event"
          contentName={lockedItem.title}
          onClose={() => setLockedItem(null)}
        />
      )}

      <h2 className="text-2xl font-semibold mb-1"
        style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: 'var(--text)' }}>
        Expert Sessions
      </h2>
      <p className="text-sm mb-5" style={{ color: 'var(--text-muted)' }}>
        Live workshops with Africa's top leaders
      </p>

      {experts.length === 0 && (
        <div className="text-center py-12">
          <div className="text-3xl mb-3">
            <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/>
            </svg>
          </div>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No upcoming sessions. Check back soon!</p>
        </div>
      )}

      <div className="flex flex-col gap-4">
        {experts.map((expert, i) => {
          const date     = new Date(expert.scheduled_at);
          const initials = expert.expert_name?.split(' ').map((n: string) => n[0]).join('') || '?';
          const isReg    = registered.has(expert.id);
          const live     = isLive(expert.scheduled_at);
          const today    = isToday(expert.scheduled_at);
          const required = (expert.plan_tier || 'free') as PlanTier;
          const locked   = !canAccess(userPlan, required);
          const tm       = TIER_META[required];

          return (
            <div
              key={expert.id}
              className="rounded-xl p-5 transition-all"
              style={{
                background: 'var(--bg-card)',
                border:     `1px solid ${live ? 'var(--error)' : locked ? tm.border : 'var(--border)'}`,
                position:   'relative',
                animationDelay: `${i * 0.1}s`,
              }}
            >
              {/* Frosted lock overlay */}
              {locked && (
                <div
                  onClick={() => setLockedItem(expert)}
                  style={{
                    position: 'absolute', inset: 0, borderRadius: 12, zIndex: 10,
                    background: 'rgba(12,11,8,0.60)', backdropFilter: 'blur(3px)',
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center',
                    gap: 10, cursor: 'pointer',
                  }}
                >
                  <div style={{
                    width: 44, height: 44, borderRadius: 12,
                    background: tm.bg, border: `1px solid ${tm.border}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                      stroke={tm.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                    </svg>
                  </div>
                  <span style={{
                    fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: '0.1em',
                    textTransform: 'uppercase', color: tm.color,
                    background: tm.bg, border: `1px solid ${tm.border}`,
                    padding: '3px 12px', borderRadius: 100,
                  }}>
                    {tm.label} plan required
                  </span>
                </div>
              )}

              {live && (
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-xs font-bold" style={{ color: 'var(--error)' }}>LIVE NOW</span>
                </div>
              )}

              <div className="flex gap-4">
                <div className="w-12 h-12 rounded-full flex items-center justify-center shrink-0 text-sm font-semibold"
                  style={{
                    background: 'linear-gradient(135deg, rgba(139,92,246,0.13), rgba(139,92,246,0.27))',
                    border: '1.5px solid rgba(139,92,246,0.33)', color: 'var(--purple)',
                  }}>
                  {initials}
                </div>

                <div className="flex-1">
                  <div className="flex justify-between items-start gap-2 flex-wrap">
                    <div>
                      <h3 className="text-base font-semibold" style={{ color: 'var(--text)' }}>
                        {expert.title}
                      </h3>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <p className="text-[13px]" style={{ color: 'var(--accent)' }}>{expert.expert_name}</p>
                        {/* Tier badge — always visible so users know what each session needs */}
                        {required !== 'free' && (
                          <span style={{
                            fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: '0.10em',
                            textTransform: 'uppercase', padding: '2px 8px', borderRadius: 100,
                            background: tm.bg, color: tm.color, border: `1px solid ${tm.border}`,
                          }}>
                            {tm.label}+
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold" style={{
                      background: live ? 'rgba(239,68,68,0.09)' : today ? 'rgba(16,185,129,0.09)' : 'rgba(59,130,246,0.09)',
                      color:      live ? 'var(--error)' : today ? 'var(--success)' : 'var(--blue)',
                      border:    `1px solid ${live ? 'rgba(239,68,68,0.19)' : today ? 'rgba(16,185,129,0.19)' : 'rgba(59,130,246,0.19)'}`,
                    }}>
                      {live ? '🔴 Live' : today ? 'Today' : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  </div>

                  {expert.expert_bio && (
                    <p className="text-[13px] mt-2" style={{ color: 'var(--text-muted)' }}>{expert.expert_bio}</p>
                  )}

                  <div className="text-xs mt-3 mb-4 flex items-center gap-1.5 flex-wrap" style={{ color: 'var(--text-dim)' }}>
                    <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                    {date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                    <span>·</span>
                    <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                    {date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                  </div>

                  <div className="flex gap-2 flex-wrap">
                    {live && isReg && !locked ? (
                      <button
                        onClick={() => window.open(expert.join_url, '_blank')}
                        className="px-5 py-2 rounded-lg text-xs font-semibold bg-red-600 text-white hover:bg-red-700 transition-colors"
                      >
                        Join Live Session
                      </button>
                    ) : (
                      <button
                        onClick={() => handleRegister(expert)}
                        className="px-5 py-2 rounded-lg text-xs font-semibold transition-all"
                        style={{
                          background: locked ? tm.bg      : isReg ? 'transparent'    : 'var(--accent)',
                          color:      locked ? tm.color   : isReg ? 'var(--text)'    : '#000',
                          border:     locked ? `1px solid ${tm.border}` : isReg ? '1px solid var(--border)' : 'none',
                        }}
                      >
                        {locked ? `Unlock — ${tm.label}` : isReg ? 'Registered ✓' : 'Register Now'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
