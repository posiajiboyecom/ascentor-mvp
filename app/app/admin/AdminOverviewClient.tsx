'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';

// ─── Ascentor Brand Tokens ────────────────────────────────────────────────────
// Gold:   #E8A020   Dark: #0C0B08   Dark-600: #2E2A22   Dark-700: #1E1C17
// Text muted: #7A7260   Text dim: #4A4438   Border: #2E2A22
// Fonts: Cormorant Garamond (display) · Syne (UI) · DM Mono (labels/meta)
// ─────────────────────────────────────────────────────────────────────────────

export default function AdminOverviewClient() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);

  const [stats, setStats] = useState({
    totalUsers: 0, newUsers7d: 0, newUsers30d: 0,
    totalSessions: 0, sessions7d: 0,
    totalPosts: 0, posts7d: 0,
    publishedCourses: 0, upcomingEvents: 0,
  });
  const [dailyActivity, setDailyActivity] = useState<{ day: string; users: number; sessions: number }[]>([]);
  const [topUsers, setTopUsers] = useState<any[]>([]);
  const [topCohorts, setTopCohorts] = useState<any[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<any[]>([]);
  const [recentSignups, setRecentSignups] = useState<any[]>([]);
  const [sessionTypes, setSessionTypes] = useState<{ type: string; count: number }[]>([]);

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    const now = new Date();
    const d7 = new Date(now.getTime() - 7 * 86400000).toISOString();
    const d30 = new Date(now.getTime() - 30 * 86400000).toISOString();

    const [
      usersAll, users7d, users30d,
      sessAll, sess7d,
      postsAll, posts7d,
      coursesP, eventsUp,
      allSessions, cohorts, events, recentUsers,
    ] = await Promise.all([
      supabase.from('profiles').select('id', { count: 'exact', head: true }),
      supabase.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', d7),
      supabase.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', d30),
      supabase.from('coaching_sessions').select('id', { count: 'exact', head: true }),
      supabase.from('coaching_sessions').select('id', { count: 'exact', head: true }).gte('created_at', d7),
      supabase.from('cohort_posts').select('id', { count: 'exact', head: true }),
      supabase.from('cohort_posts').select('id', { count: 'exact', head: true }).gte('created_at', d7),
      supabase.from('courses').select('id', { count: 'exact', head: true }).eq('is_published', true),
      supabase.from('expert_sessions').select('id', { count: 'exact', head: true }).eq('status', 'scheduled'),
      supabase.from('coaching_sessions').select('user_id, session_type, created_at').gte('created_at', d30).order('created_at'),
      supabase.from('cohorts').select('id, name, member_count, icon').order('member_count', { ascending: false }).limit(5),
      supabase.from('expert_sessions').select('*').eq('status', 'scheduled').order('scheduled_at').limit(3),
      supabase.from('profiles').select('id, full_name, email, current_role, industry, created_at').order('created_at', { ascending: false }).limit(8),
    ]);

    setStats({
      totalUsers: usersAll.count || 0, newUsers7d: users7d.count || 0, newUsers30d: users30d.count || 0,
      totalSessions: sessAll.count || 0, sessions7d: sess7d.count || 0,
      totalPosts: postsAll.count || 0, posts7d: posts7d.count || 0,
      publishedCourses: coursesP.count || 0, upcomingEvents: eventsUp.count || 0,
    });

    // Build daily activity chart (last 14 days)
    const dayMap: Record<string, { users: Set<string>; sessions: number }> = {};
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 86400000);
      const key = d.toISOString().split('T')[0];
      dayMap[key] = { users: new Set(), sessions: 0 };
    }
    allSessions.data?.forEach((s: any) => {
      const key = s.created_at.split('T')[0];
      if (dayMap[key]) {
        dayMap[key].users.add(s.user_id);
        dayMap[key].sessions++;
      }
    });
    setDailyActivity(Object.entries(dayMap).map(([day, v]) => ({
      day, users: v.users.size, sessions: v.sessions,
    })));

    // Session type breakdown
    const typeMap: Record<string, number> = {};
    allSessions.data?.forEach((s: any) => {
      const t = s.session_type || 'general';
      typeMap[t] = (typeMap[t] || 0) + 1;
    });
    setSessionTypes(Object.entries(typeMap).map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count));

    // Top users by sessions
    const userSessionMap: Record<string, number> = {};
    allSessions.data?.forEach((s: any) => {
      userSessionMap[s.user_id] = (userSessionMap[s.user_id] || 0) + 1;
    });
    const userIds = Object.keys(userSessionMap);
    let topUsersData: any[] = [];
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, current_role')
        .in('id', userIds);
      topUsersData = (profiles || []).map((p: any) => ({
        ...p, sessions: userSessionMap[p.id] || 0,
      })).sort((a: any, b: any) => b.sessions - a.sessions).slice(0, 5);
    }

    setTopUsers(topUsersData);
    setTopCohorts(cohorts.data || []);
    setUpcomingEvents(events.data || []);
    setRecentSignups(recentUsers.data || []);
    setLoading(false);
  }

  const maxSessions = Math.max(...dailyActivity.map((d) => d.sessions), 1);

  // ─── Loading State ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div
        style={{
          minHeight: '60vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '12px',
        }}
      >
        {/* Animated gold ring */}
        <div style={{
          width: '36px',
          height: '36px',
          borderRadius: '50%',
          border: '2px solid #2E2A22',
          borderTopColor: '#E8A020',
          animation: 'ascentor-spin 0.9s linear infinite',
        }} />
        <p style={{
          fontFamily: "'DM Mono', monospace",
          fontSize: '11px',
          letterSpacing: '0.12em',
          color: '#4A4438',
          textTransform: 'uppercase',
        }}>
          Loading dashboard...
        </p>
        <style>{`@keyframes ascentor-spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // ─── Shared style tokens ──────────────────────────────────────────────────
  const card: React.CSSProperties = {
    background: '#141310',
    border: '1px solid #2E2A22',
    borderRadius: '12px',
    padding: '20px',
  };

  const monoLabel: React.CSSProperties = {
    fontFamily: "'DM Mono', monospace",
    fontSize: '10px',
    letterSpacing: '0.1em',
    textTransform: 'uppercase' as const,
    color: '#4A4438',
  };

  const sectionTitle: React.CSSProperties = {
    fontFamily: "'Syne', sans-serif",
    fontSize: '13px',
    fontWeight: 600,
    color: '#D4CFC3',
    letterSpacing: '0.02em',
  };

  const goldText: React.CSSProperties = {
    color: '#E8A020',
  };

  // ─── Stat card data ───────────────────────────────────────────────────────
  const statCards = [
    { value: stats.totalUsers,      label: 'Total Users',      sub: `+${stats.newUsers7d} this week`,  href: '/admin/users',    accent: '#E8A020' },
    { value: stats.totalSessions,   label: 'AI Sessions',      sub: `+${stats.sessions7d} this week`,  href: '/admin/coaching', accent: '#E8A020' },
    { value: stats.totalPosts,      label: 'Community Posts',  sub: `+${stats.posts7d} this week`,     href: '/admin/coaching', accent: '#14B8A6' },
    { value: stats.publishedCourses,label: 'Courses',          sub: 'Published',                       href: '/admin/courses',  accent: '#8B5CF6' },
    { value: stats.upcomingEvents,  label: 'Upcoming Events',  sub: 'Scheduled',                       href: '/admin/experts',  accent: '#E8A020' },
  ];

  const quickActions = [
    { label: 'Create Cohort',    href: '/admin/cohorts?action=create' },
    { label: 'Add Expert Event', href: '/admin/experts?action=create' },
    { label: 'Add Course',       href: '/admin/courses?action=create' },
    { label: 'Manage Roles',     href: '/admin/users' },
  ];

  return (
    <div style={{ animation: 'ascentor-fade-up 0.4s ease both' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600;700&family=Syne:wght@400;600;700;800&family=DM+Mono:wght@400;500&display=swap');
        @keyframes ascentor-fade-up {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes ascentor-spin { to { transform: rotate(360deg); } }
        .ascentor-stat-card:hover  { border-color: #4A4438 !important; }
        .ascentor-action-btn:hover { border-color: #E8A020 !important; background: #1E1C17 !important; }
        .ascentor-link:hover       { color: #F5C55A !important; }
      `}</style>

      {/* ─── Page Header ──────────────────────────────────────────────────── */}
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{
          fontFamily: "'Cormorant Garamond', serif",
          fontSize: '28px',
          fontWeight: 700,
          color: '#FEF9EC',
          lineHeight: 1.1,
          marginBottom: '6px',
        }}>
          Admin Dashboard
        </h1>
        <p style={{ ...monoLabel }}>
          Platform overview&nbsp;&middot;&nbsp;Last updated {new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
        </p>
      </div>

      {/* ─── Stat Cards ───────────────────────────────────────────────────── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: '10px',
        marginBottom: '24px',
      }}
        className="lg:grid-cols-5"
      >
        {statCards.map((s) => (
          <Link key={s.label} href={s.href} style={{ textDecoration: 'none' }}>
            <div
              className="ascentor-stat-card"
              style={{
                background: '#141310',
                border: '1px solid #2E2A22',
                borderRadius: '12px',
                padding: '16px',
                cursor: 'pointer',
                transition: 'border-color 0.2s',
              }}
            >
              {/* Sub-label pill */}
              <div style={{ marginBottom: '10px' }}>
                <span style={{
                  ...monoLabel,
                  background: `${s.accent}18`,
                  color: s.accent,
                  padding: '2px 8px',
                  borderRadius: '100px',
                  fontSize: '9px',
                }}>
                  {s.sub}
                </span>
              </div>
              {/* Value */}
              <div style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontSize: '30px',
                fontWeight: 700,
                color: s.accent,
                lineHeight: 1,
                marginBottom: '4px',
              }}>
                {s.value.toLocaleString()}
              </div>
              {/* Label */}
              <div style={{ ...monoLabel }}>{s.label}</div>
            </div>
          </Link>
        ))}
      </div>

      {/* ─── Activity Chart ────────────────────────────────────────────────── */}
      <div style={{ ...card, marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <span style={{ ...sectionTitle }}>Activity — Last 14 Days</span>
          <div style={{ display: 'flex', gap: '16px' }}>
            <span style={{ ...monoLabel, display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '2px', background: '#E8A020', opacity: 0.7 }} />
              Sessions
            </span>
            <span style={{ ...monoLabel, display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#14B8A6' }} />
              Active Users
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '5px', height: '80px' }}>
          {dailyActivity.map((d) => (
            <div key={d.day} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', height: '100%', justifyContent: 'flex-end' }}>
              <div style={{ width: '100%', position: 'relative', display: 'flex', alignItems: 'flex-end', height: '64px' }}>
                {/* Sessions bar */}
                <div style={{
                  width: '100%',
                  height: `${Math.max((d.sessions / maxSessions) * 100, d.sessions > 0 ? 6 : 2)}%`,
                  background: '#E8A020',
                  opacity: 0.65,
                  borderRadius: '3px 3px 0 0',
                  transition: 'height 0.3s ease',
                }} />
                {/* Users dot */}
                {d.users > 0 && (
                  <div style={{
                    position: 'absolute',
                    width: '5px',
                    height: '5px',
                    borderRadius: '50%',
                    background: '#14B8A6',
                    bottom: `${Math.max((d.users / Math.max(...dailyActivity.map((x) => x.users), 1)) * 100, 5)}%`,
                    left: '50%',
                    transform: 'translateX(-50%)',
                  }} />
                )}
              </div>
              <span style={{ ...monoLabel, fontSize: '8px' }}>
                {new Date(d.day).toLocaleDateString('en-US', { day: 'numeric' })}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ─── Two Columns ──────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}
        className="lg:grid-cols-2 grid-cols-1">

        {/* Session Types */}
        <div style={{ ...card }}>
          <span style={{ ...sectionTitle }}>Session Types — 30d</span>
          <div style={{ marginTop: '14px' }}>
            {sessionTypes.length === 0 ? (
              <p style={{ ...monoLabel }}>No session data yet</p>
            ) : sessionTypes.map((t) => {
              const total = sessionTypes.reduce((s, x) => s + x.count, 0);
              const pct = Math.round((t.count / total) * 100);
              return (
                <div key={t.type} style={{ marginBottom: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                    <span style={{ fontFamily: "'Syne', sans-serif", fontSize: '12px', color: '#D4CFC3', textTransform: 'capitalize' }}>
                      {t.type.replace(/_/g, ' ')}
                    </span>
                    <span style={{ ...monoLabel }}>{t.count} ({pct}%)</span>
                  </div>
                  <div style={{ width: '100%', height: '3px', borderRadius: '2px', background: '#2E2A22' }}>
                    <div style={{ height: '100%', borderRadius: '2px', width: `${pct}%`, background: '#E8A020', transition: 'width 0.4s ease' }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top Users */}
        <div style={{ ...card }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <span style={{ ...sectionTitle }}>Top Users — 30d</span>
            <Link href="/admin/users" className="ascentor-link" style={{ ...monoLabel, color: '#E8A020', textDecoration: 'none', transition: 'color 0.15s' }}>
              View all
            </Link>
          </div>
          {topUsers.length === 0 ? (
            <p style={{ ...monoLabel }}>No active users yet</p>
          ) : topUsers.map((u, i) => (
            <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '9px 0', borderBottom: '1px solid #2E2A22' }}>
              <span style={{
                fontFamily: "'DM Mono', monospace",
                fontSize: '11px',
                fontWeight: 500,
                width: '18px',
                textAlign: 'center',
                color: i === 0 ? '#E8A020' : '#4A4438',
              }}>
                {i + 1}
              </span>
              <div style={{ flex: 1 }}>
                <p style={{ fontFamily: "'Syne', sans-serif", fontSize: '13px', color: '#D4CFC3', marginBottom: '2px' }}>
                  {u.full_name || 'Unknown'}
                </p>
                <p style={{ ...monoLabel }}>{u.current_role || ''}</p>
              </div>
              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '11px', fontWeight: 500, color: '#E8A020' }}>
                {u.sessions} sessions
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ─── Three Columns ────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '16px' }}
        className="lg:grid-cols-3 grid-cols-1">

        {/* Recent Signups */}
        <div style={{ ...card }}>
          <div style={{ ...sectionTitle, marginBottom: '14px' }}>Recent Signups</div>
          {recentSignups.map((u) => (
            <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0', borderBottom: '1px solid #2E2A22' }}>
              <div style={{
                width: '28px', height: '28px', borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: "'Syne', sans-serif", fontSize: '12px', fontWeight: 700,
                background: '#1E1C17', color: '#E8A020', border: '1px solid #2E2A22',
                flexShrink: 0,
              }}>
                {(u.full_name || '?').charAt(0).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontFamily: "'Syne', sans-serif", fontSize: '12px', color: '#D4CFC3', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {u.full_name || 'No name'}
                </p>
                <p style={{ ...monoLabel, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {u.industry || u.current_role || ''}
                </p>
              </div>
              <span style={{ ...monoLabel, flexShrink: 0 }}>
                {new Date(u.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
            </div>
          ))}
        </div>

        {/* Top Cohorts */}
        <div style={{ ...card }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <span style={{ ...sectionTitle }}>Top Cohorts</span>
            <Link href="/admin/cohorts" className="ascentor-link" style={{ ...monoLabel, color: '#E8A020', textDecoration: 'none', transition: 'color 0.15s' }}>
              Manage
            </Link>
          </div>
          {topCohorts.length === 0 ? (
            <p style={{ ...monoLabel }}>No cohorts yet</p>
          ) : topCohorts.map((c) => (
            <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 0', borderBottom: '1px solid #2E2A22' }}>
              {/* Replace emoji icon with styled initial badge */}
              <div style={{
                width: '28px', height: '28px', borderRadius: '6px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: '#1E1C17', border: '1px solid #2E2A22',
                fontFamily: "'Syne', sans-serif", fontSize: '11px', fontWeight: 700, color: '#E8A020',
                flexShrink: 0,
              }}>
                {(c.name || 'C').charAt(0).toUpperCase()}
              </div>
              <span style={{ fontFamily: "'Syne', sans-serif", fontSize: '12px', flex: 1, color: '#D4CFC3' }}>{c.name}</span>
              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '11px', fontWeight: 500, color: '#14B8A6' }}>
                {c.member_count || 0}
              </span>
            </div>
          ))}
        </div>

        {/* Upcoming Events */}
        <div style={{ ...card }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <span style={{ ...sectionTitle }}>Upcoming Events</span>
            <Link href="/admin/experts" className="ascentor-link" style={{ ...monoLabel, color: '#E8A020', textDecoration: 'none', transition: 'color 0.15s' }}>
              Manage
            </Link>
          </div>
          {upcomingEvents.length === 0 ? (
            <p style={{ ...monoLabel }}>No upcoming events</p>
          ) : upcomingEvents.map((e) => (
            <div key={e.id} style={{ padding: '9px 0', borderBottom: '1px solid #2E2A22' }}>
              <p style={{ fontFamily: "'Syne', sans-serif", fontSize: '13px', color: '#D4CFC3', marginBottom: '3px' }}>{e.title}</p>
              <p style={{ ...monoLabel }}>
                {e.expert_name}&nbsp;&middot;&nbsp;
                {new Date(e.scheduled_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* ─── Quick Actions ────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}
        className="lg:grid-cols-4 grid-cols-2">
        {quickActions.map((a) => (
          <Link key={a.label} href={a.href} style={{ textDecoration: 'none' }}>
            <div
              className="ascentor-action-btn"
              style={{
                background: '#141310',
                border: '1px solid #2E2A22',
                borderRadius: '10px',
                padding: '14px 12px',
                textAlign: 'center',
                cursor: 'pointer',
                transition: 'border-color 0.2s, background 0.2s',
              }}
            >
              {/* Gold accent line instead of emoji */}
              <div style={{ width: '20px', height: '2px', background: '#E8A020', margin: '0 auto 10px' }} />
              <p style={{ fontFamily: "'Syne', sans-serif", fontSize: '12px', fontWeight: 600, color: '#D4CFC3' }}>
                {a.label}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
