'use client';
// app/admin/community/page.tsx
// Admin: Full community chat management
// - Browse all channels, read all messages
// - Delete any message
// - Pin messages (sets pinned=true on DB)
// - Broadcast a message as "Ascentor" system user
// - Filter by channel, search content, date range

import { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';

interface Channel  { slug: string; name: string; description: string; category_id: string | null; }
interface Category { id: string; name: string; }
interface CMsg {
  id: string; user_id: string; content: string; created_at: string;
  channel: string; deleted: boolean; likes: string[];
  author_name?: string; author_email?: string;
  reply_to_id?: string | null; pinned?: boolean;
}

const G = '#E8A020';
const mono: React.CSSProperties = { fontFamily:"'DM Mono',monospace", fontSize:10, letterSpacing:'0.09em', textTransform:'uppercase' as const, color:'var(--admin-text-faint)' };
const card: React.CSSProperties = { background:'var(--admin-bg-deep)', border:'1px solid var(--admin-bg-input)', borderRadius:12 };
const inp: React.CSSProperties  = { padding:'9px 13px', borderRadius:8, border:'1px solid var(--admin-bg-input)', background:'var(--admin-bg-card)', color:'var(--admin-text)', fontSize:13, fontFamily:"'Syne',sans-serif", outline:'none' };

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('en-US', { month:'short', day:'numeric', hour:'numeric', minute:'2-digit', hour12:true });
}
function isVoice(c: string) { return c.startsWith('[voice:'); }

export default function AdminCommunityPage() {
  const supabase = createClient();
  const [categories,  setCategories]  = useState<Category[]>([]);
  const [channels,    setChannels]    = useState<Channel[]>([]);
  const [channel,     setChannel]     = useState('general');
  const [messages,    setMessages]    = useState<CMsg[]>([]);
  const [loading,     setLoading]     = useState(false);
  const [search,      setSearch]      = useState('');
  const [showDeleted, setShowDeleted] = useState(false);
  const [broadcast,   setBroadcast]   = useState('');
  const [sending,     setSending]     = useState(false);
  const [toast,       setToast]       = useState('');
  const [adminId,     setAdminId]     = useState<string|null>(null);
  const [adminName,   setAdminName]   = useState('Admin');
  const bottomRef = useRef<HTMLDivElement>(null);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  useEffect(() => {
    (async () => {
      const { data:{ user } } = await supabase.auth.getUser();
      if (!user) return;
      setAdminId(user.id);
      const { data: p } = await supabase.from('profiles').select('full_name').eq('id', user.id).single();
      setAdminName(p?.full_name || 'Admin');
    })();
    loadStructure();
  }, []); // eslint-disable-line

  async function loadStructure() {
    const [catRes, chRes] = await Promise.all([
      supabase.from('community_categories').select('id,name').order('sort_order'),
      supabase.from('community_channels').select('slug,name,description,category_id').order('sort_order'),
    ]);
    setCategories(catRes.data || []);
    setChannels(chRes.data || []);
  }

  const loadMessages = useCallback(async () => {
    setLoading(true);
    let q = supabase
      .from('community_messages')
      .select('id,user_id,content,created_at,channel,deleted,likes,reply_to_id,pinned')
      .eq('channel', channel)
      .order('created_at', { ascending: true })
      .limit(200);
    if (!showDeleted) q = q.eq('deleted', false);
    const { data } = await q;
    const msgs = data || [];

    // Enrich with author names
    const userIds = [...new Set(msgs.map(m => m.user_id))];
    if (userIds.length) {
      const { data: profiles } = await supabase.from('profiles').select('id,full_name,email').in('id', userIds);
      const pm: Record<string, { name: string; email: string }> = {};
      (profiles || []).forEach((p: any) => { pm[p.id] = { name: p.full_name || 'Unknown', email: p.email || '' }; });
      setMessages(msgs.map(m => ({
        ...m,
        author_name: pm[m.user_id]?.name || 'Unknown',
        author_email: pm[m.user_id]?.email || '',
      })));
    } else {
      setMessages(msgs);
    }
    setLoading(false);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior:'smooth' }), 60);
  }, [channel, showDeleted, supabase]);

  useEffect(() => { loadMessages(); }, [loadMessages]);

  async function deleteMsg(id: string) {
    await supabase.from('community_messages').update({ deleted: true }).eq('id', id);
    setMessages(prev => showDeleted
      ? prev.map(m => m.id === id ? { ...m, deleted: true } : m)
      : prev.filter(m => m.id !== id)
    );
    showToast('Message deleted');
  }

  async function restoreMsg(id: string) {
    await supabase.from('community_messages').update({ deleted: false }).eq('id', id);
    setMessages(prev => prev.map(m => m.id === id ? { ...m, deleted: false } : m));
    showToast('Message restored');
  }

  async function pinMsg(id: string, pinned: boolean) {
    await supabase.from('community_messages').update({ pinned: !pinned }).eq('id', id);
    setMessages(prev => prev.map(m => m.id === id ? { ...m, pinned: !pinned } : m));
    showToast(pinned ? 'Unpinned' : 'Message pinned');
  }

  async function sendBroadcast() {
    if (!broadcast.trim() || !adminId) return;
    setSending(true);
    const { error } = await supabase.from('community_messages').insert({
      user_id: adminId, channel, content: `📣 ${broadcast.trim()}`, likes: [],
    });
    if (error) { showToast('Failed: ' + error.message); }
    else { showToast('Broadcast sent'); setBroadcast(''); loadMessages(); }
    setSending(false);
  }

  const filtered = messages.filter(m =>
    !search || m.content.toLowerCase().includes(search.toLowerCase()) ||
    m.author_name?.toLowerCase().includes(search.toLowerCase())
  );

  const currentCh = channels.find(c => c.slug === channel);

  return (
    <div style={{ maxWidth:1400, margin:'0 auto' }}>
      <style>{`
        @keyframes asc-spin { to { transform:rotate(360deg); } }
        .asc-input:focus { border-color:${G} !important; }
        .msg-row:hover .msg-actions { opacity:1 !important; }
        .ch-btn:hover { background:var(--admin-bg-input) !important; }
        * { box-sizing:border-box; }
      `}</style>

      {/* Toast */}
      {toast && (
        <div style={{ position:'fixed', top:20, right:20, zIndex:9999, background:G, color:'#0C0B08', padding:'10px 20px', borderRadius:10, fontFamily:"'DM Mono',monospace", fontSize:12, fontWeight:600, boxShadow:'0 4px 20px rgba(0,0,0,0.4)', animation:'none' }}>
          {toast}
        </div>
      )}

      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-end', marginBottom:28, flexWrap:'wrap', gap:12 }}>
        <div>
          <h1 style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:28, fontWeight:700, color:'var(--admin-text-heading)', margin:0, marginBottom:6 }}>
            Community Management
          </h1>
          <p style={{ ...mono }}>Monitor, moderate, and broadcast across all channels</p>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <label style={{ ...mono, cursor:'pointer', display:'flex', alignItems:'center', gap:6 }}>
            <input type="checkbox" checked={showDeleted} onChange={e => setShowDeleted(e.target.checked)} style={{ accentColor:G }} />
            Show deleted
          </label>
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'240px 1fr', gap:20, minHeight:600 }}>

        {/* ── CHANNEL SIDEBAR ──────────────────────────────────────────────── */}
        <div style={{ ...card, padding:'14px 0', display:'flex', flexDirection:'column', height:'fit-content', position:'sticky', top:20 }}>
          <div style={{ padding:'0 14px 10px', borderBottom:'1px solid var(--admin-bg-input)' }}>
            <span style={{ ...mono }}>Channels</span>
          </div>
          <div style={{ overflowY:'auto', flex:1 }}>
            {categories.map(cat => {
              const catChs = channels.filter(c => c.category_id === cat.id);
              if (!catChs.length) return null;
              return (
                <div key={cat.id} style={{ marginTop:10 }}>
                  <div style={{ padding:'2px 14px 6px', ...mono }}>{cat.name}</div>
                  {catChs.map(ch => {
                    const active = ch.slug === channel;
                    return (
                      <button key={ch.slug} className="ch-btn" onClick={() => setChannel(ch.slug)}
                        style={{ display:'flex', alignItems:'center', gap:8, width:'100%', padding:'7px 14px', background:active ? 'rgba(232,160,32,0.1)' : 'transparent', border:'none', borderLeft:`3px solid ${active ? G : 'transparent'}`, cursor:'pointer', textAlign:'left' }}>
                        <span style={{ fontFamily:"'Syne',sans-serif", fontSize:13, color:active ? G : 'var(--admin-text-muted)', fontWeight:active ? 600 : 400 }}>
                          #{ch.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              );
            })}
            {/* Uncategorised */}
            {channels.filter(c => !c.category_id).map(ch => {
              const active = ch.slug === channel;
              return (
                <button key={ch.slug} className="ch-btn" onClick={() => setChannel(ch.slug)}
                  style={{ display:'flex', alignItems:'center', gap:8, width:'100%', padding:'7px 14px', background:active ? 'rgba(232,160,32,0.1)' : 'transparent', border:'none', borderLeft:`3px solid ${active ? G : 'transparent'}`, cursor:'pointer', textAlign:'left' }}>
                  <span style={{ fontFamily:"'Syne',sans-serif", fontSize:13, color:active ? G : 'var(--admin-text-muted)', fontWeight:active ? 600 : 400 }}>
                    #{ch.name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── MAIN AREA ────────────────────────────────────────────────────── */}
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>

          {/* Channel header + search */}
          <div style={{ display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
            <div style={{ flex:1 }}>
              <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:18, color:'var(--admin-text-heading)' }}>
                #{currentCh?.name || channel}
              </div>
              {currentCh?.description && (
                <div style={{ fontFamily:"'Syne',sans-serif", fontSize:12, color:'var(--admin-text-faint)', marginTop:2 }}>{currentCh.description}</div>
              )}
            </div>
            <input type="text" placeholder="Search messages..." value={search} onChange={e => setSearch(e.target.value)}
              className="asc-input" style={{ ...inp, width:220 }} />
            <button onClick={loadMessages} style={{ ...inp, cursor:'pointer', color:'var(--admin-text-muted)', whiteSpace:'nowrap' }}>↻ Refresh</button>
          </div>

          {/* Messages */}
          <div style={{ ...card, flex:1, overflow:'hidden', display:'flex', flexDirection:'column' }}>
            <div style={{ flex:1, overflowY:'auto', padding:'8px 0', minHeight:400, maxHeight:560 }}>
              {loading ? (
                <div style={{ padding:40, textAlign:'center' }}>
                  <div style={{ width:28, height:28, borderRadius:'50%', border:'2px solid var(--admin-bg-input)', borderTopColor:G, animation:'asc-spin 0.8s linear infinite', margin:'0 auto 10px' }} />
                  <span style={{ ...mono }}>Loading messages…</span>
                </div>
              ) : filtered.length === 0 ? (
                <div style={{ padding:40, textAlign:'center', ...mono }}>No messages in #{channel}</div>
              ) : filtered.map(msg => (
                <div key={msg.id} className="msg-row" style={{ display:'flex', gap:10, padding:'8px 16px', alignItems:'flex-start', opacity:msg.deleted ? 0.45 : 1, background:msg.pinned ? 'rgba(232,160,32,0.04)' : 'transparent', borderLeft:msg.pinned ? `3px solid ${G}` : '3px solid transparent' }}>
                  {/* Avatar */}
                  <div style={{ width:32, height:32, borderRadius:'50%', background:'var(--admin-bg-card)', border:'1px solid var(--admin-bg-input)', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:"'DM Mono',monospace", fontSize:12, fontWeight:600, color:G }}>
                    {(msg.author_name || 'U')[0].toUpperCase()}
                  </div>
                  {/* Content */}
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:'flex', alignItems:'baseline', gap:8, marginBottom:3 }}>
                      <span style={{ fontFamily:"'Syne',sans-serif", fontSize:13, fontWeight:700, color:'var(--admin-text)' }}>{msg.author_name}</span>
                      <span style={{ fontFamily:"'DM Mono',monospace", fontSize:10, color:'var(--admin-text-faint)' }}>{msg.author_email}</span>
                      <span style={{ fontFamily:"'DM Mono',monospace", fontSize:10, color:'var(--admin-text-faint)', marginLeft:'auto' }}>{fmtDate(msg.created_at)}</span>
                    </div>
                    {msg.deleted && <span style={{ ...mono, color:'#EF4444', fontSize:9, marginBottom:3, display:'block' }}>DELETED</span>}
                    {msg.pinned  && <span style={{ ...mono, color:G, fontSize:9, marginBottom:3, display:'block' }}>📌 PINNED</span>}
                    <p style={{ fontFamily:"'Syne',sans-serif", fontSize:13, color:'var(--admin-text-muted)', margin:0, lineHeight:1.6, wordBreak:'break-word' }}>
                      {isVoice(msg.content) ? '🎙 Voice message' : msg.content}
                    </p>
                    {msg.likes.length > 0 && (
                      <div style={{ ...mono, fontSize:10, marginTop:4, color:'var(--admin-text-faint)' }}>
                        {msg.likes.length} reaction{msg.likes.length !== 1 ? 's' : ''}
                      </div>
                    )}
                  </div>
                  {/* Actions — visible on hover */}
                  <div className="msg-actions" style={{ opacity:0, transition:'opacity 0.15s', display:'flex', gap:4, flexShrink:0 }}>
                    <button onClick={() => pinMsg(msg.id, !!msg.pinned)}
                      title={msg.pinned ? 'Unpin' : 'Pin'}
                      style={{ padding:'4px 8px', borderRadius:6, border:'1px solid var(--admin-bg-input)', background:'transparent', color:msg.pinned ? G : 'var(--admin-text-faint)', cursor:'pointer', fontSize:12 }}>
                      📌
                    </button>
                    {msg.deleted ? (
                      <button onClick={() => restoreMsg(msg.id)}
                        style={{ padding:'4px 10px', borderRadius:6, border:'1px solid rgba(20,184,166,0.3)', background:'rgba(20,184,166,0.08)', color:'#14B8A6', cursor:'pointer', fontSize:11, fontFamily:"'DM Mono',monospace" }}>
                        Restore
                      </button>
                    ) : (
                      <button onClick={() => { if (confirm('Delete this message?')) deleteMsg(msg.id); }}
                        style={{ padding:'4px 10px', borderRadius:6, border:'1px solid rgba(239,68,68,0.3)', background:'rgba(239,68,68,0.06)', color:'#EF4444', cursor:'pointer', fontSize:11, fontFamily:"'DM Mono',monospace" }}>
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>

            {/* Broadcast bar */}
            <div style={{ padding:'12px 16px', borderTop:'1px solid var(--admin-bg-input)', display:'flex', gap:8 }}>
              <div style={{ ...mono, fontSize:9, color:G, alignSelf:'center', whiteSpace:'nowrap', flexShrink:0 }}>📣 BROADCAST</div>
              <input
                type="text"
                placeholder={`Send a system message to #${currentCh?.name || channel}…`}
                value={broadcast}
                onChange={e => setBroadcast(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) sendBroadcast(); }}
                className="asc-input"
                style={{ ...inp, flex:1, fontSize:13 }}
              />
              <button onClick={sendBroadcast} disabled={sending || !broadcast.trim()}
                style={{ padding:'9px 18px', borderRadius:8, background:G, border:'none', color:'#0C0B08', fontFamily:"'DM Mono',monospace", fontSize:12, fontWeight:700, cursor:broadcast.trim() ? 'pointer' : 'default', opacity:broadcast.trim() ? 1 : 0.4 }}>
                {sending ? '…' : 'Send'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
