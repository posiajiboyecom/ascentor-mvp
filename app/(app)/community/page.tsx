'use client';

import SageLoader from '@/components/SageLoader';
import TierUpgradeModal from '@/components/TierUpgradeModal';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import UpgradePrompt from '@/components/UpgradePrompt';
import { analytics } from '@/lib/analytics';
import { canAccess, effectivePlan, TIER_META, type PlanTier } from '@/lib/planTier';

export default function CommunityPage() {
  const [cohorts,      setCohorts]      = useState<any[]>([]);
  const [myCohortIds,  setMyCohortIds]  = useState<Set<string>>(new Set());
  const [loading,      setLoading]      = useState(true);
  const [joining,      setJoining]      = useState<string | null>(null);
  const [justJoined,   setJustJoined]   = useState<string | null>(null);
  const [filter,       setFilter]       = useState('All');
  const [search,       setSearch]       = useState('');
  const [showUpgrade,  setShowUpgrade]  = useState(false);
  const [userPlan,     setUserPlan]     = useState<PlanTier>('free');
  const [lockedCohort, setLockedCohort] = useState<any>(null);
  const router      = useRouter();
  const supabaseRef = useRef(createClient());
  const supabase    = supabaseRef.current;

  const categories = ['All', 'Technology', 'Finance', 'Leadership', 'Diversity', 'Entrepreneurship', 'Consulting', 'Career Growth', 'Executive'];

  useEffect(() => { loadData(); }, []);

  // Live member count via Realtime
  useEffect(() => {
    const sb = supabaseRef.current;
    const channel = sb
      .channel('community-page-members-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cohort_members' },
        async (payload: any) => {
          const row = (payload.new ?? payload.old) as any;
          if (!row?.cohort_id) return;
          const { count } = await sb
            .from('cohort_members')
            .select('*', { count: 'exact', head: true })
            .eq('cohort_id', row.cohort_id);
          if (typeof count === 'number') {
            setCohorts(prev => prev.map(c => c.id === row.cohort_id ? { ...c, member_count: count } : c));
          }
        })
      .subscribe();
    return () => { sb.removeChannel(channel); };
  }, []);

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const [cohortsRes, membershipRes, profileRes, liveCountsRes] = await Promise.all([
      supabase.from('cohorts').select('*').order('member_count', { ascending: false }),
      supabase.from('cohort_members').select('cohort_id').eq('user_id', user.id),
      supabase.from('profiles').select('subscription_plan, subscription_status, subscription_end').eq('id', user.id).single(),
      supabase.from('cohort_members').select('cohort_id'),
    ]);

    const liveCountMap: Record<string, number> = {};
    (liveCountsRes.data || []).forEach((row: any) => {
      liveCountMap[row.cohort_id] = (liveCountMap[row.cohort_id] || 0) + 1;
    });

    const cohortsWithLiveCount = (cohortsRes.data || []).map((c: any) => ({
      ...c,
      member_count: liveCountMap[c.id] ?? 0,
    }));
    cohortsWithLiveCount.sort((a: any, b: any) => b.member_count - a.member_count);

    setCohorts(cohortsWithLiveCount);
    setMyCohortIds(new Set(membershipRes.data?.map((m: any) => m.cohort_id) || []));
    setUserPlan(effectivePlan(profileRes.data));
    setLoading(false);
  }

  const subscriptionHasAccess = userPlan !== 'free';
  const communityLimit        = subscriptionHasAccess ? -1 : 1;

  async function joinCohort(cohort: any) {
    // ── Tier gate: blocked at the door ─────────────────────────
    const required = (cohort.plan_tier || 'free') as PlanTier;
    if (!canAccess(userPlan, required)) {
      setLockedCohort(cohort);
      return;
    }

    // Free-user cohort limit (within accessible cohorts)
    if (communityLimit !== -1 && myCohortIds.size >= communityLimit) {
      setShowUpgrade(true);
      analytics.communityLimitReached();
      return;
    }

    setJoining(cohort.id);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: existing } = await supabase
        .from('cohort_members').select('cohort_id')
        .eq('cohort_id', cohort.id).eq('user_id', user.id).maybeSingle();

      if (existing) {
        setMyCohortIds(prev => new Set([...prev, cohort.id]));
        router.push(`/community/${cohort.id}`);
        return;
      }

      const { error } = await supabase.from('cohort_members').insert({ cohort_id: cohort.id, user_id: user.id });
      if (!error) {
        setMyCohortIds(prev => new Set([...prev, cohort.id]));
        setCohorts(prev => prev.map(c => c.id === cohort.id ? { ...c, member_count: (c.member_count || 0) + 1 } : c));
        analytics.communityJoined(cohort.id);
        setJustJoined(cohort.id);
        setTimeout(() => setJustJoined(null), 3000);
        await new Promise(r => setTimeout(r, 1200));
        router.push(`/community/${cohort.id}`);
      } else if (error.code === '23505') {
        setMyCohortIds(prev => new Set([...prev, cohort.id]));
      } else {
        console.error('Join failed:', error.message);
      }
    } catch (err) {
      console.error('Join error:', err);
    } finally {
      setJoining(null);
    }
  }

  async function leaveCohort(cohortId: string, e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation();
    if (!confirm('Leave this cohort? You can rejoin anytime.')) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from('cohort_members').delete().eq('cohort_id', cohortId).eq('user_id', user.id);
    if (!error) {
      setMyCohortIds(prev => { const n = new Set(prev); n.delete(cohortId); return n; });
      setCohorts(prev => prev.map(c => c.id === cohortId ? { ...c, member_count: Math.max(0, (c.member_count || 0) - 1) } : c));
      setShowUpgrade(false);
    }
  }

  const myCohorts       = cohorts.filter(c => myCohortIds.has(c.id));
  const searchLower     = search.toLowerCase().trim();
  const filteredCohorts = cohorts
    .filter(c => !myCohortIds.has(c.id))
    .filter(c => filter === 'All' || c.category === filter)
    .filter(c => !searchLower ||
      (c.name || '').toLowerCase().includes(searchLower) ||
      (c.description || '').toLowerCase().includes(searchLower) ||
      (c.category || '').toLowerCase().includes(searchLower)
    );

  if (loading) return <SageLoader message="Loading circles…" />;

  return (
    <div className="animate-fade-up pt-2 pb-6">

      {/* Tier upgrade modal */}
      {lockedCohort && (
        <TierUpgradeModal
          requiredTier={(lockedCohort.plan_tier || 'explorer') as PlanTier}
          contentType="community"
          contentName={lockedCohort.name}
          onClose={() => setLockedCohort(null)}
        />
      )}

      {showUpgrade && (
        <div className="mb-4">
          <UpgradePrompt feature="community" compact onDismiss={() => setShowUpgrade(false)} />
        </div>
      )}

      {justJoined && (
        <div className="rounded-lg px-4 py-3 mb-4 animate-fade-up flex items-center gap-2"
          style={{ background: 'rgba(16,185,129,0.09)', border: '1px solid rgba(16,185,129,0.19)' }}>
          <span style={{ color: 'var(--success)' }}>✓</span>
          <span className="text-sm" style={{ color: 'var(--success)' }}>You've joined the cohort! Tap it below to start chatting.</span>
        </div>
      )}

      {/* My Cohorts */}
      {myCohorts.length > 0 && (
        <div className="mb-8">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
              Your Cohorts ({myCohorts.length}{communityLimit !== -1 ? `/${communityLimit}` : ''})
            </h3>
          </div>
          <div className="flex flex-col gap-3">
            {myCohorts.map(cohort => (
              <Link key={cohort.id} href={`/community/${cohort.id}`}>
                <div className="rounded-xl p-4 transition-all hover:border-gray-600"
                  style={{
                    background: 'var(--bg-card)',
                    border: justJoined === cohort.id ? '1px solid var(--success)' : '1px solid var(--accent)',
                    cursor: 'pointer',
                  }}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center text-xl"
                      style={{ background: 'rgba(245,158,11,0.06)' }}>
                      <span dangerouslySetInnerHTML={{ __html: cohort.icon || '' }} />
                    </div>
                    <div className="flex-1">
                      <h4 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{cohort.name}</h4>
                      <p className="text-xs" style={{ color: 'var(--text-dim)' }}>
                        {cohort.member_count || 0} members · {cohort.category || 'General'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs px-2 py-0.5 rounded-full"
                        style={{
                          background: justJoined === cohort.id ? 'rgba(16,185,129,0.09)' : 'rgba(245,158,11,0.09)',
                          color: justJoined === cohort.id ? 'var(--success)' : 'var(--accent)',
                          border: `1px solid ${justJoined === cohort.id ? 'rgba(16,185,129,0.19)' : 'rgba(245,158,11,0.19)'}`,
                        }}>
                        {justJoined === cohort.id ? '✓ Just Joined!' : 'Joined ✓'}
                      </span>
                      <button onClick={e => leaveCohort(cohort.id, e)}
                        className="text-xs px-2 py-1 rounded opacity-50 hover:opacity-100"
                        style={{ color: 'var(--text-dim)' }}>✕</button>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Browse */}
      <div className="mb-4">
        <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--text)' }}>
          {myCohorts.length > 0 ? 'Browse More Cohorts' : 'Choose Your Cohorts'}
        </h3>

        <div className="relative mb-3">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)', pointerEvents: 'none' }}>
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search circles…" className="w-full pl-9 pr-4 py-2 text-sm rounded-lg"
            style={{ background: 'var(--bg-input)', color: 'var(--text)', border: '1px solid var(--border)', outline: 'none', fontFamily: "'Syne', system-ui, sans-serif" }} />
          {search && (
            <button onClick={() => setSearch('')}
              style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)', fontSize: 16, lineHeight: 1, background: 'none', border: 'none', cursor: 'pointer' }}>×</button>
          )}
        </div>

        <div className="flex gap-1.5 overflow-x-auto mb-4 pb-1" style={{ scrollbarWidth: 'none' }}>
          {categories.map(c => (
            <button key={c} onClick={() => setFilter(c)}
              className="px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all"
              style={{
                background: filter === c ? 'var(--accent)' : 'var(--bg-card)',
                color:      filter === c ? '#000' : 'var(--text-muted)',
                border:    `1px solid ${filter === c ? 'var(--accent)' : 'var(--border)'}`,
              }}>
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {filteredCohorts.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm" style={{ color: 'var(--text-dim)' }}>
              {searchLower ? `No circles match "${search}"` : 'No circles in this category'}
            </p>
          </div>
        ) : (
          filteredCohorts.map((cohort, i) => {
            const required = (cohort.plan_tier || 'free') as PlanTier;
            const locked   = !canAccess(userPlan, required);
            const tm       = TIER_META[required];

            return (
              <div key={cohort.id} className="rounded-xl p-4 animate-fade-up"
                style={{
                  background: 'var(--bg-card)',
                  border: `1px solid ${locked ? tm.border : 'var(--border)'}`,
                  animationDelay: `${i * 0.05}s`,
                  position: 'relative',
                  overflow: 'hidden',
                }}>

                {/* Lock banner strip at top */}
                {locked && (
                  <div style={{
                    position: 'absolute', top: 0, left: 0, right: 0,
                    padding: '4px 12px',
                    background: tm.bg, borderBottom: `1px solid ${tm.border}`,
                    display: 'flex', alignItems: 'center', gap: 5,
                  }}>
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none"
                      stroke={tm.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                    </svg>
                    <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: '0.09em', textTransform: 'uppercase', color: tm.color }}>
                      {tm.label} plan required to join
                    </span>
                  </div>
                )}

                <div className="flex gap-3" style={{ paddingTop: locked ? 26 : 0 }}>
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center text-xl shrink-0"
                    style={{ background: locked ? tm.bg : 'rgba(245,158,11,0.06)', opacity: locked ? 0.75 : 1 }}>
                    <span dangerouslySetInnerHTML={{ __html: cohort.icon || '' }} />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold mb-0.5"
                      style={{ color: locked ? 'var(--text-muted)' : 'var(--text)' }}>
                      {cohort.name}
                    </h4>
                    <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>{cohort.description}</p>
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--text-dim)' }}>
                        <span>
                          <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>{' '}
                          {cohort.member_count || 0}/{cohort.max_members || 1000}
                        </span>
                        <span>·</span>
                        <span>{cohort.category || 'General'}</span>
                      </div>
                      <button
                        onClick={() => joinCohort(cohort)}
                        disabled={joining === cohort.id}
                        className="px-4 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-40"
                        style={{
                          background: locked ? tm.bg    : 'var(--accent)',
                          color:      locked ? tm.color : '#000',
                          border:     locked ? `1px solid ${tm.border}` : 'none',
                        }}>
                        {joining === cohort.id ? 'Joining...' : locked ? `Unlock — ${tm.label}` : 'Join'}
                      </button>
                    </div>
                    <div className="w-full h-0.5 rounded-full mt-2 overflow-hidden" style={{ background: 'var(--bg-input)' }}>
                      <div className="h-full rounded-full"
                        style={{
                          width: `${((cohort.member_count || 0) / (cohort.max_members || 1000)) * 100}%`,
                          background: locked ? tm.color : 'var(--teal)',
                        }} />
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
