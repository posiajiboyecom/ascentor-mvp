'use client';

// app/(app)/community/page.tsx
// ── Full-screen immersive chat — no nav bar, no header ────────
// Features: SVG icons, message likes, WhatsApp-style replies,
//           DB-driven channels, Supabase Realtime

import { useState, useEffect, useRef, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';

const B = {
  gold:        '#E8A020',
  goldMuted:   'rgba(232,160,32,0.08)',
  goldBorder:  'rgba(232,160,32,0.20)',
  text:        'var(--app-text, var(--text, #F1F0EB))',
  textMuted:   'var(--app-text-muted, var(--text-muted, #9A9080))',
  textDim:     'var(--app-text-dim, var(--text-dim, #5A5040))',
  bg:          'var(--app-bg, var(--bg, #0C0B08))',
  bgCard:      'var(--app-bg-card, var(--bg-card, #1A1814))',
  bgInput:     'var(--app-bg-input, var(--bg-input, #242018))',
  border:      'var(--app-border, var(--border, rgba(255,255,255,0.06)))',
  fontDisplay: "'Cormorant Garamond', Georgia, serif",
  fontUI:      "'Syne', system-ui, sans-serif",
  fontMono:    "'DM Mono', 'Courier New', monospace",
};

// ── SVG icon set ─────────────────────────────────────────────
const Icons = {
  back: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 12H5M12 19l-7-7 7-7"/>
    </svg>
  ),
  send: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
    </svg>
  ),
  heart: (filled: boolean) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill={filled ? '#E8A020' : 'none'} stroke={filled ? '#E8A020' : 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
    </svg>
  ),
  reply: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/>
    </svg>
  ),
  close: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  ),
  hash: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/>
      <line x1="10" y1="3" x2="8" y2="21"/><line x1="16" y1="3" x2="14" y2="21"/>
    </svg>
  ),
  menu: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
    </svg>
  ),
  online: (
    <svg width="8" height="8" viewBox="0 0 8 8">
      <circle cx="4" cy="4" r="4" fill="#22C55E"/>
    </svg>
  ),
  trash: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
    </svg>
  ),
};

// ── Channel SVGs (replaces emojis) ───────────────────────────
const CHANNEL_ICONS: Record<string, JSX.Element> = {
  general: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
  introductions: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  'career-wins': <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2z"/></svg>,
  accountability: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>,
  'industry-talk': <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>,
  'cv-review': <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>,
  opportunities: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/><line x1="12" y1="12" x2="12" y2="16"/><line x1="10" y1="14" x2="14" y2="14"/></svg>,
};

function getChannelIcon(slug: string) {
  return CHANNEL_ICONS[slug] || Icons.hash;
}

// ── Types ────────────────────────────────────────────────────
interface Channel { slug: string; name: string; emoji: string; description: string; sort_order: number; }

interface Message {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  channel: string;
  author_name: string;
  is_own: boolean;
  likes: string[];        // array of user_ids who liked
  reply_to_id?: string;
  reply_to_content?: string;
  reply_to_author?: string;
}

const FALLBACK_CHANNELS: Channel[] = [
  { slug: 'general',        name: 'General',        emoji: '💬', description: 'Open conversation',  sort_order: 1 },
  { slug: 'introductions',  name: 'Introductions',  emoji: '👋', description: 'Introduce yourself', sort_order: 2 },
  { slug: 'career-wins',    name: 'Career Wins',    emoji: '💼', description: 'Share milestones',    sort_order: 3 },
  { slug: 'accountability', name: 'Accountability', emoji: '🤝', description: 'Weekly check-ins',   sort_order: 4 },
  { slug: 'industry-talk',  name: 'Industry Talk',  emoji: '🧠', description: 'Deep dives',          sort_order: 5 },
  { slug: 'cv-review',      name: 'CV Review',      emoji: '📄', description: 'Get feedback',        sort_order: 6 },
  { slug: 'opportunities',  name: 'Opportunities',  emoji: '🎯', description: 'Jobs & gigs',         sort_order: 7 },
];

function initials(name: string) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?';
}

function formatTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString())
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function Avatar({ name, size = 34 }: { name: string; size?: number }) {
  const colors = ['#E8A020','#14B8A6','#8B5CF6','#3B82F6','#EC4899','#F97316'];
  const idx = name.split('').reduce((a,c) => a + c.charCodeAt(0), 0) % colors.length;
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: `${colors[idx]}18`, border: `1.5px solid ${colors[idx]}35`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: B.fontMono, fontSize: size * 0.33, fontWeight: 600, color: colors[idx],
    }}>
      {initials(name)}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
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
  const [replyTo,     setReplyTo]     = useState<Message|null>(null);
  const [hoveredMsg,  setHoveredMsg]  = useState<string|null>(null);
  const bottomRef  = useRef<HTMLDivElement>(null);
  const inputRef   = useRef<HTMLTextAreaElement>(null);
  const profileMap = useRef<Record<string,string>>({});

  // ── Current user ──────────────────────────────────────────
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
        setChannel(prev => data.some((c: Channel) => c.slug === prev) ? prev : data[0].slug);
      }
    })();
  }, [supabase]);

  // ── Enrich messages ────────────────────────────────────────
  const enrichMessages = useCallback(async (raw: any[], uid: string|null): Promise<Message[]> => {
    const unknownIds = [...new Set(raw.map(m => m.user_id))].filter(id => !profileMap.current[id]);
    if (unknownIds.length > 0) {
      const { data: profiles } = await supabase.from('profiles').select('id, full_name').in('id', unknownIds);
      (profiles || []).forEach((p: any) => { profileMap.current[p.id] = p.full_name || 'Member'; });
    }

    // Fetch reply-to content for messages that have reply_to_id
    const replyIds = [...new Set(raw.filter(m => m.reply_to_id).map(m => m.reply_to_id))];
    const replyMap: Record<string, { content: string; author: string }> = {};
    if (replyIds.length > 0) {
      const { data: replyMsgs } = await supabase
        .from('community_messages')
        .select('id, content, user_id')
        .in('id', replyIds);
      (replyMsgs || []).forEach((r: any) => {
        const authorName = profileMap.current[r.user_id] || 'Member';
        replyMap[r.id] = { content: r.content, author: authorName };
      });
    }

    return raw.map(m => ({
      ...m,
      author_name: profileMap.current[m.user_id] || 'Member',
      is_own: m.user_id === uid,
      likes: m.likes || [],
      reply_to_content: m.reply_to_id ? replyMap[m.reply_to_id]?.content : undefined,
      reply_to_author: m.reply_to_id ? replyMap[m.reply_to_id]?.author : undefined,
    }));
  }, [supabase]);

  // ── Load messages ──────────────────────────────────────────
  const loadMessages = useCallback(async (ch: string, uid: string|null) => {
    setLoading(true);
    const { data } = await supabase
      .from('community_messages')
      .select('id, user_id, content, created_at, channel, likes, reply_to_id')
      .eq('channel', ch).eq('deleted', false)
      .order('created_at', { ascending: true }).limit(100);
    setMessages(await enrichMessages(data || [], uid));
    setLoading(false);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  }, [supabase, enrichMessages]);

  useEffect(() => { loadMessages(channel, userId); }, [channel, userId, loadMessages]);

  // ── Realtime ───────────────────────────────────────────────
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
        const u = payload.new;
        if (u.deleted) {
          setMessages(prev => prev.filter(m => m.id !== u.id));
        } else {
          // Update likes in place
          setMessages(prev => prev.map(m => m.id === u.id ? { ...m, likes: u.likes || [] } : m));
        }
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

  // ── Send message ───────────────────────────────────────────
  async function sendMessage() {
    const text = input.trim();
    if (!text || !userId || sending) return;
    setSending(true);
    setInput('');
    const payload: any = { user_id: userId, channel, content: text, likes: [] };
    if (replyTo) payload.reply_to_id = replyTo.id;
    const { error } = await supabase.from('community_messages').insert(payload);
    if (error) { setInput(text); console.error(error.message); }
    setReplyTo(null);
    setSending(false);
    inputRef.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
    if (e.key === 'Escape' && replyTo) setReplyTo(null);
  }

  // ── Like / unlike ──────────────────────────────────────────
  async function toggleLike(msg: Message) {
    if (!userId) return;
    const liked = msg.likes.includes(userId);
    const newLikes = liked
      ? msg.likes.filter(id => id !== userId)
      : [...msg.likes, userId];
    // Optimistic update
    setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, likes: newLikes } : m));
    await supabase.from('community_messages').update({ likes: newLikes }).eq('id', msg.id);
  }

  // ── Delete own message ─────────────────────────────────────
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

  // ── Sidebar ────────────────────────────────────────────────
  const SidebarContent = (
    <div style={{
      width: 260, flexShrink: 0, height: '100%',
      background: B.bgCard,
      borderRight: `1px solid ${B.border}`,
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      {/* Sidebar top — back to app + community title */}
      <div style={{ padding: '16px 16px 12px', borderBottom: `1px solid ${B.border}` }}>
        <Link href="/dashboard" style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          fontFamily: B.fontMono, fontSize: 10, letterSpacing: '0.08em',
          textTransform: 'uppercase', color: B.textDim,
          textDecoration: 'none', marginBottom: 12,
        }}>
          {Icons.back} Home
        </Link>
        <div style={{ fontFamily: B.fontDisplay, fontStyle: 'italic', fontSize: 20, fontWeight: 700, color: B.text }}>
          Community
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 4 }}>
          {Icons.online}
          <span style={{ fontFamily: B.fontMono, fontSize: 10, letterSpacing: '0.06em', color: B.textDim }}>
            {online} online
          </span>
        </div>
      </div>

      {/* Channel list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
        <div style={{
          fontFamily: B.fontMono, fontSize: 9, letterSpacing: '0.14em',
          textTransform: 'uppercase', color: B.textDim, padding: '8px 16px 4px',
        }}>
          Channels
        </div>
        {channels.map(ch => {
          const isActive = channel === ch.slug;
          return (
            <button key={ch.slug} onClick={() => { setChannel(ch.slug); setSidebarOpen(false); }} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              width: '100%', padding: '9px 16px',
              background: isActive ? B.goldMuted : 'transparent',
              border: 'none',
              borderLeft: isActive ? `2px solid ${B.gold}` : '2px solid transparent',
              cursor: 'pointer', textAlign: 'left',
              transition: 'background 0.1s',
            }}>
              <span style={{ color: isActive ? B.gold : B.textDim, flexShrink: 0 }}>
                {getChannelIcon(ch.slug)}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontFamily: B.fontUI, fontSize: 13,
                  color: isActive ? B.gold : B.textMuted,
                  fontWeight: isActive ? 600 : 400,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {ch.name}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Current user at bottom */}
      <div style={{
        padding: '12px 16px', borderTop: `1px solid ${B.border}`,
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <Avatar name={userName} size={30} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: B.fontUI, fontSize: 12, color: B.text, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {userName}
          </div>
          <div style={{ fontFamily: B.fontMono, fontSize: 9, color: B.textDim, letterSpacing: '0.04em' }}>
            Online
          </div>
        </div>
      </div>
    </div>
  );

  // ═══════════════════════════════════════════════════════════
  return (
    <div style={{
      display: 'flex', height: '100dvh', overflow: 'hidden',
      background: B.bg, position: 'relative',
    }}>
      <style>{`
        @keyframes cmsg-in { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes community-spin { to { transform: rotate(360deg); } }
        .cmsg-row { transition: background 0.1s; }
        .cmsg-row:hover { background: rgba(255,255,255,0.025); }
        .cmsg-actions { opacity: 0; transition: opacity 0.15s; }
        .cmsg-row:hover .cmsg-actions { opacity: 1; }
        .community-sidebar-wrap { display: flex; }
        .community-menu-btn { display: none !important; }
        @media (max-width: 640px) {
          .community-sidebar-wrap { display: none !important; }
          .community-menu-btn { display: flex !important; }
        }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 4px; }
      `}</style>

      {/* Desktop sidebar */}
      <div className="community-sidebar-wrap" style={{ height: '100%' }}>
        {SidebarContent}
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 30, display: 'flex' }}
          onClick={() => setSidebarOpen(false)}>
          <div onClick={e => e.stopPropagation()} style={{ height: '100%' }}>
            {SidebarContent}
          </div>
          <div style={{ flex: 1, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} />
        </div>
      )}

      {/* ── Main chat area ─────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>

        {/* Channel header */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '0 16px', height: 54, flexShrink: 0,
          borderBottom: `1px solid ${B.border}`,
          background: B.bgCard,
        }}>
          {/* Mobile menu */}
          <button
            className="community-menu-btn"
            onClick={() => setSidebarOpen(true)}
            style={{ background: 'none', border: 'none', color: B.textMuted, cursor: 'pointer', padding: 4, display: 'none' }}
          >
            {Icons.menu}
          </button>

          <span style={{ color: B.gold, flexShrink: 0 }}>{getChannelIcon(currentChannel?.slug || 'general')}</span>
          <span style={{ fontFamily: B.fontUI, fontSize: 15, fontWeight: 700, color: B.text }}>
            {currentChannel?.name}
          </span>
          <span style={{
            fontFamily: B.fontMono, fontSize: 10, color: B.textDim,
            letterSpacing: '0.04em', display: 'none',
          }}
            className="channel-desc">
            {currentChannel?.description}
          </span>

          {/* Online count — right aligned */}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5 }}>
            {Icons.online}
            <span style={{ fontFamily: B.fontMono, fontSize: 10, color: B.textDim, letterSpacing: '0.06em' }}>
              {online}
            </span>
          </div>
        </div>

        {/* Messages */}
        <div style={{
          flex: 1, overflowY: 'auto',
          padding: '8px 0 4px',
          display: 'flex', flexDirection: 'column',
        }}>
          {loading ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
              <div style={{ width: 24, height: 24, borderRadius: '50%', border: `2px solid ${B.border}`, borderTopColor: B.gold, animation: 'community-spin 0.7s linear infinite' }} />
              <span style={{ fontFamily: B.fontMono, fontSize: 11, color: B.textDim }}>Loading…</span>
            </div>
          ) : messages.length === 0 ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 10, padding: '40px 24px' }}>
              <div style={{ color: B.gold, opacity: 0.4 }}>{getChannelIcon(currentChannel?.slug || 'general')}</div>
              <p style={{ fontFamily: B.fontDisplay, fontStyle: 'italic', fontSize: 22, color: B.text, margin: 0 }}>
                Be the first to say something.
              </p>
              <p style={{ fontFamily: B.fontUI, fontSize: 13, color: B.textMuted, margin: 0 }}>
                {currentChannel?.description}
              </p>
            </div>
          ) : (
            messages.map((msg, i) => {
              const showHeader = shouldShowHeader(i);
              const liked = userId ? msg.likes.includes(userId) : false;
              const likeCount = msg.likes.length;

              return (
                <div
                  key={msg.id}
                  className="cmsg-row"
                  style={{
                    display: 'flex', gap: 10,
                    padding: showHeader ? '10px 16px 2px' : '2px 16px 2px',
                    alignItems: 'flex-start',
                    position: 'relative',
                    animation: 'cmsg-in 0.2s ease',
                  }}
                  onMouseEnter={() => setHoveredMsg(msg.id)}
                  onMouseLeave={() => setHoveredMsg(null)}
                >
                  {/* Avatar */}
                  <div style={{ width: 34, flexShrink: 0, paddingTop: showHeader ? 2 : 0 }}>
                    {showHeader && <Avatar name={msg.author_name} size={34} />}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    {/* Author + time */}
                    {showHeader && (
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 3 }}>
                        <span style={{ fontFamily: B.fontUI, fontSize: 13, fontWeight: 600, color: B.text }}>
                          {msg.is_own ? 'You' : msg.author_name}
                        </span>
                        <span style={{ fontFamily: B.fontMono, fontSize: 10, color: B.textDim }}>
                          {formatTime(msg.created_at)}
                        </span>
                      </div>
                    )}

                    {/* Reply preview */}
                    {msg.reply_to_id && msg.reply_to_content && (
                      <div style={{
                        borderLeft: `3px solid ${B.gold}`,
                        paddingLeft: 10, marginBottom: 6,
                        background: 'rgba(232,160,32,0.05)',
                        borderRadius: '0 6px 6px 0',
                        padding: '4px 8px 4px 10px',
                      }}>
                        <div style={{ fontFamily: B.fontMono, fontSize: 10, color: B.gold, marginBottom: 2 }}>
                          {msg.reply_to_author}
                        </div>
                        <div style={{
                          fontFamily: B.fontUI, fontSize: 12, color: B.textMuted,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          maxWidth: 300,
                        }}>
                          {msg.reply_to_content}
                        </div>
                      </div>
                    )}

                    {/* Message content */}
                    <p style={{
                      fontFamily: B.fontUI, fontSize: 14, color: B.text,
                      margin: 0, lineHeight: 1.6,
                      wordBreak: 'break-word', whiteSpace: 'pre-wrap',
                    }}>
                      {msg.content}
                    </p>

                    {/* Like count */}
                    {likeCount > 0 && (
                      <button
                        onClick={() => toggleLike(msg)}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          marginTop: 4, padding: '2px 8px', borderRadius: 12,
                          background: liked ? 'rgba(232,160,32,0.12)' : 'rgba(255,255,255,0.04)',
                          border: `1px solid ${liked ? 'rgba(232,160,32,0.3)' : 'rgba(255,255,255,0.08)'}`,
                          cursor: 'pointer', fontFamily: B.fontMono, fontSize: 11,
                          color: liked ? B.gold : B.textDim,
                        }}
                      >
                        {Icons.heart(liked)}
                        <span>{likeCount}</span>
                      </button>
                    )}
                  </div>

                  {/* Hover action bar */}
                  <div className="cmsg-actions" style={{
                    display: 'flex', alignItems: 'center', gap: 2,
                    position: 'absolute', right: 12, top: showHeader ? 10 : 2,
                    background: B.bgCard, border: `1px solid ${B.border}`,
                    borderRadius: 8, padding: '3px 4px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                  }}>
                    {/* Like */}
                    <button
                      onClick={() => toggleLike(msg)}
                      title="Like"
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: liked ? B.gold : B.textDim,
                        padding: '4px 6px', borderRadius: 6,
                        display: 'flex', alignItems: 'center',
                      }}
                    >
                      {Icons.heart(liked)}
                    </button>

                    {/* Reply */}
                    <button
                      onClick={() => { setReplyTo(msg); inputRef.current?.focus(); }}
                      title="Reply"
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: B.textDim, padding: '4px 6px', borderRadius: 6,
                        display: 'flex', alignItems: 'center',
                      }}
                    >
                      {Icons.reply}
                    </button>

                    {/* Delete own */}
                    {msg.is_own && (
                      <button
                        onClick={() => deleteMessage(msg.id)}
                        title="Delete"
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer',
                          color: 'rgba(239,68,68,0.5)', padding: '4px 6px', borderRadius: 6,
                          display: 'flex', alignItems: 'center',
                        }}
                      >
                        {Icons.trash}
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
          <div ref={bottomRef} style={{ height: 8 }} />
        </div>

        {/* Input area */}
        <div style={{
          padding: '10px 16px 14px',
          borderTop: `1px solid ${B.border}`,
          background: B.bgCard,
          flexShrink: 0,
          paddingBottom: 'max(14px, env(safe-area-inset-bottom, 14px))',
        }}>
          {/* Reply preview bar */}
          {replyTo && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '6px 10px', marginBottom: 8,
              borderRadius: 8, background: B.goldMuted,
              border: `1px solid ${B.goldBorder}`,
            }}>
              <span style={{ color: B.gold, flexShrink: 0 }}>{Icons.reply}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: B.fontMono, fontSize: 10, color: B.gold, marginBottom: 2 }}>
                  Replying to {replyTo.is_own ? 'yourself' : replyTo.author_name}
                </div>
                <div style={{
                  fontFamily: B.fontUI, fontSize: 12, color: B.textMuted,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {replyTo.content}
                </div>
              </div>
              <button
                onClick={() => setReplyTo(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: B.textDim, flexShrink: 0 }}
              >
                {Icons.close}
              </button>
            </div>
          )}

          {!userId ? (
            <div style={{
              padding: '12px 16px', borderRadius: 12,
              background: B.bgInput, border: `1px solid ${B.border}`,
              fontFamily: B.fontUI, fontSize: 13, color: B.textMuted, textAlign: 'center',
            }}>
              Sign in to join the conversation
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
              <div style={{ flex: 1, position: 'relative' }}>
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={`Message #${currentChannel?.name || 'General'}…`}
                  rows={1}
                  maxLength={2000}
                  style={{
                    width: '100%', padding: '11px 14px',
                    borderRadius: 12,
                    border: `1px solid ${input ? B.goldBorder : B.border}`,
                    background: B.bgInput,
                    color: B.text,
                    fontFamily: B.fontUI, fontSize: 14,
                    outline: 'none', resize: 'none', lineHeight: 1.5,
                    minHeight: 44, maxHeight: 120,
                    transition: 'border-color 0.15s',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
              <button
                onClick={sendMessage}
                disabled={!input.trim() || sending}
                style={{
                  width: 44, height: 44, borderRadius: 12, border: 'none',
                  background: input.trim() ? B.gold : B.bgInput,
                  color: input.trim() ? '#0C0B08' : B.textDim,
                  cursor: input.trim() ? 'pointer' : 'default',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0, transition: 'background 0.15s, color 0.15s',
                }}
              >
                {sending
                  ? <div style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid currentColor', borderTopColor: 'transparent', animation: 'community-spin 0.6s linear infinite' }} />
                  : Icons.send
                }
              </button>
            </div>
          )}
          <div style={{ fontFamily: B.fontMono, fontSize: 9, color: B.textDim, marginTop: 5, textAlign: 'right', letterSpacing: '0.04em' }}>
            Enter to send · Shift+Enter for new line · Esc to cancel reply
          </div>
        </div>
      </div>
    </div>
  );
}
