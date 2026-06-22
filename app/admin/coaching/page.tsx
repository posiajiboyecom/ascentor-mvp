'use client';

import SageLoader from '@/components/SageLoader';
import ExportPanel from '@/components/admin/ExportPanel';

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

// Real schema (see app/(app)/community/page.tsx for the canonical
// reference, confirmed against information_schema on the live DB):
//   community_channels: slug (PK, no `id`), name, channel_type,
//                        category_id, sort_order, emoji?
//   community_messages: id, user_id, channel (text = slug), content,
//                        flagged, deleted, created_at, likes (text[]),
//                        reply_to_id, pinned, reply_count
// There is no cohorts / cohort_posts involvement in current community
// — that model was replaced. A previous version of this tab still
// called the cohorts data shape via a since-removed /api/admin/community
// route, which 404'd silently and is why this tab showed no data.
interface Channel {
  slug: string;
  name: string;
  emoji?: string | null;
  channel_type?: string | null;
  messageCount: number;
}

interface ChannelMessage {
  id: string;
  user_id: string;
  channel: string;
  content: string;
  created_at: string;
  flagged: boolean;
  deleted: boolean;
  author_name: string;
}

export default function AdminCoachingPage() {
  const supabase = createClient();

  const [tab, setTab] = useState<Tab>('coaching');
  const [loading, setLoading] = useState(true);

  // Coaching
  const [userGroups, setUserGroups] = useState<UserGroup[]>([]);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [expandedSession, setExpandedSession] = useState<string | null>(null);

  // Bulk-select for delete — keyed by session/message id. Cleared on
  // tab switch since the two tabs delete against different tables
  // (coaching_sessions hard-delete vs community_messages soft-delete).
  const [selectedSessionIds, setSelectedSessionIds] = useState<Set<string>>(new Set());
  const [selectedMessageIds, setSelectedMessageIds] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);

  // Community
  const [channels, setChannels] = useState<Channel[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChannelMessage[]>([]);
  const [expandedMessage, setExpandedMessage] = useState<string | null>(null);
  const [loadingMessages, setLoadingMessages] = useState(false);

  // Stats
  const [stats, setStats] = useState({ totalSessions: 0, totalPosts: 0, activeUsers: 0 });

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    setLoading(true);

    // Stats
    const [sessRes, msgRes] = await Promise.all([
      supabase.from('coaching_sessions').select('id', { count: 'exact', head: true }),
      supabase.from('community_messages').select('id', { count: 'exact', head: true }).eq('deleted', false),
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
      totalPosts: msgRes.count || 0,
      activeUsers: uniqueActive.size,
    });

    // Load channels directly (RLS allows reading community_channels —
    // same pattern as app/(app)/community/page.tsx). Message counts
    // come from a single grouped query against community_messages
    // rather than one request per channel, to avoid an N+1 fetch
    // pattern as the channel list grows.
    const { data: channelsData, error: channelsErr } = await supabase
      .from('community_channels')
      .select('slug, name, emoji, channel_type')
      .order('sort_order');

    if (channelsErr) {
      console.error('[coaching/community] channels query failed:', channelsErr.message);
      setChannels([]);
    } else {
      // NOTE: this pulls one row per non-deleted message just to count
      // them client-side, which is fine at current platform scale but
      // won't be once message volume grows substantially. The proper
      // fix is a Postgres view or RPC that returns grouped counts
      // (SELECT channel, count(*) FROM community_messages WHERE
      // deleted = false GROUP BY channel) — flagging here rather than
      // building it now since it's not yet a real bottleneck.
      const { data: countRows } = await supabase
        .from('community_messages')
        .select('channel')
        .eq('deleted', false);

      const counts: Record<string, number> = {};
      (countRows || []).forEach((r: any) => {
        counts[r.channel] = (counts[r.channel] || 0) + 1;
      });

      setChannels((channelsData || []).map(c => ({ ...c, messageCount: counts[c.slug] || 0 })));
    }

    setLoading(false);
  }

  function switchTab(next: Tab) {
    setTab(next);
    setSelectedSessionIds(new Set());
    setSelectedMessageIds(new Set());
  }

  function toggleSession(id: string) {
    setSelectedSessionIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleMessage(id: string) {
    setSelectedMessageIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function deleteSelectedSessions() {
    if (selectedSessionIds.size === 0) return;
    const count = selectedSessionIds.size;
    if (!confirm(`Permanently delete ${count} coaching session${count === 1 ? '' : 's'}? This cannot be undone.`)) return;

    setDeleting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/admin/coaching-sessions', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ ids: Array.from(selectedSessionIds) }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        alert(body?.error || 'Delete failed');
        return;
      }

      // Remove deleted sessions from local state — both the flat
      // per-user session arrays and the userGroups summary counts.
      const idsToRemove = selectedSessionIds;
      setUserGroups(prev =>
        prev
          .map(g => ({ ...g, sessions: g.sessions.filter((s: any) => !idsToRemove.has(s.id)) }))
          .map(g => ({ ...g, sessionCount: g.sessions.length }))
          .filter(g => g.sessions.length > 0)
      );
      setStats(prev => ({ ...prev, totalSessions: Math.max(0, prev.totalSessions - idsToRemove.size) }));
      setSelectedSessionIds(new Set());
    } catch (err) {
      console.error('[deleteSelectedSessions]', err);
      alert('Delete failed — check your connection and try again.');
    } finally {
      setDeleting(false);
    }
  }

  async function deleteSelectedMessages() {
    if (selectedMessageIds.size === 0) return;
    const count = selectedMessageIds.size;
    if (!confirm(`Delete ${count} message${count === 1 ? '' : 's'}? This removes them from the community view.`)) return;

    setDeleting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/admin/community-messages', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ ids: Array.from(selectedMessageIds), action: 'delete' }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        alert(body?.error || 'Delete failed');
        return;
      }

      const idsToRemove = selectedMessageIds;
      setMessages(prev => prev.filter(m => !idsToRemove.has(m.id)));
      setChannels(prev => prev.map(c =>
        c.slug === selectedChannel ? { ...c, messageCount: Math.max(0, c.messageCount - idsToRemove.size) } : c
      ));
      setStats(prev => ({ ...prev, totalPosts: Math.max(0, prev.totalPosts - idsToRemove.size) }));
      setSelectedMessageIds(new Set());
    } catch (err) {
      console.error('[deleteSelectedMessages]', err);
      alert('Delete failed — check your connection and try again.');
    } finally {
      setDeleting(false);
    }
  }

  async function loadChannelMessages(slug: string) {
    setLoadingMessages(true);
    setSelectedChannel(slug);
    setExpandedMessage(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || '';

      const res = await fetch(`/api/admin/community-messages?channel=${encodeURIComponent(slug)}&limit=200`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const { messages: messagesData } = await res.json();
        setMessages(messagesData || []);
      } else {
        console.error('[loadChannelMessages] API error:', await res.text());
        setMessages([]);
      }
    } catch (err) {
      console.error('[loadChannelMessages]', err);
      setMessages([]);
    } finally {
      setLoadingMessages(false);
    }
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

      {/* Export — community messages + AI coaching sessions, CSV/JSON/PDF */}
      <div className="mb-6">
        <ExportPanel />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 p-1 rounded-lg" style={{ background: 'var(--bg-input)' }}>
        {([
          { key: 'coaching' as Tab, label: `AI Coaching (${stats.totalSessions})`, icon: CoachIcons.Bot },
          { key: 'community' as Tab, label: `Community (${stats.totalPosts})`, icon: CoachIcons.Group },
        ]).map((t) => (
          <button key={t.key} onClick={() => switchTab(t.key)}
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
          {selectedSessionIds.size > 0 && (
            <div className="flex items-center justify-between px-4 py-2.5 rounded-xl mb-1"
              style={{ background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.25)' }}>
              <span className="text-xs font-semibold" style={{ color: '#DC2626' }}>
                {selectedSessionIds.size} session{selectedSessionIds.size === 1 ? '' : 's'} selected
              </span>
              <div className="flex items-center gap-2">
                <button onClick={() => setSelectedSessionIds(new Set())}
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg"
                  style={{ color: 'var(--text-muted)' }}>
                  Clear
                </button>
                <button onClick={deleteSelectedSessions} disabled={deleting}
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg"
                  style={{ background: '#DC2626', color: '#fff', opacity: deleting ? 0.6 : 1 }}>
                  {deleting ? 'Deleting…' : 'Delete selected'}
                </button>
              </div>
            </div>
          )}
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
                      const isSelected = selectedSessionIds.has(s.id);
                      return (
                        <div key={s.id} className="rounded-lg mb-1.5 overflow-hidden"
                          style={{ border: isSelected ? '1.5px solid #DC2626' : '1px solid var(--border)' }}>
                          <div className="flex items-stretch">
                            <button
                              onClick={(e) => { e.stopPropagation(); toggleSession(s.id); }}
                              className="flex items-center px-2.5"
                              style={{ background: isSelected ? 'rgba(220,38,38,0.06)' : 'transparent' }}
                              aria-label={isSelected ? 'Deselect session' : 'Select session'}
                            >
                              <input type="checkbox" checked={isSelected} readOnly
                                style={{ width: 14, height: 14, accentColor: '#DC2626', cursor: 'pointer' }} />
                            </button>
                            <button onClick={() => setExpandedSession(isSessionOpen ? null : s.id)}
                              className="flex-1 flex items-center gap-3 px-3 py-2.5 text-left">
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
                          </div>

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

      {/* ═══ COMMUNITY: Channel selector → messages ═══ */}
      {tab === 'community' && (
        <div>
          {/* Channel selector */}
          <div className="flex gap-2 mb-4 flex-wrap">
            {channels.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--text-dim)' }}>No channels created yet.</p>
            ) : channels.map((c) => (
              <button key={c.slug} onClick={() => loadChannelMessages(c.slug)}
                className="px-3.5 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5"
                style={{
                  background: selectedChannel === c.slug ? 'rgba(245,158,11,0.12)' : 'var(--bg-card)',
                  border: selectedChannel === c.slug ? '1.5px solid var(--accent)' : '1px solid var(--border)',
                  color: selectedChannel === c.slug ? 'var(--accent)' : 'var(--text-muted)',
                }}>
                {c.emoji ? <span>{c.emoji}</span> : <span>{CoachIcons.Group}</span>}
                {c.name}
                <span className="text-[10px] opacity-60">({c.messageCount} messages)</span>
              </button>
            ))}
          </div>

          {/* No channel selected */}
          {!selectedChannel && channels.length > 0 && (
            <div className="text-center py-10 rounded-xl"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
              <div className="mb-2">{CoachIcons.SelectCohort}</div>
              <p className="text-sm" style={{ color: 'var(--text-dim)' }}>
                Select a channel above to view its messages
              </p>
            </div>
          )}

          {/* Loading messages */}
          {loadingMessages && (
            <div className="text-center py-10">
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading messages...</p>
            </div>
          )}

          {/* Messages list */}
          {selectedChannel && !loadingMessages && (
            <div className="flex flex-col gap-2">
              {selectedMessageIds.size > 0 && (
                <div className="flex items-center justify-between px-4 py-2.5 rounded-xl mb-1"
                  style={{ background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.25)' }}>
                  <span className="text-xs font-semibold" style={{ color: '#DC2626' }}>
                    {selectedMessageIds.size} message{selectedMessageIds.size === 1 ? '' : 's'} selected
                  </span>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setSelectedMessageIds(new Set())}
                      className="text-xs font-semibold px-3 py-1.5 rounded-lg"
                      style={{ color: 'var(--text-muted)' }}>
                      Clear
                    </button>
                    <button onClick={deleteSelectedMessages} disabled={deleting}
                      className="text-xs font-semibold px-3 py-1.5 rounded-lg"
                      style={{ background: '#DC2626', color: '#fff', opacity: deleting ? 0.6 : 1 }}>
                      {deleting ? 'Deleting…' : 'Delete selected'}
                    </button>
                  </div>
                </div>
              )}
              {messages.length === 0 ? (
                <div className="text-center py-10 rounded-xl"
                  style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                  <div className="mb-2">{CoachIcons.EmptyPosts}</div>
                  <p className="text-sm" style={{ color: 'var(--text-dim)' }}>No messages in this channel yet.</p>
                </div>
              ) : messages.map((m) => {
                const isOpen = expandedMessage === m.id;
                const isSelected = selectedMessageIds.has(m.id);
                return (
                  <div key={m.id} className="rounded-xl overflow-hidden"
                    style={{ background: 'var(--bg-card)', border: m.flagged ? '1.5px solid var(--error, #DC2626)' : isSelected ? '1.5px solid #DC2626' : '1px solid var(--border)' }}>

                    <div className="flex items-stretch">
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleMessage(m.id); }}
                        className="flex items-center px-2.5"
                        style={{ background: isSelected ? 'rgba(220,38,38,0.06)' : 'transparent' }}
                        aria-label={isSelected ? 'Deselect message' : 'Select message'}
                      >
                        <input type="checkbox" checked={isSelected} readOnly
                          style={{ width: 14, height: 14, accentColor: '#DC2626', cursor: 'pointer' }} />
                      </button>
                      <button onClick={() => setExpandedMessage(isOpen ? null : m.id)}
                        className="flex-1 text-left px-4 py-3">
                      <div className="flex justify-between items-start mb-1.5">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                            style={{ background: 'rgba(20,184,166,0.09)', color: 'var(--teal)' }}>
                            {m.author_name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <span className="text-xs font-semibold" style={{ color: 'var(--text)' }}>{m.author_name}</span>
                            <span className="text-[10px] ml-2" style={{ color: 'var(--text-dim)' }}>
                              {new Date(m.created_at).toLocaleDateString('en-US', {
                                month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
                              })}
                            </span>
                          </div>
                        </div>
                        {m.flagged && (
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                            style={{ background: 'rgba(220,38,38,0.09)', color: '#DC2626' }}>
                            Flagged
                          </span>
                        )}
                      </div>
                      <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                        {m.content}
                      </p>
                      </button>
                    </div>

                    {isOpen && (
                      <div className="px-4 py-3 flex gap-2" style={{ borderTop: '1px solid var(--border)' }}>
                        <button
                          onClick={async () => {
                            const { data: { session } } = await supabase.auth.getSession();
                            await fetch('/api/admin/community-messages', {
                              method: 'PATCH',
                              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
                              body: JSON.stringify({ id: m.id, action: m.flagged ? 'unflag' : 'flag' }),
                            });
                            setMessages(prev => prev.map(x => x.id === m.id ? { ...x, flagged: !x.flagged } : x));
                          }}
                          className="text-xs font-semibold px-3 py-1.5 rounded-lg"
                          style={{ border: '1px solid var(--border)', color: 'var(--text-muted)' }}
                        >
                          {m.flagged ? 'Unflag' : 'Flag'}
                        </button>
                        <button
                          onClick={async () => {
                            if (!confirm('Delete this message? This cannot be undone from this view.')) return;
                            const { data: { session } } = await supabase.auth.getSession();
                            await fetch('/api/admin/community-messages', {
                              method: 'PATCH',
                              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
                              body: JSON.stringify({ id: m.id, action: 'delete' }),
                            });
                            setMessages(prev => prev.filter(x => x.id !== m.id));
                          }}
                          className="text-xs font-semibold px-3 py-1.5 rounded-lg"
                          style={{ border: '1px solid rgba(220,38,38,0.3)', color: '#DC2626' }}
                        >
                          Delete
                        </button>
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
