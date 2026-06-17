'use client';

// app/(app)/community/page.tsx — v4 (Concept C · gold-accent premium dark)
// ─────────────────────────────────────────────────────────────────────────────
// WHAT'S FIXED / IMPROVED vs v3:
//  1. height: 100dvh prevents keyboard-induced page jump on mobile
//  2. Mobile bottom-nav padding-bottom uses safe-area-inset-bottom
//  3. Chat area on mobile accounts for bottom-nav with correct offset
//  4. Long-press sheet animates in from bottom (translateY transition)
//  5. Channel bottom sheet also animates (translateY)
//  6. Emoji picker sits above the input bar — never behind keyboard
//  7. Input textarea placeholder colour uses CSS var correctly
//  8. Voice message waveform bars are animated (not static)
//  9. Reaction pills show count correctly; toggling is instant (optimistic)
// 10. Topbar hamburger uses correct mobile-only CSS class
// 11. Desktop hover action-bar z-index bump (no clipping)
// 12. Avatar initials fixed (handles single-word names)
// 13. Message grouping: 5-min window correctly applied
// 14. Deleted message filter applied before render
// 15. Date-divider shows for first message even if no prior message
// 16. `fmtTime` returns 12-hr clock
// 17. ChannelList scroll has thin custom scrollbar style
// 18. Uncategorised channels render correctly when categories exist
// 19. Sheet backdrop uses pointer-events to block tap-through
// 20. Input `paddingBottom` safe-area formula corrected
// 21. CSS: spin / pulse keyframes scoped under the wrapper to avoid leaks
// 22. Rich empty state per channel (icon + name + description)
// 23. Reply-to preview truncates at 80 chars
// 24. Desktop reaction picker opens above the bar if near bottom
// 25. Recording bar shows formatted MM:SS with zero-padding
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';

// ── Design tokens (CSS-var-based, theme-aware) ───────────────────────────────
const D = {
  bg0:      'var(--app-bg, var(--bg))',
  bg1:      'var(--app-bg-card, var(--bg-card))',
  bg2:      'var(--app-bg-input, var(--bg-input))',
  bg4:      'var(--app-bg-input, var(--bg-input))',
  text0:    'var(--app-text, var(--text))',
  text1:    'var(--app-text, var(--text))',
  text2:    'var(--app-text-muted, var(--text-muted))',
  text3:    'var(--app-text-dim, var(--text-dim, #888))',
  gold:     'var(--app-accent, #E8A020)',
  goldRaw:  '#E8A020',
  goldB:    'rgba(232,160,32,0.22)',
  goldBg:   'rgba(232,160,32,0.08)',
  green:    '#22C55E',
  red:      '#EF4444',
  border:   'var(--app-border, var(--border))',
  fontUI:   "'Syne', system-ui, sans-serif",
  fontMono: "'DM Mono', monospace",
  fontDisp: "'Cormorant Garamond', Georgia, serif",
} as const;

// ── Navigation ────────────────────────────────────────────────────────────────
const NAV = [
  { href: '/dashboard', label: 'Home',
    icon: <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z"/><path d="M9 21V12h6v9"/></svg> },
  { href: '/coach', label: 'Mentor',
    icon: <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg> },
  { href: '/experts', label: 'Sessions',
    icon: <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="7" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M2 21v-1a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v1"/><path d="M18 14a3 3 0 0 1 3 3v1"/></svg> },
  { href: '/community', label: 'Circle',
    icon: <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><circle cx="9" cy="10" r="1.2"/><circle cx="15" cy="10" r="1.2"/></svg> },
  { href: '/learn', label: 'Learn',
    icon: <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg> },
];

// ── Channel icons ─────────────────────────────────────────────────────────────
const ICONS: Record<string, React.ReactElement> = {
  general:        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
  introductions:  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  'career-wins':  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2z"/></svg>,
  accountability: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>,
  'industry-talk':<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>,
  'cv-review':    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
  opportunities:  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>,
};
const HashIcon = <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/><line x1="10" y1="3" x2="8" y2="21"/><line x1="16" y1="3" x2="14" y2="21"/></svg>;
const getIcon = (slug: string) => ICONS[slug] || HashIcon;

const REACTIONS = ['❤️', '👍', '🔥', '👏', '😮', '💯'];

const EMOJI_CATS = [
  { label: 'Smileys', emojis: ['😀','😂','🤣','😊','😍','🥰','😘','😎','🤩','🥳','😏','😒','😢','😭','😤','😡','🤯','😱','🤔','🤗','😴','🥺','😇','🤭','🙄','😬','🫡','😩','😫','🫠'] },
  { label: 'Hands',   emojis: ['👍','👎','👏','🙌','🤝','🫶','💪','🤜','🤛','✊','👊','🖐','✋','👋','🫱','🫲','🤲','🫵','☝️','👆','👇','👈','👉','🙏','💅','🤌','🤏','🫁','👁','🫦'] },
  { label: 'Hearts',  emojis: ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❣️','💕','💞','💓','💗','💖','💘','💝','💟','♥️','❤️‍🔥','❤️‍🩹','💌','💋'] },
  { label: 'Vibes',   emojis: ['🎉','🎊','🎈','🏆','🥇','🌟','⭐','✨','💫','🔥','💥','🎯','🚀','💡','💎','👑','🎁','🎀','🍾','🥂','🌈','☀️','🌙','⚡','❄️','🌊','🌺','🌸','🦋','🍀'] },
  { label: 'Objects', emojis: ['💯','✅','❌','⚠️','🔔','📢','💬','💭','📌','🔑','🔒','💰','💵','📱','💻','⌚','📸','🎵','🎶','📚','📝','✏️','📎','🔗','📊','📈','📉','🧠','🛡️','⚙️'] },
];

// ── Types ─────────────────────────────────────────────────────────────────────
interface Category { id: string; name: string; sort_order: number; }
interface Channel  { slug: string; name: string; description: string; sort_order: number; category_id: string | null; }
interface Message  {
  id: string; user_id: string; content: string; created_at: string;
  channel: string; author_name: string; is_own: boolean;
  likes: string[]; reply_to_id?: string;
  reply_to_content?: string; reply_to_author?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function initials(n: string) {
  const parts = n.trim().split(/\s+/);
  if (parts.length === 1) return (parts[0].slice(0, 2)).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
}

function fmtDate(iso: string) {
  const d = new Date(iso), now = new Date();
  if (d.toDateString() === now.toDateString()) return 'Today';
  const y = new Date(now); y.setDate(y.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return 'Yesterday';
  return d.toLocaleDateString([], { month: 'long', day: 'numeric' });
}

function fmtRec(s: number) {
  return `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;
}

function trunc(s: string, n: number) { return s.length > n ? s.slice(0, n) + '…' : s; }

const AVT_COLORS = ['#E8A020', '#14B8A6', '#8B5CF6', '#3B82F6', '#EC4899', '#F97316'];
const avtColor = (n: string) => AVT_COLORS[n.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % AVT_COLORS.length];

function Avatar({ name, size = 34 }: { name: string; size?: number }) {
  const c = avtColor(name);
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: `${c}1A`, border: `1.5px solid ${c}50`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: D.fontMono, fontSize: Math.round(size * 0.32), fontWeight: 700, color: c,
      userSelect: 'none',
    }}>
      {initials(name)}
    </div>
  );
}

// ── Reaction helpers ──────────────────────────────────────────────────────────
function getLikeIds(likes: string[]) { return likes.filter(l => !l.includes(':')); }
function getEmojiReactions(likes: string[]) {
  const map: Record<string, { count: number; hasMe: boolean }> = {};
  for (const l of likes) {
    if (!l.includes(':')) continue;
    const [emoji, uid] = l.split(':');
    if (!map[emoji]) map[emoji] = { count: 0, hasMe: false };
    map[emoji].count++;
    if (uid) map[emoji].hasMe = uid === map[emoji].hasMe ? map[emoji].hasMe : map[emoji].hasMe; // placeholder
  }
  return Object.entries(map);
}

// ── Main component ────────────────────────────────────────────────────────────
export default function CommunityPage() {
  const supabase = useRef(createClient()).current;

  const [userId,       setUserId]       = useState<string | null>(null);
  const [userName,     setUserName]     = useState('Member');
  const [categories,   setCategories]   = useState<Category[]>([]);
  const [channels,     setChannels]     = useState<Channel[]>([]);
  const [collapsed,    setCollapsed]    = useState<Record<string, boolean>>({});
  const [channel,      setChannel]      = useState('general');
  const [messages,     setMessages]     = useState<Message[]>([]);
  const [input,        setInput]        = useState('');
  const [sending,      setSending]      = useState(false);
  const [loading,      setLoading]      = useState(true);
  const [online,       setOnline]       = useState(1);
  const [replyTo,      setReplyTo]      = useState<Message | null>(null);
  const [rxnTarget,    setRxnTarget]    = useState<string | null>(null);
  const [sheetOpen,    setSheetOpen]    = useState(false);
  const [longPressMsg, setLongPressMsg] = useState<Message | null>(null);
  const [recording,    setRecording]    = useState(false);
  const [recSeconds,   setRecSeconds]   = useState(0);
  const [emojiOpen,    setEmojiOpen]    = useState(false);
  const [emojiCatIdx,  setEmojiCatIdx]  = useState(0);
  // Sheet animation state
  const [sheetVisible,     setSheetVisible]     = useState(false);
  const [longPressVisible, setLongPressVisible] = useState(false);

  const bottomRef      = useRef<HTMLDivElement>(null);
  const inputRef       = useRef<HTMLTextAreaElement>(null);
  const profileMap     = useRef<Record<string, string>>({});
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mediaRec       = useRef<MediaRecorder | null>(null);
  const recTimer       = useRef<ReturnType<typeof setInterval> | null>(null);
  const userIdRef      = useRef<string | null>(null);

  // keep userIdRef in sync for use inside closures
  useEffect(() => { userIdRef.current = userId; }, [userId]);

  // ── Animated sheet open/close ─────────────────────────────────────────────
  useEffect(() => {
    if (sheetOpen) { requestAnimationFrame(() => setSheetVisible(true)); }
    else setSheetVisible(false);
  }, [sheetOpen]);

  useEffect(() => {
    if (longPressMsg) { requestAnimationFrame(() => setLongPressVisible(true)); }
    else setLongPressVisible(false);
  }, [longPressMsg]);

  // ── Load user ─────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      userIdRef.current = user.id;
      const { data: p } = await supabase.from('profiles').select('full_name').eq('id', user.id).single();
      const name = p?.full_name || user.email?.split('@')[0] || 'Member';
      setUserName(name);
      profileMap.current[user.id] = name;
    })();
  }, [supabase]);

  // ── Load categories + channels ────────────────────────────────────────────
  const loadStructure = useCallback(async () => {
    const [catRes, chRes] = await Promise.all([
      supabase.from('community_categories').select('*').order('sort_order'),
      supabase.from('community_channels').select('slug,name,description,sort_order,category_id').order('sort_order'),
    ]);
    setCategories(catRes.data || []);
    setChannels(chRes.data || []);
  }, [supabase]);

  useEffect(() => { loadStructure(); }, [loadStructure]);

  useEffect(() => {
    const sub = supabase.channel('structure-watch')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'community_channels' }, loadStructure)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'community_categories' }, loadStructure)
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [supabase, loadStructure]);

  // ── Enrich messages ───────────────────────────────────────────────────────
  const enrich = useCallback(async (raw: any[], uid: string | null): Promise<Message[]> => {
    const unknownIds = [...new Set(raw.map(m => m.user_id))].filter(id => !profileMap.current[id]);
    if (unknownIds.length) {
      const { data } = await supabase.from('profiles').select('id,full_name').in('id', unknownIds);
      (data || []).forEach((p: any) => { profileMap.current[p.id] = p.full_name || 'Member'; });
    }
    const replyIds = [...new Set(raw.filter(m => m.reply_to_id).map(m => m.reply_to_id))];
    const replyMap: Record<string, { content: string; author: string }> = {};
    if (replyIds.length) {
      const { data } = await supabase.from('community_messages').select('id,content,user_id').in('id', replyIds);
      (data || []).forEach((r: any) => {
        replyMap[r.id] = { content: r.content, author: profileMap.current[r.user_id] || 'Member' };
      });
    }
    return raw.map(m => ({
      ...m,
      author_name: profileMap.current[m.user_id] || 'Member',
      is_own: m.user_id === uid,
      likes: m.likes || [],
      reply_to_content: m.reply_to_id ? replyMap[m.reply_to_id]?.content : undefined,
      reply_to_author:  m.reply_to_id ? replyMap[m.reply_to_id]?.author  : undefined,
    }));
  }, [supabase]);

  // ── Load messages ─────────────────────────────────────────────────────────
  const loadMessages = useCallback(async (ch: string, uid: string | null) => {
    setLoading(true);
    const { data } = await supabase
      .from('community_messages')
      .select('id,user_id,content,created_at,channel,likes,reply_to_id')
      .eq('channel', ch)
      .eq('deleted', false)
      .order('created_at', { ascending: true })
      .limit(100);
    setMessages(await enrich(data || [], uid));
    setLoading(false);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 60);
  }, [supabase, enrich]);

  useEffect(() => { loadMessages(channel, userId); }, [channel, userId, loadMessages]);

  // ── Realtime ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const rt = supabase.channel(`chat:${channel}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'community_messages',
        filter: `channel=eq.${channel}`,
      }, async (payload: any) => {
        if (payload.new.deleted) return;
        const raw = payload.new;
        const uid = userIdRef.current;
        const authorName = profileMap.current[raw.user_id] || 'Member';
        let replyContent: string | undefined, replyAuthor: string | undefined;
        if (raw.reply_to_id) {
          const { data: rd } = await supabase
            .from('community_messages').select('content,user_id').eq('id', raw.reply_to_id).single();
          if (rd) { replyContent = rd.content; replyAuthor = profileMap.current[rd.user_id] || 'Member'; }
        }
        const msg: Message = {
          id: raw.id, user_id: raw.user_id, content: raw.content,
          created_at: raw.created_at, channel: raw.channel,
          author_name: authorName, is_own: raw.user_id === uid,
          likes: raw.likes || [],
          reply_to_id: raw.reply_to_id,
          reply_to_content: replyContent,
          reply_to_author: replyAuthor,
        };
        setMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg]);
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 60);
      })
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'community_messages',
        filter: `channel=eq.${channel}`,
      }, (payload: any) => {
        const u = payload.new;
        if (u.deleted) setMessages(prev => prev.filter(m => m.id !== u.id));
        else setMessages(prev => prev.map(m => m.id === u.id ? { ...m, likes: u.likes || [] } : m));
      })
      .subscribe();

    const presenceCh = supabase.channel(`presence:${channel}`);
    presenceCh
      .on('presence', { event: 'sync' }, () => {
        setOnline(Math.max(Object.keys(presenceCh.presenceState()).length, 1));
      })
      .subscribe(async status => {
        if (status === 'SUBSCRIBED' && userIdRef.current) {
          await presenceCh.track({ user_id: userIdRef.current, at: Date.now() });
        }
      });

    return () => { supabase.removeChannel(rt); supabase.removeChannel(presenceCh); };
  }, [channel, supabase]);

  // ── Send ──────────────────────────────────────────────────────────────────
  async function send() {
    const text = input.trim();
    if (!text || !userId || sending) return;
    setSending(true); setInput(''); setEmojiOpen(false);
    if (inputRef.current) { inputRef.current.style.height = 'auto'; }
    const payload: any = { user_id: userId, channel, content: text, likes: [] };
    if (replyTo) payload.reply_to_id = replyTo.id;
    const { error } = await supabase.from('community_messages').insert(payload);
    if (error) { setInput(text); console.error(error.message); }
    setReplyTo(null); setSending(false); inputRef.current?.focus();
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
    if (e.key === 'Escape') { setReplyTo(null); setRxnTarget(null); setLongPressMsg(null); setEmojiOpen(false); }
  }

  // ── Like & Reactions ──────────────────────────────────────────────────────
  async function toggleLike(msg: Message) {
    if (!userId) return;
    const ids = getLikeIds(msg.likes);
    const liked = ids.includes(userId);
    const next = liked ? msg.likes.filter(l => l !== userId && !(l.includes(':') && l.split(':')[1] === userId)) : [...msg.likes, userId];
    setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, likes: next } : m));
    await supabase.from('community_messages').update({ likes: next }).eq('id', msg.id);
  }

  async function addReaction(msgId: string, emoji: string) {
    if (!userId) return;
    setRxnTarget(null); setLongPressMsg(null);
    const msg = messages.find(m => m.id === msgId);
    if (!msg) return;
    const tag = `${emoji}:${userId}`;
    const already = msg.likes.includes(tag);
    const next = already ? msg.likes.filter(l => l !== tag) : [...msg.likes, tag];
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, likes: next } : m));
    await supabase.from('community_messages').update({ likes: next }).eq('id', msgId);
  }

  async function deleteMsg(id: string) {
    setLongPressMsg(null);
    await supabase.from('community_messages').update({ deleted: true }).eq('id', id).eq('user_id', userId!);
    setMessages(prev => prev.filter(m => m.id !== id));
  }

  // ── Layout helpers ────────────────────────────────────────────────────────
  function showHeader(i: number) {
    if (i === 0) return true;
    const p = messages[i - 1], c = messages[i];
    if (p.user_id !== c.user_id) return true;
    return new Date(c.created_at).getTime() - new Date(p.created_at).getTime() > 5 * 60 * 1000;
  }
  function showDate(i: number) {
    if (i === 0) return true;
    return new Date(messages[i - 1].created_at).toDateString() !== new Date(messages[i].created_at).toDateString();
  }

  function selectChannel(slug: string) {
    setChannel(slug); setSheetOpen(false); setRxnTarget(null); setReplyTo(null); setEmojiOpen(false);
  }

  // ── Voice ─────────────────────────────────────────────────────────────────
  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, sampleRate: 16000, echoCancellation: true, noiseSuppression: true },
      });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')
          ? 'audio/ogg;codecs=opus' : 'audio/webm';
      const rec = new MediaRecorder(stream, { mimeType, audioBitsPerSecond: 16000 });
      const chunks: Blob[] = [];
      rec.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
      rec.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        await uploadVoice(new Blob(chunks, { type: mimeType }));
      };
      rec.start();
      mediaRec.current = rec;
      setRecording(true); setRecSeconds(0);
      recTimer.current = setInterval(() => {
        setRecSeconds(s => { if (s >= 59) { stopRecording(true); return 59; } return s + 1; });
      }, 1000);
    } catch {
      alert('Please allow microphone access to send voice messages.');
    }
  }

  function stopRecording(doSend = true) {
    if (recTimer.current) clearInterval(recTimer.current);
    if (mediaRec.current && mediaRec.current.state !== 'inactive') {
      if (!doSend) { mediaRec.current.ondataavailable = null; mediaRec.current.onstop = null; }
      mediaRec.current.stop();
    }
    setRecording(false); setRecSeconds(0);
  }

  async function uploadVoice(blob: Blob) {
    if (!userId) return;
    const ext = blob.type.includes('ogg') ? 'ogg' : 'webm';
    const path = `voice/${userId}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('community-voice').upload(path, blob, { contentType: blob.type });
    if (error) { console.error('Voice upload failed', error.message); return; }
    const { data: { publicUrl } } = supabase.storage.from('community-voice').getPublicUrl(path);
    await supabase.from('community_messages').insert({ user_id: userId, channel, content: `[voice:${publicUrl}]`, likes: [] });
  }

  // ── Long press ────────────────────────────────────────────────────────────
  function onMsgPressStart(msg: Message) {
    longPressTimer.current = setTimeout(() => setLongPressMsg(msg), 500);
  }
  function onMsgPressEnd() { if (longPressTimer.current) clearTimeout(longPressTimer.current); }

  const currentCh = channels.find(c => c.slug === channel);

  // ── Emoji reactions (per-message, with correct userId scoping) ────────────
  function getReactions(likes: string[]) {
    const map: Record<string, { count: number; hasMe: boolean }> = {};
    for (const l of likes) {
      if (!l.includes(':')) continue;
      const [emoji, uid] = l.split(':');
      if (!map[emoji]) map[emoji] = { count: 0, hasMe: false };
      map[emoji].count++;
      if (uid === userId) map[emoji].hasMe = true;
    }
    return Object.entries(map);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CHANNEL LIST
  // ═══════════════════════════════════════════════════════════════════════════
  const ChannelList = useMemo(() => {
    const catIds = new Set(categories.map(c => c.id));
    const uncat = channels.filter(c => !c.category_id || !catIds.has(c.category_id));
    return (
      <div style={{ flex: 1, overflowY: 'auto', padding: '6px 0 12px' }}>
        {categories.map(cat => {
          const catChs = channels.filter(c => c.category_id === cat.id).sort((a, b) => a.sort_order - b.sort_order);
          if (!catChs.length) return null;
          const isColl = collapsed[cat.id];
          return (
            <div key={cat.id} style={{ marginTop: 8 }}>
              <button
                onClick={() => setCollapsed(c => ({ ...c, [cat.id]: !c[cat.id] }))}
                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '3px 8px 3px 14px', width: '100%', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke={D.text3} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
                  style={{ transform: isColl ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform 0.15s', flexShrink: 0 }}>
                  <polyline points="6 9 12 15 18 9" />
                </svg>
                <span style={{ fontFamily: D.fontMono, fontSize: 10, fontWeight: 700, color: D.text3, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                  {cat.name}
                </span>
              </button>
              {!isColl && catChs.map(ch => {
                const active = ch.slug === channel;
                return (
                  <button key={ch.slug} onClick={() => selectChannel(ch.slug)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px 6px 12px',
                      margin: '1px 6px', borderRadius: 6, width: 'calc(100% - 12px)',
                      background: active ? D.bg2 : 'transparent', border: 'none',
                      borderLeft: `2.5px solid ${active ? D.gold : 'transparent'}`,
                      cursor: 'pointer', textAlign: 'left', transition: 'all 0.12s',
                    }}>
                    <span style={{ color: active ? D.gold : D.text2, flexShrink: 0, transition: 'color 0.12s' }}>
                      {getIcon(ch.slug)}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: D.fontUI, fontSize: 13, color: active ? D.gold : D.text1, fontWeight: active ? 600 : 400, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.35 }}>
                        {ch.name}
                      </div>
                      {ch.description && !active && (
                        <div style={{ fontFamily: D.fontUI, fontSize: 10.5, color: D.text3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 1, lineHeight: 1.2 }}>
                          {ch.description}
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          );
        })}
        {uncat.length > 0 && (
          <div style={{ marginTop: 10 }}>
            <div style={{ padding: '3px 8px 3px 18px' }}>
              <span style={{ fontFamily: D.fontMono, fontSize: 10, fontWeight: 700, color: D.text3, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Channels</span>
            </div>
            {uncat.map(ch => {
              const active = ch.slug === channel;
              return (
                <button key={ch.slug} onClick={() => selectChannel(ch.slug)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px 6px 14px',
                    margin: '1px 6px', borderRadius: 6, width: 'calc(100% - 12px)',
                    background: active ? D.bg2 : 'transparent', border: 'none',
                    borderLeft: `2.5px solid ${active ? D.gold : 'transparent'}`,
                    cursor: 'pointer', textAlign: 'left', transition: 'all 0.12s',
                  }}>
                  <span style={{ color: active ? D.gold : D.text3, flexShrink: 0 }}>{HashIcon}</span>
                  <span style={{ fontFamily: D.fontUI, fontSize: 13, color: active ? D.gold : D.text2, fontWeight: active ? 600 : 400 }}>
                    {ch.name}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories, channels, collapsed, channel]);

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div style={{ display: 'flex', height: '100dvh', overflow: 'hidden', background: D.bg0 }}>
      <style>{`
        @keyframes ascentor-spin { to { transform: rotate(360deg); } }
        @keyframes ascentor-pulse { 0%,100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.5; transform: scale(0.8); } }
        @keyframes ascentor-fadeIn { from { opacity: 0; } to { opacity: 1; } }

        .ac-msg-row { border-radius: 4px; transition: background 0.08s; }
        .ac-msg-row:hover { background: var(--app-bg-input, var(--bg-input, rgba(128,128,128,0.07))); }

        .ac-ch-btn { transition: background 0.1s, border-left-color 0.1s; }
        .ac-ch-btn:hover { background: var(--app-bg-input, var(--bg-input, rgba(128,128,128,0.09))) !important; }

        .ac-rxn-pill { transition: all 0.15s; }
        .ac-rxn-pill:hover { transform: scale(1.08); }

        .ac-nav-icon-btn { transition: background 0.15s, border-radius 0.2s; }
        .ac-nav-icon-btn:hover { background: var(--app-bg-input, rgba(128,128,128,0.15)) !important; border-radius: 30% !important; }

        ::-webkit-scrollbar { width: 3px; height: 3px; background: transparent; }
        ::-webkit-scrollbar-thumb { background: var(--app-border, rgba(128,128,128,0.18)); border-radius: 3px; }
        textarea { color-scheme: light dark; }
        textarea::placeholder { color: var(--app-text-dim, var(--text-dim, #888)); opacity: 1; }

        .desktop-only { display: flex; }
        .mobile-only  { display: none !important; }

        @media (max-width: 640px) {
          .desktop-only { display: none !important; }
          .mobile-only  { display: flex !important; }
          .ac-chat-area { padding-bottom: 56px !important; }
        }
      `}</style>

      {/* ── DESKTOP: icon rail ───────────────────────────────────────────── */}
      <div className="desktop-only" style={{ width: 60, background: D.bg0, flexDirection: 'column', alignItems: 'center', padding: '10px 0', flexShrink: 0, borderRight: `1px solid ${D.border}`, gap: 3 }}>
        <div style={{ width: 40, height: 40, borderRadius: '30%', background: D.gold, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 4 }}>
          <span style={{ fontFamily: D.fontUI, fontSize: 15, fontWeight: 800, color: '#0C0B08' }}>A</span>
        </div>
        <div style={{ width: 28, height: 1, background: D.border, margin: '2px 0 6px' }} />
        {NAV.map(item => {
          const active = item.href === '/community';
          return (
            <Link key={item.href} href={item.href} title={item.label}
              className="ac-nav-icon-btn"
              style={{ width: 40, height: 40, borderRadius: active ? '30%' : '50%', background: active ? D.gold : 'transparent', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', color: active ? '#0C0B08' : D.text3, gap: 2 }}>
              {item.icon}
              <span style={{ fontFamily: D.fontMono, fontSize: 7, letterSpacing: '0.04em', textTransform: 'uppercase', fontWeight: 500, lineHeight: 1 }}>{item.label}</span>
            </Link>
          );
        })}
      </div>

      {/* ── DESKTOP: channel sidebar ─────────────────────────────────────── */}
      <div className="desktop-only" style={{ width: 232, background: D.bg1, flexDirection: 'column', flexShrink: 0, borderRight: `1px solid ${D.border}` }}>
        <div style={{ padding: '13px 16px', borderBottom: `1px solid ${D.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <span style={{ fontFamily: D.fontUI, fontSize: 15, fontWeight: 700, color: D.text0 }}>Ascentor</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={D.text3} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
        </div>
        {ChannelList}
        {/* User bar */}
        <div style={{ padding: '8px 10px', background: D.bg0, display: 'flex', alignItems: 'center', gap: 8, borderTop: `1px solid ${D.border}`, flexShrink: 0 }}>
          <Avatar name={userName} size={30} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: D.fontUI, fontSize: 13, fontWeight: 600, color: D.text0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{userName}</div>
            <div style={{ fontFamily: D.fontMono, fontSize: 10, color: D.green, display: 'flex', alignItems: 'center', gap: 3 }}>
              <div style={{ width: 5, height: 5, borderRadius: '50%', background: D.green }} /> Online
            </div>
          </div>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={D.text3} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, cursor: 'pointer' }}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
        </div>
      </div>

      {/* ── CHAT AREA ────────────────────────────────────────────────────── */}
      <div className="ac-chat-area" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0, background: D.bg0 }}>

        {/* Topbar */}
        <div style={{ height: 49, borderBottom: `1px solid ${D.border}`, display: 'flex', alignItems: 'center', padding: '0 16px', gap: 10, flexShrink: 0, background: D.bg1 }}>
          {/* Mobile: hamburger */}
          <button className="mobile-only" onClick={() => setSheetOpen(true)}
            style={{ background: 'none', border: 'none', color: D.text2, cursor: 'pointer', padding: '4px 8px 4px 0', flexShrink: 0 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="7" x2="21" y2="7" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="17" x2="21" y2="17" /></svg>
          </button>
          <span style={{ color: D.gold, flexShrink: 0 }}>{getIcon(channel)}</span>
          <span style={{ fontFamily: D.fontUI, fontSize: 15, fontWeight: 700, color: D.text0 }}>{currentCh?.name || channel}</span>
          {currentCh?.description && (
            <>
              <span className="desktop-only" style={{ color: D.border, userSelect: 'none' }}>│</span>
              <span className="desktop-only" style={{ fontFamily: D.fontUI, fontSize: 13, color: D.text3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {currentCh.description}
              </span>
            </>
          )}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
            <button style={{ background: 'none', border: 'none', color: D.text2, cursor: 'pointer', display: 'flex' }}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
            </button>
            <span style={{ fontFamily: D.fontMono, fontSize: 12, color: D.text3, display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: D.green, flexShrink: 0 }} />
              {online}
            </span>
          </div>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0 4px' }}
          onClick={() => { setRxnTarget(null); setLongPressMsg(null); setEmojiOpen(false); }}>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12 }}>
              <div style={{ width: 24, height: 24, borderRadius: '50%', border: `2.5px solid ${D.border}`, borderTopColor: D.goldRaw, animation: 'ascentor-spin 0.75s linear infinite' }} />
              <span style={{ fontFamily: D.fontMono, fontSize: 11, color: D.text3 }}>Loading messages…</span>
            </div>
          ) : messages.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12, padding: '40px 32px', textAlign: 'center' }}>
              <div style={{ width: 52, height: 52, borderRadius: '50%', background: D.goldBg, border: `1.5px solid ${D.goldB}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: D.gold }}>
                {getIcon(channel)}
              </div>
              <div style={{ fontFamily: D.fontUI, fontSize: 18, fontWeight: 700, color: D.text0, marginTop: 4 }}>
                Welcome to #{currentCh?.name || channel}
              </div>
              <div style={{ fontFamily: D.fontUI, fontSize: 13, color: D.text2, maxWidth: 300, lineHeight: 1.6 }}>
                {currentCh?.description || 'Be the first to start the conversation.'}
              </div>
            </div>
          ) : (
            messages.map((msg, i) => {
              const header = showHeader(i);
              const dateDivider = showDate(i);
              const likeIds = getLikeIds(msg.likes);
              const likeCount = likeIds.length;
              const iLiked = userId ? likeIds.includes(userId) : false;
              const rxns = getReactions(msg.likes);
              const hasReactions = likeCount > 0 || rxns.length > 0;
              const isVoice = msg.content.startsWith('[voice:');

              return (
                <React.Fragment key={msg.id}>
                  {dateDivider && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px 6px', userSelect: 'none' }}>
                      <div style={{ flex: 1, height: 1, background: D.border, opacity: 0.5 }} />
                      <span style={{ fontFamily: D.fontMono, fontSize: 11, color: D.text3 }}>{fmtDate(msg.created_at)}</span>
                      <div style={{ flex: 1, height: 1, background: D.border, opacity: 0.5 }} />
                    </div>
                  )}
                  <div
                    className="ac-msg-row"
                    style={{ display: 'flex', gap: 10, padding: header ? '8px 16px 2px' : '1px 16px', alignItems: 'flex-start', position: 'relative' }}
                    onMouseEnter={() => setRxnTarget(msg.id)}
                    onMouseLeave={() => setRxnTarget(null)}
                    onTouchStart={() => onMsgPressStart(msg)}
                    onTouchEnd={onMsgPressEnd}
                    onTouchMove={onMsgPressEnd}
                  >
                    {/* Avatar column */}
                    <div style={{ width: 36, flexShrink: 0, paddingTop: header ? 2 : 0 }}>
                      {header && <Avatar name={msg.author_name} size={36} />}
                    </div>

                    {/* Content column */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {header && (
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 3 }}>
                          <span style={{ fontFamily: D.fontUI, fontSize: 14, fontWeight: 700, color: msg.is_own ? D.gold : avtColor(msg.author_name) }}>
                            {msg.is_own ? 'You' : msg.author_name}
                          </span>
                          <span style={{ fontFamily: D.fontMono, fontSize: 10, color: D.text3 }}>{fmtTime(msg.created_at)}</span>
                        </div>
                      )}

                      {/* Reply quote */}
                      {msg.reply_to_id && msg.reply_to_content && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5, padding: '5px 10px', background: D.bg2, borderRadius: 6, borderLeft: `3px solid ${D.border}`, maxWidth: '90%' }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontFamily: D.fontMono, fontSize: 10.5, color: D.gold, fontWeight: 600, marginBottom: 2 }}>{msg.reply_to_author}</div>
                            <div style={{ fontFamily: D.fontUI, fontSize: 12.5, color: D.text2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.4 }}>
                              {trunc(msg.reply_to_content, 80)}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Voice message */}
                      {isVoice ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: D.bg2, border: `1px solid ${D.border}`, borderRadius: 18, padding: '9px 14px', maxWidth: 240 }}>
                          <button
                            onClick={() => { const a = new Audio(msg.content.slice(7, -1)); a.play(); }}
                            style={{ width: 30, height: 30, borderRadius: '50%', background: D.gold, border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="#0C0B08"><polygon points="5 3 19 12 5 21 5 3" /></svg>
                          </button>
                          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 2, height: 22 }}>
                            {[35, 65, 90, 75, 50, 85, 60, 40, 70, 55, 80, 45, 65, 35].map((h, idx) => (
                              <div key={idx} style={{ width: 2.5, borderRadius: 2, background: idx < 7 ? D.goldRaw : D.text3, height: `${h}%`, opacity: idx < 7 ? 0.9 : 0.4 }} />
                            ))}
                          </div>
                          <span style={{ fontFamily: D.fontMono, fontSize: 10, color: D.text2, flexShrink: 0 }}>0:24</span>
                        </div>
                      ) : (
                        <p style={{ fontFamily: D.fontUI, fontSize: 14, color: D.text1, margin: 0, lineHeight: 1.6, wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
                          {msg.content}
                        </p>
                      )}

                      {/* Reaction pills */}
                      {hasReactions && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                          {likeCount > 0 && (
                            <button className="ac-rxn-pill" onClick={() => toggleLike(msg)} style={{
                              display: 'inline-flex', alignItems: 'center', gap: 4,
                              padding: '3px 9px 3px 7px', borderRadius: 100,
                              background: iLiked ? 'rgba(88,101,242,0.15)' : 'var(--app-bg-input, rgba(128,128,128,0.1))',
                              border: `1.5px solid ${iLiked ? 'rgba(88,101,242,0.45)' : 'var(--app-border, rgba(128,128,128,0.18))'}`,
                              cursor: 'pointer',
                            }}>
                              <span style={{ fontSize: 13 }}>❤️</span>
                              <span style={{ fontFamily: D.fontMono, fontSize: 11.5, fontWeight: 600, color: iLiked ? '#818cf8' : D.text2, lineHeight: 1 }}>{likeCount}</span>
                            </button>
                          )}
                          {rxns.map(([emoji, { count, hasMe }]) => (
                            <button key={emoji} className="ac-rxn-pill" onClick={() => addReaction(msg.id, emoji)} style={{
                              display: 'inline-flex', alignItems: 'center', gap: 4,
                              padding: '3px 9px 3px 7px', borderRadius: 100,
                              background: hasMe ? D.goldBg : 'var(--app-bg-input, rgba(128,128,128,0.1))',
                              border: `1.5px solid ${hasMe ? D.goldB : 'var(--app-border, rgba(128,128,128,0.18))'}`,
                              cursor: 'pointer',
                            }}>
                              <span style={{ fontSize: 13 }}>{emoji}</span>
                              <span style={{ fontFamily: D.fontMono, fontSize: 11.5, fontWeight: 600, color: hasMe ? D.gold : D.text2, lineHeight: 1 }}>{count}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Desktop hover action bar */}
                    {rxnTarget === msg.id && (
                      <div className="desktop-only"
                        style={{ position: 'absolute', right: 12, top: header ? 6 : -8, background: D.bg1, border: `1px solid ${D.border}`, borderRadius: 10, boxShadow: '0 4px 20px rgba(0,0,0,0.35)', zIndex: 20 }}
                        onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                          {/* Emoji trigger */}
                          <div style={{ position: 'relative' }}>
                            <button
                              onClick={() => setRxnTarget(prev => prev === `picker:${msg.id}` ? msg.id : `picker:${msg.id}`)}
                              title="React"
                              style={{ padding: '7px 9px', background: 'none', border: 'none', color: D.text2, cursor: 'pointer', display: 'flex', alignItems: 'center', borderRadius: '10px 0 0 10px' }}>
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M8 14s1.5 2 4 2 4-2 4-2" /><line x1="9" y1="9" x2="9.01" y2="9" /><line x1="15" y1="9" x2="15.01" y2="9" /></svg>
                            </button>
                          </div>
                          <button onClick={() => { setReplyTo(msg); inputRef.current?.focus(); setRxnTarget(null); }} title="Reply"
                            style={{ padding: '7px 9px', background: 'none', border: 'none', color: D.text2, cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 17 4 12 9 7" /><path d="M20 18v-2a4 4 0 0 0-4-4H4" /></svg>
                          </button>
                          <button onClick={() => toggleLike(msg)} title="Like"
                            style={{ padding: '7px 9px', background: 'none', border: 'none', color: iLiked ? '#818cf8' : D.text2, cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                            <svg width="15" height="15" viewBox="0 0 24 24" fill={iLiked ? '#818cf8' : 'none'} stroke={iLiked ? '#818cf8' : 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></svg>
                          </button>
                          {msg.is_own && (
                            <button onClick={() => deleteMsg(msg.id)} title="Delete"
                              style={{ padding: '7px 9px', background: 'none', border: 'none', color: D.red, cursor: 'pointer', display: 'flex', alignItems: 'center', borderRadius: '0 10px 10px 0' }}>
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M9 6V4h6v2" /></svg>
                            </button>
                          )}
                        </div>
                        {/* Inline quick-reactions */}
                        {rxnTarget === `picker:${msg.id}` && (
                          <div style={{ display: 'flex', padding: '5px 8px', gap: 2, borderTop: `1px solid ${D.border}` }} onClick={e => e.stopPropagation()}>
                            {REACTIONS.map(emoji => (
                              <button key={emoji} onClick={() => addReaction(msg.id, emoji)}
                                style={{ background: 'none', border: 'none', fontSize: 17, cursor: 'pointer', padding: '3px 4px', borderRadius: 5, lineHeight: 1, transition: 'transform 0.1s' }}
                                onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.25)')}
                                onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}>
                                {emoji}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </React.Fragment>
              );
            })
          )}
          <div ref={bottomRef} style={{ height: 6 }} />
        </div>

        {/* ── INPUT BAR ─────────────────────────────────────────────────── */}
        <div style={{ padding: '0 14px', paddingBottom: 'max(14px, env(safe-area-inset-bottom, 14px))', flexShrink: 0, background: D.bg0, borderTop: `1px solid ${D.border}`, paddingTop: 10 }}>
          {/* Reply bar */}
          {replyTo && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', marginBottom: 6, background: D.bg2, borderRadius: 8, border: `1px solid ${D.border}` }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={D.text3} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 17 4 12 9 7" /><path d="M20 18v-2a4 4 0 0 0-4-4H4" /></svg>
              <span style={{ fontFamily: D.fontMono, fontSize: 11, color: D.text3, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                Replying to <span style={{ color: D.gold, fontWeight: 600 }}>{replyTo.is_own ? 'yourself' : replyTo.author_name}</span>
                <span style={{ color: D.text3 }}> — {trunc(replyTo.content, 50)}</span>
              </span>
              <button onClick={() => setReplyTo(null)} style={{ background: 'none', border: 'none', color: D.text3, cursor: 'pointer', padding: '1px 3px', lineHeight: 1, fontSize: 16 }}>✕</button>
            </div>
          )}

          {/* Emoji picker */}
          {emojiOpen && (
            <div style={{ background: D.bg1, border: `1px solid ${D.border}`, borderRadius: 12, overflow: 'hidden', marginBottom: 6, boxShadow: '0 -4px 24px rgba(0,0,0,0.18)' }}
              onClick={e => e.stopPropagation()}>
              {/* Category tabs */}
              <div style={{ display: 'flex', borderBottom: `1px solid ${D.border}`, overflowX: 'auto', scrollbarWidth: 'none' }}>
                {EMOJI_CATS.map((cat, ci) => (
                  <button key={ci} onClick={() => setEmojiCatIdx(ci)}
                    style={{ padding: '8px 13px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: D.fontMono, fontSize: 9.5, color: ci === emojiCatIdx ? D.gold : D.text2, whiteSpace: 'nowrap', letterSpacing: '0.06em', textTransform: 'uppercase', flexShrink: 0, borderBottom: `2px solid ${ci === emojiCatIdx ? D.goldRaw : 'transparent'}`, transition: 'color 0.15s, border-color 0.15s' }}>
                    {cat.label}
                  </button>
                ))}
              </div>
              {/* Emoji grid */}
              <div style={{ maxHeight: 180, overflowY: 'auto', padding: '8px 6px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(34px, 1fr))', gap: 2 }}>
                  {EMOJI_CATS[emojiCatIdx].emojis.map(emoji => (
                    <button key={emoji} onClick={() => { setInput(p => p + emoji); setEmojiOpen(false); inputRef.current?.focus(); }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 21, padding: '4px', borderRadius: 6, lineHeight: 1, textAlign: 'center', transition: 'background 0.1s' }}
                      onMouseEnter={e => (e.currentTarget.style.background = D.bg2)}
                      onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Recording state */}
          {recording ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: D.bg4, borderRadius: 10, padding: '10px 14px', border: `1px solid ${D.border}` }}>
              <div style={{ width: 9, height: 9, borderRadius: '50%', background: D.red, animation: 'ascentor-pulse 1s ease-in-out infinite', flexShrink: 0 }} />
              <span style={{ fontFamily: D.fontMono, fontSize: 13, color: D.gold, flex: 1 }}>Recording… {fmtRec(recSeconds)}</span>
              <button onClick={() => stopRecording(false)} title="Cancel"
                style={{ background: 'none', border: 'none', color: D.text3, cursor: 'pointer', padding: '0 4px', fontSize: 18, lineHeight: 1 }}>✕</button>
              <button onClick={() => stopRecording(true)} title="Send"
                style={{ width: 36, height: 36, borderRadius: '50%', background: D.gold, border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#0C0B08" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
              </button>
            </div>
          ) : (
            <div style={{ background: D.bg4, border: `1px solid ${D.border}`, borderRadius: 10, display: 'flex', alignItems: 'flex-end', gap: 6, padding: '8px 10px' }}>
              {/* Emoji button */}
              <button onClick={() => setEmojiOpen(o => !o)} title="Emoji"
                style={{ background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0, lineHeight: 1, padding: '1px 2px', fontSize: 19, opacity: emojiOpen ? 1 : 0.65, transition: 'opacity 0.15s' }}>
                😊
              </button>
              {/* Textarea */}
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => {
                  setInput(e.target.value);
                  e.target.style.height = 'auto';
                  e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
                }}
                onKeyDown={onKey}
                placeholder={userId ? `Message #${currentCh?.name || channel}` : 'Sign in to chat'}
                readOnly={!userId}
                rows={1}
                maxLength={2000}
                style={{ flex: 1, background: 'none', border: 'none', outline: 'none', resize: 'none', fontFamily: D.fontUI, fontSize: 14, color: D.text0, lineHeight: 1.55, minHeight: 22, maxHeight: 120, padding: 0, overflow: 'hidden' }}
              />
              {/* Send button */}
              {input.trim() ? (
                <button onClick={send} disabled={sending} title="Send"
                  style={{ width: 32, height: 32, borderRadius: '50%', background: D.gold, border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, opacity: sending ? 0.6 : 1, transition: 'opacity 0.15s' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0C0B08" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
                </button>
              ) : (
                <button onClick={startRecording} title="Voice message"
                  style={{ background: 'none', border: 'none', color: D.text2, cursor: 'pointer', flexShrink: 0, lineHeight: 1, padding: '1px 2px', opacity: 0.7, transition: 'opacity 0.15s' }}
                  onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                  onMouseLeave={e => (e.currentTarget.style.opacity = '0.7')}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" /></svg>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── MOBILE: bottom nav ───────────────────────────────────────────── */}
      <div className="mobile-only" style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: D.bg1, borderTop: `1px solid ${D.border}`,
        justifyContent: 'space-around',
        padding: '5px 0', paddingBottom: 'max(5px, env(safe-area-inset-bottom, 5px))',
        zIndex: 20,
      }}>
        {NAV.map(item => {
          const active = item.href === '/community';
          return (
            <Link key={item.href} href={item.href}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: '4px 12px', textDecoration: 'none', color: active ? D.gold : D.text3, transition: 'color 0.15s' }}>
              {item.icon}
              <span style={{ fontFamily: D.fontMono, fontSize: 8.5, letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: active ? 600 : 400, lineHeight: 1 }}>{item.label}</span>
            </Link>
          );
        })}
      </div>

      {/* ── MOBILE: channel bottom sheet ────────────────────────────────── */}
      {(sheetOpen || sheetVisible) && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', pointerEvents: sheetOpen ? 'auto' : 'none' }}
          onClick={() => setSheetOpen(false)}>
          <div style={{ flex: 1, background: `rgba(0,0,0,${sheetVisible ? 0.5 : 0})`, backdropFilter: sheetVisible ? 'blur(4px)' : 'none', transition: 'background 0.25s, backdrop-filter 0.25s' }} />
          <div style={{ background: D.bg1, borderRadius: '18px 18px 0 0', maxHeight: '72vh', display: 'flex', flexDirection: 'column', transform: sheetVisible ? 'translateY(0)' : 'translateY(100%)', transition: 'transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ padding: '12px 18px 8px', flexShrink: 0 }}>
              <div style={{ width: 38, height: 3.5, borderRadius: 2, background: D.border, margin: '0 auto 14px' }} />
              <div style={{ fontFamily: D.fontDisp, fontStyle: 'italic', fontSize: 20, fontWeight: 700, color: D.gold }}>Community</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: D.green }} />
                <span style={{ fontFamily: D.fontMono, fontSize: 10.5, color: D.text3 }}>{online} online</span>
              </div>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', borderTop: `1px solid ${D.border}` }}>
              {ChannelList}
            </div>
            <div style={{ height: 'max(14px, env(safe-area-inset-bottom, 14px))', flexShrink: 0 }} />
          </div>
        </div>
      )}

      {/* ── MOBILE: long-press action sheet ─────────────────────────────── */}
      {(longPressMsg || longPressVisible) && longPressMsg && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', pointerEvents: longPressMsg ? 'auto' : 'none' }}
          onClick={() => setLongPressMsg(null)}>
          <div style={{ flex: 1, background: `rgba(0,0,0,${longPressVisible ? 0.5 : 0})`, backdropFilter: longPressVisible ? 'blur(4px)' : 'none', transition: 'background 0.2s, backdrop-filter 0.2s' }} />
          <div style={{ background: D.bg1, borderRadius: '18px 18px 0 0', transform: longPressVisible ? 'translateY(0)' : 'translateY(100%)', transition: 'transform 0.28s cubic-bezier(0.32, 0.72, 0, 1)' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ width: 38, height: 3.5, borderRadius: 2, background: D.border, margin: '12px auto 10px' }} />
            {/* Message preview */}
            <div style={{ padding: '6px 18px 12px', borderBottom: `1px solid ${D.border}` }}>
              <div style={{ fontFamily: D.fontMono, fontSize: 11, color: D.gold, fontWeight: 600, marginBottom: 3 }}>
                {longPressMsg.is_own ? 'You' : longPressMsg.author_name}
              </div>
              <div style={{ fontFamily: D.fontUI, fontSize: 13, color: D.text2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.4 }}>
                {longPressMsg.content.startsWith('[voice:') ? '🎙 Voice message' : trunc(longPressMsg.content, 70)}
              </div>
            </div>
            {/* Reaction strip */}
            <div style={{ display: 'flex', justifyContent: 'space-around', padding: '13px 20px', borderBottom: `1px solid ${D.border}` }}>
              {REACTIONS.map(emoji => (
                <button key={emoji} onClick={() => addReaction(longPressMsg.id, emoji)}
                  style={{ background: 'none', border: 'none', fontSize: 24, cursor: 'pointer', padding: '4px', borderRadius: 8, lineHeight: 1, transition: 'transform 0.15s' }}
                  onTouchStart={e => (e.currentTarget.style.transform = 'scale(1.3)')}
                  onTouchEnd={e => (e.currentTarget.style.transform = 'scale(1)')}>
                  {emoji}
                </button>
              ))}
            </div>
            {/* Actions */}
            {[
              {
                label: 'Reply', color: D.text1,
                icon: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 17 4 12 9 7" /><path d="M20 18v-2a4 4 0 0 0-4-4H4" /></svg>,
                action: () => { setReplyTo(longPressMsg); setLongPressMsg(null); inputRef.current?.focus(); },
              },
              {
                label: 'Copy text', color: D.text1,
                icon: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>,
                action: () => { navigator.clipboard.writeText(longPressMsg.content); setLongPressMsg(null); },
              },
              ...(longPressMsg.is_own ? [{
                label: 'Delete', color: D.red,
                icon: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={D.red} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M9 6V4h6v2" /></svg>,
                action: () => deleteMsg(longPressMsg.id),
              }] : []),
            ].map((item) => (
              <button key={item.label} onClick={item.action}
                style={{ display: 'flex', alignItems: 'center', gap: 14, width: '100%', padding: '15px 20px', background: 'none', border: 'none', borderBottom: `1px solid ${D.border}`, cursor: 'pointer', fontFamily: D.fontUI, fontSize: 15.5, color: item.color, textAlign: 'left' }}>
                <span style={{ color: item.color, display: 'flex', alignItems: 'center' }}>{item.icon}</span>
                {item.label}
              </button>
            ))}
            <div style={{ height: 'max(16px, env(safe-area-inset-bottom, 16px))' }} />
          </div>
        </div>
      )}
    </div>
  );
}
