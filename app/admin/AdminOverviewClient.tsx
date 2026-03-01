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
  const [dailyActivity, setDailyActivity]   = useState<{ day: string; label: string; users: number; sessions: number }[]>([]);
  const [topUsers, setTopUsers]             = useState<any[]>([]);
  const [topCohorts, setTopCohorts]         = useState<any[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<any[]>([]);
  const [recentSignups, setRecentSignups]   = useState<any[]>([]);
  const [sessionTypes, setSessionTypes]     = useState<{ type: string; count: number }[]>([]);

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    const now = new Date();
    const d7  = new Date(now.getTime() - 7  * 86400000).toISOString();
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

    // Build daily activity chart — last 14 days
    const dayMap: Record<string, { users: Set<string>; sessions: number }> = {};
    for (let i = 13; i >= 0; i--) {
      const d   = new Date(now.getTime() - i * 86400000);
      const key = d.toISOString().split('T')[0];
      dayMap[key] = { users: new Set(), sessions: 0 };
    }
    allSessions.data?.forEach((s: any) => {
      const key = s.created_at.split('T')[0];
      if (dayMap[key]) { dayMap[key].users.add(s.user_id); dayMap[key].sessions++; }
    });
    setDailyActivity(Object.entries(dayMap).map(([day, v]) => ({
      day,
      label: new Date(day).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      users: v.users.size,
      sessions: v.sessions,
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
    allSessions.data?.forEach((s: any) => { userSessionMap[s.user_id] = (userSessionMap[s.user_id] || 0) + 1; });
    const userIds = Object.keys(userSessionMap);
    let topUsersData: any[] = [];
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles').select('id, full_name, current_role').in('id', userIds);
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

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
        <div style={{ width: 36, height: 36, borderRadius: '50%', border: '2px solid #2E2A22', borderTopColor: '#E8A020', animation: 'ao-spin 0.9s linear infinite' }} />
        <p style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, letterSpacing: '0.12em', color: '#4A4438', textTransform: 'uppercase' }}>Loading dashboard...</p>
        <style>{`
        /* ── Responsive grid breakpoints ── */
        @media (min-width: 600px) {
          .ao-grid-2 { grid-template-columns: 1fr 1fr !important; }
          .ao-grid-kpi { grid-template-columns: repeat(3, 1fr) !important; }
        }
        @media (min-width: 900px) {
          .ao-grid-3 { grid-template-columns: repeat(3, 1fr) !important; }
          .ao-grid-kpi { grid-template-columns: repeat(5, 1fr) !important; }
        }@keyframes ao-spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // ── Derived values ───────────────────────────────────────────────────────
  const maxSessions  = Math.max(...dailyActivity.map(d => d.sessions), 1);
  const maxUsers     = Math.max(...dailyActivity.map(d => d.users), 1);
  const totalSessTypes = sessionTypes.reduce((s, x) => s + x.count, 0);
  const CHART_H      = 120; // px

  const TYPE_LABELS: Record<string, string> = {
    challenge_navigation:  'Challenge Navigation',
    difficult_conversation:'Difficult Conversation',
    weekly_reflection:     'Weekly Reflection',
    accountability_check:  'Accountability Check',
    general:               'General',
  };

  const TYPE_COLORS = ['#E8A020', '#14B8A6', '#8B5CF6', '#3B82F6', '#10B981'];

  // ── Helpers ──────────────────────────────────────────────────────────────
  const pct = (n: number, total: number) => total === 0 ? 0 : Math.round((n / total) * 100);

  return (
    <div>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600;700&family=Syne:wght@400;600;700&family=DM+Mono:wght@400;500&display=swap');
        @keyframes ao-fade-up { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
        @keyframes ao-spin     { to { transform:rotate(360deg); } }
        @keyframes ao-bar-grow { from { height:0; } to { height:var(--bar-h); } }
        .ao-card         { background:#141310; border:1px solid #2E2A22; border-radius:14px; padding:20px; }
        .ao-card:hover   { border-color:#3A3630; }
        .ao-stat:hover   { border-color:#4A4438 !important; transform:translateY(-1px); }
        .ao-link:hover   { color:#F5C55A !important; }
        .ao-row:hover    { background:rgba(232,160,32,0.03); border-radius:8px; }
        .ao-action:hover { border-color:#E8A020 !important; background:#1E1C17 !important; }
        .ao-bar-col:hover .ao-tooltip { opacity:1; pointer-events:auto; }
        .ao-tooltip { opacity:0; pointer-events:none; transition:opacity 0.15s; }
      `}</style>

      <div style={{ animation: 'ao-fade-up 0.35s ease both' }}>

        {/* ── Header ────────────────────────────────────────────────────── */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-end', marginBottom:28 }}>
          <div>
            <h1 style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:28, fontWeight:700, color:'#FEF9EC', lineHeight:1.1, marginBottom:4 }}>
              Admin Dashboard
            </h1>
            <p style={{ fontFamily:"'DM Mono',monospace", fontSize:10, letterSpacing:'0.1em', textTransform:'uppercase', color:'#4A4438' }}>
              Last refreshed · {new Date().toLocaleTimeString('en-US', { hour:'numeric', minute:'2-digit' })}
            </p>
          </div>
          <div style={{ display:'flex', gap:8 }}>
            {[
              { label:'+ Cohort',  href:'/admin/cohorts?action=create' },
              { label:'+ Expert',  href:'/admin/experts?action=create' },
              { label:'+ Course',  href:'/admin/courses?action=create' },
            ].map(a => (
              <Link key={a.label} href={a.href} style={{ textDecoration:'none' }}>
                <div className="ao-action" style={{ padding:'8px 14px', borderRadius:8, border:'1px solid #2E2A22', background:'#141310', fontFamily:"'Syne',sans-serif", fontSize:12, fontWeight:600, color:'#D4CFC3', cursor:'pointer', transition:'all 0.15s', whiteSpace:'nowrap' }}>
                  {a.label}
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* ── KPI Row ───────────────────────────────────────────────────── */}
        <div className="ao-grid-kpi" style={{ display:'grid', gridTemplateColumns:'repeat(2, 1fr)', gap:10, marginBottom:24 }}>
          {[
            {
              value: stats.totalUsers,
              label: 'Total Users',
              delta: stats.newUsers7d,
              deltaLabel: 'new this week',
              accent: '#E8A020',
              icon: '👤',
              href: '/admin/users',
            },
            {
              value: stats.totalSessions,
              label: 'Sage Sessions',
              delta: stats.sessions7d,
              deltaLabel: 'this week',
              accent: '#8B5CF6',
              icon: '💬',
              href: '/admin/coaching',
            },
            {
              value: stats.totalPosts,
              label: 'Circle Posts',
              delta: stats.posts7d,
              deltaLabel: 'this week',
              accent: '#14B8A6',
              icon: '🗣️',
              href: '/admin/coaching',
            },
            {
              value: stats.publishedCourses,
              label: 'Courses Live',
              delta: null,
              deltaLabel: 'published',
              accent: '#3B82F6',
              icon: '📚',
              href: '/admin/courses',
            },
            {
              value: stats.upcomingEvents,
              label: 'Events Scheduled',
              delta: null,
              deltaLabel: 'upcoming',
              accent: '#10B981',
              icon: '🎙️',
              href: '/admin/experts',
            },
          ].map(s => (
            <Link key={s.label} href={s.href} style={{ textDecoration:'none' }}>
              <div className="ao-stat" style={{
                background:'#141310', border:'1px solid #2E2A22', borderRadius:14,
                padding:'18px 16px', cursor:'pointer', transition:'all 0.2s',
                borderLeft:`3px solid ${s.accent}`,
              }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:12 }}>
                  <span style={{ fontSize:18 }}>{s.icon}</span>
                  {s.delta !== null && s.delta > 0 && (
                    <span style={{
                      fontFamily:"'DM Mono',monospace", fontSize:9, letterSpacing:'0.08em',
                      background:`${s.accent}18`, color:s.accent,
                      padding:'2px 7px', borderRadius:100,
                    }}>
                      +{s.delta} {s.deltaLabel}
                    </span>
                  )}
                </div>
                <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:36, fontWeight:700, color:'#FEF9EC', lineHeight:1, marginBottom:4 }}>
                  {s.value.toLocaleString()}
                </div>
                <div style={{ fontFamily:"'DM Mono',monospace", fontSize:10, letterSpacing:'0.1em', textTransform:'uppercase', color:'#7A7260' }}>
                  {s.label}
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* ── Activity Chart ─────────────────────────────────────────────── */}
        <div className="ao-card" style={{ marginBottom:20 }}>
          {/* Header */}
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
            <div>
              <p style={{ fontFamily:"'Syne',sans-serif", fontSize:14, fontWeight:600, color:'#D4CFC3', marginBottom:2 }}>
                Activity — Last 14 Days
              </p>
              <p style={{ fontFamily:"'DM Mono',monospace", fontSize:10, letterSpacing:'0.08em', textTransform:'uppercase', color:'#4A4438' }}>
                Sage sessions per day · active users overlay
              </p>
            </div>
            <div style={{ display:'flex', gap:16, alignItems:'center' }}>
              <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                <div style={{ width:10, height:10, borderRadius:2, background:'#E8A020', opacity:0.75 }} />
                <span style={{ fontFamily:"'DM Mono',monospace", fontSize:10, letterSpacing:'0.08em', color:'#7A7260' }}>Sessions</span>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                <div style={{ width:10, height:10, borderRadius:'50%', background:'#14B8A6' }} />
                <span style={{ fontFamily:"'DM Mono',monospace", fontSize:10, letterSpacing:'0.08em', color:'#7A7260' }}>Active Users</span>
              </div>
            </div>
          </div>

          {/* Y-axis + bars */}
          <div style={{ display:'flex', gap:0 }}>
            {/* Y labels */}
            <div style={{ display:'flex', flexDirection:'column', justifyContent:'space-between', paddingBottom:28, paddingRight:10, minWidth:24 }}>
              {[maxSessions, Math.ceil(maxSessions/2), 0].map(v => (
                <span key={v} style={{ fontFamily:"'DM Mono',monospace", fontSize:9, color:'#4A4438', textAlign:'right', display:'block' }}>
                  {v}
                </span>
              ))}
            </div>

            {/* Chart area */}
            <div style={{ flex:1, position:'relative' }}>
              {/* Grid lines */}
              {[0, 50, 100].map(p => (
                <div key={p} style={{
                  position:'absolute', left:0, right:0,
                  top:`${p}%`, height:1,
                  background: p === 100 ? '#3A3630' : '#2E2A22',
                  transform:'translateY(-1px)',
                }} />
              ))}

              {/* Bars */}
              <div style={{ display:'flex', alignItems:'flex-end', gap:4, height:CHART_H, paddingBottom:0 }}>
                {dailyActivity.map((d, i) => {
                  const barH   = Math.max(d.sessions > 0 ? (d.sessions / maxSessions) * CHART_H : 2, d.sessions > 0 ? 6 : 2);
                  const dotBot = d.users > 0 ? (d.users / maxUsers) * CHART_H : 0;
                  const isToday = i === dailyActivity.length - 1;
                  return (
                    <div key={d.day} className="ao-bar-col" style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:0, height:'100%', justifyContent:'flex-end', position:'relative', cursor:'default' }}>
                      {/* Tooltip */}
                      <div className="ao-tooltip" style={{
                        position:'absolute', bottom:'100%', left:'50%', transform:'translateX(-50%)',
                        marginBottom:6, background:'#1E1C17', border:'1px solid #3A3630',
                        borderRadius:8, padding:'8px 10px', whiteSpace:'nowrap', zIndex:10,
                        boxShadow:'0 4px 16px rgba(0,0,0,0.4)',
                      }}>
                        <p style={{ fontFamily:"'Syne',sans-serif", fontSize:11, fontWeight:600, color:'#FEF9EC', marginBottom:3 }}>{d.label}</p>
                        <p style={{ fontFamily:"'DM Mono',monospace", fontSize:10, color:'#E8A020', margin:0 }}>{d.sessions} session{d.sessions !== 1 ? 's' : ''}</p>
                        <p style={{ fontFamily:"'DM Mono',monospace", fontSize:10, color:'#14B8A6', margin:'2px 0 0' }}>{d.users} active user{d.users !== 1 ? 's' : ''}</p>
                      </div>

                      {/* Active users dot */}
                      {d.users > 0 && (
                        <div style={{
                          position:'absolute',
                          bottom: dotBot + 4,
                          width:6, height:6, borderRadius:'50%',
                          background:'#14B8A6',
                          boxShadow:'0 0 5px rgba(20,184,166,0.6)',
                          zIndex:2,
                        }} />
                      )}

                      {/* Sessions bar */}
                      <div style={{
                        width:'100%',
                        height: barH,
                        background: isToday
                          ? 'linear-gradient(to top, #E8A020, #F5C55A)'
                          : 'rgba(232,160,32,0.55)',
                        borderRadius:'3px 3px 0 0',
                        transition:'all 0.3s ease',
                        boxShadow: isToday ? '0 0 10px rgba(232,160,32,0.3)' : 'none',
                      }} />
                    </div>
                  );
                })}
              </div>

              {/* X-axis labels */}
              <div style={{ display:'flex', gap:4, marginTop:8 }}>
                {dailyActivity.map((d, i) => {
                  const showLabel = i === 0 || i === 6 || i === 13 || dailyActivity.length <= 7;
                  return (
                    <div key={d.day} style={{ flex:1, textAlign:'center' }}>
                      <span style={{
                        fontFamily:"'DM Mono',monospace", fontSize:9,
                        color: i === dailyActivity.length - 1 ? '#E8A020' : '#4A4438',
                        letterSpacing:'0.04em',
                        visibility: showLabel ? 'visible' : 'hidden',
                      }}>
                        {new Date(d.day).toLocaleDateString('en-US', { month:'short', day:'numeric' })}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Summary row under chart */}
          <div style={{ display:'flex', gap:20, marginTop:16, paddingTop:16, borderTop:'1px solid #2E2A22' }}>
            {[
              { label:'Total sessions (14d)', value: dailyActivity.reduce((s,d)=>s+d.sessions,0), color:'#E8A020' },
              { label:'Peak day',             value: `${maxSessions} sessions`, color:'#F5C55A' },
              { label:'Avg per day',          value: (dailyActivity.reduce((s,d)=>s+d.sessions,0)/14).toFixed(1), color:'#7A7260' },
            ].map(s => (
              <div key={s.label}>
                <p style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:20, fontWeight:700, color:s.color, lineHeight:1, marginBottom:2 }}>{s.value}</p>
                <p style={{ fontFamily:"'DM Mono',monospace", fontSize:9, letterSpacing:'0.08em', textTransform:'uppercase', color:'#4A4438' }}>{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Two columns: Session Types + Top Users ─────────────────────── */}
        <div className="ao-grid-2" style={{ display:'grid', gridTemplateColumns:'1fr', gap:16, marginBottom:16 }}>

          {/* Session Types */}
          <div className="ao-card">
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:18 }}>
              <p style={{ fontFamily:"'Syne',sans-serif", fontSize:14, fontWeight:600, color:'#D4CFC3' }}>Session Types</p>
              <span style={{ fontFamily:"'DM Mono',monospace", fontSize:9, letterSpacing:'0.08em', color:'#4A4438', textTransform:'uppercase' }}>
                Last 30 days · {totalSessTypes} total
              </span>
            </div>
            {sessionTypes.length === 0 ? (
              <p style={{ fontFamily:"'DM Mono',monospace", fontSize:11, color:'#4A4438' }}>No sessions yet</p>
            ) : sessionTypes.map((t, i) => {
              const p = pct(t.count, totalSessTypes);
              const color = TYPE_COLORS[i % TYPE_COLORS.length];
              return (
                <div key={t.type} style={{ marginBottom:14 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:6 }}>
                    <span style={{ fontFamily:"'Syne',sans-serif", fontSize:13, color:'#D4CFC3' }}>
                      {TYPE_LABELS[t.type] || t.type.replace(/_/g,' ')}
                    </span>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <span style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:20, fontWeight:700, color, lineHeight:1 }}>{t.count}</span>
                      <span style={{ fontFamily:"'DM Mono',monospace", fontSize:10, color:'#4A4438', minWidth:32, textAlign:'right' }}>{p}%</span>
                    </div>
                  </div>
                  {/* Progress bar with percentage marker */}
                  <div style={{ position:'relative', width:'100%', height:6, borderRadius:4, background:'#2E2A22', overflow:'hidden' }}>
                    <div style={{
                      height:'100%', borderRadius:4, width:`${p}%`,
                      background:`linear-gradient(90deg, ${color}99, ${color})`,
                      transition:'width 0.5s ease',
                    }} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Top Users */}
          <div className="ao-card">
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:18 }}>
              <p style={{ fontFamily:"'Syne',sans-serif", fontSize:14, fontWeight:600, color:'#D4CFC3' }}>Top Users by Sessions</p>
              <Link href="/admin/users" className="ao-link" style={{ fontFamily:"'DM Mono',monospace", fontSize:10, letterSpacing:'0.08em', color:'#E8A020', textDecoration:'none', textTransform:'uppercase', transition:'color 0.15s' }}>
                View all →
              </Link>
            </div>
            {topUsers.length === 0 ? (
              <p style={{ fontFamily:"'DM Mono',monospace", fontSize:11, color:'#4A4438' }}>No active users yet</p>
            ) : (() => {
              const maxS = Math.max(...topUsers.map(u => u.sessions), 1);
              return topUsers.map((u, i) => (
                <div key={u.id} className="ao-row" style={{ display:'flex', alignItems:'center', gap:12, padding:'9px 6px', borderBottom:'1px solid #2E2A22', transition:'background 0.15s' }}>
                  {/* Rank */}
                  <span style={{
                    fontFamily:"'DM Mono',monospace", fontSize:11, fontWeight:500,
                    width:18, textAlign:'center', flexShrink:0,
                    color: i === 0 ? '#E8A020' : '#4A4438',
                  }}>{i + 1}</span>

                  {/* Avatar */}
                  <div style={{
                    width:30, height:30, borderRadius:'50%', flexShrink:0,
                    display:'flex', alignItems:'center', justifyContent:'center',
                    fontFamily:"'Syne',sans-serif", fontSize:12, fontWeight:700,
                    background: i === 0 ? 'rgba(232,160,32,0.12)' : '#1E1C17',
                    border: `1px solid ${i === 0 ? 'rgba(232,160,32,0.3)' : '#2E2A22'}`,
                    color: i === 0 ? '#E8A020' : '#7A7260',
                  }}>
                    {(u.full_name || '?').charAt(0).toUpperCase()}
                  </div>

                  {/* Name + role + bar */}
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:4 }}>
                      <p style={{ fontFamily:"'Syne',sans-serif", fontSize:13, color:'#D4CFC3', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                        {u.full_name || 'Unknown'}
                      </p>
                      <span style={{ fontFamily:"'DM Mono',monospace", fontSize:11, fontWeight:500, color:'#E8A020', flexShrink:0, marginLeft:8 }}>
                        {u.sessions}
                      </span>
                    </div>
                    {/* Mini progress bar showing share of top user */}
                    <div style={{ width:'100%', height:3, borderRadius:2, background:'#2E2A22' }}>
                      <div style={{ height:'100%', borderRadius:2, width:`${(u.sessions/maxS)*100}%`, background: i === 0 ? '#E8A020' : '#3A3630', transition:'width 0.4s ease' }} />
                    </div>
                    <p style={{ fontFamily:"'DM Mono',monospace", fontSize:9, letterSpacing:'0.06em', textTransform:'uppercase', color:'#4A4438', marginTop:2 }}>
                      {u.current_role || 'No role set'}
                    </p>
                  </div>
                </div>
              ));
            })()}
          </div>
        </div>

        {/* ── Three columns: Signups + Cohorts + Events ─────────────────── */}
        <div className="ao-grid-3 ao-grid-2" style={{ display:'grid', gridTemplateColumns:'1fr', gap:16, marginBottom:16 }}>

          {/* Recent Signups */}
          <div className="ao-card">
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
              <p style={{ fontFamily:"'Syne',sans-serif", fontSize:14, fontWeight:600, color:'#D4CFC3' }}>Recent Signups</p>
              <Link href="/admin/users" className="ao-link" style={{ fontFamily:"'DM Mono',monospace", fontSize:10, letterSpacing:'0.08em', color:'#E8A020', textDecoration:'none', textTransform:'uppercase', transition:'color 0.15s' }}>
                All →
              </Link>
            </div>
            {recentSignups.length === 0 ? (
              <p style={{ fontFamily:"'DM Mono',monospace", fontSize:11, color:'#4A4438' }}>No signups yet</p>
            ) : recentSignups.slice(0,6).map(u => (
              <div key={u.id} className="ao-row" style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 6px', borderBottom:'1px solid #2E2A22', transition:'background 0.15s' }}>
                <div style={{
                  width:28, height:28, borderRadius:'50%', flexShrink:0,
                  display:'flex', alignItems:'center', justifyContent:'center',
                  fontFamily:"'Syne',sans-serif", fontSize:11, fontWeight:700,
                  background:'#1E1C17', color:'#E8A020', border:'1px solid #2E2A22',
                }}>
                  {(u.full_name || '?').charAt(0).toUpperCase()}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <p style={{ fontFamily:"'Syne',sans-serif", fontSize:12, color:'#D4CFC3', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                    {u.full_name || 'No name'}
                  </p>
                  <p style={{ fontFamily:"'DM Mono',monospace", fontSize:9, letterSpacing:'0.06em', textTransform:'uppercase', color:'#4A4438', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                    {u.industry || u.current_role || 'No role'}
                  </p>
                </div>
                <span style={{ fontFamily:"'DM Mono',monospace", fontSize:10, color:'#7A7260', flexShrink:0 }}>
                  {new Date(u.created_at).toLocaleDateString('en-US', { month:'short', day:'numeric' })}
                </span>
              </div>
            ))}
          </div>

          {/* Top Cohorts */}
          <div className="ao-card">
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
              <p style={{ fontFamily:"'Syne',sans-serif", fontSize:14, fontWeight:600, color:'#D4CFC3' }}>Top Circles</p>
              <Link href="/admin/cohorts" className="ao-link" style={{ fontFamily:"'DM Mono',monospace", fontSize:10, letterSpacing:'0.08em', color:'#E8A020', textDecoration:'none', textTransform:'uppercase', transition:'color 0.15s' }}>
                Manage →
              </Link>
            </div>
            {topCohorts.length === 0 ? (
              <p style={{ fontFamily:"'DM Mono',monospace", fontSize:11, color:'#4A4438' }}>No circles yet</p>
            ) : (() => {
              const maxM = Math.max(...topCohorts.map(c => c.member_count || 0), 1);
              return topCohorts.map((c, i) => (
                <div key={c.id} className="ao-row" style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 6px', borderBottom:'1px solid #2E2A22', transition:'background 0.15s' }}>
                  <div style={{
                    width:28, height:28, borderRadius:6, flexShrink:0,
                    display:'flex', alignItems:'center', justifyContent:'center',
                    background:'#1E1C17', border:'1px solid #2E2A22',
                    fontFamily:"'Syne',sans-serif", fontSize:11, fontWeight:700, color:'#14B8A6',
                  }}>
                    {(c.name || 'C').charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <p style={{ fontFamily:"'Syne',sans-serif", fontSize:12, color:'#D4CFC3', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', marginBottom:3 }}>
                      {c.name}
                    </p>
                    <div style={{ width:'100%', height:3, borderRadius:2, background:'#2E2A22' }}>
                      <div style={{ height:'100%', borderRadius:2, width:`${((c.member_count||0)/maxM)*100}%`, background:'#14B8A6', transition:'width 0.4s ease' }} />
                    </div>
                  </div>
                  <span style={{ fontFamily:"'DM Mono',monospace", fontSize:11, fontWeight:500, color:'#14B8A6', flexShrink:0 }}>
                    {c.member_count || 0}
                  </span>
                </div>
              ));
            })()}
          </div>

          {/* Upcoming Events */}
          <div className="ao-card">
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
              <p style={{ fontFamily:"'Syne',sans-serif", fontSize:14, fontWeight:600, color:'#D4CFC3' }}>Upcoming Events</p>
              <Link href="/admin/experts" className="ao-link" style={{ fontFamily:"'DM Mono',monospace", fontSize:10, letterSpacing:'0.08em', color:'#E8A020', textDecoration:'none', textTransform:'uppercase', transition:'color 0.15s' }}>
                Manage →
              </Link>
            </div>
            {upcomingEvents.length === 0 ? (
              <div style={{ textAlign:'center', padding:'24px 0' }}>
                <p style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:22, color:'#2E2A22', marginBottom:6 }}>No events</p>
                <Link href="/admin/experts?action=create" style={{ textDecoration:'none' }}>
                  <span style={{ fontFamily:"'DM Mono',monospace", fontSize:10, letterSpacing:'0.08em', color:'#E8A020', textTransform:'uppercase' }}>
                    + Schedule one →
                  </span>
                </Link>
              </div>
            ) : upcomingEvents.map(e => (
              <div key={e.id} style={{ padding:'10px 6px', borderBottom:'1px solid #2E2A22' }}>
                {/* Date pill */}
                <div style={{ marginBottom:5 }}>
                  <span style={{
                    fontFamily:"'DM Mono',monospace", fontSize:9, letterSpacing:'0.1em', textTransform:'uppercase',
                    background:'rgba(16,185,129,0.08)', color:'#10B981',
                    padding:'2px 8px', borderRadius:100,
                  }}>
                    {new Date(e.scheduled_at).toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric' })}
                  </span>
                </div>
                <p style={{ fontFamily:"'Syne',sans-serif", fontSize:13, color:'#D4CFC3', marginBottom:2 }}>{e.title}</p>
                <p style={{ fontFamily:"'DM Mono',monospace", fontSize:10, letterSpacing:'0.06em', color:'#4A4438' }}>
                  with {e.expert_name} · {new Date(e.scheduled_at).toLocaleTimeString('en-US', { hour:'numeric', minute:'2-digit' })}
                </p>
              </div>
            ))}
          </div>

        </div>

      </div>
    </div>
  );
}
