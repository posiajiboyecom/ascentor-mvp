'use client';

// community/page.tsx — v5
// Fixes:
// 1. INSTANT messages — optimistic insert before Supabase round-trip
// 2. Voice messages appear in chat via optimistic insert + real URL swap
// 3. Live recording visualizer — animated waveform bars while recording
// 4. WhatsApp-style reaction sheet — emoji tray floats above the long-pressed message
// 5. Static header — layout uses flex column, messages scroll independently
//    keyboard open/close never moves the header
// 6. Channel drawer — swipe-down-to-close (touch gesture), full redesign:
//    large channel cards with icon + description, no tiny list items

import React, {
  useState, useEffect, useRef, useCallback, useMemo,
} from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';

// ── Design tokens ─────────────────────────────────────────────────────────────
const D = {
  bg0:      'var(--app-bg, var(--bg))',
  bg1:      'var(--app-bg-card, var(--bg-card))',
  bg2:      'var(--app-bg-input, var(--bg-input))',
  text0:    'var(--app-text, var(--text))',
  text1:    'var(--app-text, var(--text))',
  text2:    'var(--app-text-muted, var(--text-muted))',
  text3:    'var(--app-text-dim, var(--text-dim, #888))',
  gold:     'var(--app-accent, #E8A020)',
  G:        '#E8A020',   // raw gold for calculations
  goldB:    'rgba(232,160,32,0.25)',
  goldBg:   'rgba(232,160,32,0.10)',
  green:    '#22C55E',
  red:      '#EF4444',
  border:   'var(--app-border, var(--border))',
  UI:       "'Syne', system-ui, sans-serif",
  MONO:     "'DM Mono', monospace",
  DISP:     "'Cormorant Garamond', Georgia, serif",
} as const;

// ── Nav ───────────────────────────────────────────────────────────────────────
const NAV = [
  { href: '/dashboard', label: 'Home',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z"/><path d="M9 21V12h6v9"/></svg> },
  { href: '/coach', label: 'Mentor',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg> },
  { href: '/experts', label: 'Sessions',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="7" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M2 21v-1a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v1"/><path d="M18 14a3 3 0 0 1 3 3v1"/></svg> },
  { href: '/community', label: 'Circle',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><circle cx="9" cy="10" r="1.2"/><circle cx="15" cy="10" r="1.2"/></svg> },
  { href: '/learn', label: 'Learn',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg> },
];

// ── Channel icons ─────────────────────────────────────────────────────────────
const CH_ICONS: Record<string, React.ReactElement> = {
  general:        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
  introductions:  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  'career-wins':  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2z"/></svg>,
  accountability: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>,
  'industry-talk':<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>,
  'cv-review':    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
  opportunities:  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>,
};
const HashIcon = (sz = 14) => <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/><line x1="10" y1="3" x2="8" y2="21"/><line x1="16" y1="3" x2="14" y2="21"/></svg>;
const getIcon = (slug: string, sz?: number) => CH_ICONS[slug] || HashIcon(sz);

// ── Quick reactions (WhatsApp order) ─────────────────────────────────────────
const QUICK_RXN = ['👍','❤️','😂','😮','😢','🙏','🔥','💯'];

const EMOJI_CATS = [
  { label: 'Smileys', emojis: ['😀','😂','🤣','😊','😍','🥰','😘','😎','🤩','🥳','😏','😒','😢','😭','😤','😡','🤯','😱','🤔','🤗','😴','🥺','😇','🤭','🙄','😬','🫡','😩','😫','🫠'] },
  { label: 'Hands',   emojis: ['👍','👎','👏','🙌','🤝','🫶','💪','🤜','🤛','✊','👊','🖐','✋','👋','🫱','🫲','🤲','🫵','☝️','👆','👇','👈','👉','🙏','💅','🤌','🤏'] },
  { label: 'Hearts',  emojis: ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❣️','💕','💞','💓','💗','💖','💘','💝','💟','♥️','❤️‍🔥','❤️‍🩹','💌','💋'] },
  { label: 'Vibes',   emojis: ['🎉','🎊','🎈','🏆','🥇','🌟','⭐','✨','💫','🔥','💥','🎯','🚀','💡','💎','👑','🎁','🍾','🥂','🌈','☀️','🌙','⚡','❄️','🌊','🌺','🌸','🦋','🍀','🫶'] },
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
  pending?: boolean; // optimistic, not yet confirmed
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function initials(n: string) {
  const p = n.trim().split(/\s+/);
  return p.length === 1 ? p[0].slice(0, 2).toUpperCase() : (p[0][0] + p[p.length - 1][0]).toUpperCase();
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
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}
function trunc(s: string, n: number) { return s.length > n ? s.slice(0, n) + '…' : s; }

const AVT = ['#E8A020','#14B8A6','#8B5CF6','#3B82F6','#EC4899','#F97316'];
const avtColor = (n: string) => AVT[n.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % AVT.length];

function Avatar({ name, size = 34 }: { name: string; size?: number }) {
  const c = avtColor(name);
  return <div style={{ width: size, height: size, borderRadius: '50%', flexShrink: 0, background: `${c}18`, border: `1.5px solid ${c}50`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: D.MONO, fontSize: Math.round(size * 0.32), fontWeight: 700, color: c, userSelect: 'none' }}>{initials(name)}</div>;
}

function getLikes(likes: string[]) { return likes.filter(l => !l.includes(':')); }
function getReactions(likes: string[], userId: string | null) {
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

// ── Animated waveform bars (for recording) ────────────────────────────────────
function RecordingWave() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 2.5, height: 24 }}>
      {[0,1,2,3,4,5,6,7,8,9,10,11].map(i => (
        <div key={i} style={{
          width: 3, borderRadius: 2, background: D.G, opacity: 0.85,
          animation: `ac-wave 1.1s ease-in-out ${(i * 0.09).toFixed(2)}s infinite alternate`,
        }} />
      ))}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
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
  const [rxnTarget,    setRxnTarget]    = useState<string | null>(null); // desktop hover
  const [sheetOpen,    setSheetOpen]    = useState(false);
  const [sheetIn,      setSheetIn]      = useState(false);
  const [longPress,    setLongPress]    = useState<Message | null>(null);
  const [longPressIn,  setLongPressIn]  = useState(false);
  const [recording,    setRecording]    = useState(false);
  const [recSec,       setRecSec]       = useState(0);
  const [emojiOpen,    setEmojiOpen]    = useState(false);
  const [emojiCat,     setEmojiCat]     = useState(0);
  const [uploadingVoice, setUploadingVoice] = useState(false);

  const bottomRef     = useRef<HTMLDivElement>(null);
  const msgListRef    = useRef<HTMLDivElement>(null);
  const inputRef      = useRef<HTMLTextAreaElement>(null);
  const profileMap    = useRef<Record<string, string>>({});
  const lpTimer       = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mediaRec      = useRef<MediaRecorder | null>(null);
  const recTimer      = useRef<ReturnType<typeof setInterval> | null>(null);
  const userIdRef     = useRef<string | null>(null);
  // For swipe-to-close sheet
  const sheetRef      = useRef<HTMLDivElement>(null);
  const dragStart     = useRef(0);
  const dragging      = useRef(false);

  useEffect(() => { userIdRef.current = userId; }, [userId]);

  // ── iOS Safari keyboard fix ───────────────────────────────────────────────
  // On iOS, the keyboard shrinks the visualViewport but NOT the layout viewport.
  // We listen to visualViewport resize and shift the root element up by the
  // difference, so the input always stays above the keyboard.
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    function onResize() {
      const offset = window.innerHeight - vv!.height - vv!.offsetTop;
      document.documentElement.style.setProperty('--vv-offset', `${Math.max(0, offset)}px`);
    }
    vv.addEventListener('resize', onResize);
    vv.addEventListener('scroll', onResize);
    onResize();
    return () => { vv.removeEventListener('resize', onResize); vv.removeEventListener('scroll', onResize); };
  }, []);

  // Sheet animation
  useEffect(() => {
    if (sheetOpen) requestAnimationFrame(() => setSheetIn(true));
    else setSheetIn(false);
  }, [sheetOpen]);

  useEffect(() => {
    if (longPress) requestAnimationFrame(() => setLongPressIn(true));
    else setLongPressIn(false);
  }, [longPress]);

  // ── User ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id); userIdRef.current = user.id;
      const { data: p } = await supabase.from('profiles').select('full_name').eq('id', user.id).single();
      const name = p?.full_name || user.email?.split('@')[0] || 'Member';
      setUserName(name); profileMap.current[user.id] = name;
    })();
  }, [supabase]);

  // ── Structure ─────────────────────────────────────────────────────────────
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

  // ── Enrich ────────────────────────────────────────────────────────────────
  const enrich = useCallback(async (raw: any[], uid: string | null): Promise<Message[]> => {
    const unknownIds = [...new Set(raw.map((m: any) => m.user_id as string))].filter(id => !profileMap.current[id]);
    if (unknownIds.length) {
      const { data } = await supabase.from('profiles').select('id,full_name').in('id', unknownIds);
      (data || []).forEach((p: any) => { profileMap.current[p.id] = p.full_name || 'Member'; });
    }
    const replyIds = [...new Set(raw.filter((m: any) => m.reply_to_id).map((m: any) => m.reply_to_id as string))];
    const replyMap: Record<string, { content: string; author: string }> = {};
    if (replyIds.length) {
      const { data } = await supabase.from('community_messages').select('id,content,user_id').in('id', replyIds);
      (data || []).forEach((r: any) => { replyMap[r.id] = { content: r.content, author: profileMap.current[r.user_id] || 'Member' }; });
    }
    return raw.map((m: any) => ({
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
      .eq('channel', ch).eq('deleted', false)
      .order('created_at', { ascending: true }).limit(100);
    setMessages(await enrich(data || [], uid));
    setLoading(false);
    setTimeout(() => {
      if (msgListRef.current) msgListRef.current.scrollTop = msgListRef.current.scrollHeight;
    }, 30);
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
        // If this is our own optimistic message, swap it out by matching content+userId
        setMessages(prev => {
          const pendingIdx = uid === raw.user_id
            ? prev.findIndex(m => m.pending && m.content === raw.content && m.user_id === uid)
            : -1;
          const authorName = profileMap.current[raw.user_id] || 'Member';
          const confirmed: Message = {
            id: raw.id, user_id: raw.user_id, content: raw.content,
            created_at: raw.created_at, channel: raw.channel,
            author_name: authorName, is_own: raw.user_id === uid,
            likes: raw.likes || [],
            reply_to_id: raw.reply_to_id,
          };
          if (pendingIdx !== -1) {
            const next = [...prev];
            next[pendingIdx] = confirmed;
            return next;
          }
          if (prev.some(m => m.id === raw.id)) return prev;
          return [...prev, confirmed];
        });
        // Scroll to bottom
        setTimeout(() => { if (msgListRef.current) msgListRef.current.scrollTop = msgListRef.current.scrollHeight; }, 30);
      })
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'community_messages',
        filter: `channel=eq.${channel}`,
      }, (payload: any) => {
        const u = payload.new;
        if (!u) return;
        if (u.deleted) {
          setMessages(prev => prev.filter(m => m.id !== u.id));
        } else {
          // Update likes AND content in one pass — covers reactions, edits, deletes
          setMessages(prev => prev.map(m =>
            m.id === u.id
              ? { ...m, likes: Array.isArray(u.likes) ? u.likes : [], content: u.content ?? m.content }
              : m
          ));
        }
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

  // ── Send — OPTIMISTIC ─────────────────────────────────────────────────────
  async function send() {
    const text = input.trim();
    if (!text || !userId || sending) return;
    setSending(true);
    setInput('');
    setEmojiOpen(false);
    if (inputRef.current) { inputRef.current.style.height = 'auto'; }

    // Build optimistic message and insert immediately
    const optimisticId = `opt-${Date.now()}`;
    const optimistic: Message = {
      id: optimisticId,
      user_id: userId,
      content: text,
      created_at: new Date().toISOString(),
      channel,
      author_name: userName,
      is_own: true,
      likes: [],
      reply_to_id: replyTo?.id,
      reply_to_content: replyTo?.content,
      reply_to_author: replyTo?.author_name,
      pending: true,
    };
    setMessages(prev => [...prev, optimistic]);
    setTimeout(() => { if (msgListRef.current) msgListRef.current.scrollTop = msgListRef.current.scrollHeight; }, 30);

    const payload: any = { user_id: userId, channel, content: text, likes: [] };
    if (replyTo) payload.reply_to_id = replyTo.id;
    setReplyTo(null);

    const { error } = await supabase.from('community_messages').insert(payload);
    if (error) {
      // Roll back optimistic message on error
      setMessages(prev => prev.filter(m => m.id !== optimisticId));
      setInput(text);
      console.error(error.message);
    }
    setSending(false);
    inputRef.current?.focus();
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
    if (e.key === 'Escape') { setReplyTo(null); setRxnTarget(null); setLongPress(null); setEmojiOpen(false); }
  }

  // ── Reactions ─────────────────────────────────────────────────────────────
  async function addReaction(msgId: string, emoji: string) {
    if (!userId) return;
    setLongPress(null); setRxnTarget(null);
    const msg = messages.find(m => m.id === msgId);
    if (!msg) return;
    const tag = `${emoji}:${userId}`;
    const already = msg.likes.includes(tag);
    const next = already ? msg.likes.filter(l => l !== tag) : [...msg.likes, tag];
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, likes: next } : m));
    await supabase.from('community_messages').update({ likes: next }).eq('id', msgId);
  }

  async function toggleLike(msg: Message) {
    if (!userId) return;
    const ids = getLikes(msg.likes);
    const liked = ids.includes(userId);
    const next = liked ? msg.likes.filter(l => l !== userId) : [...msg.likes, userId];
    setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, likes: next } : m));
    await supabase.from('community_messages').update({ likes: next }).eq('id', msg.id);
  }

  async function deleteMsg(id: string) {
    setLongPress(null);
    await supabase.from('community_messages').update({ deleted: true }).eq('id', id).eq('user_id', userId!);
    setMessages(prev => prev.filter(m => m.id !== id));
  }

  // ── Voice recording ───────────────────────────────────────────────────────
  // FIX: 4 root causes of failure addressed:
  // 1. Use userIdRef (not userId) inside onstop closure — avoids stale null on PWA cold start
  // 2. Capture recSecRef instead of recSec state — state is 0 by the time onstop fires
  // 3. Remove sampleRate constraint — unsupported on iOS Safari / some Android PWA browsers
  // 4. Remove audioBitsPerSecond from options — let browser choose; 16kbps caused silent
  //    MediaRecorder construction failures on Chrome PWA. Use timeslice only.
  // 5. Try/catch per codec to avoid crashing if webm unsupported (e.g. Firefox mobile)
  const recSecRef = useRef(0); // mirrors recSec but readable inside closures

  async function startRecording() {
    const uid = userIdRef.current;
    if (!uid) { alert('Please sign in to send voice messages.'); return; }
    try {
      // Minimal constraints — widest browser support
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Pick best supported mime type
      const mimeType = (
        MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' :
        MediaRecorder.isTypeSupported('audio/webm')             ? 'audio/webm' :
        MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')  ? 'audio/ogg;codecs=opus' :
        MediaRecorder.isTypeSupported('audio/mp4')              ? 'audio/mp4' :
        ''
      );

      // Build options — only add mimeType if non-empty (empty string throws on some browsers)
      const recOptions: MediaRecorderOptions = mimeType ? { mimeType } : {};
      const rec = new MediaRecorder(stream, recOptions);
      const chunks: Blob[] = [];

      rec.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunks.push(e.data); };
      rec.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const finalDuration = recSecRef.current;      // read ref, not stale state
        const finalUserId   = userIdRef.current;      // read ref, not stale closure
        const actualMime    = mimeType || 'audio/webm';
        const blob = new Blob(chunks, { type: actualMime });
        if (blob.size === 0) { console.error('Voice recording: empty blob'); return; }
        await uploadVoice(blob, actualMime, finalDuration, finalUserId);
      };

      rec.start(200); // timeslice 200ms — reliable on all browsers
      mediaRec.current = rec;
      recSecRef.current = 0;
      setRecording(true);
      setRecSec(0);
      recTimer.current = setInterval(() => {
        recSecRef.current += 1;
        setRecSec(s => {
          if (s >= 59) { stopRecording(true); return 59; }
          return s + 1;
        });
      }, 1000);
    } catch (err: any) {
      console.error('Voice recording failed:', err);
      const msg = err?.name === 'NotAllowedError'
        ? 'Microphone permission denied. Please allow access in your browser settings.'
        : err?.name === 'NotFoundError'
          ? 'No microphone found on this device.'
          : 'Could not start recording. Please try again.';
      alert(msg);
    }
  }

  function stopRecording(doSend = true) {
    if (recTimer.current) { clearInterval(recTimer.current); recTimer.current = null; }
    if (mediaRec.current && mediaRec.current.state !== 'inactive') {
      if (!doSend) {
        // Cancel: null out handlers before stopping so no upload fires
        mediaRec.current.ondataavailable = null;
        mediaRec.current.onstop = null;
      }
      mediaRec.current.stop();
    }
    setRecording(false);
    setRecSec(0);
    recSecRef.current = 0;
  }

  async function uploadVoice(blob: Blob, mimeType: string, durationSec: number, uid: string | null) {
    if (!uid) { console.error('uploadVoice: no userId'); return; }
    setUploadingVoice(true);

    // Show optimistic bubble immediately
    const optId = `opt-voice-${Date.now()}`;
    const optimistic: Message = {
      id: optId, user_id: uid, content: '[voice:uploading]',
      created_at: new Date().toISOString(), channel,
      author_name: userName, is_own: true, likes: [], pending: true,
    };
    setMessages(prev => [...prev, optimistic]);
    setTimeout(() => { if (msgListRef.current) msgListRef.current.scrollTop = msgListRef.current.scrollHeight; }, 30);

    try {
      // Route through server API — uses service role key to bypass RLS on storage
      const dur = durationSec > 0 ? durationSec : 1;
      const ext = mimeType.includes('ogg') ? 'ogg' : mimeType.includes('mp4') ? 'm4a' : 'webm';
      const form = new FormData();
      form.append('file', new File([blob], `voice.${ext}`, { type: mimeType }));
      form.append('channel', channel);
      form.append('duration', String(dur));

      const res = await fetch('/api/community/voice-upload', { method: 'POST', body: form });
      const json = await res.json();

      if (!res.ok) {
        console.error('Voice upload failed:', json.error);
        setMessages(prev => prev.filter(m => m.id !== optId));
        alert(`Voice upload failed: ${json.error}`);
        setUploadingVoice(false);
        return;
      }

      // Swap optimistic bubble — realtime INSERT handles other users
      setMessages(prev => prev.map(m =>
        m.id === optId ? { ...m, content: json.content, pending: false } : m
      ));
    } catch (err: any) {
      console.error('Voice upload error:', err);
      setMessages(prev => prev.filter(m => m.id !== optId));
      alert('Voice upload failed. Please try again.');
    }

    setUploadingVoice(false);
  }

  // ── Long press ────────────────────────────────────────────────────────────
  function onPressStart(msg: Message) {
    lpTimer.current = setTimeout(() => setLongPress(msg), 480);
  }
  function onPressEnd() { if (lpTimer.current) clearTimeout(lpTimer.current); }

  // ── Swipe-to-close sheet ──────────────────────────────────────────────────
  function onSheetTouchStart(e: React.TouchEvent) {
    dragStart.current = e.touches[0].clientY;
    dragging.current = true;
  }
  function onSheetTouchMove(e: React.TouchEvent) {
    if (!dragging.current || !sheetRef.current) return;
    const dy = e.touches[0].clientY - dragStart.current;
    if (dy > 0) sheetRef.current.style.transform = `translateY(${dy}px)`;
  }
  function onSheetTouchEnd(e: React.TouchEvent) {
    dragging.current = false;
    if (!sheetRef.current) return;
    const dy = e.changedTouches[0].clientY - dragStart.current;
    if (dy > 100) {
      sheetRef.current.style.transform = 'translateY(100%)';
      setTimeout(() => setSheetOpen(false), 250);
    } else {
      sheetRef.current.style.transform = '';
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
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

  const currentCh = channels.find(c => c.slug === channel);

  // ── Voice bubble renderer ─────────────────────────────────────────────────
  function VoiceBubble({ content, isOwn }: { content: string; isOwn: boolean }) {
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const [playing, setPlaying] = useState(false);

    if (content === '[voice:uploading]') {
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: D.bg2, border: `1px solid ${D.border}`, borderRadius: 18, padding: '10px 16px', maxWidth: 220, opacity: 0.7 }}>
          <div style={{ width: 28, height: 28, borderRadius: '50%', background: D.G, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: '#0C0B08', animation: 'ac-pulse 0.8s ease-in-out infinite' }} />
          </div>
          <span style={{ fontFamily: D.MONO, fontSize: 11, color: D.text3 }}>Uploading…</span>
        </div>
      );
    }

    // Parse [voice:URL:durationSec] or [voice:URL]
    const inner = content.slice(7, -1); // strip [voice: and ]
    const parts = inner.split(':');
    // URL could be https://... so rejoin all but last if last is a number
    let url: string, durSec: number;
    const lastPart = parts[parts.length - 1];
    if (!isNaN(Number(lastPart)) && parts.length > 1) {
      durSec = parseInt(lastPart, 10);
      url = parts.slice(0, -1).join(':');
    } else {
      url = inner;
      durSec = 0;
    }
    const durLabel = durSec > 0
      ? `${String(Math.floor(durSec / 60)).padStart(2, '0')}:${String(durSec % 60).padStart(2, '0')}`
      : '0:24';

    function togglePlay() {
      if (!audioRef.current) audioRef.current = new Audio(url);
      if (playing) {
        audioRef.current.pause();
        setPlaying(false);
      } else {
        audioRef.current.play();
        setPlaying(true);
        audioRef.current.onended = () => setPlaying(false);
      }
    }

    const barHeights = [35,60,90,70,50,85,55,40,75,50,80,45,65,35];

    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: isOwn ? 'rgba(232,160,32,0.12)' : D.bg2, border: `1px solid ${isOwn ? D.goldB : D.border}`, borderRadius: 18, padding: '10px 14px', maxWidth: 240 }}>
        <button onClick={togglePlay} style={{ width: 32, height: 32, borderRadius: '50%', background: D.G, border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
          {playing
            ? <svg width="11" height="11" viewBox="0 0 24 24" fill="#0C0B08"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
            : <svg width="11" height="11" viewBox="0 0 24 24" fill="#0C0B08"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          }
        </button>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 2, height: 22 }}>
          {barHeights.map((h, i) => (
            <div key={i} style={{ width: 2.5, borderRadius: 2, background: i < 7 ? D.G : D.text3, height: `${h}%`, opacity: i < 7 ? (playing ? 0.6 + Math.random() * 0.4 : 0.9) : 0.4, transition: 'height 0.3s' }} />
          ))}
        </div>
        <span style={{ fontFamily: D.MONO, fontSize: 10.5, color: D.text2, flexShrink: 0 }}>{durLabel}</span>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CHANNEL LIST — used in desktop sidebar + mobile sheet
  // ═══════════════════════════════════════════════════════════════════════════
  const ChannelList = useMemo(() => {
    const catIds = new Set(categories.map(c => c.id));
    const uncat = channels.filter(c => !c.category_id || !catIds.has(c.category_id));
    return (
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0 16px' }}>
        {categories.map(cat => {
          const catChs = channels.filter(c => c.category_id === cat.id).sort((a, b) => a.sort_order - b.sort_order);
          if (!catChs.length) return null;
          const isColl = collapsed[cat.id];
          return (
            <div key={cat.id} style={{ marginTop: 10 }}>
              <button onClick={() => setCollapsed(c => ({ ...c, [cat.id]: !c[cat.id] }))}
                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '3px 10px 3px 16px', width: '100%', background: 'none', border: 'none', cursor: 'pointer' }}>
                <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke={D.text3} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
                  style={{ transform: isColl ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform 0.15s', flexShrink: 0 }}>
                  <polyline points="6 9 12 15 18 9" />
                </svg>
                <span style={{ fontFamily: D.MONO, fontSize: 10, fontWeight: 700, color: D.text3, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{cat.name}</span>
              </button>
              {!isColl && catChs.map(ch => {
                const active = ch.slug === channel;
                return (
                  <button key={ch.slug} onClick={() => selectChannel(ch.slug)}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px 6px 14px', margin: '1px 6px', borderRadius: 7, width: 'calc(100% - 12px)', background: active ? D.bg2 : 'transparent', border: 'none', borderLeft: `2.5px solid ${active ? D.G : 'transparent'}`, cursor: 'pointer', textAlign: 'left', transition: 'all 0.1s' }}>
                    <span style={{ color: active ? D.G : D.text2, flexShrink: 0 }}>{getIcon(ch.slug, 14)}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: D.UI, fontSize: 13, color: active ? D.G : D.text1, fontWeight: active ? 600 : 400, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ch.name}</div>
                      {ch.description && !active && <div style={{ fontFamily: D.UI, fontSize: 10.5, color: D.text3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 1 }}>{ch.description}</div>}
                    </div>
                  </button>
                );
              })}
            </div>
          );
        })}
        {uncat.length > 0 && (
          <div style={{ marginTop: 10 }}>
            <div style={{ padding: '3px 10px 3px 20px' }}>
              <span style={{ fontFamily: D.MONO, fontSize: 10, fontWeight: 700, color: D.text3, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Channels</span>
            </div>
            {uncat.map(ch => {
              const active = ch.slug === channel;
              return (
                <button key={ch.slug} onClick={() => selectChannel(ch.slug)}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px 6px 16px', margin: '1px 6px', borderRadius: 7, width: 'calc(100% - 12px)', background: active ? D.bg2 : 'transparent', border: 'none', borderLeft: `2.5px solid ${active ? D.G : 'transparent'}`, cursor: 'pointer', textAlign: 'left', transition: 'all 0.1s' }}>
                  <span style={{ color: active ? D.G : D.text3, flexShrink: 0 }}>{HashIcon(14)}</span>
                  <span style={{ fontFamily: D.UI, fontSize: 13, color: active ? D.G : D.text2, fontWeight: active ? 600 : 400 }}>{ch.name}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories, channels, collapsed, channel]);

  // ── MOBILE CHANNEL SHEET — redesigned as large cards ─────────────────────
  const MobileChannelSheet = useMemo(() => {
    if (!sheetOpen && !sheetIn) return null;
    // Flatten all channels in order for card layout
    const allChs = channels.slice().sort((a, b) => a.sort_order - b.sort_order);
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', pointerEvents: sheetOpen ? 'auto' : 'none' }}
        onClick={() => setSheetOpen(false)}>
        {/* Backdrop */}
        <div style={{ position: 'absolute', inset: 0, background: sheetIn ? 'rgba(0,0,0,0.6)' : 'transparent', backdropFilter: sheetIn ? 'blur(6px)' : 'none', transition: 'background 0.28s, backdrop-filter 0.28s' }} />
        {/* Sheet */}
        <div
          ref={sheetRef}
          onClick={e => e.stopPropagation()}
          onTouchStart={onSheetTouchStart}
          onTouchMove={onSheetTouchMove}
          onTouchEnd={onSheetTouchEnd}
          style={{ position: 'relative', background: D.bg1, borderRadius: '22px 22px 0 0', maxHeight: '82vh', display: 'flex', flexDirection: 'column', transform: sheetIn ? 'translateY(0)' : 'translateY(100%)', transition: 'transform 0.32s cubic-bezier(0.32, 0.72, 0, 1)' }}>
          {/* Handle */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: 12, paddingBottom: 4, flexShrink: 0, cursor: 'grab' }}>
            <div style={{ width: 44, height: 4, borderRadius: 3, background: D.border }} />
          </div>
          {/* Header */}
          <div style={{ padding: '10px 20px 12px', flexShrink: 0, borderBottom: `1px solid ${D.border}` }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontFamily: D.DISP, fontStyle: 'italic', fontSize: 22, fontWeight: 700, color: D.G, lineHeight: 1.1 }}>Community</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: D.green }} />
                  <span style={{ fontFamily: D.MONO, fontSize: 11, color: D.text3 }}>{online} online</span>
                </div>
              </div>
              <button onClick={() => setSheetOpen(false)} style={{ width: 32, height: 32, borderRadius: '50%', background: D.bg2, border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, color: D.text2 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
          </div>
          {/* Discord-style channel list */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0 12px' }}>
            {categories.map(cat => {
              const catChs = channels.filter(c => c.category_id === cat.id).sort((a, b) => a.sort_order - b.sort_order);
              if (!catChs.length) return null;
              const isColl = collapsed[cat.id];
              return (
                <div key={cat.id} style={{ marginTop: 16 }}>
                  {/* Category header — clickable to collapse, Discord-style */}
                  <button
                    onClick={() => setCollapsed(c => ({ ...c, [cat.id]: !c[cat.id] }))}
                    style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '2px 16px 6px', width: '100%', background: 'none', border: 'none', cursor: 'pointer' }}>
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke={D.text3} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"
                      style={{ transform: isColl ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform 0.15s', flexShrink: 0 }}>
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                    <span style={{ fontFamily: D.MONO, fontSize: 11, fontWeight: 700, color: D.text3, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                      {cat.name}
                    </span>
                  </button>
                  {/* Channel rows */}
                  {!isColl && catChs.map(ch => {
                    const active = ch.slug === channel;
                    return (
                      <button key={ch.slug} onClick={() => selectChannel(ch.slug)}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 16px 8px 14px', background: active ? D.goldBg : 'transparent', border: 'none', borderLeft: `3px solid ${active ? D.G : 'transparent'}`, cursor: 'pointer', textAlign: 'left', transition: 'all 0.1s' }}>
                        {/* # or custom icon */}
                        <span style={{ color: active ? D.G : D.text3, flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                          {getIcon(ch.slug, 16)}
                        </span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontFamily: D.UI, fontSize: 15, color: active ? D.G : D.text2, fontWeight: active ? 600 : 400, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.3 }}>
                            {ch.name}
                          </div>
                          {ch.description && !active && (
                            <div style={{ fontFamily: D.UI, fontSize: 11.5, color: D.text3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 1, lineHeight: 1.2 }}>
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
            {/* Uncategorised */}
            {(() => {
              const catIds = new Set(categories.map(c => c.id));
              const uncat = channels.filter(c => !c.category_id || !catIds.has(c.category_id));
              if (!uncat.length) return null;
              return (
                <div style={{ marginTop: 16 }}>
                  <div style={{ padding: '2px 16px 6px' }}>
                    <span style={{ fontFamily: D.MONO, fontSize: 11, fontWeight: 700, color: D.text3, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Channels</span>
                  </div>
                  {uncat.map(ch => {
                    const active = ch.slug === channel;
                    return (
                      <button key={ch.slug} onClick={() => selectChannel(ch.slug)}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 16px 8px 14px', background: active ? D.goldBg : 'transparent', border: 'none', borderLeft: `3px solid ${active ? D.G : 'transparent'}`, cursor: 'pointer', textAlign: 'left', transition: 'all 0.1s' }}>
                        <span style={{ color: active ? D.G : D.text3, flexShrink: 0, display: 'flex', alignItems: 'center' }}>{HashIcon(16)}</span>
                        <span style={{ fontFamily: D.UI, fontSize: 15, color: active ? D.G : D.text2, fontWeight: active ? 600 : 400 }}>{ch.name}</span>
                      </button>
                    );
                  })}
                </div>
              );
            })()}
          </div>
          <div style={{ height: 'max(16px, env(safe-area-inset-bottom, 16px))', flexShrink: 0 }} />
        </div>
      </div>
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheetOpen, sheetIn, categories, channels, channel, online, collapsed]);

  // ── WhatsApp-style long-press reaction sheet ──────────────────────────────
  const LongPressSheet = longPress && (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, pointerEvents: longPressIn ? 'auto' : 'none' }}
      onClick={() => setLongPress(null)}>
      {/* Blurred backdrop */}
      <div style={{ position: 'absolute', inset: 0, background: longPressIn ? 'rgba(0,0,0,0.55)' : 'transparent', backdropFilter: longPressIn ? 'blur(8px)' : 'none', transition: 'all 0.22s' }} />

      {/* Floating content — centered in viewport */}
      <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', width: 'min(340px, 90vw)', opacity: longPressIn ? 1 : 0, transition: 'opacity 0.18s', display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}
        onClick={e => e.stopPropagation()}>

        {/* ── WhatsApp-style emoji tray ── */}
        <div style={{ background: D.bg1, borderRadius: 60, padding: '10px 16px', display: 'flex', gap: 6, alignItems: 'center', boxShadow: '0 8px 40px rgba(0,0,0,0.5)', border: `1px solid ${D.border}` }}>
          {QUICK_RXN.map(emoji => {
            const tag = `${emoji}:${userId}`;
            const hasMe = longPress.likes.includes(tag);
            return (
              <button key={emoji} onClick={() => addReaction(longPress.id, emoji)}
                style={{ background: hasMe ? D.goldBg : 'none', border: `1.5px solid ${hasMe ? D.goldB : 'transparent'}`, borderRadius: '50%', width: 42, height: 42, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 24, lineHeight: 1, transition: 'all 0.15s', flexShrink: 0 }}
                onTouchStart={e => { e.currentTarget.style.transform = 'scale(1.35)'; }}
                onTouchEnd={e => { e.currentTarget.style.transform = 'scale(1)'; }}>
                {emoji}
              </button>
            );
          })}
          {/* + more reactions */}
          <button onClick={() => { setLongPress(null); setEmojiOpen(true); inputRef.current?.focus(); }}
            style={{ background: D.bg2, border: `1px solid ${D.border}`, borderRadius: '50%', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: D.text2, flexShrink: 0 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>
          </button>
        </div>

        {/* Message preview bubble */}
        <div style={{ background: D.bg1, borderRadius: 16, padding: '10px 16px', width: '100%', border: `1px solid ${D.border}`, boxShadow: '0 4px 24px rgba(0,0,0,0.4)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <Avatar name={longPress.author_name} size={24} />
            <span style={{ fontFamily: D.MONO, fontSize: 11, color: D.G, fontWeight: 600 }}>{longPress.is_own ? 'You' : longPress.author_name}</span>
          </div>
          <div style={{ fontFamily: D.UI, fontSize: 13.5, color: D.text1, lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' }}>
            {longPress.content.startsWith('[voice:') ? '🎙 Voice message' : longPress.content}
          </div>
        </div>

        {/* Actions menu */}
        <div style={{ background: D.bg1, borderRadius: 16, width: '100%', overflow: 'hidden', border: `1px solid ${D.border}`, boxShadow: '0 4px 24px rgba(0,0,0,0.4)' }}>
          {[
            { label: 'Reply', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/></svg>, action: () => { setReplyTo(longPress); setLongPress(null); inputRef.current?.focus(); } },
            { label: 'Copy text', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>, action: () => { navigator.clipboard.writeText(longPress.content); setLongPress(null); } },
            ...(longPress.is_own ? [{ label: 'Delete', danger: true, icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={D.red} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M9 6V4h6v2"/></svg>, action: () => deleteMsg(longPress.id) }] : []),
          ].map((item: any, idx, arr) => (
            <button key={item.label} onClick={item.action}
              style={{ display: 'flex', alignItems: 'center', gap: 14, width: '100%', padding: '15px 20px', background: 'none', border: 'none', borderBottom: idx < arr.length - 1 ? `1px solid ${D.border}` : 'none', cursor: 'pointer', fontFamily: D.UI, fontSize: 15.5, color: item.danger ? D.red : D.text1, textAlign: 'left' }}>
              <span style={{ color: item.danger ? D.red : D.text3 }}>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div style={{ display: 'flex', height: '100dvh', overflow: 'hidden', background: D.bg0, position: 'fixed', inset: 0, transform: 'translateY(calc(-1 * var(--vv-offset, 0px)))', transition: 'transform 0s' }}>
      <style>{`
        @keyframes ac-spin  { to { transform: rotate(360deg); } }
        @keyframes ac-pulse { 0%,100% { opacity:1; transform:scale(1); } 50% { opacity:0.4; transform:scale(0.7); } }
        @keyframes ac-wave  { from { height: 20%; } to { height: 100%; } }

        /* Prevent native highlight / text selection / callout on long-press */
        .ac-msg {
          border-radius: 4px;
          transition: background 0.07s;
          -webkit-user-select: none;
          -moz-user-select: none;
          user-select: none;
          -webkit-touch-callout: none;
          -webkit-tap-highlight-color: transparent;
        }
        .ac-msg:hover { background: var(--app-bg-input, rgba(128,128,128,0.07)); }
        /* Allow selecting message text only (so copy still works via our sheet) */
        .ac-msg p, .ac-msg span.selectable {
          -webkit-user-select: text;
          user-select: text;
        }
        /* Kill the blue flash on tap for the whole message list */
        .ac-msglist {
          -webkit-tap-highlight-color: transparent;
          -webkit-touch-callout: none;
        }
        .ac-ch-btn:hover { background: var(--app-bg-input, rgba(128,128,128,0.09)) !important; }
        .ac-rxn:hover { transform: scale(1.1); }
        .ac-nav:hover { background: rgba(128,128,128,0.12) !important; border-radius: 30% !important; }

        ::-webkit-scrollbar { width: 3px; height: 3px; background: transparent; }
        ::-webkit-scrollbar-thumb { background: var(--app-border, rgba(128,128,128,0.18)); border-radius: 3px; }
        textarea { color-scheme: light dark; }
        textarea::placeholder { color: var(--app-text-dim, var(--text-dim, #888)); opacity: 1; }

        .desk { display: flex !important; }
        .mob  { display: none !important; }
        @media (max-width: 640px) {
          /* Reserve space above the fixed bottom nav */
          .chat-col { padding-bottom: calc(56px + env(safe-area-inset-bottom, 0px)) !important; }
          /* Input area needs no extra padding — chat-col handles the offset */
          .input-area { padding-bottom: 0 !important; }
          .desk { display: none !important; }
          .mob  { display: flex !important; }
        }
      `}</style>

      {/* ── DESKTOP: icon rail ───────────────────────────────────────────── */}
      <div className="desk" style={{ width: 60, background: D.bg0, flexDirection: 'column', alignItems: 'center', padding: '10px 0', flexShrink: 0, borderRight: `1px solid ${D.border}`, gap: 3 }}>
        <div style={{ width: 40, height: 40, borderRadius: '30%', background: D.G, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 4 }}>
          <span style={{ fontFamily: D.UI, fontSize: 15, fontWeight: 800, color: '#0C0B08' }}>A</span>
        </div>
        <div style={{ width: 28, height: 1, background: D.border, margin: '2px 0 6px' }} />
        {NAV.map(item => {
          const active = item.href === '/community';
          return (
            <Link key={item.href} href={item.href} title={item.label} className="ac-nav"
              style={{ width: 40, height: 40, borderRadius: active ? '30%' : '50%', background: active ? D.G : 'transparent', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', color: active ? '#0C0B08' : D.text3, gap: 2, transition: 'all 0.15s' }}>
              {item.icon}
              <span style={{ fontFamily: D.MONO, fontSize: 7, letterSpacing: '0.04em', textTransform: 'uppercase', fontWeight: 500 }}>{item.label}</span>
            </Link>
          );
        })}
      </div>

      {/* ── DESKTOP: sidebar ─────────────────────────────────────────────── */}
      <div className="desk" style={{ width: 232, background: D.bg1, flexDirection: 'column', flexShrink: 0, borderRight: `1px solid ${D.border}` }}>
        <div style={{ padding: '13px 16px', borderBottom: `1px solid ${D.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <span style={{ fontFamily: D.UI, fontSize: 15, fontWeight: 700, color: D.text0 }}>Ascentor</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={D.text3} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
        </div>
        {ChannelList}
        <div style={{ padding: '8px 10px', background: D.bg0, display: 'flex', alignItems: 'center', gap: 8, borderTop: `1px solid ${D.border}`, flexShrink: 0 }}>
          <Avatar name={userName} size={30} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: D.UI, fontSize: 13, fontWeight: 600, color: D.text0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{userName}</div>
            <div style={{ fontFamily: D.MONO, fontSize: 10, color: D.green, display: 'flex', alignItems: 'center', gap: 3 }}>
              <div style={{ width: 5, height: 5, borderRadius: '50%', background: D.green }} /> Online
            </div>
          </div>
        </div>
      </div>

      {/* ── MAIN CHAT COLUMN — flex column, header fixed, messages scroll ── */}
      {/* On mobile, marginBottom = height of fixed bottom nav so input never hides under it */}
      <div className="chat-col" style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden', background: D.bg0 }}>

        {/* TOPBAR — never moves */}
        <div style={{ height: 49, borderBottom: `1px solid ${D.border}`, display: 'flex', alignItems: 'center', padding: '0 14px', gap: 10, flexShrink: 0, background: D.bg1, zIndex: 10 }}>
          <button className="mob" onClick={() => setSheetOpen(true)}
            style={{ background: 'none', border: 'none', color: D.text2, cursor: 'pointer', padding: '4px 8px 4px 0', flexShrink: 0 }}>
            <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="7" x2="21" y2="7"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="17" x2="21" y2="17"/></svg>
          </button>
          <span style={{ color: D.G, flexShrink: 0 }}>{getIcon(channel, 15)}</span>
          <span style={{ fontFamily: D.UI, fontSize: 15, fontWeight: 700, color: D.text0 }}>{currentCh?.name || channel}</span>
          {currentCh?.description && <>
            <span className="desk" style={{ color: D.border, userSelect: 'none' }}>│</span>
            <span className="desk" style={{ fontFamily: D.UI, fontSize: 13, color: D.text3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{currentCh.description}</span>
          </>}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 14 }}>
            <button style={{ background: 'none', border: 'none', color: D.text2, cursor: 'pointer', display: 'flex' }}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            </button>
            <span style={{ fontFamily: D.MONO, fontSize: 12, color: D.text3, display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: D.green }} />{online}
            </span>
          </div>
        </div>

        {/* MESSAGES — only this scrolls */}
        <div ref={msgListRef} className="ac-msglist" style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', paddingBottom: 8 }}
          onClick={() => { setRxnTarget(null); setLongPress(null); setEmojiOpen(false); }}>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12 }}>
              <div style={{ width: 24, height: 24, borderRadius: '50%', border: `2.5px solid ${D.border}`, borderTopColor: D.G, animation: 'ac-spin 0.75s linear infinite' }} />
              <span style={{ fontFamily: D.MONO, fontSize: 11, color: D.text3 }}>Loading messages…</span>
            </div>
          ) : messages.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12, padding: '40px 32px', textAlign: 'center' }}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: D.goldBg, border: `1.5px solid ${D.goldB}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: D.G }}>
                {getIcon(channel, 22)}
              </div>
              <div style={{ fontFamily: D.UI, fontSize: 18, fontWeight: 700, color: D.text0 }}>Welcome to #{currentCh?.name || channel}</div>
              <div style={{ fontFamily: D.UI, fontSize: 13, color: D.text2, maxWidth: 280, lineHeight: 1.6 }}>{currentCh?.description || 'Be the first to start the conversation.'}</div>
            </div>
          ) : messages.map((msg, i) => {
            const header = showHeader(i);
            const dateDivider = showDate(i);
            const likeIds = getLikes(msg.likes);
            const likeCount = likeIds.length;
            const iLiked = userId ? likeIds.includes(userId) : false;
            const rxns = getReactions(msg.likes, userId);
            const isVoice = msg.content.startsWith('[voice:');

            return (
              <React.Fragment key={msg.id}>
                {dateDivider && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px 6px', userSelect: 'none' }}>
                    <div style={{ flex: 1, height: 1, background: D.border, opacity: 0.5 }} />
                    <span style={{ fontFamily: D.MONO, fontSize: 11, color: D.text3 }}>{fmtDate(msg.created_at)}</span>
                    <div style={{ flex: 1, height: 1, background: D.border, opacity: 0.5 }} />
                  </div>
                )}
                <div className="ac-msg"
                  style={{ display: 'flex', gap: 10, padding: header ? '8px 14px 2px' : '1px 14px', alignItems: 'flex-start', position: 'relative', opacity: msg.pending ? 0.65 : 1, transition: 'opacity 0.3s' }}
                  onMouseEnter={() => setRxnTarget(msg.id)}
                  onMouseLeave={() => setRxnTarget(null)}
                  onTouchStart={() => onPressStart(msg)}
                  onTouchEnd={onPressEnd}
                  onTouchMove={onPressEnd}
                >
                  <div style={{ width: 36, flexShrink: 0, paddingTop: header ? 2 : 0 }}>
                    {header && <Avatar name={msg.author_name} size={36} />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {header && (
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 3 }}>
                        <span style={{ fontFamily: D.UI, fontSize: 14, fontWeight: 700, color: msg.is_own ? D.G : avtColor(msg.author_name) }}>
                          {msg.is_own ? 'You' : msg.author_name}
                        </span>
                        <span style={{ fontFamily: D.MONO, fontSize: 10, color: D.text3 }}>{fmtTime(msg.created_at)}</span>
                        {msg.pending && <span style={{ fontFamily: D.MONO, fontSize: 9, color: D.text3, fontStyle: 'italic' }}>sending…</span>}
                      </div>
                    )}
                    {/* Reply quote */}
                    {msg.reply_to_id && msg.reply_to_content && (
                      <div style={{ display: 'flex', gap: 0, marginBottom: 5, borderRadius: 8, overflow: 'hidden', maxWidth: '92%' }}>
                        <div style={{ width: 3, background: D.G, flexShrink: 0 }} />
                        <div style={{ padding: '5px 10px', background: D.bg2, flex: 1 }}>
                          <div style={{ fontFamily: D.MONO, fontSize: 10.5, color: D.G, fontWeight: 600, marginBottom: 2 }}>{msg.reply_to_author}</div>
                          <div style={{ fontFamily: D.UI, fontSize: 12.5, color: D.text2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{trunc(msg.reply_to_content, 80)}</div>
                        </div>
                      </div>
                    )}
                    {/* Content */}
                    {isVoice
                      ? <VoiceBubble content={msg.content} isOwn={msg.is_own} />
                      : <p style={{ fontFamily: D.UI, fontSize: 14, color: D.text1, margin: 0, lineHeight: 1.6, wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>{msg.content}</p>
                    }
                    {/* Reaction pills */}
                    {(likeCount > 0 || rxns.length > 0) && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                        {likeCount > 0 && (
                          <button className="ac-rxn" onClick={() => toggleLike(msg)}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 9px 3px 7px', borderRadius: 100, background: iLiked ? 'rgba(88,101,242,0.15)' : 'var(--app-bg-input,rgba(128,128,128,0.1))', border: `1.5px solid ${iLiked ? 'rgba(88,101,242,0.4)' : D.border}`, cursor: 'pointer', transition: 'transform 0.15s' }}>
                            <span style={{ fontSize: 13 }}>❤️</span>
                            <span style={{ fontFamily: D.MONO, fontSize: 11, fontWeight: 600, color: iLiked ? '#818cf8' : D.text2 }}>{likeCount}</span>
                          </button>
                        )}
                        {rxns.map(([emoji, { count, hasMe }]) => (
                          <button key={emoji} className="ac-rxn" onClick={() => addReaction(msg.id, emoji)}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 9px 3px 7px', borderRadius: 100, background: hasMe ? D.goldBg : 'var(--app-bg-input,rgba(128,128,128,0.1))', border: `1.5px solid ${hasMe ? D.goldB : D.border}`, cursor: 'pointer', transition: 'transform 0.15s' }}>
                            <span style={{ fontSize: 13 }}>{emoji}</span>
                            <span style={{ fontFamily: D.MONO, fontSize: 11, fontWeight: 600, color: hasMe ? D.G : D.text2 }}>{count}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {/* Desktop hover bar */}
                  {rxnTarget === msg.id && (
                    <div className="desk"
                      style={{ position: 'absolute', right: 10, top: header ? 6 : -8, background: D.bg1, border: `1px solid ${D.border}`, borderRadius: 10, boxShadow: '0 4px 20px rgba(0,0,0,0.35)', zIndex: 20 }}
                      onClick={e => e.stopPropagation()}>
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        <div style={{ position: 'relative' }}>
                          <button onClick={() => setRxnTarget(prev => prev === `picker:${msg.id}` ? msg.id : `picker:${msg.id}`)}
                            style={{ padding: '7px 9px', background: 'none', border: 'none', color: D.text2, cursor: 'pointer', display: 'flex', alignItems: 'center', borderRadius: '10px 0 0 10px' }}>
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>
                          </button>
                        </div>
                        <button onClick={() => { setReplyTo(msg); inputRef.current?.focus(); setRxnTarget(null); }} style={{ padding: '7px 9px', background: 'none', border: 'none', color: D.text2, cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/></svg>
                        </button>
                        <button onClick={() => toggleLike(msg)} style={{ padding: '7px 9px', background: 'none', border: 'none', color: iLiked ? '#818cf8' : D.text2, cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                          <svg width="15" height="15" viewBox="0 0 24 24" fill={iLiked ? '#818cf8' : 'none'} stroke={iLiked ? '#818cf8' : 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                        </button>
                        {msg.is_own && (
                          <button onClick={() => deleteMsg(msg.id)} style={{ padding: '7px 9px', background: 'none', border: 'none', color: D.red, cursor: 'pointer', display: 'flex', alignItems: 'center', borderRadius: '0 10px 10px 0' }}>
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M9 6V4h6v2"/></svg>
                          </button>
                        )}
                      </div>
                      {rxnTarget === `picker:${msg.id}` && (
                        <div style={{ display: 'flex', padding: '5px 8px', gap: 2, borderTop: `1px solid ${D.border}` }} onClick={e => e.stopPropagation()}>
                          {QUICK_RXN.map(emoji => (
                            <button key={emoji} onClick={() => addReaction(msg.id, emoji)}
                              style={{ background: 'none', border: 'none', fontSize: 17, cursor: 'pointer', padding: '3px 4px', borderRadius: 5, lineHeight: 1, transition: 'transform 0.1s' }}
                              onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.25)'; }}
                              onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}>
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
          })}
          <div ref={bottomRef} style={{ height: 4 }} />
        </div>

        {/* INPUT AREA — stays at bottom, never pushed by keyboard (position in flow) */}
        <div style={{ flexShrink: 0, background: D.bg0, borderTop: `1px solid ${D.border}`, paddingBottom: 'max(12px, env(safe-area-inset-bottom, 12px))' }} className="input-area">
          {/* Reply bar */}
          {replyTo && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px 6px' }}>
              <div style={{ flex: 1, display: 'flex', alignItems: 'stretch', gap: 0, borderRadius: 8, overflow: 'hidden', background: D.bg2, border: `1px solid ${D.border}` }}>
                <div style={{ width: 3, background: D.G, flexShrink: 0 }} />
                <div style={{ padding: '5px 10px', flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: D.MONO, fontSize: 10.5, color: D.G, fontWeight: 600, marginBottom: 1 }}>Replying to {replyTo.is_own ? 'yourself' : replyTo.author_name}</div>
                  <div style={{ fontFamily: D.UI, fontSize: 12, color: D.text2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{trunc(replyTo.content, 60)}</div>
                </div>
              </div>
              <button onClick={() => setReplyTo(null)} style={{ background: 'none', border: 'none', color: D.text3, cursor: 'pointer', padding: 4, lineHeight: 1, fontSize: 18, flexShrink: 0 }}>✕</button>
            </div>
          )}
          {/* Emoji picker */}
          {emojiOpen && (
            <div style={{ background: D.bg1, borderTop: `1px solid ${D.border}` }} onClick={e => e.stopPropagation()}>
              <div style={{ display: 'flex', borderBottom: `1px solid ${D.border}`, overflowX: 'auto', scrollbarWidth: 'none' }}>
                {EMOJI_CATS.map((cat, ci) => (
                  <button key={ci} onClick={() => setEmojiCat(ci)}
                    style={{ padding: '8px 13px', background: 'none', border: 'none', borderBottom: `2px solid ${ci === emojiCat ? D.G : 'transparent'}`, cursor: 'pointer', fontFamily: D.MONO, fontSize: 9.5, color: ci === emojiCat ? D.G : D.text2, whiteSpace: 'nowrap', letterSpacing: '0.06em', textTransform: 'uppercase', flexShrink: 0, transition: 'color 0.15s, border-color 0.15s' }}>
                    {cat.label}
                  </button>
                ))}
              </div>
              <div style={{ maxHeight: 160, overflowY: 'auto', padding: '6px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(36px, 1fr))', gap: 2 }}>
                  {EMOJI_CATS[emojiCat].emojis.map(emoji => (
                    <button key={emoji} onClick={() => { setInput(p => p + emoji); setEmojiOpen(false); inputRef.current?.focus(); }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, padding: 4, borderRadius: 6, lineHeight: 1, textAlign: 'center' }}
                      onMouseEnter={e => { e.currentTarget.style.background = D.bg2; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}>
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
          {/* Recording UI */}
          {recording ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '10px 14px', background: D.bg2, borderRadius: 12, padding: '10px 14px', border: `1px solid ${D.border}` }}>
              <div style={{ width: 9, height: 9, borderRadius: '50%', background: D.red, animation: 'ac-pulse 1s ease-in-out infinite', flexShrink: 0 }} />
              <RecordingWave />
              <span style={{ fontFamily: D.MONO, fontSize: 13, color: D.G, flex: 1, paddingLeft: 4 }}>{fmtRec(recSec)}</span>
              <button onClick={() => stopRecording(false)} title="Cancel"
                style={{ background: 'none', border: 'none', color: D.text3, cursor: 'pointer', padding: '0 6px', fontSize: 20, lineHeight: 1 }}>✕</button>
              <button onClick={() => stopRecording(true)} title="Send"
                style={{ width: 38, height: 38, borderRadius: '50%', background: D.G, border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#0C0B08" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
              </button>
            </div>
          ) : (
            <div style={{ margin: '10px 14px', background: D.bg2, border: `1px solid ${D.border}`, borderRadius: 12, display: 'flex', alignItems: 'flex-end', gap: 6, padding: '8px 10px' }}>
              <button onClick={() => setEmojiOpen(o => !o)} title="Emoji"
                style={{ background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0, lineHeight: 1, padding: '1px 2px', fontSize: 20, opacity: emojiOpen ? 1 : 0.65, transition: 'opacity 0.15s' }}>
                😊
              </button>
              <textarea ref={inputRef} value={input}
                onChange={e => { setInput(e.target.value); e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'; }}
                onKeyDown={onKey}
                placeholder={userId ? `Message #${currentCh?.name || channel}` : 'Sign in to chat'}
                readOnly={!userId} rows={1} maxLength={2000}
                style={{ flex: 1, background: 'none', border: 'none', outline: 'none', resize: 'none', fontFamily: D.UI, fontSize: 14, color: D.text0, lineHeight: 1.55, minHeight: 22, maxHeight: 120, padding: 0, overflow: 'hidden' }}
              />
              {input.trim()
                ? <button onClick={send} disabled={sending} title="Send"
                    style={{ width: 34, height: 34, borderRadius: '50%', background: D.G, border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, opacity: sending ? 0.6 : 1 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0C0B08" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                  </button>
                : <button onClick={startRecording} title="Voice message" disabled={uploadingVoice}
                    style={{ background: 'none', border: 'none', color: D.text2, cursor: uploadingVoice ? 'default' : 'pointer', flexShrink: 0, lineHeight: 1, padding: '1px 2px', opacity: uploadingVoice ? 0.4 : 0.75, transition: 'opacity 0.15s' }}>
                    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
                  </button>
              }
            </div>
          )}
        </div>
      </div>

      {/* MOBILE BOTTOM NAV */}
      <div className="mob" style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: D.bg1, borderTop: `1px solid ${D.border}`, justifyContent: 'space-around', padding: '5px 0', paddingBottom: 'max(5px, env(safe-area-inset-bottom, 5px))', zIndex: 15 }}>
        {NAV.map(item => {
          const active = item.href === '/community';
          return (
            <Link key={item.href} href={item.href}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: '4px 12px', textDecoration: 'none', color: active ? D.G : D.text3, transition: 'color 0.15s' }}>
              {item.icon}
              <span style={{ fontFamily: D.MONO, fontSize: 8.5, letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: active ? 600 : 400 }}>{item.label}</span>
            </Link>
          );
        })}
      </div>

      {/* MOBILE CHANNEL SHEET */}
      {MobileChannelSheet}

      {/* WHATSAPP-STYLE LONG-PRESS REACTION SHEET */}
      {LongPressSheet}
    </div>
  );
}
