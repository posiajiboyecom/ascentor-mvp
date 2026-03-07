'use client';

import SageLoader from '@/components/SageLoader';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

// ── SVG icons for coaching page ───────────────────────────────────
const CoachIcons = {
  Chat:    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
  Edit:    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>,
  Users:   <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="7" r="4"/><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/><path d="M21 21v-2a4 4 0 0 0-3-3.85"/></svg>,
  Bot:     <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/><line x1="8" y1="16" x2="8" y2="16"/><line x1="16" y1="16" x2="16" y2="16"/></svg>,
  Group:   <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  EmptyChat: <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
  SelectCohort: <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>,
  EmptyPosts: <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
  Pin:     <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>,
  ChevUp:  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15"/></svg>,
  ChevDn:  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>,
  ThumbUp: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z"/><path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>,
};


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

    // Stats
    const [sessRes, postsRes] = await Promise.all([
      supabase.from('coaching_sessions').select('id', { count: 'exact', head: true }),
      supabase.from('cohort_posts').select('id', { count: 'exact', head: true }),
    ]);

    // All coaching sessions
    const { data: sessions } = await supabase
      .from('coaching_sessions')
      .select('id, user_id, user_input, ai_response, session_type, created_at, token_usage')
      .order('created_at', { ascending: false });

    // All profiles
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, current_role, industry');

    const profileMap: Record<string, any> = {};
    profiles?.forEach((p: any) => { profileMap[p.id] = p; });

    // Group sessions by user
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

    // Load cohorts for community tab
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
      // Fetch profiles
      const userIds = [...new Set(postsData.map((p: any) => p.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', userIds);

      const profileMap: Record<string, string> = {};
      profiles?.forEach((p: any) => { profileMap[p.id] = p.full_name; });

      // Fetch replies for all posts
      const postIds = postsData.map((p: any) => p.id);
      let replies: any[] = [];

      // Check if cohort_replies table exists by trying to query it
      try {
        const { data: repliesData } = await supabase
          .from('cohort_replies')
          .select('id, post_id, user_id, content, created_at')
          .in('post_id', postIds)
          .order('created_at', { ascending: true });

        if (repliesData) {
          // Get reply author names
          const replyUserIds = [...new Set(repliesData.map((r: any) => r.user_id))];
          const { data: replyProfiles } = replyUserIds.length > 0
            ? await supabase.from('profiles').select('id, full_name').in('id', replyUserIds)
            : { data: [] };
          replyProfiles?.forEach((p: any) => { profileMap[p.id] = p.full_name; });
          replies = repliesData;
        }
      } catch {
        // cohort_replies table might not exist — that's fine
      }

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

  if (loading) {
    return (
      <div className="py-20 text-center">
        <SageLoader size="sm" />
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading chat data...</p>
      </div>
    );
  }

  return (
    <div className="animate-fade-up">
      <h1 className="text-2xl font-semibold mb-1"
        style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: 'var(--text)' }}>
        Chat Data & Analytics
      </h1>
      <p className="text-sm mb-5" style={{ color: 'var(--text-muted)' }}>
        All AI coaching conversations and community discussions
      </p>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { icon: CoachIcons.Chat, value: stats.totalSessions, label: 'AI Coaching Sessions', color: 'var(--accent)' },
          { icon: CoachIcons.Edit, value: stats.totalPosts, label: 'Community Posts', color: 'var(--teal)' },
          { icon: CoachIcons.Users, value: stats.activeUsers, label: 'Active Users (7d)', color: 'var(--purple)' },
        ].map((s) => (
          <div key={s.label} className="rounded-xl p-4"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <div className="text-2xl mb-1">{s.icon}</div>
            <div className="text-2xl font-bold" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: s.color }}>
              {s.value}
            </div>
            <div className="text-[11px]" style={{ color: 'var(--text-dim)' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 p-1 rounded-lg" style={{ background: 'var(--bg-input)' }}>
        {([
          { key: 'coaching' as Tab, label: `AI Coaching (${stats.totalSessions})`, icon: CoachIcons.Bot },
          { key: 'community' as Tab, label: `Community (${stats.totalPosts})`, icon: CoachIcons.Group },
        ]).map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className="flex-1 py-2.5 rounded-md text-xs font-semibold transition-all flex items-center justify-center gap-1.5"
            style={{
              background: tab === t.key ? 'var(--bg-card)' : 'transparent',
              color: tab === t.key ? 'var(--accent)' : 'var(--text-dim)',
            }}>
            <span>{t.icon}</span> {t.label}
          </button>
        ))}
      </div>

      {/* ═══ AI COACHING: Grouped by user ═══ */}
      {tab === 'coaching' && (
        <div className="flex flex-col gap-2">
          {userGroups.length === 0 ? (
            <div className="text-center py-10 rounded-xl"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
              <div className="mb-2">{CoachIcons.EmptyChat}</div>
              <p className="text-sm" style={{ color: 'var(--text-dim)' }}>
                No coaching sessions yet.
              </p>
            </div>
          ) : userGroups.map((group) => {
            const isUserOpen = expandedUser === group.userId;
            return (
              <div key={group.userId} className="rounded-xl overflow-hidden"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>

                {/* User header */}
                <button onClick={() => setExpandedUser(isUserOpen ? null : group.userId)}
                  className="w-full flex items-center gap-3 px-4 py-3.5 text-left"
                  style={{ borderBottom: isUserOpen ? '1px solid var(--border)' : 'none' }}>
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                    style={{ background: 'rgba(245,158,11,0.09)', color: 'var(--accent)' }}>
                    {group.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{group.name}</p>
                    <p className="text-[11px]" style={{ color: 'var(--text-dim)' }}>
                      {group.role}{group.industry ? ` · ${group.industry}` : ''}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-xs font-bold px-2.5 py-1 rounded-full"
                      style={{ background: 'rgba(245,158,11,0.09)', color: 'var(--accent)' }}>
                      {group.sessionCount} session{group.sessionCount !== 1 ? 's' : ''}
                    </span>
                    <p className="text-[10px] mt-1" style={{ color: 'var(--text-dim)' }}>
                      Last: {new Date(group.lastActive).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </p>
                  </div>
                  <span className="text-xs ml-1" style={{ color: 'var(--text-dim)' }}>{isUserOpen ? CoachIcons.ChevUp : CoachIcons.ChevDn}</span>
                </button>

                {/* User's sessions */}
                {isUserOpen && (
                  <div className="px-3 py-2">
                    {group.sessions.map((s) => {
                      const ai = s.ai_response || {};
                      const isSessionOpen = expandedSession === s.id;
                      return (
                        <div key={s.id} className="rounded-lg mb-1.5 overflow-hidden"
                          style={{ border: '1px solid var(--border)' }}>
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
                              {isSessionOpen ? CoachIcons.ChevUp : CoachIcons.ChevDn}
                            </span>
                          </button>

                          {isSessionOpen && (
                            <div className="px-3 py-3" style={{ borderTop: '1px solid var(--border)', background: 'var(--bg-input)' }}>
                              {/* User bubble */}
                              <div className="flex justify-end mb-3">
                                <div className="max-w-[80%] px-3 py-2 rounded-xl rounded-br-sm text-sm"
                                  style={{ background: 'rgba(245,158,11,0.12)', color: 'var(--text)' }}>
                                  {s.user_input}
                                </div>
                              </div>

                              {/* Coach response */}
                              <div className="flex justify-start mb-2">
                                <div className="max-w-[80%]">
                                  {ai.reflection && (
                                    <p className="text-sm mb-1.5 px-3 py-2 rounded-xl rounded-bl-sm"
                                      style={{ background: 'var(--bg-card)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                                      {ai.reflection}
                                    </p>
                                  )}
                                  {ai.question && (
                                    <p className="text-sm font-medium mb-1.5 px-3 py-2 rounded-xl rounded-bl-sm"
                                      style={{ background: 'var(--bg-card)', color: 'var(--text)', border: '1px solid rgba(245,158,11,0.2)' }}>
                                      {ai.question}
                                    </p>
                                  )}
                                  {ai.action && (
                                    <p className="text-xs px-3 py-2 rounded-xl"
                                      style={{ background: 'rgba(20,184,166,0.06)', color: 'var(--teal)', border: '1px solid rgba(20,184,166,0.15)' }}>
                                      <span className="inline-flex items-center gap-1">{CoachIcons.Pin} {ai.action}</span>
                                    </p>
                                  )}
                                </div>
                              </div>

                              {s.token_usage && (
                                <div className="flex gap-3 text-[9px] mt-1" style={{ color: 'var(--text-dim)' }}>
                                  <span>Cost: ${s.token_usage.cost?.toFixed(4) || '—'}</span>
                                  {s.token_usage.rag_used && <span style={{ color: 'var(--teal)' }}>RAG ✓</span>}
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

      {/* ═══ COMMUNITY: Cohort selector → posts → replies ═══ */}
      {tab === 'community' && (
        <div>
          {/* Cohort selector */}
          <div className="flex gap-2 mb-4 flex-wrap">
            {cohorts.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--text-dim)' }}>No cohorts created yet.</p>
            ) : cohorts.map((c) => (
              <button key={c.id} onClick={() => loadCohortPosts(c.id)}
                className="px-3.5 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5"
                style={{
                  background: selectedCohort === c.id ? 'rgba(245,158,11,0.12)' : 'var(--bg-card)',
                  border: selectedCohort === c.id ? '1.5px solid var(--accent)' : '1px solid var(--border)',
                  color: selectedCohort === c.id ? 'var(--accent)' : 'var(--text-muted)',
                }}>
                <span>{c.icon || CoachIcons.Group}</span> {c.name}
                <span className="text-[10px] opacity-60">({c.member_count || 0})</span>
              </button>
            ))}
          </div>

          {/* No cohort selected */}
          {!selectedCohort && cohorts.length > 0 && (
            <div className="text-center py-10 rounded-xl"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
              <div className="mb-2">{CoachIcons.SelectCohort}</div>
              <p className="text-sm" style={{ color: 'var(--text-dim)' }}>
                Select a cohort above to view its conversations
              </p>
            </div>
          )}

          {/* Loading posts */}
          {loadingPosts && (
            <div className="text-center py-10">
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading posts...</p>
            </div>
          )}

          {/* Posts list */}
          {selectedCohort && !loadingPosts && (
            <div className="flex flex-col gap-2">
              {posts.length === 0 ? (
                <div className="text-center py-10 rounded-xl"
                  style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                  <div className="mb-2">{CoachIcons.EmptyPosts}</div>
                  <p className="text-sm" style={{ color: 'var(--text-dim)' }}>No posts in this cohort yet.</p>
                </div>
              ) : posts.map((p) => {
                const isPostOpen = expandedPost === p.id;
                return (
                  <div key={p.id} className="rounded-xl overflow-hidden"
                    style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>

                    {/* Post */}
                    <button onClick={() => setExpandedPost(isPostOpen ? null : p.id)}
                      className="w-full text-left px-4 py-3">
                      <div className="flex justify-between items-start mb-1.5">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                            style={{ background: 'rgba(20,184,166,0.09)', color: 'var(--teal)' }}>
                            {p.author.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <span className="text-xs font-semibold" style={{ color: 'var(--text)' }}>{p.author}</span>
                            <span className="text-[10px] ml-2" style={{ color: 'var(--text-dim)' }}>
                              {new Date(p.created_at).toLocaleDateString('en-US', {
                                month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
                              })}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-semibold" style={{ color: 'var(--accent)' }}>
                            <span className="inline-flex items-center gap-1">{CoachIcons.ThumbUp} {p.upvotes || 0}</span>
                          </span>
                          {p.replies?.length > 0 && (
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                              style={{ background: 'rgba(59,130,246,0.09)', color: 'var(--blue)' }}>
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
                      <div className="px-4 pb-3" style={{ borderTop: '1px solid var(--border)' }}>
                        <p className="text-[10px] font-bold uppercase tracking-wider pt-3 pb-2"
                          style={{ color: 'var(--text-dim)' }}>
                          Replies ({p.replies.length})
                        </p>
                        {p.replies.map((r: any) => (
                          <div key={r.id} className="flex gap-2 mb-2 pl-4"
                            style={{ borderLeft: '2px solid var(--border)' }}>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-0.5">
                                <span className="text-[11px] font-semibold" style={{ color: 'var(--teal)' }}>{r.author}</span>
                                <span className="text-[10px]" style={{ color: 'var(--text-dim)' }}>
                                  {new Date(r.created_at).toLocaleDateString('en-US', {
                                    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
                                  })}
                                </span>
                              </div>
                              <p className="text-[13px]" style={{ color: 'var(--text-muted)' }}>{r.content}</p>
                            </div>
                          </div>
                        ))}
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
