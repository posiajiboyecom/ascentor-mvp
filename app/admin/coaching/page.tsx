'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

type Tab = 'coaching' | 'community';

interface UserGroup {
  userId: string;
  name: string;
  role: string;
  industry: string;
  sessionCount: number;
  lastActive: string;
  sessions: any[];
}

export default function AdminCoachingPage() {
  const supabase = createClient();

  const [tab, setTab] = useState<Tab>('coaching');
  const [loading, setLoading] = useState(true);

  // Coaching
  const [userGroups, setUserGroups] = useState<UserGroup[]>([]);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [expandedSession, setExpandedSession] = useState<string | null>(null);

  // Community
  const [cohorts, setCohorts] = useState<any[]>([]);
  const [selectedCohort, setSelectedCohort] = useState<string | null>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [expandedPost, setExpandedPost] = useState<string | null>(null);
  const [loadingPosts, setLoadingPosts] = useState(false);

  // Stats
  const [stats, setStats] = useState({ totalSessions: 0, totalPosts: 0, activeUsers: 0 });

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    setLoading(true);

    const [sessRes, postsRes] = await Promise.all([
      supabase.from('coaching_sessions').select('id', { count: 'exact', head: true }),
      supabase.from('cohort_posts').select('id', { count: 'exact', head: true }),
    ]);

    const { data: sessions } = await supabase
      .from('coaching_sessions')
      .select('id, user_id, user_input, ai_response, session_type, created_at, token_usage')
      .order('created_at', { ascending: false });

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, current_role, industry');

    const profileMap: Record<string, any> = {};
    profiles?.forEach((p: any) => { profileMap[p.id] = p; });

    const grouped: Record<string, UserGroup> = {};
    sessions?.forEach((s: any) => {
      const uid = s.user_id;
      if (!grouped[uid]) {
        const p = profileMap[uid];
        grouped[uid] = {
          userId: uid,
          name: p?.full_name || 'Unknown User',
          role: p?.current_role || '',
          industry: p?.industry || '',
          sessionCount: 0,
          lastActive: s.created_at,
          sessions: [],
        };
      }
      grouped[uid].sessionCount++;
      grouped[uid].sessions.push(s);
    });

    const sorted = Object.values(grouped).sort((a, b) => b.sessionCount - a.sessionCount);
    const uniqueActive = new Set(
      sessions?.filter((s: any) => new Date(s.created_at) > new Date(Date.now() - 7 * 86400000))
        .map((s: any) => s.user_id) || []
    );

    setUserGroups(sorted);
    setStats({
      totalSessions: sessRes.count || 0,
      totalPosts: postsRes.count || 0,
      activeUsers: uniqueActive.size,
    });

    const { data: cohortsData } = await supabase
      .from('cohorts')
      .select('id, name, member_count, icon')
      .order('member_count', { ascending: false });
    setCohorts(cohortsData || []);

    setLoading(false);
  }

  async function loadCohortPosts(cohortId: string) {
    setLoadingPosts(true);
    setSelectedCohort(cohortId);
    setExpandedPost(null);

    const { data: postsData } = await supabase
      .from('cohort_posts')
      .select('id, user_id, content, upvotes, created_at')
      .eq('cohort_id', cohortId)
      .order('created_at', { ascending: false })
      .limit(100);

    if (postsData && postsData.length > 0) {
      const userIds = [...new Set(postsData.map((p: any) => p.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', userIds);

      const profileMap: Record<string, string> = {};
      profiles?.forEach((p: any) => { profileMap[p.id] = p.full_name; });

      const postIds = postsData.map((p: any) => p.id);
      let replies: any[] = [];

      try {
        const { data: repliesData } = await supabase
          .from('cohort_replies')
          .select('id, post_id, user_id, content, created_at')
          .in('post_id', postIds)
          .order('created_at', { ascending: true });

        if (repliesData) {
          const replyUserIds = [...new Set(repliesData.map((r: any) => r.user_id))];
          const { data: replyProfiles } = replyUserIds.length > 0
            ? await supabase.from('profiles').select('id, full_name').in('id', replyUserIds)
            : { data: [] };
          replyProfiles?.forEach((p: any) => { profileMap[p.id] = p.full_name; });
          replies = repliesData;
        }
      } catch { /* cohort_replies may not exist */ }

      const enriched = postsData.map((p: any) => ({
        ...p,
        author: profileMap[p.user_id] || 'Unknown',
        replies: replies
          .filter((r: any) => r.post_id === p.id)
          .map((r: any) => ({ ...r, author: profileMap[r.user_id] || 'Unknown' })),
      }));

      setPosts(enriched);
    } else {
      setPosts([]);
    }

    setLoadingPosts(false);
  }

  // Avatar initial background — cycles through brand colors
  const avatarColors = [
    { bg: 'rgba(102,98,255,0.15)', color: '#6662FF' },
    { bg: 'rgba(207,255,94,0.15)', color: '#5E8000' },
    { bg: 'rgba(253,129,253,0.15)', color: '#C040C0' },
    { bg: 'rgba(166,162,255,0.15)', color: '#5550CC' },
  ];
  function avatarStyle(name: string) {
    const idx = name.charCodeAt(0) % avatarColors.length;
    return avatarColors[idx];
  }

  if (loading) {
    return (
      <div className="py-20 text-center">
        <div style={{
          width: 36, height: 36, borderRadius: '50%',
          border: '3px solid rgba(102,98,255,0.15)',
          borderTop: '3px solid #6662FF',
          animation: 'spin 0.9s linear infinite',
          margin: '0 auto 12px',
        }} />
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading chat data...</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div className="animate-fade-up">

      {/* ── Header ── */}
      <h1 className="text-2xl font-semibold mb-1"
        style={{ fontFamily: "'Syne', sans-serif", color: 'var(--text)', letterSpacing: '-0.02em' }}>
        Chat Data & Analytics
      </h1>
      <p className="text-sm mb-5" style={{ color: 'var(--text-muted)' }}>
        All AI coaching conversations and community discussions
      </p>

      {/* ── Stats ── */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          {
            icon: '🤖', value: stats.totalSessions, label: 'AI Coaching Sessions',
            // Brand purple
            bg: 'rgba(102,98,255,0.07)', border: 'rgba(102,98,255,0.18)',
            numColor: '#6662FF', barColor: '#6662FF',
          },
          {
            icon: '📝', value: stats.totalPosts, label: 'Community Posts',
            // Green yellow
            bg: 'rgba(207,255,94,0.07)', border: 'rgba(207,255,94,0.25)',
            numColor: '#5E8000', barColor: '#CFFF5E',
          },
          {
            icon: '👥', value: stats.activeUsers, label: 'Active Users (7d)',
            // Fuchsia
            bg: 'rgba(253,129,253,0.07)', border: 'rgba(253,129,253,0.22)',
            numColor: '#C040C0', barColor: '#FD81FD',
          },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl p-4 relative overflow-hidden"
            style={{ background: s.bg, border: `1px solid ${s.border}` }}>
            {/* Decorative top bar */}
            <div style={{
              position: 'absolute', top: 0, left: 0, right: 0, height: 3,
              background: s.barColor, opacity: 0.7,
            }} />
            <div className="text-2xl mb-2">{s.icon}</div>
            <div className="text-3xl font-bold"
              style={{ fontFamily: "'Syne', sans-serif", color: s.numColor, letterSpacing: '-0.03em' }}>
              {s.value}
            </div>
            <div className="text-[11px] mt-0.5 font-medium" style={{ color: 'var(--text-dim)' }}>
              {s.label}
            </div>
          </div>
        ))}
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-1 mb-5 p-1 rounded-xl" style={{ background: 'var(--bg-input)' }}>
        {([
          { key: 'coaching' as Tab, label: `AI Coaching (${stats.totalSessions})`, icon: '🤖' },
          { key: 'community' as Tab, label: `Community (${stats.totalPosts})`, icon: '👥' },
        ]).map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className="flex-1 py-2.5 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5"
            style={{
              background: tab === t.key ? 'var(--bg-card)' : 'transparent',
              color: tab === t.key ? '#6662FF' : 'var(--text-dim)',
              boxShadow: tab === t.key ? '0 1px 4px rgba(102,98,255,0.15)' : 'none',
            }}>
            <span>{t.icon}</span> {t.label}
          </button>
        ))}
      </div>

      {/* ═══ AI COACHING TAB ═══ */}
      {tab === 'coaching' && (
        <div className="flex flex-col gap-2.5">
          {userGroups.length === 0 ? (
            <div className="text-center py-14 rounded-2xl"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
              <div style={{
                width: 52, height: 52, borderRadius: 14,
                background: 'rgba(102,98,255,0.1)', border: '1.5px solid rgba(102,98,255,0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 12px', fontSize: 22,
              }}>💬</div>
              <p className="text-sm" style={{ color: 'var(--text-dim)' }}>No coaching sessions yet.</p>
            </div>
          ) : userGroups.map((group) => {
            const isUserOpen = expandedUser === group.userId;
            const av = avatarStyle(group.name);

            return (
              <div key={group.userId} className="rounded-2xl overflow-hidden transition-all"
                style={{
                  background: 'var(--bg-card)',
                  border: isUserOpen ? '1px solid rgba(102,98,255,0.3)' : '1px solid var(--border)',
                  boxShadow: isUserOpen ? '0 0 0 3px rgba(102,98,255,0.06)' : 'none',
                }}>

                {/* User header */}
                <button onClick={() => setExpandedUser(isUserOpen ? null : group.userId)}
                  className="w-full flex items-center gap-3 px-4 py-3.5 text-left transition-all"
                  style={{ borderBottom: isUserOpen ? '1px solid var(--border)' : 'none' }}>
                  {/* Avatar — color keyed to name */}
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                    style={{ background: av.bg, color: av.color, fontFamily: "'Syne', sans-serif" }}>
                    {group.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold" style={{ color: 'var(--text)', fontFamily: "'Syne', sans-serif" }}>
                      {group.name}
                    </p>
                    <p className="text-[11px]" style={{ color: 'var(--text-dim)' }}>
                      {group.role}{group.industry ? ` · ${group.industry}` : ''}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    {/* Session count — green-yellow pill for high users, purple for others */}
                    <span className="text-xs font-bold px-2.5 py-1 rounded-full"
                      style={group.sessionCount >= 5 ? {
                        background: 'rgba(207,255,94,0.12)', color: '#5E8000',
                        border: '1px solid rgba(207,255,94,0.3)',
                      } : {
                        background: 'rgba(102,98,255,0.1)', color: '#6662FF',
                        border: '1px solid rgba(102,98,255,0.2)',
                      }}>
                      {group.sessionCount} session{group.sessionCount !== 1 ? 's' : ''}
                    </span>
                    <p className="text-[10px] mt-1" style={{ color: 'var(--text-dim)' }}>
                      {new Date(group.lastActive).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </p>
                  </div>
                  <span className="text-[10px] ml-1" style={{ color: 'var(--text-dim)' }}>
                    {isUserOpen ? '▲' : '▼'}
                  </span>
                </button>

                {/* Sessions list */}
                {isUserOpen && (
                  <div className="px-3 py-2.5 flex flex-col gap-1.5">
                    {group.sessions.map((s) => {
                      const ai = s.ai_response || {};
                      const isSessionOpen = expandedSession === s.id;
                      return (
                        <div key={s.id} className="rounded-xl overflow-hidden transition-all"
                          style={{
                            border: isSessionOpen ? '1px solid rgba(102,98,255,0.25)' : '1px solid var(--border)',
                          }}>
                          <button onClick={() => setExpandedSession(isSessionOpen ? null : s.id)}
                            className="w-full flex items-center gap-3 px-3 py-2.5 text-left">
                            <div className="flex-1">
                              <p className="text-[13px] truncate" style={{ color: 'var(--text-muted)' }}>
                                {s.user_input}
                              </p>
                            </div>
                            <span className="text-[10px] shrink-0" style={{ color: 'var(--text-dim)' }}>
                              {new Date(s.created_at).toLocaleDateString('en-US', {
                                month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
                              })}
                            </span>
                            <span className="text-[10px]" style={{ color: 'var(--text-dim)' }}>
                              {isSessionOpen ? '▲' : '▼'}
                            </span>
                          </button>

                          {isSessionOpen && (
                            <div className="px-3 py-3"
                              style={{ borderTop: '1px solid var(--border)', background: 'var(--bg-input)' }}>
                              {/* User bubble — brand purple tint */}
                              <div className="flex justify-end mb-3">
                                <div className="max-w-[80%] px-3 py-2 rounded-xl rounded-br-sm text-sm"
                                  style={{
                                    background: 'rgba(102,98,255,0.1)',
                                    border: '1px solid rgba(102,98,255,0.2)',
                                    color: 'var(--text)',
                                  }}>
                                  {s.user_input}
                                </div>
                              </div>

                              {/* Coach response */}
                              <div className="flex justify-start mb-2">
                                <div className="max-w-[80%] flex flex-col gap-1.5">
                                  {ai.reflection && (
                                    <p className="text-sm px-3 py-2 rounded-xl rounded-bl-sm"
                                      style={{ background: 'var(--bg-card)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                                      {ai.reflection}
                                    </p>
                                  )}
                                  {ai.question && (
                                    <p className="text-sm font-medium px-3 py-2 rounded-xl rounded-bl-sm"
                                      style={{ background: 'var(--bg-card)', color: 'var(--text)', border: '1px solid rgba(102,98,255,0.22)' }}>
                                      {ai.question}
                                    </p>
                                  )}
                                  {ai.action && (
                                    <p className="text-xs px-3 py-2 rounded-xl flex items-start gap-1.5"
                                      style={{ background: 'rgba(102,98,255,0.07)', color: '#6662FF', border: '1px solid rgba(102,98,255,0.18)' }}>
                                      📌 {ai.action}
                                    </p>
                                  )}
                                </div>
                              </div>

                              {/* Token usage — fuchsia accent */}
                              {s.token_usage && (
                                <div className="flex gap-3 text-[9px] mt-2 pt-2"
                                  style={{ borderTop: '1px solid var(--border)', color: 'var(--text-dim)' }}>
                                  <span>Cost: ${s.token_usage.cost?.toFixed(4) || '—'}</span>
                                  {s.token_usage.rag_used && (
                                    <span style={{ color: '#C040C0', fontWeight: 700 }}>RAG ✓</span>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ═══ COMMUNITY TAB ═══ */}
      {tab === 'community' && (
        <div>
          {/* Cohort selector chips */}
          <div className="flex gap-2 mb-4 flex-wrap">
            {cohorts.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--text-dim)' }}>No cohorts created yet.</p>
            ) : cohorts.map((c, idx) => {
              const chipColors = [
                { active: { bg: 'rgba(102,98,255,0.12)', border: '#6662FF', color: '#6662FF' } },
                { active: { bg: 'rgba(207,255,94,0.12)', border: '#CFFF5E', color: '#5E8000' } },
                { active: { bg: 'rgba(253,129,253,0.12)', border: '#FD81FD', color: '#C040C0' } },
                { active: { bg: 'rgba(166,162,255,0.15)', border: '#A6A2FF', color: '#5550CC' } },
              ];
              const chip = chipColors[idx % chipColors.length].active;
              const isSelected = selectedCohort === c.id;

              return (
                <button key={c.id} onClick={() => loadCohortPosts(c.id)}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5"
                  style={{
                    background: isSelected ? chip.bg : 'var(--bg-card)',
                    border: isSelected ? `1.5px solid ${chip.border}` : '1px solid var(--border)',
                    color: isSelected ? chip.color : 'var(--text-muted)',
                    boxShadow: isSelected ? `0 0 0 3px ${chip.bg}` : 'none',
                  }}>
                  <span>{c.icon || '👥'}</span> {c.name}
                  <span className="text-[10px] opacity-60">({c.member_count || 0})</span>
                </button>
              );
            })}
          </div>

          {/* No cohort selected state */}
          {!selectedCohort && cohorts.length > 0 && (
            <div className="text-center py-14 rounded-2xl"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
              <div style={{
                width: 52, height: 52, borderRadius: 14,
                background: 'rgba(166,162,255,0.12)', border: '1.5px solid rgba(166,162,255,0.25)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 12px', fontSize: 22,
              }}>👆</div>
              <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>
                Select a cohort to view its conversations
              </p>
            </div>
          )}

          {/* Loading posts */}
          {loadingPosts && (
            <div className="text-center py-10">
              <div style={{
                width: 32, height: 32, borderRadius: '50%',
                border: '3px solid rgba(207,255,94,0.2)',
                borderTop: '3px solid #CFFF5E',
                animation: 'spin 0.9s linear infinite',
                margin: '0 auto 10px',
              }} />
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading posts...</p>
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          )}

          {/* Posts */}
          {selectedCohort && !loadingPosts && (
            <div className="flex flex-col gap-2.5">
              {posts.length === 0 ? (
                <div className="text-center py-14 rounded-2xl"
                  style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                  <div style={{
                    width: 52, height: 52, borderRadius: 14,
                    background: 'rgba(253,129,253,0.1)', border: '1.5px solid rgba(253,129,253,0.22)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    margin: '0 auto 12px', fontSize: 22,
                  }}>🕳️</div>
                  <p className="text-sm" style={{ color: 'var(--text-dim)' }}>No posts in this cohort yet.</p>
                </div>
              ) : posts.map((p) => {
                const isPostOpen = expandedPost === p.id;
                const av = avatarStyle(p.author);
                return (
                  <div key={p.id} className="rounded-2xl overflow-hidden transition-all"
                    style={{
                      background: 'var(--bg-card)',
                      border: isPostOpen ? '1px solid rgba(102,98,255,0.25)' : '1px solid var(--border)',
                      boxShadow: isPostOpen ? '0 0 0 3px rgba(102,98,255,0.05)' : 'none',
                    }}>

                    {/* Post header */}
                    <button onClick={() => setExpandedPost(isPostOpen ? null : p.id)}
                      className="w-full text-left px-4 py-3.5">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2">
                          {/* Author avatar — palette color keyed to name */}
                          <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                            style={{ background: av.bg, color: av.color, fontFamily: "'Syne', sans-serif" }}>
                            {p.author.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <span className="text-xs font-semibold" style={{ color: 'var(--text)', fontFamily: "'Syne', sans-serif" }}>
                              {p.author}
                            </span>
                            <span className="text-[10px] ml-2" style={{ color: 'var(--text-dim)' }}>
                              {new Date(p.created_at).toLocaleDateString('en-US', {
                                month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
                              })}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {/* Upvotes — green-yellow */}
                          {(p.upvotes || 0) > 0 && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                              style={{ background: 'rgba(207,255,94,0.12)', color: '#5E8000', border: '1px solid rgba(207,255,94,0.3)' }}>
                              ▲ {p.upvotes}
                            </span>
                          )}
                          {/* Reply count — fuchsia */}
                          {p.replies?.length > 0 && (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                              style={{ background: 'rgba(253,129,253,0.1)', color: '#C040C0', border: '1px solid rgba(253,129,253,0.25)' }}>
                              {p.replies.length} repl{p.replies.length === 1 ? 'y' : 'ies'}
                            </span>
                          )}
                        </div>
                      </div>
                      <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                        {p.content}
                      </p>
                    </button>

                    {/* Replies */}
                    {isPostOpen && p.replies?.length > 0 && (
                      <div className="px-4 pb-4" style={{ borderTop: '1px solid var(--border)' }}>
                        <p className="text-[10px] font-bold uppercase tracking-wider pt-3 pb-2"
                          style={{ color: 'var(--text-dim)' }}>
                          Replies ({p.replies.length})
                        </p>
                        <div className="flex flex-col gap-2">
                          {p.replies.map((r: any) => {
                            const rav = avatarStyle(r.author);
                            return (
                              <div key={r.id} className="flex gap-2 pl-3"
                                style={{ borderLeft: '2px solid rgba(166,162,255,0.3)' }}>
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-0.5">
                                    {/* Reply author — Maximum Blue Purple */}
                                    <span className="text-[11px] font-semibold" style={{ color: '#A6A2FF' }}>
                                      {r.author}
                                    </span>
                                    <span className="text-[10px]" style={{ color: 'var(--text-dim)' }}>
                                      {new Date(r.created_at).toLocaleDateString('en-US', {
                                        month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
                                      })}
                                    </span>
                                  </div>
                                  <p className="text-[13px]" style={{ color: 'var(--text-muted)' }}>{r.content}</p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {isPostOpen && (!p.replies || p.replies.length === 0) && (
                      <div className="px-4 py-3" style={{ borderTop: '1px solid var(--border)' }}>
                        <p className="text-xs" style={{ color: 'var(--text-dim)' }}>No replies yet</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
