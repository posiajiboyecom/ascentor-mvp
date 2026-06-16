'use client';

// app/(app)/community/page.tsx
// ── Ascentor Community Chat — Supabase Realtime ───────────────
// Channels are loaded from community_channels table (DB-driven).
// Admin can create/rename/delete channels from admin panel.

import { useState, useEffect, useRef, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

const B = {
  gold:        '#E8A020',
  goldMuted:   'rgba(232,160,32,0.08)',
  goldBorder:  'rgba(232,160,32,0.18)',
  text:        'var(--text)',
  textMuted:   'var(--text-muted)',
  textDim:     'var(--text-dim, #666)',
  bg:          'var(--bg)',
  bgCard:      'var(--bg-card)',
  bgInput:     'var(--bg-input)',
  border:      'var(--border)',
  fontDisplay: "'Cormorant Garamond', Georgia, serif",
  fontUI:      "'Syne', system-ui, sans-serif",
  fontMono:    "'DM Mono', 'Courier New', monospace",
};

interface Channel {
  slug: string;
  name: string;
  emoji: string;
  description: string;
  sort_order: number;
}

interface Message {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  channel: string;
  author_name: string;
  is_own: boolean;
}

// Fallback if DB is empty or table not seeded yet
const FALLBACK_CHANNELS: Channel[] = [
  { slug: 'general',        name: 'General',        emoji: '💬', description: 'Open conversation',   sort_order: 1 },
  { slug: 'introductions',  name: 'Introductions',  emoji: '👋', description: 'Introduce yourself',  sort_order: 2 },
  { slug: 'career-wins',    name: 'Career Wins',    emoji: '💼', description: 'Share milestones',     sort_order: 3 },
  { slug: 'accountability', name: 'Accountability', emoji: '🤝', description: 'Weekly check-ins',    sort_order: 4 },
  { slug: 'industry-talk',  name: 'Industry Talk',  emoji: '🧠', description: 'Deep dives',           sort_order: 5 },
  { slug: 'cv-review',      name: 'CV Review',      emoji: '📄', description: 'Get feedback',         sort_order: 6 },
  { slug: 'opportunities',  name: 'Opportunities',  emoji: '🎯', description: 'Jobs & gigs',          sort_order: 7 },
];

function initials(name: string) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?';
}

function formatTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  return d.toDateString() === now.toDateString()
    ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function Avatar({ name, size = 32 }: { name: string; size?: number }) {
  const colors = ['#E8A020','#14B8A6','#8B5CF6','#3B82F6','#EC4899','#F97316'];
  const idx = name.split('').reduce((a,c) => a + c.charCodeAt(0), 0) % colors.length;
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: `${colors[idx]}20`, border: `1px solid ${colors[idx]}40`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0, fontFamily: B.fontMono, fontSize: size * 0.35,
      fontWeight: 500, color: colors[idx],
    }}>
      {initials(name)}
    </div>
  );
}

export default function CommunityPage() {
  const supabase = useRef(createClient()).current;
  const [userId,      setUserId]      = useState<string|null>(null);
  const [userName,    setUserName]    = useState('Member');
  const [channels,    setChannels]    = useState<Channel[]>(FALLBACK_CHANNELS);
  const [channel,     setChannel]     = useState('general');
  const [messages,    setMessages]    = useState<Message[]>([]);
  const [input,       setInput]       = useState('');
  const [sending,     setSending]     = useState(false);
  const [loading,     setLoading]     = useState(true);
  const [online,      setOnline]      = useState(1);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const bottomRef  = useRef<HTMLDivElement>(null);
  const inputRef   = useRef<HTMLTextAreaElement>(null);
  const profileMap = useRef<Record<string,string>>({});

  // ── Load current user ──────────────────────────────────────
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      const { data: p } = await supabase.from('profiles').select('full_name').eq('id', user.id).single();
      const name = p?.full_name || user.email?.split('@')[0] || 'Member';
      setUserName(name);
      profileMap.current[user.id] = name;
    })();
  }, [supabase]);

  // ── Load channels from DB ──────────────────────────────────
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('community_channels')
        .select('slug, name, emoji, description, sort_order')
        .order('sort_order', { ascending: true });
      if (data && data.length > 0) {
        setChannels(data as Channel[]);
        // If current channel no longer exists, fall back to first
        setChannel(prev => data.some((c: Channel) => c.slug === prev) ? prev : data[0].slug);
      }
    })();
  }, [supabase]);

  // ── Realtime channel list updates (admin adds/removes channels) ──
  useEffect(() => {
    const sub = supabase
      .channel('community-channels-watch')
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'community_channels',
      }, async () => {
        // Re-fetch channels whenever admin makes changes
        const { data } = await supabase
          .from('community_channels')
          .select('slug, name, emoji, description, sort_order')
          .order('sort_order', { ascending: true });
        if (data && data.length > 0) setChannels(data as Channel[]);
      })
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [supabase]);

  const enrichMessages = useCallback(async (raw: any[], uid: string|null): Promise<Message[]> => {
    const unknownIds = [...new Set(raw.map(m => m.user_id))].filter(id => !profileMap.current[id]);
    if (unknownIds.length > 0) {
      const { data: profiles } = await supabase.from('profiles').select('id, full_name').in('id', unknownIds);
      (profiles || []).forEach((p: any) => { profileMap.current[p.id] = p.full_name || 'Member'; });
    }
    return raw.map(m => ({
      ...m,
      author_name: profileMap.current[m.user_id] || 'Member',
      is_own: m.user_id === uid,
    }));
  }, [supabase]);

  const loadMessages = useCallback(async (ch: string, uid: string|null) => {
    setLoading(true);
    const { data } = await supabase
      .from('community_messages')
      .select('id, user_id, content, created_at, channel')
      .eq('channel', ch).eq('deleted', false)
      .order('created_at', { ascending: true }).limit(100);
    setMessages(await enrichMessages(data || [], uid));
    setLoading(false);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  }, [supabase, enrichMessages]);

  useEffect(() => { loadMessages(channel, userId); }, [channel, userId, loadMessages]);

  // ── Realtime messages ──────────────────────────────────────
  useEffect(() => {
    const msgCh = supabase
      .channel(`community:${channel}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public',
        table: 'community_messages', filter: `channel=eq.${channel}`,
      }, async (payload: any) => {
        if (payload.new.deleted) return;
        const [enriched] = await enrichMessages([payload.new], userId);
        setMessages(prev => prev.some(m => m.id === enriched.id) ? prev : [...prev, enriched]);
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
      })
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public',
        table: 'community_messages', filter: `channel=eq.${channel}`,
      }, (payload: any) => {
        if (payload.new.deleted) setMessages(prev => prev.filter(m => m.id !== payload.new.id));
      })
      .subscribe();

    const presenceCh = supabase.channel(`presence:${channel}`);
    presenceCh
      .on('presence', { event: 'sync' }, () => {
        setOnline(Object.keys(presenceCh.presenceState()).length || 1);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED' && userId) {
          await presenceCh.track({ user_id: userId });
        }
      });

    return () => { supabase.removeChannel(msgCh); supabase.removeChannel(presenceCh); };
  }, [channel, userId, supabase, enrichMessages]);

  async function sendMessage() {
    const text = input.trim();
    if (!text || !userId || sending) return;
    setSending(true);
    setInput('');
    const { error } = await supabase.from('community_messages').insert({ user_id: userId, channel, content: text });
    if (error) { setInput(text); console.error(error.message); }
    setSending(false);
    inputRef.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  }

  async function deleteMessage(id: string) {
    await supabase.from('community_messages').update({ deleted: true }).eq('id', id).eq('user_id', userId!);
    setMessages(prev => prev.filter(m => m.id !== id));
  }

  function shouldShowHeader(i: number) {
    if (i === 0) return true;
    const prev = messages[i-1], curr = messages[i];
    if (prev.user_id !== curr.user_id) return true;
    return new Date(curr.created_at).getTime() - new Date(prev.created_at).getTime() > 5 * 60 * 1000;
  }

  const currentChannel = channels.find(c => c.slug === channel) || channels[0];

  const SidebarContent = (
    <div style={{
      width: 220, flexShrink: 0, height: '100%',
      background: B.bgCard, borderRight: `1px solid ${B.border}`,
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      <div style={{ padding: '16px 16px 12px', borderBottom: `1px solid ${B.border}` }}>
        <div style={{ fontFamily: B.fontDisplay, fontStyle: 'italic', fontSize: 18, fontWeight: 700, color: B.text, marginBottom: 4 }}>Community</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22C55E', display: 'inline-block' }} />
          <span style={{ fontFamily: B.fontMono, fontSize: 10, letterSpacing: '0.06em', color: B.textDim }}>{online} online</span>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
        <div style={{ fontFamily: B.fontMono, fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase' as const, color: B.textDim, padding: '8px 16px 4px' }}>
          Channels
        </div>
        {channels.map(ch => (
          <button key={ch.slug} onClick={() => { setChannel(ch.slug); setSidebarOpen(false); }} style={{
            display: 'flex', alignItems: 'center', gap: 8,
            width: '100%', padding: '8px 16px',
            background: channel === ch.slug ? B.goldMuted : 'transparent',
            border: 'none',
            borderLeft: channel === ch.slug ? `2px solid ${B.gold}` : '2px solid transparent',
            cursor: 'pointer', textAlign: 'left' as const,
          }}>
            <span style={{ fontSize: 14 }}>{ch.emoji}</span>
            <span style={{ fontFamily: B.fontUI, fontSize: 13, color: channel === ch.slug ? B.gold : B.textMuted, fontWeight: channel === ch.slug ? 600 : 400 }}>
              # {ch.name}
            </span>
          </button>
        ))}
      </div>

      <div style={{ padding: '12px 16px', borderTop: `1px solid ${B.border}`, display: 'flex', alignItems: 'center', gap: 8 }}>
        <Avatar name={userName} size={28} />
        <span style={{ fontFamily: B.fontUI, fontSize: 12, color: B.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
          {userName}
        </span>
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 64px)', overflow: 'hidden', background: B.bg, position: 'relative' }}>
      <style>{`
        @keyframes community-spin { to { transform: rotate(360deg); } }
        .cmsg-row:hover { background: var(--bg-input, rgba(255,255,255,0.03)); }
        .cmsg-row:hover .cmsg-del { display: flex !important; }
        .community-sidebar { display: flex; }
        .community-menu-btn { display: none !important; }
        @media (max-width: 640px) {
          .community-sidebar { display: none !important; }
          .community-menu-btn { display: flex !important; }
        }
      `}</style>

      <div className="community-sidebar">{SidebarContent}</div>

      {sidebarOpen && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 20, display: 'flex' }} onClick={() => setSidebarOpen(false)}>
          <div onClick={e => e.stopPropagation()}>{SidebarContent}</div>
          <div style={{ flex: 1, background: 'rgba(0,0,0,0.5)' }} />
        </div>
      )}

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        {/* Channel header */}
        <div style={{ padding: '0 16px', height: 52, flexShrink: 0, borderBottom: `1px solid ${B.border}`, display: 'flex', alignItems: 'center', gap: 10, background: B.bgCard }}>
          <button className="community-menu-btn" onClick={() => setSidebarOpen(true)} style={{ background: 'none', border: 'none', color: B.textMuted, cursor: 'pointer', padding: 4, fontSize: 18 }}>☰</button>
          <span style={{ fontSize: 18 }}>{currentChannel?.emoji}</span>
          <span style={{ fontFamily: B.fontUI, fontSize: 14, fontWeight: 600, color: B.text }}># {currentChannel?.name}</span>
          <span style={{ fontFamily: B.fontMono, fontSize: 10, color: B.textDim, letterSpacing: '0.04em' }}>{currentChannel?.description}</span>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 8px', display: 'flex', flexDirection: 'column' }}>
          {loading ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
              <div style={{ width: 24, height: 24, borderRadius: '50%', border: `2px solid ${B.border}`, borderTopColor: B.gold, animation: 'community-spin 0.7s linear infinite' }} />
              <span style={{ fontFamily: B.fontMono, fontSize: 11, color: B.textDim }}>Loading…</span>
            </div>
          ) : messages.length === 0 ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8, padding: '40px 0' }}>
              <span style={{ fontSize: 36 }}>{currentChannel?.emoji}</span>
              <p style={{ fontFamily: B.fontDisplay, fontStyle: 'italic', fontSize: 20, color: B.text, margin: 0 }}>Be the first to say something.</p>
              <p style={{ fontFamily: B.fontUI, fontSize: 13, color: B.textMuted, margin: 0 }}>{currentChannel?.description}</p>
            </div>
          ) : messages.map((msg, i) => {
            const showHeader = shouldShowHeader(i);
            return (
              <div key={msg.id} className="cmsg-row" style={{ display: 'flex', gap: 10, padding: showHeader ? '12px 8px 2px' : '2px 8px 2px', borderRadius: 8, alignItems: 'flex-start', position: 'relative' }}>
                <div style={{ width: 32, flexShrink: 0 }}>{showHeader && <Avatar name={msg.author_name} size={32} />}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {showHeader && (
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 2 }}>
                      <span style={{ fontFamily: B.fontUI, fontSize: 13, fontWeight: 600, color: B.text }}>{msg.is_own ? 'You' : msg.author_name}</span>
                      <span style={{ fontFamily: B.fontMono, fontSize: 10, color: B.textDim }}>{formatTime(msg.created_at)}</span>
                    </div>
                  )}
                  <p style={{ fontFamily: B.fontUI, fontSize: 14, color: B.text, margin: 0, lineHeight: 1.55, wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>{msg.content}</p>
                </div>
                {msg.is_own && (
                  <button className="cmsg-del" onClick={() => deleteMessage(msg.id)} style={{ display: 'none', background: 'none', border: 'none', color: 'rgba(239,68,68,0.6)', cursor: 'pointer', fontSize: 11, padding: '2px 6px', borderRadius: 4, fontFamily: B.fontMono, alignItems: 'center' }} title="Delete">✕</button>
                )}
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div style={{ padding: '12px 16px', borderTop: `1px solid ${B.border}`, background: B.bgCard, flexShrink: 0 }}>
          {!userId ? (
            <div style={{ padding: '12px 16px', borderRadius: 10, background: B.bgInput, border: `1px solid ${B.border}`, fontFamily: B.fontUI, fontSize: 13, color: B.textMuted, textAlign: 'center' }}>
              Sign in to join the conversation
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={`Message #${currentChannel?.name}…`}
                rows={1}
                maxLength={2000}
                style={{ flex: 1, padding: '10px 14px', borderRadius: 10, border: `1px solid ${B.border}`, background: B.bgInput, color: B.text, fontFamily: B.fontUI, fontSize: 14, outline: 'none', resize: 'none', lineHeight: 1.5, minHeight: 42, maxHeight: 120 }}
                onFocus={e => (e.target.style.borderColor = B.gold)}
                onBlur={e => (e.target.style.borderColor = B.border)}
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim() || sending}
                style={{ width: 42, height: 42, borderRadius: 10, border: 'none', background: input.trim() ? B.gold : B.bgInput, color: input.trim() ? '#0C0B08' : B.textDim, cursor: input.trim() ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'background 0.15s', fontSize: 16 }}
              >{sending ? '…' : '↑'}</button>
            </div>
          )}
          <div style={{ fontFamily: B.fontMono, fontSize: 9, color: B.textDim, marginTop: 6, textAlign: 'right' }}>
            Enter to send · Shift+Enter for new line
          </div>
        </div>
      </div>
    </div>
  );
}
