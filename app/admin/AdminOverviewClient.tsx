'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';

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

    const dayMap: Record<string, { users: Set<string>; sessions: number }> = {};
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 86400000);
      const key = d.toISOString().split('T')[0];
      dayMap[key] = { users: new Set(), sessions: 0 };
    }
    allSessions.data?.forEach((s: any) => {
      const key = s.created_at.split('T')[0];
      if (dayMap[key]) { dayMap[key].users.add(s.user_id); dayMap[key].sessions++; }
    });
    setDailyActivity(Object.entries(dayMap).map(([day, v]) => ({ day, users: v.users.size, sessions: v.sessions })));

    const typeMap: Record<string, number> = {};
    allSessions.data?.forEach((s: any) => {
      const t = s.session_type || 'general';
      typeMap[t] = (typeMap[t] || 0) + 1;
    });
    setSessionTypes(Object.entries(typeMap).map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count));

    const userSessionMap: Record<string, number> = {};
    allSessions.data?.forEach((s: any) => { userSessionMap[s.user_id] = (userSessionMap[s.user_id] || 0) + 1; });
    const userIds = Object.keys(userSessionMap);
    let topUsersData: any[] = [];
    if (userIds.length > 0) {
      const { data: profiles } = await supabase.from('profiles').select('id, full_name, current_role').in('id', userIds);
      topUsersData = (profiles || []).map((p: any) => ({ ...p, sessions: userSessionMap[p.id] || 0 }))
        .sort((a: any, b: any) => b.sessions - a.sessions).slice(0, 5);
    }

    setTopUsers(topUsersData);
    setTopCohorts(cohorts.data || []);
    setUpcomingEvents(events.data || []);
    setRecentSignups(recentUsers.data || []);
    setLoading(false);
  }

  const maxSessions = Math.max(...dailyActivity.map((d) => d.sessions), 1);
  const maxUsers = Math.max(...dailyActivity.map((d) => d.users), 1);

  // Secondary color palette for cycling
  const barColors = ['#6662FF', '#A6A2FF', '#CFFF5E', '#FD81FD', '#6662FF', '#A6A2FF', '#CFFF5E'];
  const typeColors = ['#6662FF', '#A6A2FF', '#FD81FD', '#CFFF5E'];

  if (loading) {
    return (
      <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&family=DM+Sans:wght@400;500;600&display=swap');`}</style>
        <div className="py-20 text-center">
          <div style={{
            width: 48, height: 48, borderRadius: '50%', margin: '0 auto 16px',
            border: '3px solid rgba(102,98,255,0.15)',
            borderTop: '3px solid #6662FF',
            animation: 'spin 0.9s linear infinite',
          }} />
          <p className="text-sm" style={{ color: 'var(--text-muted)', fontFamily: "'DM Sans', sans-serif" }}>
            Loading dashboard...
          </p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&family=DM+Sans:wght@400;500;600&display=swap');

        .admin-stat-card { transition: transform 0.2s, box-shadow 0.2s; }
        .admin-stat-card:hover { transform: translateY(-2px); }

        .admin-quick-action { transition: transform 0.18s, border-color 0.18s, box-shadow 0.18s; }
        .admin-quick-action:hover { transform: translateY(-2px); }

        .bar-col:hover .bar-fill { opacity: 1 !important; }

        @keyframes admin-fade-up {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .admin-fade-in { animation: admin-fade-up 0.5s ease both; }
        .admin-fade-in:nth-child(1) { animation-delay: 0.05s; }
        .admin-fade-in:nth-child(2) { animation-delay: 0.1s; }
        .admin-fade-in:nth-child(3) { animation-delay: 0.15s; }
        .admin-fade-in:nth-child(4) { animation-delay: 0.2s; }
        .admin-fade-in:nth-child(5) { animation-delay: 0.25s; }

        .rank-badge-1 { background: linear-gradient(135deg, #CFFF5E, #A6A2FF); color: #1E1E1E; }
        .rank-badge-2 { background: linear-gradient(135deg, #A6A2FF, #6662FF); color: #fff; }
        .rank-badge-3 { background: linear-gradient(135deg, #FD81FD, #A6A2FF); color: #fff; }
        .rank-badge-other { background: rgba(102,98,255,0.1); color: #6662FF; }

        .signup-avatar-0 { background: linear-gradient(135deg, #6662FF, #A6A2FF); color: #fff; }
        .signup-avatar-1 { background: linear-gradient(135deg, #A6A2FF, #FD81FD); color: #fff; }
        .signup-avatar-2 { background: linear-gradient(135deg, #CFFF5E, #6662FF); color: #fff; }
        .signup-avatar-3 { background: linear-gradient(135deg, #FD81FD, #6662FF); color: #fff; }
      `}</style>

      <div className="animate-fade-up">

        {/* ═══ PAGE HEADER ═══ */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div style={{
                width: 8, height: 8, borderRadius: '50%',
                background: '#CFFF5E',
                boxShadow: '0 0 8px rgba(207,255,94,0.8)',
                animation: 'admin-pulse 2s ease infinite',
              }} />
              <span className="text-[11px] font-bold uppercase tracking-widest"
                style={{ color: 'var(--text-dim)', fontFamily: "'DM Sans', sans-serif" }}>
                Live
              </span>
            </div>
            <h1 className="text-2xl lg:text-3xl font-extrabold"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", color: 'var(--text)', letterSpacing: '-0.04em' }}>
              Admin Dashboard
            </h1>
            <p className="text-sm mt-1" style={{ color: 'var(--text-muted)', fontFamily: "'DM Sans', sans-serif" }}>
              Platform overview · Updated {new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
            </p>
          </div>
          <div className="hidden lg:flex items-center gap-2">
            <div style={{
              padding: '8px 16px', borderRadius: 10,
              background: 'linear-gradient(135deg, rgba(102,98,255,0.1), rgba(253,129,253,0.08))',
              border: '1px solid rgba(102,98,255,0.2)',
            }}>
              <span className="text-xs font-semibold" style={{ color: '#A6A2FF', fontFamily: "'DM Sans', sans-serif" }}>
                🛡️ Admin Panel
              </span>
            </div>
          </div>
        </div>
        <style>{`@keyframes admin-pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.5;transform:scale(0.7)} }`}</style>

        {/* ═══ TOP STAT CARDS ═══ */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
          {[
            {
              icon: '👥', value: stats.totalUsers, label: 'Total Users',
              sub: `+${stats.newUsers7d} this week`,
              gradient: 'linear-gradient(135deg, #6662FF, #A6A2FF)',
              glow: 'rgba(102,98,255,0.25)',
              badge: 'rgba(102,98,255,0.12)', badgeText: '#6662FF',
              href: '/admin/users',
            },
            {
              icon: '💬', value: stats.totalSessions, label: 'AI Sessions',
              sub: `+${stats.sessions7d} this week`,
              gradient: 'linear-gradient(135deg, #A6A2FF, #FD81FD)',
              glow: 'rgba(253,129,253,0.2)',
              badge: 'rgba(253,129,253,0.12)', badgeText: '#C040C0',
              href: '/admin/coaching',
            },
            {
              icon: '📝', value: stats.totalPosts, label: 'Community Posts',
              sub: `+${stats.posts7d} this week`,
              gradient: 'linear-gradient(135deg, #CFFF5E, #6662FF)',
              glow: 'rgba(207,255,94,0.2)',
              badge: 'rgba(207,255,94,0.15)', badgeText: '#5A7A00',
              href: '/admin/coaching',
            },
            {
              icon: '📚', value: stats.publishedCourses, label: 'Live Courses',
              sub: 'Published',
              gradient: 'linear-gradient(135deg, #FD81FD, #A6A2FF)',
              glow: 'rgba(253,129,253,0.18)',
              badge: 'rgba(166,162,255,0.12)', badgeText: '#6662FF',
              href: '/admin/courses',
            },
            {
              icon: '🎓', value: stats.upcomingEvents, label: 'Upcoming Events',
              sub: 'Scheduled',
              gradient: 'linear-gradient(135deg, #6662FF, #CFFF5E)',
              glow: 'rgba(207,255,94,0.15)',
              badge: 'rgba(102,98,255,0.1)', badgeText: '#A6A2FF',
              href: '/admin/experts',
            },
          ].map((s, idx) => (
            <Link key={s.label} href={s.href} className="admin-fade-in">
              <div className="admin-stat-card rounded-2xl p-4 relative overflow-hidden cursor-pointer"
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  boxShadow: `0 4px 24px ${s.glow}`,
                }}>
                {/* Gradient top strip */}
                <div style={{
                  position: 'absolute', top: 0, left: 0, right: 0, height: 3,
                  background: s.gradient,
                }} />
                {/* Glow orb */}
                <div style={{
                  position: 'absolute', top: -20, right: -20, width: 80, height: 80,
                  borderRadius: '50%',
                  background: `radial-gradient(circle, ${s.glow} 0%, transparent 70%)`,
                  pointerEvents: 'none',
                }} />
                <div className="flex justify-between items-start mb-3">
                  <div style={{
                    width: 36, height: 36, borderRadius: 10,
                    background: s.gradient,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 18, boxShadow: `0 4px 12px ${s.glow}`,
                  }}>
                    {s.icon}
                  </div>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                    style={{ background: s.badge, color: s.badgeText, fontFamily: "'DM Sans', sans-serif" }}>
                    {s.sub}
                  </span>
                </div>
                <div className="text-2xl lg:text-3xl font-extrabold"
                  style={{
                    fontFamily: "'Plus Jakarta Sans', sans-serif",
                    letterSpacing: '-0.04em',
                    background: s.gradient,
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                  }}>
                  {s.value.toLocaleString()}
                </div>
                <div className="text-[11px] mt-1 font-medium" style={{ color: 'var(--text-dim)', fontFamily: "'DM Sans', sans-serif" }}>
                  {s.label}
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* ═══ ACTIVITY CHART ═══ */}
        <div className="rounded-2xl p-5 mb-5 relative overflow-hidden"
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            boxShadow: '0 4px 32px rgba(102,98,255,0.08)',
          }}>
          {/* Background glow */}
          <div style={{
            position: 'absolute', bottom: 0, left: '30%', right: '30%', height: 80,
            background: 'radial-gradient(ellipse, rgba(102,98,255,0.08) 0%, transparent 70%)',
            pointerEvents: 'none',
          }} />

          <div className="flex justify-between items-center mb-5">
            <div>
              <h3 className="text-sm font-bold" style={{ color: 'var(--text)', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                Activity — Last 14 Days
              </h3>
              <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-dim)', fontFamily: "'DM Sans', sans-serif" }}>
                Coaching sessions & active users per day
              </p>
            </div>
            <div className="flex gap-4 text-[11px]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm" style={{ background: 'linear-gradient(135deg, #6662FF, #A6A2FF)', display: 'inline-block' }} />
                <span style={{ color: 'var(--text-dim)' }}>Sessions</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#CFFF5E', display: 'inline-block', boxShadow: '0 0 6px rgba(207,255,94,0.6)' }} />
                <span style={{ color: 'var(--text-dim)' }}>Active Users</span>
              </span>
            </div>
          </div>

          <div className="flex items-end gap-1 h-36 relative">
            {dailyActivity.map((d, i) => (
              <div key={d.day} className="flex-1 flex flex-col items-center gap-1 bar-col group">
                <div className="w-full flex flex-col items-center justify-end h-28 relative">
                  {/* Sessions bar — gradient */}
                  <div className="w-full rounded-t-md bar-fill transition-all"
                    style={{
                      height: `${Math.max((d.sessions / maxSessions) * 100, 3)}%`,
                      background: i % 2 === 0
                        ? 'linear-gradient(180deg, #6662FF, rgba(102,98,255,0.4))'
                        : 'linear-gradient(180deg, #A6A2FF, rgba(166,162,255,0.4))',
                      opacity: 0.75,
                    }} />
                  {/* Users dot — green yellow */}
                  {d.users > 0 && (
                    <div className="absolute w-2 h-2 rounded-full transition-all"
                      style={{
                        background: '#CFFF5E',
                        boxShadow: '0 0 6px rgba(207,255,94,0.7)',
                        bottom: `${Math.max((d.users / maxUsers) * 100, 6)}%`,
                        zIndex: 2,
                      }} />
                  )}
                  {/* Tooltip on hover */}
                  <div className="absolute bottom-full mb-1 hidden group-hover:flex flex-col items-center z-10"
                    style={{ left: '50%', transform: 'translateX(-50%)' }}>
                    <div style={{
                      background: 'var(--bg-card)',
                      border: '1px solid rgba(102,98,255,0.3)',
                      borderRadius: 6, padding: '3px 7px',
                      whiteSpace: 'nowrap',
                      boxShadow: '0 4px 12px rgba(102,98,255,0.2)',
                    }}>
                      <span className="text-[9px] font-semibold" style={{ color: '#6662FF', fontFamily: "'DM Sans', sans-serif" }}>
                        {d.sessions}s · {d.users}u
                      </span>
                    </div>
                  </div>
                </div>
                <span className="text-[8px] leading-none" style={{ color: 'var(--text-dim)', fontFamily: "'DM Sans', sans-serif" }}>
                  {new Date(d.day).toLocaleDateString('en-US', { day: 'numeric' })}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* ═══ TWO COLUMNS ═══ */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">

          {/* Session Types */}
          <div className="rounded-2xl p-5 relative overflow-hidden"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <div style={{
              position: 'absolute', top: -30, right: -30, width: 120, height: 120, borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(253,129,253,0.08) 0%, transparent 70%)',
              pointerEvents: 'none',
            }} />
            <div className="flex items-center gap-2 mb-4">
              <div style={{
                width: 28, height: 28, borderRadius: 8,
                background: 'linear-gradient(135deg, #FD81FD, #A6A2FF)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14,
              }}>🎯</div>
              <span className="text-sm font-bold" style={{ color: 'var(--text)', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                Session Types
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full ml-auto"
                style={{ background: 'rgba(166,162,255,0.12)', color: '#A6A2FF', fontFamily: "'DM Sans', sans-serif" }}>
                Last 30 days
              </span>
            </div>
            <div className="mt-2">
              {sessionTypes.length === 0 ? (
                <p className="text-xs" style={{ color: 'var(--text-dim)', fontFamily: "'DM Sans', sans-serif" }}>No session data yet</p>
              ) : sessionTypes.map((t, idx) => {
                const total = sessionTypes.reduce((s, x) => s + x.count, 0);
                const pct = Math.round((t.count / total) * 100);
                const color = typeColors[idx % typeColors.length];
                const isLight = color === '#CFFF5E';
                return (
                  <div key={t.type} className="mb-3">
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="capitalize font-medium" style={{ color: 'var(--text-muted)', fontFamily: "'DM Sans', sans-serif" }}>
                        {t.type.replace(/_/g, ' ')}
                      </span>
                      <span className="font-bold" style={{ color: isLight ? '#5A7A00' : color, fontFamily: "'DM Sans', sans-serif" }}>
                        {t.count} · {pct}%
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg-input)' }}>
                      <div className="h-full rounded-full transition-all"
                        style={{
                          width: `${pct}%`,
                          background: isLight
                            ? 'linear-gradient(90deg, #CFFF5E, #A6A2FF)'
                            : `linear-gradient(90deg, ${color}, ${color}99)`,
                          boxShadow: `0 0 8px ${color}66`,
                        }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Top Users */}
          <div className="rounded-2xl p-5 relative overflow-hidden"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <div style={{
              position: 'absolute', top: -30, right: -30, width: 120, height: 120, borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(207,255,94,0.07) 0%, transparent 70%)',
              pointerEvents: 'none',
            }} />
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <div style={{
                  width: 28, height: 28, borderRadius: 8,
                  background: 'linear-gradient(135deg, #CFFF5E, #6662FF)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14,
                }}>🏆</div>
                <span className="text-sm font-bold" style={{ color: 'var(--text)', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                  Top Users
                </span>
              </div>
              <Link href="/admin/users" className="text-xs font-semibold"
                style={{ color: '#A6A2FF', fontFamily: "'DM Sans', sans-serif" }}>
                View all →
              </Link>
            </div>
            {topUsers.length === 0 ? (
              <p className="text-xs" style={{ color: 'var(--text-dim)', fontFamily: "'DM Sans', sans-serif" }}>No active users yet</p>
            ) : topUsers.map((u, i) => (
              <div key={u.id} className="flex items-center gap-3 py-2.5"
                style={{ borderBottom: '1px solid var(--border)' }}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-extrabold shrink-0 rank-badge-${i < 3 ? i + 1 : 'other'}`}
                  style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                  {i + 1}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium" style={{ color: 'var(--text)', fontFamily: "'DM Sans', sans-serif" }}>
                    {u.full_name || 'Unknown'}
                  </p>
                  <p className="text-[10px]" style={{ color: 'var(--text-dim)', fontFamily: "'DM Sans', sans-serif" }}>
                    {u.current_role || ''}
                  </p>
                </div>
                <div style={{
                  padding: '3px 10px', borderRadius: 100,
                  background: i === 0 ? 'rgba(207,255,94,0.12)' : i === 1 ? 'rgba(166,162,255,0.12)' : 'rgba(102,98,255,0.08)',
                  border: `1px solid ${i === 0 ? 'rgba(207,255,94,0.25)' : i === 1 ? 'rgba(166,162,255,0.25)' : 'rgba(102,98,255,0.15)'}`,
                }}>
                  <span className="text-[11px] font-bold" style={{
                    color: i === 0 ? '#5A7A00' : i === 1 ? '#A6A2FF' : '#6662FF',
                    fontFamily: "'DM Sans', sans-serif",
                  }}>
                    {u.sessions} sessions
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ═══ THREE COLUMNS ═══ */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-5">

          {/* Recent Signups */}
          <div className="rounded-2xl p-5" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <div className="flex items-center gap-2 mb-4">
              <div style={{
                width: 28, height: 28, borderRadius: 8,
                background: 'linear-gradient(135deg, #6662FF, #FD81FD)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14,
              }}>🆕</div>
              <span className="text-sm font-bold" style={{ color: 'var(--text)', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                Recent Signups
              </span>
            </div>
            {recentSignups.map((u, idx) => (
              <div key={u.id} className="flex items-center gap-2.5 py-2"
                style={{ borderBottom: '1px solid var(--border)' }}>
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 signup-avatar-${idx % 4}`}>
                  {(u.full_name || '?').charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold truncate" style={{ color: 'var(--text)', fontFamily: "'DM Sans', sans-serif" }}>
                    {u.full_name || 'No name'}
                  </p>
                  <p className="text-[10px] truncate" style={{ color: 'var(--text-dim)', fontFamily: "'DM Sans', sans-serif" }}>
                    {u.industry || u.current_role || '—'}
                  </p>
                </div>
                <span className="text-[10px] shrink-0 font-medium" style={{ color: 'var(--text-dim)', fontFamily: "'DM Sans', sans-serif" }}>
                  {new Date(u.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
              </div>
            ))}
          </div>

          {/* Top Cohorts */}
          <div className="rounded-2xl p-5" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <div style={{
                  width: 28, height: 28, borderRadius: 8,
                  background: 'linear-gradient(135deg, #A6A2FF, #CFFF5E)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14,
                }}>🏘️</div>
                <span className="text-sm font-bold" style={{ color: 'var(--text)', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                  Top Cohorts
                </span>
              </div>
              <Link href="/admin/cohorts" className="text-xs font-semibold"
                style={{ color: '#FD81FD', fontFamily: "'DM Sans', sans-serif" }}>
                Manage →
              </Link>
            </div>
            {topCohorts.length === 0 ? (
              <p className="text-xs" style={{ color: 'var(--text-dim)', fontFamily: "'DM Sans', sans-serif" }}>No cohorts yet</p>
            ) : topCohorts.map((c, idx) => {
              const cohortColors = ['#6662FF', '#A6A2FF', '#FD81FD', '#CFFF5E', '#6662FF'];
              const cc = cohortColors[idx % cohortColors.length];
              const isLight = cc === '#CFFF5E';
              return (
                <div key={c.id} className="flex items-center gap-2.5 py-2"
                  style={{ borderBottom: '1px solid var(--border)' }}>
                  <span className="text-lg">{c.icon || '👥'}</span>
                  <span className="text-sm flex-1 font-medium" style={{ color: 'var(--text-muted)', fontFamily: "'DM Sans', sans-serif" }}>
                    {c.name}
                  </span>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                    style={{
                      background: `${cc}18`,
                      color: isLight ? '#5A7A00' : cc,
                      border: `1px solid ${cc}33`,
                      fontFamily: "'DM Sans', sans-serif",
                    }}>
                    {c.member_count || 0}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Upcoming Events */}
          <div className="rounded-2xl p-5" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <div style={{
                  width: 28, height: 28, borderRadius: 8,
                  background: 'linear-gradient(135deg, #CFFF5E, #FD81FD)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14,
                }}>🎓</div>
                <span className="text-sm font-bold" style={{ color: 'var(--text)', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                  Upcoming Events
                </span>
              </div>
              <Link href="/admin/experts" className="text-xs font-semibold"
                style={{ color: '#CFFF5E', fontFamily: "'DM Sans', sans-serif" }}>
                Manage →
              </Link>
            </div>
            {upcomingEvents.length === 0 ? (
              <p className="text-xs" style={{ color: 'var(--text-dim)', fontFamily: "'DM Sans', sans-serif" }}>No upcoming events</p>
            ) : upcomingEvents.map((e, idx) => {
              const evColors = [
                { bg: 'rgba(102,98,255,0.08)', border: 'rgba(102,98,255,0.2)', dot: '#6662FF' },
                { bg: 'rgba(207,255,94,0.07)', border: 'rgba(207,255,94,0.2)', dot: '#CFFF5E' },
                { bg: 'rgba(253,129,253,0.07)', border: 'rgba(253,129,253,0.2)', dot: '#FD81FD' },
              ];
              const ev = evColors[idx % evColors.length];
              return (
                <div key={e.id} className="py-2.5 px-3 rounded-xl mb-2"
                  style={{ background: ev.bg, border: `1px solid ${ev.border}` }}>
                  <div className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ background: ev.dot }} />
                    <div>
                      <p className="text-sm font-medium" style={{ color: 'var(--text)', fontFamily: "'DM Sans', sans-serif" }}>
                        {e.title}
                      </p>
                      <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-dim)', fontFamily: "'DM Sans', sans-serif" }}>
                        {e.expert_name} · {new Date(e.scheduled_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ═══ QUICK ACTIONS ═══ */}
        <div>
          <p className="text-xs font-bold uppercase tracking-widest mb-3"
            style={{ color: 'var(--text-dim)', fontFamily: "'DM Sans', sans-serif" }}>
            Quick Actions
          </p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              {
                label: 'Create Cohort', href: '/admin/cohorts?action=create', icon: '➕',
                gradient: 'linear-gradient(135deg, #6662FF, #A6A2FF)',
                glow: 'rgba(102,98,255,0.2)', border: 'rgba(102,98,255,0.25)',
              },
              {
                label: 'Add Expert Event', href: '/admin/experts?action=create', icon: '🎤',
                gradient: 'linear-gradient(135deg, #FD81FD, #A6A2FF)',
                glow: 'rgba(253,129,253,0.18)', border: 'rgba(253,129,253,0.25)',
              },
              {
                label: 'Add Course', href: '/admin/courses?action=create', icon: '📖',
                gradient: 'linear-gradient(135deg, #CFFF5E, #6662FF)',
                glow: 'rgba(207,255,94,0.15)', border: 'rgba(207,255,94,0.25)',
              },
              {
                label: 'Manage Roles', href: '/admin/users', icon: '🔑',
                gradient: 'linear-gradient(135deg, #A6A2FF, #FD81FD)',
                glow: 'rgba(166,162,255,0.2)', border: 'rgba(166,162,255,0.25)',
              },
            ].map((a) => (
              <Link key={a.label} href={a.href}>
                <div className="admin-quick-action rounded-2xl p-4 text-center cursor-pointer relative overflow-hidden"
                  style={{
                    background: 'var(--bg-card)',
                    border: `1px solid ${a.border}`,
                    boxShadow: `0 4px 20px ${a.glow}`,
                  }}>
                  {/* Corner glow */}
                  <div style={{
                    position: 'absolute', top: -16, right: -16, width: 60, height: 60, borderRadius: '50%',
                    background: `radial-gradient(circle, ${a.glow} 0%, transparent 70%)`,
                    pointerEvents: 'none',
                  }} />
                  <div style={{
                    width: 44, height: 44, borderRadius: 12,
                    background: a.gradient,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 22, margin: '0 auto 10px',
                    boxShadow: `0 4px 16px ${a.glow}`,
                  }}>
                    {a.icon}
                  </div>
                  <p className="text-xs font-bold" style={{ color: 'var(--text)', fontFamily: "'DM Sans', sans-serif" }}>
                    {a.label}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>

      </div>
    </>
  );
}
