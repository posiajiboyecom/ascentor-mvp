'use client';

import SageLoader from '@/components/SageLoader';

import { useState, useEffect, useRef} from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import UpgradePrompt from '@/components/UpgradePrompt';
import { analytics } from '@/lib/analytics';


// Renders SVG icon strings safely  
function SvgIcon({ html, className, style }: { html: string; className?: string; style?: React.CSSProperties }) {
  return <span className={className} style={style} dangerouslySetInnerHTML={{ __html: html }} />;
}

export default function CommunityPage() {
  const [cohorts, setCohorts] = useState<any[]>([]);
  const [myCohortIds, setMyCohortIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState<string | null>(null);
  const [justJoined, setJustJoined] = useState<string | null>(null);
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [subscription, setSubscription] = useState<{ plan: string; hasAccess: boolean } | null>(null);
  const router = useRouter();
  const supabaseRef = useRef(createClient());
  const supabase = supabaseRef.current;

  const categories = ['All', 'Technology', 'Finance', 'Leadership', 'Diversity', 'Entrepreneurship', 'Consulting', 'Career Growth', 'Executive'];

  useEffect(() => {
    loadData();
  }, []);

  // ── Feature 1: Subscribe to cohort_members so member counts stay live ──
  useEffect(() => {
    const sb = supabaseRef.current;
    const channel = sb
      .channel('community-page-members-rt')
      .on('postgres_changes', {
        event:  '*',    // INSERT = join, DELETE = leave
        schema: 'public',
        table:  'cohort_members',
      }, async (payload: any) => {
        const row = (payload.new ?? payload.old) as any;
        if (!row?.cohort_id) return;
        // Re-fetch exact live count from DB for that cohort
        const { count } = await sb
          .from('cohort_members')
          .select('*', { count: 'exact', head: true })
          .eq('cohort_id', row.cohort_id);
        if (typeof count === 'number') {
          setCohorts(prev => prev.map(c =>
            c.id === row.cohort_id ? { ...c, member_count: count } : c
          ));
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
      // Live count: fetch all cohort_members rows to count per cohort
      supabase.from('cohort_members').select('cohort_id'),
    ]);

    // Build live count map: { [cohort_id]: actualMemberCount }
    const liveCountMap: Record<string, number> = {};
    (liveCountsRes.data || []).forEach((row: any) => {
      liveCountMap[row.cohort_id] = (liveCountMap[row.cohort_id] || 0) + 1;
    });

    // Override stale member_count column with real live count
    const cohortsWithLiveCount = (cohortsRes.data || []).map((c: any) => ({
      ...c,
      member_count: liveCountMap[c.id] ?? 0,
    }));
    cohortsWithLiveCount.sort((a: any, b: any) => b.member_count - a.member_count);

    setCohorts(cohortsWithLiveCount);
    setMyCohortIds(new Set(membershipRes.data?.map((m: any) => m.cohort_id) || []));

    // Determine subscription — free users limited to 3 communities
    const profile = profileRes.data;
    const hasAccess = profile &&
      ['active', 'trialing'].includes(profile.subscription_status) &&
      (!profile.subscription_end || new Date(profile.subscription_end) > new Date());
    setSubscription({
      plan: profile?.subscription_plan || 'free',
      hasAccess: !!hasAccess,
    });

    setLoading(false);
  }

  const communityLimit = subscription?.hasAccess ? -1 : 1; // free: 1 cohort, paid: unlimited

  async function joinCohort(cohortId: string) {
    // Check limit for free users
    if (communityLimit !== -1 && myCohortIds.size >= communityLimit) {
      setShowUpgrade(true);
      analytics.communityLimitReached();
      return;
    }

    setJoining(cohortId);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Check if already a member to avoid duplicate insert error
      const { data: existing } = await supabase
        .from('cohort_members')
        .select('cohort_id')
        .eq('cohort_id', cohortId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (existing) {
        // Already a member — navigate directly into the circle
        setMyCohortIds((prev) => new Set([...prev, cohortId]));
        router.push(`/community/${cohortId}`);
        return;
      }

      const { error } = await supabase.from('cohort_members').insert({
        cohort_id: cohortId,
        user_id: user.id,
      });

      if (!error) {
        setMyCohortIds((prev) => new Set([...prev, cohortId]));
        setCohorts((prev) => prev.map((c) =>
          c.id === cohortId ? { ...c, member_count: (c.member_count || 0) + 1 } : c
        ));
        analytics.communityJoined(cohortId);
        // Show "Just Joined!" toast for 3 seconds, then navigate
        setJustJoined(cohortId);
        setTimeout(() => setJustJoined(null), 3000);
        // Delay so DB write fully propagates before membership check in feed page
        await new Promise(r => setTimeout(r, 1200));
        router.push(`/community/${cohortId}`);
      } else {
        // Handle unique constraint violation gracefully
        if (error.code === '23505') {
          setMyCohortIds((prev) => new Set([...prev, cohortId]));
        } else {
          console.error('Join failed:', error.message);
        }
      }
    } catch (err) {
      console.error('Join error:', err);
    } finally {
      setJoining(null);
    }
  }

  async function leaveCohort(cohortId: string, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    if (!confirm('Leave this cohort? You can rejoin anytime.')) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from('cohort_members')
      .delete()
      .eq('cohort_id', cohortId)
      .eq('user_id', user.id);

    if (!error) {
      setMyCohortIds((prev) => {
        const next = new Set(prev);
        next.delete(cohortId);
        return next;
      });
      setCohorts((prev) => prev.map((c) =>
        c.id === cohortId ? { ...c, member_count: Math.max(0, (c.member_count || 0) - 1) } : c
      ));
      setShowUpgrade(false);
    }
  }

  const myCohorts = cohorts.filter((c) => myCohortIds.has(c.id));
  const searchLower = search.toLowerCase().trim();
  const filteredCohorts = cohorts
    .filter((c) => !myCohortIds.has(c.id))
    .filter((c) => filter === 'All' || c.category === filter)
    .filter((c) => !searchLower ||
      (c.name || '').toLowerCase().includes(searchLower) ||
      (c.description || '').toLowerCase().includes(searchLower) ||
      (c.category || '').toLowerCase().includes(searchLower)
    );

  if (loading) {
    return (
      <SageLoader message="Loading circles…" />
    );
  }

  return (
    <div className="animate-fade-up pt-2 pb-6">

      {/* Upgrade prompt when limit hit */}
      {showUpgrade && (
        <div className="mb-4">
          <UpgradePrompt feature="community" compact onDismiss={() => setShowUpgrade(false)} />
        </div>
      )}

      {/* Just joined toast */}
      {justJoined && (
        <div className="rounded-lg px-4 py-3 mb-4 animate-fade-up flex items-center gap-2"
          style={{ background: 'rgba(16,185,129,0.09)', border: '1px solid rgba(16,185,129,0.19)' }}>
          <span style={{ color: 'var(--success)' }}>✓</span>
          <span className="text-sm" style={{ color: 'var(--success)' }}>
            You've joined the cohort! Tap it below to start chatting.
          </span>
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
            {myCohorts.map((cohort) => (
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
                      <span dangerouslySetInnerHTML={{ __html: cohort.icon || "" }} />
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
                      <button onClick={(e) => leaveCohort(cohort.id, e)}
                        className="text-xs px-2 py-1 rounded opacity-50 hover:opacity-100"
                        style={{ color: 'var(--text-dim)' }}>
                        ✕
                      </button>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Browse Cohorts */}
      <div className="mb-4">
        <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--text)' }}>
          {myCohorts.length > 0 ? 'Browse More Cohorts' : 'Choose Your Cohorts'}
        </h3>

        {/* U4: Search input */}
        <div className="relative mb-3">
          <svg
            width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)', pointerEvents: 'none' }}
          >
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search circles…"
            className="w-full pl-9 pr-4 py-2 text-sm rounded-lg"
            style={{
              background: 'var(--bg-input)',
              color: 'var(--text)',
              border: '1px solid var(--border)',
              outline: 'none',
              fontFamily: "'Syne', system-ui, sans-serif",
            }}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              style={{
                position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                color: 'var(--text-dim)', fontSize: 16, lineHeight: 1, background: 'none', border: 'none', cursor: 'pointer',
              }}
            >×</button>
          )}
        </div>

        <div className="flex gap-1.5 overflow-x-auto mb-4 pb-1" style={{ scrollbarWidth: 'none' }}>
          {categories.map((c) => (
            <button key={c} onClick={() => setFilter(c)}
              className="px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all"
              style={{
                background: filter === c ? 'var(--accent)' : 'var(--bg-card)',
                color: filter === c ? '#000' : 'var(--text-muted)',
                border: `1px solid ${filter === c ? 'var(--accent)' : 'var(--border)'}`,
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
              {communityLimit !== -1 && myCohortIds.size >= communityLimit
                ? "You've reached your free cohort limit (1) — upgrade to Explorer for 3, or Builder for unlimited"
                : searchLower
                  ? `No circles match "${search}"`
                  : 'No circles in this category'}
            </p>
          </div>
        ) : (
          filteredCohorts.map((cohort, i) => (
            <div key={cohort.id}
              className="rounded-xl p-4 animate-fade-up"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', animationDelay: `${i * 0.05}s` }}>
              <div className="flex gap-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center text-xl shrink-0"
                  style={{ background: 'rgba(245,158,11,0.06)' }}>
                  <span dangerouslySetInnerHTML={{ __html: cohort.icon || "" }} />
                </div>
                <div className="flex-1">
                  <h4 className="text-sm font-semibold mb-0.5" style={{ color: 'var(--text)' }}>{cohort.name}</h4>
                  <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>{cohort.description}</p>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--text-dim)' }}>
                      <span><svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> {cohort.member_count || 0}/{cohort.max_members || 1000}</span>
                      <span>·</span>
                      <span>{cohort.category || 'General'}</span>
                    </div>
                    <button
                      onClick={() => joinCohort(cohort.id)}
                      disabled={joining === cohort.id}
                      className="px-4 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-40"
                      style={{ background: 'var(--accent)', color: '#000' }}>
                      {joining === cohort.id ? 'Joining...' : 'Join'}
                    </button>
                  </div>
                  <div className="w-full h-0.5 rounded-full mt-2 overflow-hidden" style={{ background: 'var(--bg-input)' }}>
                    <div className="h-full rounded-full"
                      style={{ width: `${((cohort.member_count || 0) / (cohort.max_members || 1000)) * 100}%`, background: 'var(--teal)' }} />
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
