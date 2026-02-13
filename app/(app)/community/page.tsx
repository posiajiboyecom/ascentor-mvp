'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';

export default function CommunityPage() {
  const [cohorts, setCohorts] = useState<any[]>([]);
  const [myCohortIds, setMyCohortIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState<string | null>(null);
  const [justJoined, setJustJoined] = useState<string | null>(null);
  const [filter, setFilter] = useState('All');
  const supabase = createClient();

  const categories = ['All', 'Technology', 'Finance', 'Leadership', 'Diversity', 'Entrepreneurship', 'Consulting', 'Career Growth', 'Executive'];

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const [cohortsRes, membershipRes] = await Promise.all([
      supabase.from('cohorts').select('*').eq('is_active', true).order('member_count', { ascending: false }),
      supabase.from('cohort_members').select('cohort_id').eq('user_id', user.id),
    ]);

    setCohorts(cohortsRes.data || []);
    setMyCohortIds(new Set(membershipRes.data?.map((m: any) => m.cohort_id) || []));
    setLoading(false);
  }

  async function joinCohort(cohortId: string) {
    if (myCohortIds.size >= 3) {
      alert('You can join up to 3 cohorts. Leave one to join another.');
      return;
    }

    setJoining(cohortId);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from('cohort_members').insert({
      cohort_id: cohortId,
      user_id: user.id,
    });

    if (!error) {
      // Immediately update UI
      setMyCohortIds((prev) => new Set([...prev, cohortId]));
      setCohorts((prev) => prev.map((c) =>
        c.id === cohortId ? { ...c, member_count: (c.member_count || 0) + 1 } : c
      ));
      // Show "Just joined" feedback
      setJustJoined(cohortId);
      setTimeout(() => setJustJoined(null), 3000);
    }
    setJoining(null);
  }

  async function leaveCohort(cohortId: string, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    if (!confirm('Leave this cohort?')) return;

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
    }
  }

  const myCohorts = cohorts.filter((c) => myCohortIds.has(c.id));
  const filteredCohorts = filter === 'All'
    ? cohorts.filter((c) => !myCohortIds.has(c.id))
    : cohorts.filter((c) => !myCohortIds.has(c.id) && c.category === filter);

  if (loading) {
    return (
      <div className="py-20 text-center">
        <div className="text-2xl mb-2">⏳</div>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading cohorts...</p>
      </div>
    );
  }

  return (
    <div className="animate-fade-up py-6">
      <h2 className="text-2xl font-semibold mb-1"
        style={{ fontFamily: "'Playfair Display', serif", color: 'var(--text)' }}>
        Cohorts
      </h2>
      <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
        Join up to 3 communities of peers on similar journeys
      </p>

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
              Your Cohorts ({myCohorts.length}/3)
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
                      {cohort.icon}
                    </div>
                    <div className="flex-1">
                      <h4 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{cohort.name}</h4>
                      <p className="text-xs" style={{ color: 'var(--text-dim)' }}>
                        {cohort.member_count} members · {cohort.category}
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
              {myCohortIds.size >= 3 ? "You've joined 3 cohorts — leave one to explore others" : 'No cohorts in this category'}
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
                  {cohort.icon}
                </div>
                <div className="flex-1">
                  <h4 className="text-sm font-semibold mb-0.5" style={{ color: 'var(--text)' }}>{cohort.name}</h4>
                  <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>{cohort.description}</p>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--text-dim)' }}>
                      <span>👥 {cohort.member_count}/{cohort.max_members}</span>
                      <span>·</span>
                      <span>{cohort.category}</span>
                    </div>
                    <button
                      onClick={() => joinCohort(cohort.id)}
                      disabled={joining === cohort.id || myCohortIds.size >= 3}
                      className="px-4 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-40"
                      style={{ background: 'var(--accent)', color: '#000' }}>
                      {joining === cohort.id ? 'Joining...' : 'Join'}
                    </button>
                  </div>
                  <div className="w-full h-0.5 rounded-full mt-2 overflow-hidden" style={{ background: 'var(--bg-input)' }}>
                    <div className="h-full rounded-full"
                      style={{ width: `${(cohort.member_count / cohort.max_members) * 100}%`, background: 'var(--teal)' }} />
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