'use client';

// app/(app)/community/page.tsx
// ── Discord-faithful layout ────────────────────────────────────
// Desktop: icon nav | channel sidebar (categorised) | chat area
// Mobile:  channel list screen → chat screen (Discord mobile)
// Colors:  Concept A (#1e1f22 / #2b2d31 / #313338)

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';

// ── Discord color tokens ─────────────────────────────────────
const D = {
  bg0:     '#111214',   // icon rail
  bg1:     '#1e1f22',   // darkest — status bar / dividers
  bg2:     '#2b2d31',   // sidebar
  bg3:     '#313338',   // chat area
  bg4:     '#383a40',   // input box
  bg5:     '#404249',   // active channel
  text0:   '#f2f3f5',   // primary text
  text1:   '#dbdee1',   // secondary text
  text2:   '#b5bac1',   // muted
  text3:   '#949ba4',   // dimmer
  text4:   '#6d6f78',   // placeholder
  gold:    '#E8A020',   // Ascentor accent
  accent:  '#5865f2',   // reactions / active elements
  accentL: 'rgba(88,101,242,0.15)',
  green:   '#23a55a',
  border:  '#1e1f22',
  fontUI:  "'Syne', system-ui, sans-serif",
  fontMono:"'DM Mono', monospace",
  fontDisplay:"'Cormorant Garamond', Georgia, serif",
};

// Nav items (left icon strip on desktop)
const NAV = [
  { href: '/dashboard', label: 'Home',     icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z"/><path d="M9 21V12h6v9"/></svg> },
  { href: '/coach',     label: 'Mentor',   icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg> },
  { href: '/experts',   label: 'Sessions', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="7" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M2 21v-1a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v1"/><path d="M18 14a3 3 0 0 1 3 3v1"/></svg> },
  { href: '/community', label: 'Circle',   icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><circle cx="9" cy="10" r="1.5"/><circle cx="15" cy="10" r="1.5"/></svg> },
  { href: '/learn',     label: 'Learn',    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg> },
];

// Channel SVG icons
const ICONS: Record<string, React.ReactElement> = {
  general:        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
  introductions:  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  'career-wins':  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2z"/></svg>,
  accountability: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>,
  'industry-talk':<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>,
  'cv-review':    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
  opportunities:  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/><line x1="12" y1="12" x2="12" y2="16"/><line x1="10" y1="14" x2="14" y2="14"/></svg>,
};
const HashIcon = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/><line x1="10" y1="3" x2="8" y2="21"/><line x1="16" y1="3" x2="14" y2="21"/></svg>;

function getIcon(slug: string) { return ICONS[slug] || HashIcon; }

// Types
interface Category  { id: string; name: string; sort_order: number; collapsible: boolean; }
interface Channel   { slug: string; name: string; description: string; sort_order: number; category_id: string | null; }
interface Message   { id: string; user_id: string; content: string; created_at: string; channel: string; author_name: string; is_own: boolean; likes: string[]; reply_to_id?: string; reply_to_content?: string; reply_to_author?: string; }

const REACTIONS = ['❤️','👍','🔥','👏','😮','💯'];

function initials(n: string) { return n.split(' ').map(w => w[0]).join('').toUpperCase().slice(0,2) || '?'; }

function formatTime(iso: string) {
  const d = new Date(iso), now = new Date();
  return d.toDateString() === now.toDateString()
    ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function formatDate(iso: string) {
  const d = new Date(iso), now = new Date();
  if (d.toDateString() === now.toDateString()) return 'Today';
  const y = new Date(now); y.setDate(y.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return 'Yesterday';
  return d.toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' });
}

const AVT_COLORS = ['#5865f2','#E8A020','#14B8A6','#8B5CF6','#ec4899','#f97316','#22c55e'];
function avtColor(name: string) { return AVT_COLORS[name.split('').reduce((a,c)=>a+c.charCodeAt(0),0) % AVT_COLORS.length]; }

function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  const c = avtColor(name);
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', flexShrink: 0, background: `${c}28`, border: `1.5px solid ${c}50`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: D.fontMono, fontSize: size * 0.3, fontWeight: 700, color: c }}>
      {initials(name)}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
export default function CommunityPage() {
  const supabase = useRef(createClient()).current;
  const [userId,    setUserId]    = useState<string|null>(null);
  const [userName,  setUserName]  = useState('Member');
  const [categories,setCategories]= useState<Category[]>([]);
  const [channels,  setChannels]  = useState<Channel[]>([]);
  const [collapsed, setCollapsed] = useState<Record<string,boolean>>({});
  const [channel,   setChannel]   = useState('general');
  const [messages,  setMessages]  = useState<Message[]>([]);
  const [input,     setInput]     = useState('');
  const [sending,   setSending]   = useState(false);
  const [loading,   setLoading]   = useState(true);
  const [online,    setOnline]    = useState(1);
  const [replyTo,   setReplyTo]   = useState<Message|null>(null);
  const [rxnTarget, setRxnTarget] = useState<string|null>(null);
  // Mobile: 'channels' | 'chat'
  const [mobileView, setMobileView] = useState<'channels'|'chat'>('channels');
  const bottomRef  = useRef<HTMLDivElement>(null);
  const inputRef   = useRef<HTMLTextAreaElement>(null);
  const profileMap = useRef<Record<string,string>>({});

  // ── Load user ────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      const { data: p } = await supabase.from('profiles').select('full_name').eq('id', user.id).single();
      const name = p?.full_name || user.email?.split('@')[0] || 'Member';
      setUserName(name); profileMap.current[user.id] = name;
    })();
  }, [supabase]);

  // ── Load categories + channels ───────────────────────────────
  const loadStructure = useCallback(async () => {
    const [catRes, chRes] = await Promise.all([
      supabase.from('community_categories').select('*').order('sort_order'),
      supabase.from('community_channels').select('slug,name,description,sort_order,category_id').order('sort_order'),
    ]);
    setCategories(catRes.data || []);
    setChannels(chRes.data || []);
  }, [supabase]);

  useEffect(() => { loadStructure(); }, [loadStructure]);

  // ── Realtime structure updates ───────────────────────────────
  useEffect(() => {
    const sub = supabase.channel('structure-watch')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'community_channels' }, loadStructure)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'community_categories' }, loadStructure)
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [supabase, loadStructure]);

  // ── Enrich messages ──────────────────────────────────────────
  const enrich = useCallback(async (raw: any[], uid: string|null): Promise<Message[]> => {
    const unknownIds = [...new Set(raw.map(m => m.user_id))].filter(id => !profileMap.current[id]);
    if (unknownIds.length) {
      const { data } = await supabase.from('profiles').select('id,full_name').in('id', unknownIds);
      (data||[]).forEach((p:any) => { profileMap.current[p.id] = p.full_name || 'Member'; });
    }
    const replyIds = [...new Set(raw.filter(m => m.reply_to_id).map(m => m.reply_to_id))];
    const replyMap: Record<string,{content:string;author:string}> = {};
    if (replyIds.length) {
      const { data } = await supabase.from('community_messages').select('id,content,user_id').in('id', replyIds);
      (data||[]).forEach((r:any) => { replyMap[r.id] = { content: r.content, author: profileMap.current[r.user_id] || 'Member' }; });
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

  // ── Load messages ────────────────────────────────────────────
  const loadMessages = useCallback(async (ch: string, uid: string|null) => {
    setLoading(true);
    const { data } = await supabase.from('community_messages').select('id,user_id,content,created_at,channel,likes,reply_to_id').eq('channel', ch).eq('deleted', false).order('created_at', { ascending: true }).limit(100);
    setMessages(await enrich(data||[], uid));
    setLoading(false);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 60);
  }, [supabase, enrich]);

  useEffect(() => { loadMessages(channel, userId); }, [channel, userId, loadMessages]);

  // ── Realtime messages ────────────────────────────────────────
  useEffect(() => {
    const msgCh = supabase.channel(`community:${channel}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'community_messages', filter: `channel=eq.${channel}` }, async (payload: any) => {
        if (payload.new.deleted) return;
        const [enriched] = await enrich([payload.new], userId);
        setMessages(prev => prev.some(m => m.id === enriched.id) ? prev : [...prev, enriched]);
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 60);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'community_messages', filter: `channel=eq.${channel}` }, (payload: any) => {
        const u = payload.new;
        if (u.deleted) setMessages(prev => prev.filter(m => m.id !== u.id));
        else setMessages(prev => prev.map(m => m.id === u.id ? { ...m, likes: u.likes||[] } : m));
      })
      .subscribe();
    const presenceCh = supabase.channel(`presence:${channel}`);
    presenceCh.on('presence', { event: 'sync' }, () => { setOnline(Object.keys(presenceCh.presenceState()).length || 1); })
      .subscribe(async (s) => { if (s === 'SUBSCRIBED' && userId) await presenceCh.track({ user_id: userId }); });
    return () => { supabase.removeChannel(msgCh); supabase.removeChannel(presenceCh); };
  }, [channel, userId, supabase, enrich]);

  // ── Send ─────────────────────────────────────────────────────
  async function send() {
    const text = input.trim();
    if (!text || !userId || sending) return;
    setSending(true); setInput('');
    const payload: any = { user_id: userId, channel, content: text, likes: [] };
    if (replyTo) payload.reply_to_id = replyTo.id;
    const { error } = await supabase.from('community_messages').insert(payload);
    if (error) { setInput(text); console.error(error.message); }
    setReplyTo(null); setSending(false); inputRef.current?.focus();
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
    if (e.key === 'Escape') { setReplyTo(null); setRxnTarget(null); }
  }

  async function toggleLike(msg: Message) {
    if (!userId) return;
    const liked = msg.likes.includes(userId);
    const next = liked ? msg.likes.filter(id => id !== userId) : [...msg.likes, userId];
    setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, likes: next } : m));
    await supabase.from('community_messages').update({ likes: next }).eq('id', msg.id);
  }

  async function addReaction(msgId: string, emoji: string) {
    // Store reaction as a like with emoji prefix — simple approach
    setRxnTarget(null);
    const msg = messages.find(m => m.id === msgId);
    if (!msg || !userId) return;
    const tag = `${emoji}:${userId}`;
    const already = msg.likes.includes(tag);
    const next = already ? msg.likes.filter(l => l !== tag) : [...msg.likes, tag];
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, likes: next } : m));
    await supabase.from('community_messages').update({ likes: next }).eq('id', msgId);
  }

  async function deleteMsg(id: string) {
    await supabase.from('community_messages').update({ deleted: true }).eq('id', id).eq('user_id', userId!);
    setMessages(prev => prev.filter(m => m.id !== id));
  }

  function showHeader(i: number) {
    if (i === 0) return true;
    const p = messages[i-1], c = messages[i];
    if (p.user_id !== c.user_id) return true;
    return new Date(c.created_at).getTime() - new Date(p.created_at).getTime() > 5*60*1000;
  }

  function showDateDivider(i: number) {
    if (i === 0) return true;
    const p = new Date(messages[i-1].created_at), c = new Date(messages[i].created_at);
    return p.toDateString() !== c.toDateString();
  }

  // ── Reaction summary ─────────────────────────────────────────
  function getReactions(likes: string[]) {
    const counts: Record<string,{count:number;hasMe:boolean}> = {};
    for (const l of likes) {
      if (l.includes(':')) {
        const emoji = l.split(':')[0];
        const uid = l.split(':')[1];
        if (!counts[emoji]) counts[emoji] = { count: 0, hasMe: false };
        counts[emoji].count++;
        if (uid === userId) counts[emoji].hasMe = true;
      }
    }
    return Object.entries(counts);
  }

  function getLikeCount(likes: string[]) { return likes.filter(l => !l.includes(':')).length; }
  function iLiked(likes: string[]) { return userId ? likes.filter(l => !l.includes(':')).includes(userId) : false; }

  const currentCh = channels.find(c => c.slug === channel);

  // ── Channel selector helper ──────────────────────────────────
  function selectChannel(slug: string) {
    setChannel(slug);
    setMobileView('chat');
    setRxnTarget(null);
    setReplyTo(null);
  }

  // ════════════════════════════════════════════════════════════
  // SIDEBAR (shared between desktop + mobile channel view)
  // ════════════════════════════════════════════════════════════
  const Sidebar = (
    <div style={{ width: '100%', height: '100%', background: D.bg2, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Server name bar */}
      <div style={{ padding: '13px 16px', borderBottom: `1px solid ${D.bg1}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
        <span style={{ fontFamily: D.fontUI, fontSize: 15, fontWeight: 700, color: D.text0 }}>Ascentor</span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={D.text3} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
      </div>

      {/* Channel list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>

        {/* Navigation group — always shown */}
        <div>
          <button
            onClick={() => setCollapsed(c => ({ ...c, '__nav': !c['__nav'] }))}
            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px 4px 16px', width: '100%', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={D.text3} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ transform: collapsed['__nav'] ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}>
              <polyline points="6 9 12 15 18 9"/>
            </svg>
            <span style={{ fontFamily: D.fontMono, fontSize: 10, fontWeight: 700, color: D.text3, letterSpacing: '0.08em', textTransform: 'uppercase' as const }}>Navigation</span>
          </button>
          {!collapsed['__nav'] && NAV.map(item => (
            <Link key={item.href} href={item.href} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px 5px 14px', margin: '1px 4px', borderRadius: 4, textDecoration: 'none', color: D.text3 }}>
              <span style={{ color: D.text3, flexShrink: 0 }}>{item.icon}</span>
              <span style={{ fontFamily: D.fontUI, fontSize: 14, color: D.text3 }}>{item.label}</span>
            </Link>
          ))}
        </div>

        {/* Dynamic categories */}
        {categories.map(cat => {
          const catChannels = channels.filter(c => c.category_id === cat.id).sort((a,b) => a.sort_order - b.sort_order);
          if (!catChannels.length) return null;
          const isCollapsed = collapsed[cat.id];
          return (
            <div key={cat.id} style={{ marginTop: 8 }}>
              <button
                onClick={() => setCollapsed(c => ({ ...c, [cat.id]: !c[cat.id] }))}
                style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px 4px 16px', width: '100%', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={D.text3} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}>
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
                <span style={{ fontFamily: D.fontMono, fontSize: 10, fontWeight: 700, color: D.text3, letterSpacing: '0.08em', textTransform: 'uppercase' as const }}>{cat.name}</span>
              </button>
              {!isCollapsed && catChannels.map(ch => {
                const active = ch.slug === channel;
                return (
                  <button key={ch.slug} onClick={() => selectChannel(ch.slug)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px 5px 14px', margin: '1px 4px', borderRadius: 4, width: 'calc(100% - 8px)', background: active ? D.bg5 : 'none', border: 'none', cursor: 'pointer', textAlign: 'left' as const }}>
                    <span style={{ color: active ? D.text1 : D.text3, flexShrink: 0 }}>{getIcon(ch.slug)}</span>
                    <span style={{ fontFamily: D.fontUI, fontSize: 14, color: active ? D.text1 : D.text3, fontWeight: active ? 500 : 400 }}>{ch.name}</span>
                  </button>
                );
              })}
            </div>
          );
        })}

        {/* Uncategorised channels */}
        {(() => {
          const catIds = new Set(categories.map(c => c.id));
          const uncategorised = channels.filter(c => !c.category_id || !catIds.has(c.category_id));
          if (!uncategorised.length) return null;
          return (
            <div style={{ marginTop: 8 }}>
              <div style={{ padding: '4px 8px 4px 20px' }}>
                <span style={{ fontFamily: D.fontMono, fontSize: 10, fontWeight: 700, color: D.text3, letterSpacing: '0.08em', textTransform: 'uppercase' as const }}>Other</span>
              </div>
              {uncategorised.map(ch => {
                const active = ch.slug === channel;
                return (
                  <button key={ch.slug} onClick={() => selectChannel(ch.slug)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px 5px 14px', margin: '1px 4px', borderRadius: 4, width: 'calc(100% - 8px)', background: active ? D.bg5 : 'none', border: 'none', cursor: 'pointer', textAlign: 'left' as const }}>
                    <span style={{ color: active ? D.text1 : D.text3, flexShrink: 0 }}>{HashIcon}</span>
                    <span style={{ fontFamily: D.fontUI, fontSize: 14, color: active ? D.text1 : D.text3 }}>{ch.name}</span>
                  </button>
                );
              })}
            </div>
          );
        })()}
      </div>

      {/* User bar */}
      <div style={{ padding: '8px 10px', background: D.bg1, display: 'flex', alignItems: 'center', gap: 8 }}>
        <Avatar name={userName} size={30} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: D.fontUI, fontSize: 13, fontWeight: 600, color: D.text0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{userName}</div>
          <div style={{ fontFamily: D.fontMono, fontSize: 10, color: D.green, display: 'flex', alignItems: 'center', gap: 3 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: D.green }} /> Online
          </div>
        </div>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={D.text3} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M4.93 4.93a10 10 0 0 0 0 14.14"/></svg>
      </div>
    </div>
  );

  // ════════════════════════════════════════════════════════════
  // CHAT AREA
  // ════════════════════════════════════════════════════════════
  const ChatArea = (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: D.bg3, overflow: 'hidden', minWidth: 0 }}>
      {/* Topbar */}
      <div style={{ height: 48, borderBottom: `1px solid ${D.bg1}`, display: 'flex', alignItems: 'center', padding: '0 16px', gap: 10, flexShrink: 0, background: D.bg3 }}>
        {/* Mobile back */}
        <button className="mob-back-btn" onClick={() => setMobileView('channels')} style={{ display: 'none', background: 'none', border: 'none', color: D.text2, cursor: 'pointer', padding: '4px 6px 4px 0', marginRight: 2 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
        </button>
        <span style={{ color: D.text2, flexShrink: 0 }}>{getIcon(channel)}</span>
        <span style={{ fontFamily: D.fontUI, fontSize: 15, fontWeight: 700, color: D.text0 }}>{currentCh?.name || channel}</span>
        {currentCh?.description && (
          <><span style={{ color: D.bg5, userSelect: 'none' }}>│</span>
          <span style={{ fontFamily: D.fontUI, fontSize: 13, color: D.text3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{currentCh.description}</span></>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 14, color: D.text2, fontSize: 18 }}>
          <button style={{ background: 'none', border: 'none', color: D.text2, cursor: 'pointer' }} title="Search">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          </button>
          <span style={{ fontFamily: D.fontMono, fontSize: 12, color: D.text3, display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: D.green }} />{online}
          </span>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0 4px' }} onClick={() => setRxnTarget(null)}>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', gap: 10 }}>
            <div style={{ width: 22, height: 22, borderRadius: '50%', border: `2px solid ${D.bg5}`, borderTopColor: D.gold, animation: 'spin 0.7s linear infinite' }} />
            <span style={{ fontFamily: D.fontMono, fontSize: 11, color: D.text3 }}>Loading...</span>
          </div>
        ) : messages.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 10, padding: 40 }}>
            <div style={{ width: 60, height: 60, borderRadius: '50%', background: D.bg2, display: 'flex', alignItems: 'center', justifyContent: 'center', color: D.text3 }}>{getIcon(channel)}</div>
            <div style={{ fontFamily: D.fontUI, fontSize: 20, fontWeight: 700, color: D.text0 }}>Welcome to #{currentCh?.name || channel}!</div>
            <div style={{ fontFamily: D.fontUI, fontSize: 14, color: D.text3 }}>This is the start of the #{currentCh?.name || channel} channel. {currentCh?.description}</div>
          </div>
        ) : messages.map((msg, i) => {
          const header = showHeader(i);
          const dateDivider = showDateDivider(i);
          const liked = iLiked(msg.likes);
          const likeCount = getLikeCount(msg.likes);
          const reactions = getReactions(msg.likes);

          return (
            <React.Fragment key={msg.id}>
              {dateDivider && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 16px 8px', userSelect: 'none' }}>
                  <div style={{ flex: 1, height: '0.5px', background: D.bg5 }} />
                  <span style={{ fontFamily: D.fontMono, fontSize: 11, color: D.text3, padding: '0 4px' }}>{formatDate(msg.created_at)}</span>
                  <div style={{ flex: 1, height: '0.5px', background: D.bg5 }} />
                </div>
              )}
              <div
                className="msg-row"
                style={{ display: 'flex', gap: 12, padding: header ? '8px 16px 2px' : '1px 16px', alignItems: 'flex-start', position: 'relative', cursor: 'default' }}
              >
                <div style={{ width: 36, flexShrink: 0, paddingTop: header ? 2 : 0 }}>
                  {header && <Avatar name={msg.author_name} size={36} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {header && (
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 2 }}>
                      <span style={{ fontFamily: D.fontUI, fontSize: 14, fontWeight: 700, color: msg.is_own ? D.gold : avtColor(msg.author_name) }}>
                        {msg.is_own ? 'You' : msg.author_name}
                      </span>
                      <span style={{ fontFamily: D.fontMono, fontSize: 11, color: D.text3 }}>{formatTime(msg.created_at)}</span>
                    </div>
                  )}
                  {msg.reply_to_id && msg.reply_to_content && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <div style={{ width: 24, height: 12, borderTop: `2px solid ${D.bg5}`, borderLeft: `2px solid ${D.bg5}`, borderRadius: '4px 0 0 0', marginLeft: 12, flexShrink: 0 }} />
                      <Avatar name={msg.reply_to_author||'?'} size={14} />
                      <span style={{ fontFamily: D.fontMono, fontSize: 11, color: D.text3, flexShrink: 0 }}>{msg.reply_to_author}</span>
                      <span style={{ fontFamily: D.fontUI, fontSize: 12, color: D.text3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{msg.reply_to_content}</span>
                    </div>
                  )}
                  <p style={{ fontFamily: D.fontUI, fontSize: 14, color: D.text1, margin: 0, lineHeight: 1.5, wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>{msg.content}</p>
                  {/* Reactions */}
                  {(likeCount > 0 || reactions.length > 0) && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                      {likeCount > 0 && (
                        <button onClick={() => toggleLike(msg)} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 7px', borderRadius: 4, background: liked ? D.accentL : 'rgba(255,255,255,0.04)', border: `0.5px solid ${liked ? D.accent+'80' : 'rgba(255,255,255,0.08)'}`, cursor: 'pointer', fontFamily: D.fontMono, fontSize: 12, color: liked ? '#c9cdfb' : D.text2 }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill={liked ? D.accent : 'none'} stroke={liked ? D.accent : 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                          {likeCount}
                        </button>
                      )}
                      {reactions.map(([emoji, { count, hasMe }]) => (
                        <button key={emoji} onClick={() => addReaction(msg.id, emoji)} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 7px', borderRadius: 4, background: hasMe ? D.accentL : 'rgba(255,255,255,0.04)', border: `0.5px solid ${hasMe ? D.accent+'80' : 'rgba(255,255,255,0.08)'}`, cursor: 'pointer', fontFamily: D.fontMono, fontSize: 12, color: hasMe ? '#c9cdfb' : D.text2 }}>
                          {emoji} {count}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Hover actions */}
                <div className="msg-actions" style={{ position: 'absolute', right: 8, top: header ? 8 : 0, display: 'none', background: D.bg2, border: `0.5px solid ${D.bg1}`, borderRadius: 6, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.4)' }}>
                  <div style={{ display: 'flex' }}>
                    {/* React */}
                    <button onClick={(e) => { e.stopPropagation(); setRxnTarget(rxnTarget === msg.id ? null : msg.id); }} style={{ padding: '6px 8px', background: 'none', border: 'none', color: D.text2, cursor: 'pointer', display: 'flex', alignItems: 'center' }} title="Add reaction">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>
                    </button>
                    {/* Reply */}
                    <button onClick={() => { setReplyTo(msg); inputRef.current?.focus(); }} style={{ padding: '6px 8px', background: 'none', border: 'none', color: D.text2, cursor: 'pointer', display: 'flex', alignItems: 'center' }} title="Reply">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/></svg>
                    </button>
                    {/* Like */}
                    <button onClick={() => toggleLike(msg)} style={{ padding: '6px 8px', background: 'none', border: 'none', color: liked ? D.accent : D.text2, cursor: 'pointer', display: 'flex', alignItems: 'center' }} title="Like">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill={liked ? D.accent : 'none'} stroke={liked ? D.accent : 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                    </button>
                    {/* Delete own */}
                    {msg.is_own && (
                      <button onClick={() => deleteMsg(msg.id)} style={{ padding: '6px 8px', background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center' }} title="Delete">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                      </button>
                    )}
                  </div>
                  {/* Reaction picker inline */}
                  {rxnTarget === msg.id && (
                    <div style={{ display: 'flex', padding: '4px 6px', gap: 4, borderTop: `0.5px solid ${D.bg1}` }} onClick={e => e.stopPropagation()}>
                      {REACTIONS.map(emoji => (
                        <button key={emoji} onClick={() => addReaction(msg.id, emoji)} style={{ background: 'none', border: 'none', fontSize: 16, cursor: 'pointer', padding: '2px 3px', borderRadius: 4 }}>{emoji}</button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </React.Fragment>
          );
        })}
        <div ref={bottomRef} style={{ height: 8 }} />
      </div>

      {/* Input */}
      <div style={{ padding: '0 16px 16px', flexShrink: 0, background: D.bg3, paddingBottom: 'max(16px, env(safe-area-inset-bottom, 16px))' }}>
        {replyTo && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', marginBottom: 6, background: D.bg2, borderRadius: '8px 8px 0 0', borderBottom: `2px solid ${D.bg1}` }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={D.text3} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/></svg>
            <span style={{ fontFamily: D.fontMono, fontSize: 11, color: D.text3, flex: 1 }}>
              Replying to <span style={{ color: D.text1, fontWeight: 600 }}>{replyTo.is_own ? 'yourself' : replyTo.author_name}</span>
            </span>
            <button onClick={() => setReplyTo(null)} style={{ background: 'none', border: 'none', color: D.text3, cursor: 'pointer', lineHeight: 1 }}>✕</button>
          </div>
        )}
        {!userId ? (
          <div style={{ background: D.bg4, borderRadius: 8, padding: '12px 16px', fontFamily: D.fontUI, fontSize: 13, color: D.text3, textAlign: 'center' }}>
            Sign in to chat
          </div>
        ) : (
          <div style={{ background: D.bg4, borderRadius: replyTo ? '0 0 8px 8px' : 8, display: 'flex', alignItems: 'flex-end', gap: 8, padding: '10px 14px' }}>
            <button style={{ background: 'none', border: 'none', color: D.text3, cursor: 'pointer', flexShrink: 0, lineHeight: 1 }} title="Attach">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
            </button>
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={onKey}
              placeholder={`Message #${currentCh?.name || channel}`}
              rows={1}
              maxLength={2000}
              style={{ flex: 1, background: 'none', border: 'none', outline: 'none', resize: 'none', fontFamily: D.fontUI, fontSize: 14, color: D.text0, lineHeight: 1.5, minHeight: 22, maxHeight: 120, padding: 0 }}
            />
            <button style={{ background: 'none', border: 'none', color: D.text3, cursor: 'pointer', flexShrink: 0, lineHeight: 1 }} title="Emoji">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>
            </button>
            {input.trim() ? (
              <button onClick={send} disabled={sending} style={{ background: 'none', border: 'none', color: D.gold, cursor: 'pointer', flexShrink: 0, lineHeight: 1 }} title="Send">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
              </button>
            ) : (
              <button style={{ background: 'none', border: 'none', color: D.text3, cursor: 'pointer', flexShrink: 0, lineHeight: 1 }} title="Voice message">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
              </button>
            )}
          </div>
        )}
        <div style={{ fontFamily: D.fontMono, fontSize: 9, color: D.text3, marginTop: 4, textAlign: 'right', letterSpacing: '0.04em' }}>
          Enter to send · Shift+Enter for new line
        </div>
      </div>
    </div>
  );

  // ════════════════════════════════════════════════════════════
  return (
    <div style={{ display: 'flex', height: '100dvh', overflow: 'hidden', background: D.bg3 }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .msg-row:hover { background: rgba(0,0,0,0.07); }
        .msg-row:hover .msg-actions { display: block !important; }

        /* Desktop layout */
        .desktop-nav   { display: flex; }
        .desktop-sidebar { display: flex; width: 230px; flex-shrink: 0; }
        .mobile-view   { display: none !important; }
        .mob-back-btn  { display: none !important; }

        @media (max-width: 640px) {
          .desktop-nav    { display: none !important; }
          .desktop-sidebar { display: none !important; }
          .mob-back-btn   { display: flex !important; }
        }

        textarea::placeholder { color: ${D.text4}; }
        textarea { color-scheme: dark; }
        ::-webkit-scrollbar { width: 4px; background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.06); border-radius: 4px; }
      `}</style>

      {/* ── Desktop: icon nav strip ── */}
      <div className="desktop-nav" style={{ width: 60, background: D.bg0, flexDirection: 'column', alignItems: 'center', padding: '10px 0', flexShrink: 0, borderRight: `1px solid ${D.bg1}` }}>
        {/* Ascentor logo */}
        <div style={{ width: 40, height: 40, borderRadius: '30%', background: D.gold, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 6, flexShrink: 0 }}>
          <span style={{ fontFamily: D.fontUI, fontSize: 14, fontWeight: 800, color: '#0C0B08' }}>A</span>
        </div>
        <div style={{ width: 28, height: 1, background: D.bg2, margin: '4px 0 6px' }} />
        {NAV.map(item => {
          const active = item.href === '/community';
          return (
            <Link key={item.href} href={item.href} title={item.label} style={{ width: 40, height: 40, borderRadius: active ? '30%' : '50%', background: active ? D.gold : D.bg2, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', color: active ? '#0C0B08' : D.text3, margin: '3px 0', transition: 'border-radius 0.2s, background 0.2s', gap: 2 }}>
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{item.icon}</span>
              <span style={{ fontFamily: D.fontMono, fontSize: 7, letterSpacing: '0.04em', textTransform: 'uppercase' as const, fontWeight: 500, lineHeight: 1 }}>{item.label}</span>
            </Link>
          );
        })}
      </div>

      {/* ── Desktop: channel sidebar ── */}
      <div className="desktop-sidebar">
        {Sidebar}
      </div>

      {/* ── Desktop: chat ── */}
      <div className="desktop-chat" style={{ flex: 1, display: 'flex', overflow: 'hidden', minWidth: 0 }}>
        {ChatArea}
      </div>

      {/* ── Mobile: channel list screen ── */}
      <div style={{ display: mobileView === 'channels' ? 'flex' : 'none', flexDirection: 'column', flex: 1, overflow: 'hidden' }} className="mobile-channel-view">
        <style>{`
          @media (max-width: 640px) {
            .mobile-channel-view { display: ${mobileView === 'channels' ? 'flex' : 'none'} !important; }
            .mobile-chat-view    { display: ${mobileView === 'chat'     ? 'flex' : 'none'} !important; }
            .desktop-chat        { display: none !important; }
          }
        `}</style>
        <div style={{ flex: 1, overflow: 'hidden' }}>{Sidebar}</div>
        {/* Mobile bottom nav */}
        <div style={{ background: D.bg1, borderTop: `1px solid ${D.bg0}`, display: 'flex', justifyContent: 'space-around', padding: '6px 0 10px', flexShrink: 0, paddingBottom: 'max(10px, env(safe-area-inset-bottom, 10px))' }}>
          {NAV.map(item => {
            const active = item.href === '/community';
            return (
              <Link key={item.href} href={item.href} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: '4px 10px', textDecoration: 'none', color: active ? D.gold : D.text3 }}>
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{item.icon}</span>
                <span style={{ fontFamily: D.fontMono, fontSize: 8, letterSpacing: '0.06em', textTransform: 'uppercase' as const, fontWeight: active ? 600 : 400 }}>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* ── Mobile: chat screen ── */}
      <div style={{ display: mobileView === 'chat' ? 'flex' : 'none', flex: 1, flexDirection: 'column', overflow: 'hidden' }} className="mobile-chat-view">
        {ChatArea}
        {/* Mobile bottom nav (in chat too) */}
        <div style={{ background: D.bg1, borderTop: `1px solid ${D.bg0}`, display: 'flex', justifyContent: 'space-around', padding: '6px 0 10px', flexShrink: 0, paddingBottom: 'max(10px, env(safe-area-inset-bottom, 10px))' }}>
          {NAV.map(item => {
            const active = item.href === '/community';
            return (
              <Link key={item.href} href={item.href} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: '4px 10px', textDecoration: 'none', color: active ? D.gold : D.text3 }}>
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{item.icon}</span>
                <span style={{ fontFamily: D.fontMono, fontSize: 8, letterSpacing: '0.06em', textTransform: 'uppercase' as const, fontWeight: active ? 600 : 400 }}>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
