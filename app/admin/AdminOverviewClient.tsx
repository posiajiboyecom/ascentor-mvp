'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import SageLoader from '@/components/SageLoader';


// Renders SVG icon strings safely  
function SvgIcon({ html, className, style }: { html: string; className?: string; style?: React.CSSProperties }) {
  return <span className={className} style={style} dangerouslySetInnerHTML={{ __html: html }} />;
}

export default function AdminOverviewClient() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);

  const [stats, setStats] = useState({
    totalUsers: 0, newUsers7d: 0, newUsers30d: 0,
    totalSessions: 0, sessions7d: 0,
    totalPosts: 0, posts7d: 0,
    publishedCourses: 0, upcomingEvents: 0,
    openJobs: 0,
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
      allSessions, cohorts, events, recentUsers, openJobs,
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
      // Detailed data
      supabase.from('coaching_sessions').select('user_id, session_type, created_at').gte('created_at', d30).order('created_at'),
      supabase.from('cohorts').select('id, name, member_count, icon').order('member_count', { ascending: false }).limit(5),
      supabase.from('expert_sessions').select('*').eq('status', 'scheduled').order('scheduled_at').limit(3),
      supabase.from('profiles').select('id, full_name, email, current_role, industry, created_at').order('created_at', { ascending: false }).limit(8),
      supabase.from('job_listings').select('id', { count: 'exact', head: true }).eq('is_active', true),
    ]);

    setStats({
      totalUsers: usersAll.count || 0, newUsers7d: users7d.count || 0, newUsers30d: users30d.count || 0,
      totalSessions: sessAll.count || 0, sessions7d: sess7d.count || 0,
      totalPosts: postsAll.count || 0, posts7d: posts7d.count || 0,
      publishedCourses: coursesP.count || 0, upcomingEvents: eventsUp.count || 0,
      openJobs: openJobs.count || 0,
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

  if (loading) {
    return <SageLoader fullScreen message="Loading dashboard…" />;
  }

  return (
    <div className="animate-fade-up">
      <h1 className="text-xl lg:text-2xl font-semibold mb-1"
        style={{ fontFamily: "'Playfair Display', serif", color: 'var(--text)' }}>
        Admin Dashboard
      </h1>
      <p className="text-sm mb-5" style={{ color: 'var(--text-muted)' }}>
        Platform overview · Last updated {new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
      </p>

      {/* ═══ TOP STAT CARDS ═══ */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-2.5 mb-6">
        {[
          { icon: '<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>', value: stats.totalUsers, label: 'Total Users', sub: `+${stats.newUsers7d} this week`, color: 'var(--blue)', href: '/admin/users' },
          { icon: '<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>', value: stats.totalSessions, label: 'AI Sessions', sub: `+${stats.sessions7d} this week`, color: 'var(--accent)', href: '/admin/coaching' },
          { icon: '<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>', value: stats.totalPosts, label: 'Community Posts', sub: `+${stats.posts7d} this week`, color: 'var(--teal)', href: '/admin/coaching' },
          { icon: '<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>', value: stats.publishedCourses, label: 'Courses', sub: 'Published', color: 'var(--purple)', href: '/admin/courses' },
          { icon: '<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>', value: stats.upcomingEvents, label: 'Upcoming Events', sub: 'Scheduled', color: 'var(--success)', href: '/admin/experts' },
          { icon: '<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v3"/></svg>', value: stats.openJobs, label: 'Open Roles', sub: 'Live on /careers', color: 'var(--accent)', href: '/admin/careers' },
        ].map((s) => (
          <Link key={s.label} href={s.href}>
            <div className="rounded-xl p-3.5 transition-all hover:border-gray-600 cursor-pointer"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
              <div className="flex justify-between items-start mb-1.5">
                <span className="text-xl" dangerouslySetInnerHTML={{ __html: s.icon }} />
                <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full"
                  style={{ background: `color-mix(in srgb, ${s.color} 12%, transparent)`, color: s.color }}>
                  {s.sub}
                </span>
              </div>
              <div className="text-xl lg:text-2xl font-bold" style={{ fontFamily: "'Playfair Display', serif", color: s.color }}>
                {s.value.toLocaleString()}
              </div>
              <div className="text-[10px] mt-0.5" style={{ color: 'var(--text-dim)' }}>{s.label}</div>
            </div>
          </Link>
        ))}
      </div>

      {/* ═══ ACTIVITY CHART (last 14 days) ═══ */}
      <div className="rounded-xl p-5 mb-5" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        <div className="flex justify-between items-center mb-4">
          <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}><svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg> Activity — Last 14 Days</span>
          <div className="flex gap-3 text-[10px]" style={{ color: 'var(--text-dim)' }}>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full" style={{ background: 'var(--accent)' }} /> Sessions
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full" style={{ background: 'var(--blue)' }} /> Active Users
            </span>
          </div>
        </div>
        <div className="flex items-end gap-[3px] h-32">
          {dailyActivity.map((d, i) => (
            <div key={d.day} className="flex-1 flex flex-col items-center gap-1">
              <div className="w-full flex flex-col items-center justify-end h-24 relative">
                {/* Sessions bar */}
                <div className="w-full rounded-t-sm transition-all"
                  style={{
                    height: `${Math.max((d.sessions / maxSessions) * 100, 2)}%`,
                    background: 'var(--accent)',
                    opacity: 0.7,
                  }} />
                {/* Users dot */}
                {d.users > 0 && (
                  <div className="absolute w-1.5 h-1.5 rounded-full"
                    style={{
                      background: 'var(--blue)',
                      bottom: `${Math.max((d.users / Math.max(...dailyActivity.map((x) => x.users), 1)) * 100, 5)}%`,
                    }} />
                )}
              </div>
              <span className="text-[8px] leading-none" style={{ color: 'var(--text-dim)' }}>
                {new Date(d.day).toLocaleDateString('en-US', { day: 'numeric' })}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ═══ TWO COLUMNS ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">

        {/* Session Types Breakdown */}
        <div className="rounded-xl p-5" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}><svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg> Session Types (30d)</span>
          <div className="mt-3">
            {sessionTypes.length === 0 ? (
              <p className="text-xs" style={{ color: 'var(--text-dim)' }}>No session data yet</p>
            ) : sessionTypes.map((t) => {
              const total = sessionTypes.reduce((s, x) => s + x.count, 0);
              const pct = Math.round((t.count / total) * 100);
              return (
                <div key={t.type} className="mb-2.5">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="capitalize" style={{ color: 'var(--text-muted)' }}>{t.type.replace(/_/g, ' ')}</span>
                    <span style={{ color: 'var(--text-dim)' }}>{t.count} ({pct}%)</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full" style={{ background: 'var(--bg-input)' }}>
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: 'var(--accent)' }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top Users by Engagement */}
        <div className="rounded-xl p-5" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <div className="flex justify-between items-center mb-3">
            <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}><svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg> Top Users (30d)</span>
            <Link href="/admin/users" className="text-xs" style={{ color: 'var(--accent)' }}>View all →</Link>
          </div>
          {topUsers.length === 0 ? (
            <p className="text-xs" style={{ color: 'var(--text-dim)' }}>No active users yet</p>
          ) : topUsers.map((u, i) => (
            <div key={u.id} className="flex items-center gap-3 py-2"
              style={{ borderBottom: '1px solid var(--border)' }}>
              <span className="text-xs font-bold w-5 text-center"
                style={{ color: i === 0 ? 'var(--accent)' : 'var(--text-dim)' }}>
                {i + 1}
              </span>
              <div className="flex-1">
                <p className="text-sm" style={{ color: 'var(--text)' }}>{u.full_name || 'Unknown'}</p>
                <p className="text-[10px]" style={{ color: 'var(--text-dim)' }}>{u.current_role || ''}</p>
              </div>
              <span className="text-xs font-bold" style={{ color: 'var(--accent)' }}>
                {u.sessions} sessions
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ═══ THREE COLUMNS ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-5">

        {/* Recent Signups */}
        <div className="rounded-xl p-5" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <div className="flex justify-between items-center mb-3">
            <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>New Signups</span>
          </div>
          {recentSignups.map((u) => (
            <div key={u.id} className="flex items-center gap-2 py-1.5"
              style={{ borderBottom: '1px solid var(--border)' }}>
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                style={{ background: 'rgba(59,130,246,0.09)', color: 'var(--blue)' }}>
                {(u.full_name || '?').charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate" style={{ color: 'var(--text)' }}>{u.full_name || 'No name'}</p>
                <p className="text-[10px] truncate" style={{ color: 'var(--text-dim)' }}>{u.industry || u.current_role || ''}</p>
              </div>
              <span className="text-[10px] shrink-0" style={{ color: 'var(--text-dim)' }}>
                {new Date(u.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
            </div>
          ))}
        </div>

        {/* Top Cohorts */}
        <div className="rounded-xl p-5" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <div className="flex justify-between items-center mb-3">
            <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Top Cohorts</span>
            <Link href="/admin/cohorts" className="text-xs" style={{ color: 'var(--accent)' }}>Manage →</Link>
          </div>
          {topCohorts.length === 0 ? (
            <p className="text-xs" style={{ color: 'var(--text-dim)' }}>No cohorts yet</p>
          ) : topCohorts.map((c) => (
            <div key={c.id} className="flex items-center gap-2 py-2"
              style={{ borderBottom: '1px solid var(--border)' }}>
              <span className="text-lg" dangerouslySetInnerHTML={{ __html: c.icon || "" }} />
              <span className="text-sm flex-1" style={{ color: 'var(--text-muted)' }}>{c.name}</span>
              <span className="text-xs font-semibold" style={{ color: 'var(--teal)' }}>
                {c.member_count || 0}
              </span>
            </div>
          ))}
        </div>

        {/* Upcoming Events */}
        <div className="rounded-xl p-5" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <div className="flex justify-between items-center mb-3">
            <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}><svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg> Upcoming Events</span>
            <Link href="/admin/experts" className="text-xs" style={{ color: 'var(--accent)' }}>Manage →</Link>
          </div>
          {upcomingEvents.length === 0 ? (
            <p className="text-xs" style={{ color: 'var(--text-dim)' }}>No upcoming events</p>
          ) : upcomingEvents.map((e) => (
            <div key={e.id} className="py-2" style={{ borderBottom: '1px solid var(--border)' }}>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{e.title}</p>
              <p className="text-[10px]" style={{ color: 'var(--text-dim)' }}>
                {e.expert_name} · {new Date(e.scheduled_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-2.5">
        {[
          { label: 'Create Cohort', href: '/admin/cohorts?action=create', icon: '<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>' },
          { label: 'Add Expert Event', href: '/admin/experts?action=create', icon: '<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a4 4 0 0 0-4 4v7a4 4 0 0 0 8 0V5a4 4 0 0 0-4-4z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>' },
          { label: 'Add Course', href: '/admin/courses?action=create', icon: '<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>' },
          { label: 'Manage Roles', href: '/admin/users', icon: '<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>' },
          { label: 'Manage Careers', href: '/admin/careers', icon: '<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v3"/></svg>' },
          { label: 'Master Marketing', href: '/admin/master', icon: '<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/></svg>' },
        ].map((a) => (
          <Link key={a.label} href={a.href}>
            <div className="rounded-lg p-3 text-center transition-all hover:border-gray-600 cursor-pointer"
              style={{ background: 'var(--bg-input)', border: '1px solid var(--border)' }}>
              <SvgIcon html={a.icon} style={{ display: "flex", justifyContent: "center", alignItems: "center", color: "var(--accent)" }} />
              <p className="text-xs font-semibold mt-1" style={{ color: 'var(--text-muted)' }}>{a.label}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
