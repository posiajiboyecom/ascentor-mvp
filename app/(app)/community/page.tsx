'use client';

// app/(app)/community/page.tsx — v3
// Desktop: icon strip | channel sidebar (categorised) | chat
// Mobile:  full-screen chat + bottom nav + bottom sheet for channels
// Colors:  Concept B (Ascentor premium dark — gold accents)
// Fixes:   realtime reactions desktop, no nav in sidebar,
//          no double screen, bottom sheet pattern, mic/emoji working

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';

// ── Ascentor Premium Dark tokens ────────────────────────────
const D = {
  bg0:     'var(--app-bg, var(--bg))',                    // page / icon rail
  bg1:     'var(--app-bg-card, var(--bg-card))',          // sidebar
  bg2:     'var(--app-bg-input, var(--bg-input))',        // hover / input bg
  bg3:     'var(--app-bg, var(--bg))',                    // chat area
  bg4:     'var(--app-bg-input, var(--bg-input))',        // message input box
  bg5:     'var(--app-bg-input, var(--bg-input))',        // active channel bg
  text0:   'var(--app-text, var(--text))',                // primary
  text1:   'var(--app-text, var(--text))',                // secondary
  text2:   'var(--app-text-muted, var(--text-muted))',    // muted
  text3:   'var(--app-text-dim, var(--text-dim, #888))',  // dimmer
  text4:   'var(--app-text-dim, var(--text-dim, #888))',  // placeholder
  gold:    'var(--app-accent, #E8A020)',                  // accent
  goldB:   'rgba(232,160,32,0.20)',
  goldBg:  'rgba(232,160,32,0.06)',
  green:   '#22C55E',
  red:     '#EF4444',
  border:  'var(--app-border, var(--border))',
  fontUI:  "'Syne', system-ui, sans-serif",
  fontMono:"'DM Mono', monospace",
  fontDisp:"'Cormorant Garamond', Georgia, serif",
};

// Nav items
const NAV = [
  { href: '/dashboard', label: 'Home',     icon: <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z"/><path d="M9 21V12h6v9"/></svg> },
  { href: '/coach',     label: 'Mentor',   icon: <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg> },
  { href: '/experts',   label: 'Sessions', icon: <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="7" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M2 21v-1a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v1"/><path d="M18 14a3 3 0 0 1 3 3v1"/></svg> },
  { href: '/community', label: 'Circle',   icon: <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><circle cx="9" cy="10" r="1.2"/><circle cx="15" cy="10" r="1.2"/></svg> },
  { href: '/learn',     label: 'Learn',    icon: <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg> },
];

// Channel icons
const ICONS: Record<string, React.ReactElement> = {
  general:        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
  introductions:  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  'career-wins':  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2z"/></svg>,
  accountability: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>,
  'industry-talk':<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>,
  'cv-review':    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
  opportunities:  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>,
};
const Hash = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/><line x1="10" y1="3" x2="8" y2="21"/><line x1="16" y1="3" x2="14" y2="21"/></svg>;
const getIcon = (slug: string) => ICONS[slug] || Hash;

const REACTIONS = ['❤️','👍','🔥','👏','😮','💯'];

// Types
interface Category { id: string; name: string; sort_order: number; }
interface Channel  { slug: string; name: string; description: string; sort_order: number; category_id: string|null; }
interface Message  {
  id: string; user_id: string; content: string; created_at: string;
  channel: string; author_name: string; is_own: boolean;
  likes: string[]; reply_to_id?: string;
  reply_to_content?: string; reply_to_author?: string;
}

function initials(n: string) { return n.split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2)||'?'; }
function fmtTime(iso: string) {
  const d=new Date(iso), now=new Date();
  return d.toDateString()===now.toDateString()
    ? d.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})
    : d.toLocaleDateString([],{month:'short',day:'numeric'});
}
function fmtDate(iso: string) {
  const d=new Date(iso), now=new Date();
  if(d.toDateString()===now.toDateString()) return 'Today';
  const y=new Date(now); y.setDate(y.getDate()-1);
  if(d.toDateString()===y.toDateString()) return 'Yesterday';
  return d.toLocaleDateString([],{month:'long',day:'numeric'});
}
const AVT_COLORS=['#E8A020','#14B8A6','#8B5CF6','#3B82F6','#ec4899','#f97316'];
const avtColor=(n:string)=>AVT_COLORS[n.split('').reduce((a,c)=>a+c.charCodeAt(0),0)%AVT_COLORS.length];

function Avatar({name,size=34}:{name:string;size?:number}){
  const c=avtColor(name);
  return <div style={{width:size,height:size,borderRadius:'50%',flexShrink:0,background:`${c}18`,border:`1.5px solid ${c}40`,display:'flex',alignItems:'center',justifyContent:'center',fontFamily:D.fontMono,fontSize:size*0.3,fontWeight:700,color:c}}>{initials(name)}</div>;
}

// ══════════════════════════════════════════════════════════════
export default function CommunityPage() {
  const supabase = useRef(createClient()).current;

  const [userId,      setUserId]      = useState<string|null>(null);
  const [userName,    setUserName]    = useState('Member');
  const [categories,  setCategories]  = useState<Category[]>([]);
  const [channels,    setChannels]    = useState<Channel[]>([]);
  const [collapsed,   setCollapsed]   = useState<Record<string,boolean>>({});
  const [channel,     setChannel]     = useState('general');
  const [messages,    setMessages]    = useState<Message[]>([]);
  const [input,       setInput]       = useState('');
  const [sending,     setSending]     = useState(false);
  const [loading,     setLoading]     = useState(true);
  const [online,      setOnline]      = useState(1);
  const [replyTo,     setReplyTo]     = useState<Message|null>(null);
  const [rxnTarget,   setRxnTarget]   = useState<string|null>(null);
  const [sheetOpen,   setSheetOpen]   = useState(false);  // mobile channel sheet
  const [longPressMsg,setLongPressMsg]= useState<Message|null>(null); // mobile long-press
  const [recording,   setRecording]   = useState(false);
  const [recSeconds,  setRecSeconds]  = useState(0);

  const bottomRef    = useRef<HTMLDivElement>(null);
  const inputRef     = useRef<HTMLTextAreaElement>(null);
  const profileMap   = useRef<Record<string,string>>({});
  const longPressTimer = useRef<ReturnType<typeof setTimeout>|null>(null);
  const mediaRec     = useRef<MediaRecorder|null>(null);
  const recTimer     = useRef<ReturnType<typeof setInterval>|null>(null);

  // ── Load user ────────────────────────────────────────────────
  useEffect(()=>{
    (async()=>{
      const{data:{user}}=await supabase.auth.getUser();
      if(!user)return;
      setUserId(user.id);
      const{data:p}=await supabase.from('profiles').select('full_name').eq('id',user.id).single();
      const name=p?.full_name||user.email?.split('@')[0]||'Member';
      setUserName(name); profileMap.current[user.id]=name;
    })();
  },[supabase]);

  // ── Load categories + channels ───────────────────────────────
  const loadStructure=useCallback(async()=>{
    const[catRes,chRes]=await Promise.all([
      supabase.from('community_categories').select('*').order('sort_order'),
      supabase.from('community_channels').select('slug,name,description,sort_order,category_id').order('sort_order'),
    ]);
    setCategories(catRes.data||[]);
    setChannels(chRes.data||[]);
  },[supabase]);

  useEffect(()=>{loadStructure();},[loadStructure]);

  // Realtime structure
  useEffect(()=>{
    const sub=supabase.channel('structure-watch')
      .on('postgres_changes',{event:'*',schema:'public',table:'community_channels'},loadStructure)
      .on('postgres_changes',{event:'*',schema:'public',table:'community_categories'},loadStructure)
      .subscribe();
    return()=>{supabase.removeChannel(sub);};
  },[supabase,loadStructure]);

  // ── Enrich messages ──────────────────────────────────────────
  const enrich=useCallback(async(raw:any[],uid:string|null):Promise<Message[]>=>{
    const unknownIds=[...new Set(raw.map(m=>m.user_id))].filter(id=>!profileMap.current[id]);
    if(unknownIds.length){
      const{data}=await supabase.from('profiles').select('id,full_name').in('id',unknownIds);
      (data||[]).forEach((p:any)=>{profileMap.current[p.id]=p.full_name||'Member';});
    }
    const replyIds=[...new Set(raw.filter(m=>m.reply_to_id).map(m=>m.reply_to_id))];
    const replyMap:Record<string,{content:string;author:string}>={};
    if(replyIds.length){
      const{data}=await supabase.from('community_messages').select('id,content,user_id').in('id',replyIds);
      (data||[]).forEach((r:any)=>{replyMap[r.id]={content:r.content,author:profileMap.current[r.user_id]||'Member'};});
    }
    return raw.map(m=>({
      ...m,
      author_name:profileMap.current[m.user_id]||'Member',
      is_own:m.user_id===uid,
      likes:m.likes||[],
      reply_to_content:m.reply_to_id?replyMap[m.reply_to_id]?.content:undefined,
      reply_to_author:m.reply_to_id?replyMap[m.reply_to_id]?.author:undefined,
    }));
  },[supabase]);

  // ── Load messages ────────────────────────────────────────────
  const loadMessages=useCallback(async(ch:string,uid:string|null)=>{
    setLoading(true);
    const{data}=await supabase.from('community_messages')
      .select('id,user_id,content,created_at,channel,likes,reply_to_id')
      .eq('channel',ch).eq('deleted',false)
      .order('created_at',{ascending:true}).limit(100);
    setMessages(await enrich(data||[],uid));
    setLoading(false);
    setTimeout(()=>bottomRef.current?.scrollIntoView({behavior:'smooth'}),60);
  },[supabase,enrich]);

  useEffect(()=>{loadMessages(channel,userId);},[channel,userId,loadMessages]);

  // ── Realtime messages + reactions ────────────────────────────
  useEffect(()=>{
    // Use a single channel for both INSERT and UPDATE to avoid filter issues
    const rt=supabase.channel(`chat:${channel}`)
      .on('postgres_changes',{
        event:'INSERT',schema:'public',table:'community_messages',
        filter:`channel=eq.${channel}`,
      },async(payload:any)=>{
        if(payload.new.deleted)return;
        const[enriched]=await enrich([payload.new],userId);
        setMessages(prev=>prev.some(m=>m.id===enriched.id)?prev:[...prev,enriched]);
        setTimeout(()=>bottomRef.current?.scrollIntoView({behavior:'smooth'}),60);
      })
      .on('postgres_changes',{
        event:'UPDATE',schema:'public',table:'community_messages',
        filter:`channel=eq.${channel}`,
      },(payload:any)=>{
        const u=payload.new;
        if(u.deleted){
          setMessages(prev=>prev.filter(m=>m.id!==u.id));
        } else {
          // Update likes immediately — no enrichment needed
          setMessages(prev=>prev.map(m=>m.id===u.id?{...m,likes:u.likes||[]}:m));
        }
      })
      .subscribe();

    // Presence
    const presenceCh=supabase.channel(`presence:${channel}`);
    presenceCh
      .on('presence',{event:'sync'},()=>{
        const state=presenceCh.presenceState();
        setOnline(Math.max(Object.keys(state).length,1));
      })
      .subscribe(async(status)=>{
        if(status==='SUBSCRIBED'&&userId){
          await presenceCh.track({user_id:userId,at:Date.now()});
        }
      });

    return()=>{
      supabase.removeChannel(rt);
      supabase.removeChannel(presenceCh);
    };
  },[channel,userId,supabase,enrich]);

  // ── Send message ─────────────────────────────────────────────
  async function send(){
    const text=input.trim();
    if(!text||!userId||sending)return;
    setSending(true); setInput('');
    const payload:any={user_id:userId,channel,content:text,likes:[]};
    if(replyTo)payload.reply_to_id=replyTo.id;
    const{error}=await supabase.from('community_messages').insert(payload);
    if(error){setInput(text);console.error(error.message);}
    setReplyTo(null); setSending(false); inputRef.current?.focus();
  }

  function onKey(e:React.KeyboardEvent){
    if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send();}
    if(e.key==='Escape'){setReplyTo(null);setRxnTarget(null);setLongPressMsg(null);}
  }

  // ── Like ─────────────────────────────────────────────────────
  async function toggleLike(msg:Message){
    if(!userId)return;
    const liked=getLikeIds(msg.likes).includes(userId);
    const next=liked
      ? msg.likes.filter(l=>!l.includes(':')||l.split(':')[1]!==userId).filter(l=>l!==userId)
      : [...msg.likes,userId];
    // Optimistic
    setMessages(prev=>prev.map(m=>m.id===msg.id?{...m,likes:next}:m));
    await supabase.from('community_messages').update({likes:next}).eq('id',msg.id);
  }

  async function addReaction(msgId:string,emoji:string){
    if(!userId)return;
    setRxnTarget(null); setLongPressMsg(null);
    const msg=messages.find(m=>m.id===msgId);
    if(!msg)return;
    const tag=`${emoji}:${userId}`;
    const already=msg.likes.includes(tag);
    const next=already?msg.likes.filter(l=>l!==tag):[...msg.likes,tag];
    setMessages(prev=>prev.map(m=>m.id===msgId?{...m,likes:next}:m));
    await supabase.from('community_messages').update({likes:next}).eq('id',msgId);
  }

  async function deleteMsg(id:string){
    setLongPressMsg(null);
    await supabase.from('community_messages').update({deleted:true}).eq('id',id).eq('user_id',userId!);
    setMessages(prev=>prev.filter(m=>m.id!==id));
  }

  // ── Reaction helpers ─────────────────────────────────────────
  function getLikeIds(likes:string[]){return likes.filter(l=>!l.includes(':'));}
  function getEmojiReactions(likes:string[]){
    const map:Record<string,{count:number;hasMe:boolean}>={};
    for(const l of likes){
      if(!l.includes(':'))continue;
      const parts=l.split(':');
      const emoji=parts[0]; const uid=parts[1];
      if(!map[emoji])map[emoji]={count:0,hasMe:false};
      map[emoji].count++;
      if(uid===userId)map[emoji].hasMe=true;
    }
    return Object.entries(map);
  }

  // ── Layout helpers ───────────────────────────────────────────
  function showHeader(i:number){
    if(i===0)return true;
    const p=messages[i-1],c=messages[i];
    if(p.user_id!==c.user_id)return true;
    return new Date(c.created_at).getTime()-new Date(p.created_at).getTime()>5*60*1000;
  }
  function showDate(i:number){
    if(i===0)return true;
    const p=new Date(messages[i-1].created_at),c=new Date(messages[i].created_at);
    return p.toDateString()!==c.toDateString();
  }

  function selectChannel(slug:string){
    setChannel(slug);
    setSheetOpen(false);
    setRxnTarget(null);
    setReplyTo(null);
  }

  // ── Voice recording ──────────────────────────────────────────
  // Compressed: mono 16kHz opus at 16kbps → ~60KB/min (8x smaller)
  // 60s cap prevents large files on free Supabase storage (1GB limit)
  async function startRecording(){
    try{
      const stream=await navigator.mediaDevices.getUserMedia({audio:{
        channelCount:1, sampleRate:16000,
        echoCancellation:true, noiseSuppression:true,
      }});
      const mimeType=MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ?'audio/webm;codecs=opus'
        :MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')
          ?'audio/ogg;codecs=opus':'audio/webm';
      const rec=new MediaRecorder(stream,{mimeType,audioBitsPerSecond:16000});
      const chunks:Blob[]=[];
      rec.ondataavailable=e=>{if(e.data.size>0)chunks.push(e.data);};
      rec.onstop=async()=>{
        stream.getTracks().forEach(t=>t.stop());
        await uploadVoiceMessage(new Blob(chunks,{type:mimeType}));
      };
      rec.start();
      mediaRec.current=rec;
      setRecording(true); setRecSeconds(0);
      recTimer.current=setInterval(()=>{
        setRecSeconds(s=>{
          if(s>=59){stopRecording(true);return 59;}
          return s+1;
        });
      },1000);
    }catch(err){
      alert('Please allow microphone access to send voice messages.');
    }
  }

  function stopRecording(doSend=true){
    if(recTimer.current)clearInterval(recTimer.current);
    if(mediaRec.current&&mediaRec.current.state!=='inactive'){
      if(!doSend){mediaRec.current.ondataavailable=null;mediaRec.current.onstop=null;}
      mediaRec.current.stop();
    }
    setRecording(false); setRecSeconds(0);
  }

  async function uploadVoiceMessage(blob:Blob){
    if(!userId)return;
    const ext=blob.type.includes('ogg')?'ogg':'webm';
    const path=`voice/${userId}/${Date.now()}.${ext}`;
    const{error}=await supabase.storage.from('community-voice').upload(path,blob,{contentType:blob.type,upsert:false});
    if(error){console.error('Voice upload failed',error.message);return;}
    const{data:{publicUrl}}=supabase.storage.from('community-voice').getPublicUrl(path);
    await supabase.from('community_messages').insert({user_id:userId,channel,content:`[voice:${publicUrl}]`,likes:[]});
  }

  function fmtRec(s:number){return`${Math.floor(s/60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}`;}

  // ── Long press ───────────────────────────────────────────────
  function onMsgPressStart(msg:Message){longPressTimer.current=setTimeout(()=>setLongPressMsg(msg),500);}
  function onMsgPressEnd(){if(longPressTimer.current)clearTimeout(longPressTimer.current);}

  const currentCh=channels.find(c=>c.slug===channel);

  // ════════════════════════════════════════════════════════════
  // CHANNEL LIST (used inside sidebar on desktop + sheet on mobile)
  // ════════════════════════════════════════════════════════════
  const ChannelList = (
    <div style={{flex:1,overflowY:'auto',padding:'6px 0'}}>
      {categories.map(cat=>{
        const catChs=channels.filter(c=>c.category_id===cat.id).sort((a,b)=>a.sort_order-b.sort_order);
        if(!catChs.length)return null;
        const isCollapsed=collapsed[cat.id];
        return(
          <div key={cat.id} style={{marginTop:6}}>
            <button
              onClick={()=>setCollapsed(c=>({...c,[cat.id]:!c[cat.id]}))}
              style={{display:'flex',alignItems:'center',gap:4,padding:'3px 8px 3px 14px',width:'100%',background:'none',border:'none',cursor:'pointer'}}
            >
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke={D.text3} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{transform:isCollapsed?'rotate(-90deg)':'rotate(0deg)',transition:'transform 0.15s'}}>
                <polyline points="6 9 12 15 18 9"/>
              </svg>
              <span style={{fontFamily:D.fontMono,fontSize:10,fontWeight:700,color:D.text3,letterSpacing:'0.1em',textTransform:'uppercase' as const}}>{cat.name}</span>
            </button>
            {!isCollapsed&&catChs.map(ch=>{
              const active=ch.slug===channel;
              return(
                <button key={ch.slug} onClick={()=>selectChannel(ch.slug)} style={{display:'flex',alignItems:'center',gap:7,padding:'5px 8px 5px 14px',margin:'1px 4px',borderRadius:4,width:'calc(100% - 8px)',background:active?D.bg5:'none',border:'none',borderLeft:active?`2px solid ${D.gold}`:'2px solid transparent',cursor:'pointer',textAlign:'left' as const}}>
                  <span style={{color:active?D.gold:D.text3,flexShrink:0}}>{getIcon(ch.slug)}</span>
                  <span style={{fontFamily:D.fontUI,fontSize:13,color:active?D.gold:D.text2,fontWeight:active?600:400,whiteSpace:'nowrap' as const,overflow:'hidden',textOverflow:'ellipsis'}}>{ch.name}</span>
                </button>
              );
            })}
          </div>
        );
      })}
      {/* Uncategorised */}
      {(()=>{
        const catIds=new Set(categories.map(c=>c.id));
        const uncat=channels.filter(c=>!c.category_id||!catIds.has(c.category_id));
        if(!uncat.length)return null;
        return(
          <div style={{marginTop:8}}>
            <div style={{padding:'3px 8px 3px 18px'}}>
              <span style={{fontFamily:D.fontMono,fontSize:10,fontWeight:700,color:D.text3,letterSpacing:'0.1em',textTransform:'uppercase' as const}}>Channels</span>
            </div>
            {uncat.map(ch=>{
              const active=ch.slug===channel;
              return(
                <button key={ch.slug} onClick={()=>selectChannel(ch.slug)} style={{display:'flex',alignItems:'center',gap:7,padding:'5px 8px 5px 14px',margin:'1px 4px',borderRadius:4,width:'calc(100% - 8px)',background:active?D.bg5:'none',border:'none',borderLeft:active?`2px solid ${D.gold}`:'2px solid transparent',cursor:'pointer',textAlign:'left' as const}}>
                  <span style={{color:active?D.gold:D.text3,flexShrink:0}}>{Hash}</span>
                  <span style={{fontFamily:D.fontUI,fontSize:13,color:active?D.gold:D.text2,fontWeight:active?600:400}}>{ch.name}</span>
                </button>
              );
            })}
          </div>
        );
      })()}
    </div>
  );

  // ════════════════════════════════════════════════════════════
  // CHAT MESSAGES
  // ════════════════════════════════════════════════════════════
  const Messages = (
    <div style={{flex:1,overflowY:'auto',padding:'8px 0 4px'}} onClick={()=>{setRxnTarget(null);setLongPressMsg(null);}}>
      {loading?(
        <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100%',flexDirection:'column',gap:10}}>
          <div style={{width:22,height:22,borderRadius:'50%',border:`2px solid ${D.border}`,borderTopColor:D.gold,animation:'spin 0.7s linear infinite'}}/>
          <span style={{fontFamily:D.fontMono,fontSize:11,color:D.text3}}>Loading...</span>
        </div>
      ):messages.length===0?(
        <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'100%',gap:10,padding:40}}>
          <div style={{color:D.gold,opacity:0.5}}>{getIcon(channel)}</div>
          <div style={{fontFamily:D.fontUI,fontSize:18,fontWeight:700,color:D.text0}}>Welcome to #{currentCh?.name||channel}</div>
          <div style={{fontFamily:D.fontUI,fontSize:13,color:D.text2,textAlign:'center'}}>{currentCh?.description||'Be the first to say something.'}</div>
        </div>
      ):messages.map((msg,i)=>{
        const header=showHeader(i);
        const dateDivider=showDate(i);
        const likeIds=getLikeIds(msg.likes);
        const likeCount=likeIds.length;
        const iLiked=userId?likeIds.includes(userId):false;
        const rxns=getEmojiReactions(msg.likes);
        return(
          <React.Fragment key={msg.id}>
            {dateDivider&&(
              <div style={{display:'flex',alignItems:'center',gap:12,padding:'12px 16px 6px',userSelect:'none'}}>
                <div style={{flex:1,height:'0.5px',background:D.border}}/>
                <span style={{fontFamily:D.fontMono,fontSize:11,color:D.text3,padding:'0 4px'}}>{fmtDate(msg.created_at)}</span>
                <div style={{flex:1,height:'0.5px',background:D.border}}/>
              </div>
            )}
            <div
              className="msg-row"
              style={{display:'flex',gap:10,padding:header?'8px 16px 2px':'1px 16px',alignItems:'flex-start',position:'relative'}}
              onMouseEnter={()=>setRxnTarget(msg.id)}
              onMouseLeave={()=>setRxnTarget(null)}
              onTouchStart={()=>onMsgPressStart(msg)}
              onTouchEnd={onMsgPressEnd}
              onTouchMove={onMsgPressEnd}
            >
              <div style={{width:36,flexShrink:0,paddingTop:header?2:0}}>
                {header&&<Avatar name={msg.author_name} size={36}/>}
              </div>
              <div style={{flex:1,minWidth:0}}>
                {header&&(
                  <div style={{display:'flex',alignItems:'baseline',gap:8,marginBottom:2}}>
                    <span style={{fontFamily:D.fontUI,fontSize:14,fontWeight:700,color:msg.is_own?D.gold:avtColor(msg.author_name)}}>{msg.is_own?'You':msg.author_name}</span>
                    <span style={{fontFamily:D.fontMono,fontSize:10,color:D.text3}}>{fmtTime(msg.created_at)}</span>
                  </div>
                )}
                {msg.reply_to_id&&msg.reply_to_content&&(
                  <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:4}}>
                    <div style={{width:22,height:10,borderTop:`2px solid ${D.border}`,borderLeft:`2px solid ${D.border}`,borderRadius:'4px 0 0 0',marginLeft:12,flexShrink:0}}/>
                    <Avatar name={msg.reply_to_author||'?'} size={14}/>
                    <span style={{fontFamily:D.fontMono,fontSize:11,color:D.text3,flexShrink:0}}>{msg.reply_to_author}</span>
                    <span style={{fontFamily:D.fontUI,fontSize:12,color:D.text3,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' as const}}>{msg.reply_to_content}</span>
                  </div>
                )}
                {/* Voice message */}
                {msg.content.startsWith('[voice:')?
                  <div style={{display:'flex',alignItems:'center',gap:8,background:D.bg2,border:`0.5px solid ${D.border}`,borderRadius:16,padding:'8px 12px',maxWidth:220}}>
                    <button onClick={()=>{const a=new Audio(msg.content.slice(7,-1));a.play();}} style={{width:28,height:28,borderRadius:'50%',background:D.gold,border:'none',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',flexShrink:0}}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="#0C0B08"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                    </button>
                    <div style={{flex:1,display:'flex',alignItems:'center',gap:2,height:20}}>
                      {[40,70,100,80,55,90,65,45,75,50,85,60,40,70].map((h,i)=>(
                        <div key={i} style={{width:2,borderRadius:1,background:i<7?D.gold:D.text3,height:`${h}%`,opacity:i<7?1:0.5}}/>
                      ))}
                    </div>
                    <span style={{fontFamily:D.fontMono,fontSize:10,color:D.text2,flexShrink:0}}>0:24</span>
                  </div>
                :
                  <p style={{fontFamily:D.fontUI,fontSize:14,color:D.text1,margin:0,lineHeight:1.55,wordBreak:'break-word',whiteSpace:'pre-wrap'}}>{msg.content}</p>
                }
                {/* Reactions */}
                {(likeCount>0||rxns.length>0)&&(
                  <div style={{display:'flex',flexWrap:'wrap',gap:4,marginTop:4}}>
                    {likeCount>0&&(
                      <button onClick={()=>toggleLike(msg)} style={{display:'inline-flex',alignItems:'center',gap:4,padding:'2px 7px',borderRadius:4,background:iLiked?'rgba(88,101,242,0.15)':'rgba(255,255,255,0.04)',border:`0.5px solid ${iLiked?'rgba(88,101,242,0.5)':'rgba(255,255,255,0.08)'}`,cursor:'pointer',fontFamily:D.fontMono,fontSize:12,color:iLiked?'#c9cdfb':D.text2}}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill={iLiked?'#5865f2':'none'} stroke={iLiked?'#5865f2':'currentColor'} strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                        {likeCount}
                      </button>
                    )}
                    {rxns.map(([emoji,{count,hasMe}])=>(
                      <button key={emoji} onClick={()=>addReaction(msg.id,emoji)} style={{display:'inline-flex',alignItems:'center',gap:3,padding:'2px 7px',borderRadius:4,background:hasMe?'rgba(232,160,32,0.12)':'rgba(255,255,255,0.04)',border:`0.5px solid ${hasMe?D.goldB:'rgba(255,255,255,0.08)'}`,cursor:'pointer',fontFamily:D.fontMono,fontSize:12,color:hasMe?D.gold:D.text2}}>
                        {emoji} {count}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Desktop hover action bar */}
              {rxnTarget===msg.id&&(
                <div className="desktop-only" style={{position:'absolute',right:8,top:header?8:0,background:D.bg1,border:`0.5px solid ${D.border}`,borderRadius:8,overflow:'hidden',boxShadow:'0 2px 12px rgba(0,0,0,0.5)',zIndex:10}} onClick={e=>e.stopPropagation()}>
                  <div style={{display:'flex'}}>
                    {/* Reaction picker trigger */}
                    <div style={{position:'relative'}}>
                      <button onClick={()=>setRxnTarget(prev=>prev===`picker:${msg.id}`?msg.id:`picker:${msg.id}`)} style={{padding:'6px 8px',background:'none',border:'none',color:D.text2,cursor:'pointer',display:'flex',alignItems:'center'}}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>
                      </button>
                    </div>
                    <button onClick={()=>{setReplyTo(msg);inputRef.current?.focus();setRxnTarget(null);}} style={{padding:'6px 8px',background:'none',border:'none',color:D.text2,cursor:'pointer',display:'flex',alignItems:'center'}}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/></svg>
                    </button>
                    <button onClick={()=>toggleLike(msg)} style={{padding:'6px 8px',background:'none',border:'none',color:iLiked?'#5865f2':D.text2,cursor:'pointer',display:'flex',alignItems:'center'}}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill={iLiked?'#5865f2':'none'} stroke={iLiked?'#5865f2':'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                    </button>
                    {msg.is_own&&(
                      <button onClick={()=>deleteMsg(msg.id)} style={{padding:'6px 8px',background:'none',border:'none',color:D.red,cursor:'pointer',display:'flex',alignItems:'center'}}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M9 6V4h6v2"/></svg>
                      </button>
                    )}
                  </div>
                  {/* Inline reaction picker */}
                  {rxnTarget===`picker:${msg.id}`&&(
                    <div style={{display:'flex',padding:'4px 8px',gap:4,borderTop:`0.5px solid ${D.border}`}} onClick={e=>e.stopPropagation()}>
                      {REACTIONS.map(emoji=>(
                        <button key={emoji} onClick={()=>addReaction(msg.id,emoji)} style={{background:'none',border:'none',fontSize:16,cursor:'pointer',padding:'2px 3px',borderRadius:4}}>{emoji}</button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </React.Fragment>
        );
      })}
      <div ref={bottomRef} style={{height:8}}/>
    </div>
  );

  // ════════════════════════════════════════════════════════════
  // INPUT BAR
  // ════════════════════════════════════════════════════════════
  const InputBar = (
    <div style={{padding:'0 16px 16px',flexShrink:0,background:D.bg3,paddingBottom:'max(16px, env(safe-area-inset-bottom, 16px))'}}>
      {replyTo&&(
        <div style={{display:'flex',alignItems:'center',gap:8,padding:'6px 12px',marginBottom:0,background:D.bg2,borderRadius:'8px 8px 0 0',borderBottom:`2px solid ${D.border}`}}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={D.text3} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/></svg>
          <span style={{fontFamily:D.fontMono,fontSize:11,color:D.text3,flex:1}}>
            Replying to <span style={{color:D.text1,fontWeight:600}}>{replyTo.is_own?'yourself':replyTo.author_name}</span>
          </span>
          <button onClick={()=>setReplyTo(null)} style={{background:'none',border:'none',color:D.text3,cursor:'pointer',lineHeight:1,padding:2}}>✕</button>
        </div>
      )}
      {recording?(
        <div style={{display:'flex',alignItems:'center',gap:10,background:D.bg4,borderRadius:replyTo?'0 0 8px 8px':8,padding:'10px 14px'}}>
          <div style={{width:8,height:8,borderRadius:'50%',background:D.red,animation:'pulse 1s infinite',flexShrink:0}}/>
          <span style={{fontFamily:D.fontMono,fontSize:13,color:D.gold,flex:1}}>Recording... {fmtRec(recSeconds)}</span>
          <button onClick={()=>stopRecording(false)} title="Cancel" style={{background:'none',border:'none',color:D.text3,cursor:'pointer',padding:'0 4px',fontSize:18,lineHeight:1}}>✕</button>
          <button onClick={()=>stopRecording(true)} title="Send" style={{width:36,height:36,borderRadius:'50%',background:D.gold,border:'none',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',flexShrink:0}}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0C0B08" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          </button>
        </div>
      ):(
        <div style={{background:D.bg4,border:`0.5px solid ${D.border}`,borderRadius:replyTo?'0 0 8px 8px':8,display:'flex',alignItems:'flex-end',gap:8,padding:'8px 12px'}}>
          <button title="Attach" style={{background:'none',border:'none',color:D.text3,cursor:'pointer',flexShrink:0,lineHeight:1,padding:'0 2px'}}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
          </button>
          <textarea
            ref={inputRef}
            value={input}
            onChange={e=>{
              setInput(e.target.value);
              // Auto-resize
              e.target.style.height='auto';
              e.target.style.height=Math.min(e.target.scrollHeight,120)+'px';
            }}
            onKeyDown={onKey}
            placeholder={userId?`Message #${currentCh?.name||channel}`:'Sign in to chat'}
            readOnly={!userId}
            rows={1}
            maxLength={2000}
            style={{flex:1,background:'none',border:'none',outline:'none',resize:'none',fontFamily:D.fontUI,fontSize:14,color:D.text0,lineHeight:1.5,minHeight:22,maxHeight:120,padding:0,overflow:'hidden'}}
          />
          {/* Emoji — shows picker */}
          <button
            onClick={()=>{
              const emoji=prompt('Type an emoji to add to your message (e.g. 😊)');
              if(emoji)setInput(prev=>prev+emoji);
              inputRef.current?.focus();
            }}
            title="Add emoji"
            style={{background:'none',border:'none',color:D.text3,cursor:'pointer',flexShrink:0,lineHeight:1,padding:'0 2px'}}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>
          </button>
          {/* Mic / Send */}
          {input.trim()?(
            <button onClick={send} disabled={sending} title="Send" style={{background:'none',border:'none',color:D.gold,cursor:'pointer',flexShrink:0,lineHeight:1,padding:'0 2px'}}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
            </button>
          ):(
            <button onClick={startRecording} title="Voice message" style={{background:'none',border:'none',color:D.text3,cursor:'pointer',flexShrink:0,lineHeight:1,padding:'0 2px'}}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
            </button>
          )}
        </div>
      )}
    </div>
  );

  // ════════════════════════════════════════════════════════════
  // MOBILE LONG-PRESS SHEET
  // ════════════════════════════════════════════════════════════
  const LongPressSheet = longPressMsg && (
    <div style={{position:'fixed',inset:0,zIndex:100,display:'flex',flexDirection:'column',justifyContent:'flex-end'}} onClick={()=>setLongPressMsg(null)}>
      <div style={{flex:1,background:'rgba(0,0,0,0.5)',backdropFilter:'blur(4px)'}}/>
      <div style={{background:D.bg1,borderRadius:'16px 16px 0 0',padding:'12px 0 0'}} onClick={e=>e.stopPropagation()}>
        <div style={{width:36,height:3,borderRadius:2,background:D.border,margin:'0 auto 12px'}}/>
        {/* Quoted message preview */}
        <div style={{padding:'6px 16px 12px',borderBottom:`0.5px solid ${D.border}`}}>
          <div style={{fontFamily:D.fontMono,fontSize:11,color:D.gold,marginBottom:2}}>{longPressMsg.is_own?'You':longPressMsg.author_name}</div>
          <div style={{fontFamily:D.fontUI,fontSize:13,color:D.text2,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' as const}}>{longPressMsg.content}</div>
        </div>
        {/* Reaction row */}
        <div style={{display:'flex',justifyContent:'space-around',padding:'12px 16px',borderBottom:`0.5px solid ${D.border}`}}>
          {REACTIONS.map(emoji=>(
            <button key={emoji} onClick={()=>addReaction(longPressMsg.id,emoji)} style={{background:'none',border:'none',fontSize:22,cursor:'pointer',padding:'4px 6px',borderRadius:8}}>
              {emoji}
            </button>
          ))}
        </div>
        {/* Actions */}
        {[
          {label:'Reply',icon:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/></svg>,action:()=>{setReplyTo(longPressMsg);setLongPressMsg(null);inputRef.current?.focus();}},
          {label:'Copy',icon:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>,action:()=>{navigator.clipboard.writeText(longPressMsg.content);setLongPressMsg(null);}},
          ...(longPressMsg.is_own?[{label:'Delete',icon:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={D.red} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M9 6V4h6v2"/></svg>,action:()=>deleteMsg(longPressMsg.id),danger:true}]:[]),
        ].map((item:any)=>(
          <button key={item.label} onClick={item.action} style={{display:'flex',alignItems:'center',gap:14,width:'100%',padding:'14px 20px',background:'none',border:'none',borderBottom:`0.5px solid ${D.border}`,cursor:'pointer',fontFamily:D.fontUI,fontSize:15,color:item.danger?D.red:D.text1,textAlign:'left' as const}}>
            <span style={{color:item.danger?D.red:D.text2}}>{item.icon}</span>
            {item.label}
          </button>
        ))}
        <div style={{height:'max(16px, env(safe-area-inset-bottom, 16px))'}}/>
      </div>
    </div>
  );

  // ════════════════════════════════════════════════════════════
  // MOBILE CHANNEL BOTTOM SHEET
  // ════════════════════════════════════════════════════════════
  const ChannelSheet = sheetOpen && (
    <div style={{position:'fixed',inset:0,zIndex:50,display:'flex',flexDirection:'column',justifyContent:'flex-end'}} onClick={()=>setSheetOpen(false)}>
      <div style={{flex:1,background:'rgba(0,0,0,0.5)',backdropFilter:'blur(4px)'}}/>
      <div style={{background:D.bg1,borderRadius:'16px 16px 0 0',maxHeight:'70vh',display:'flex',flexDirection:'column'}} onClick={e=>e.stopPropagation()}>
        <div style={{padding:'12px 16px 8px',flexShrink:0}}>
          <div style={{width:36,height:3,borderRadius:2,background:D.border,margin:'0 auto 12px'}}/>
          <div style={{fontFamily:D.fontDisp,fontStyle:'italic',fontSize:18,fontWeight:700,color:D.gold}}>Community</div>
          <div style={{display:'flex',alignItems:'center',gap:5,marginTop:2}}>
            <div style={{width:6,height:6,borderRadius:'50%',background:D.green}}/>
            <span style={{fontFamily:D.fontMono,fontSize:10,color:D.text3}}>{online} online</span>
          </div>
        </div>
        <div style={{flex:1,overflowY:'auto',borderTop:`0.5px solid ${D.border}`}}>
          {ChannelList}
        </div>
        <div style={{height:'max(12px, env(safe-area-inset-bottom, 12px))',flexShrink:0}}/>
      </div>
    </div>
  );

  // ════════════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════════════
  return (
    <div style={{display:'flex',height:'100dvh',overflow:'hidden',background:D.bg3}}>
      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
        .msg-row:hover{background:rgba(232,160,32,0.02);}
        textarea{color-scheme:dark;}
        textarea::placeholder{color:${D.text4};}
        ::-webkit-scrollbar{width:4px;background:transparent;}
        ::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.06);border-radius:4px;}

        /* Desktop-only elements */
        .desktop-only{display:flex;}
        .mobile-only{display:none!important;}
        .mobile-only-flex{display:none!important;}

        @media(max-width:640px){
          .desktop-only{display:none!important;}
          .mobile-only{display:flex!important;}
          .mobile-only-flex{display:flex!important;}
        }
      `}</style>

      {/* ── DESKTOP: icon nav ── */}
      <div className="desktop-only" style={{width:60,background:D.bg0,flexDirection:'column',alignItems:'center',padding:'10px 0',flexShrink:0,borderRight:`1px solid ${D.border}`}}>
        <div style={{width:40,height:40,borderRadius:'30%',background:D.gold,display:'flex',alignItems:'center',justifyContent:'center',marginBottom:6,flexShrink:0}}>
          <span style={{fontFamily:D.fontUI,fontSize:14,fontWeight:800,color:'#0C0B08'}}>A</span>
        </div>
        <div style={{width:28,height:1,background:D.border,margin:'4px 0 6px'}}/>
        {NAV.map(item=>{
          const active=item.href==='/community';
          return(
            <Link key={item.href} href={item.href} title={item.label} style={{width:40,height:40,borderRadius:active?'30%':'50%',background:active?D.gold:D.bg1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',textDecoration:'none',color:active?'#0C0B08':D.text3,margin:'3px 0',transition:'border-radius 0.2s,background 0.2s',gap:2}}>
              {item.icon}
              <span style={{fontFamily:D.fontMono,fontSize:7,letterSpacing:'0.04em',textTransform:'uppercase' as const,fontWeight:500,lineHeight:1}}>{item.label}</span>
            </Link>
          );
        })}
      </div>

      {/* ── DESKTOP: channel sidebar ── */}
      <div className="desktop-only" style={{width:230,background:D.bg1,flexDirection:'column',flexShrink:0,borderRight:`1px solid ${D.border}`}}>
        {/* Server name */}
        <div style={{padding:'13px 16px',borderBottom:`1px solid ${D.border}`,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <span style={{fontFamily:D.fontUI,fontSize:15,fontWeight:700,color:D.text0}}>Ascentor</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={D.text3} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
        </div>
        {ChannelList}
        {/* User bar */}
        <div style={{padding:'8px 10px',background:D.bg0,display:'flex',alignItems:'center',gap:8,borderTop:`1px solid ${D.border}`}}>
          <Avatar name={userName} size={30}/>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontFamily:D.fontUI,fontSize:13,fontWeight:600,color:D.text0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' as const}}>{userName}</div>
            <div style={{fontFamily:D.fontMono,fontSize:10,color:D.green,display:'flex',alignItems:'center',gap:3}}>
              <div style={{width:5,height:5,borderRadius:'50%',background:D.green}}/> Online
            </div>
          </div>
        </div>
      </div>

      {/* ── DESKTOP + MOBILE: chat area ── */}
      <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden',minWidth:0,background:D.bg3}}>

        {/* Topbar */}
        <div style={{height:48,borderBottom:`1px solid ${D.border}`,display:'flex',alignItems:'center',padding:'0 16px',gap:10,flexShrink:0,background:D.bg3}}>
          {/* Mobile: channels sheet trigger */}
          <button className="mobile-only" onClick={()=>setSheetOpen(true)} style={{display:'none',background:'none',border:'none',color:D.text2,cursor:'pointer',padding:'4px 6px 4px 0'}}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
          </button>
          <span style={{color:D.gold,flexShrink:0}}>{getIcon(channel)}</span>
          <span style={{fontFamily:D.fontUI,fontSize:15,fontWeight:700,color:D.text0}}>{currentCh?.name||channel}</span>
          {currentCh?.description&&(
            <><span style={{color:D.border}}>│</span>
            <span className="desktop-only" style={{fontFamily:D.fontUI,fontSize:13,color:D.text3,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' as const}}>{currentCh.description}</span></>
          )}
          <div style={{marginLeft:'auto',display:'flex',alignItems:'center',gap:12}}>
            <button style={{background:'none',border:'none',color:D.text2,cursor:'pointer'}}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            </button>
            <span style={{fontFamily:D.fontMono,fontSize:12,color:D.text3,display:'flex',alignItems:'center',gap:4}}>
              <div style={{width:7,height:7,borderRadius:'50%',background:D.green}}/>{online}
            </span>
          </div>
        </div>

        {Messages}
        {InputBar}
      </div>

      {/* Mobile bottom nav */}
      <div className="mobile-only" style={{position:'fixed',bottom:0,left:0,right:0,background:D.bg0,borderTop:`1px solid ${D.border}`,display:'none',justifyContent:'space-around',padding:'6px 0',paddingBottom:'max(6px, env(safe-area-inset-bottom, 6px))',zIndex:20}}>
        {NAV.map(item=>{
          const active=item.href==='/community';
          return(
            <Link key={item.href} href={item.href} style={{display:'flex',flexDirection:'column',alignItems:'center',gap:3,padding:'4px 10px',textDecoration:'none',color:active?D.gold:D.text3}}>
              {item.icon}
              <span style={{fontFamily:D.fontMono,fontSize:8,letterSpacing:'0.06em',textTransform:'uppercase' as const,fontWeight:active?600:400}}>{item.label}</span>
            </Link>
          );
        })}
      </div>

      {/* Overlays */}
      {ChannelSheet}
      {LongPressSheet}
    </div>
  );
}
