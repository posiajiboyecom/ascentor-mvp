'use client';

// app/admin/community-intel/page.tsx
// Two tabs:
//   1. Message Monitor — live moderation of community_messages
//   2. Community Intelligence — AI cohort recommendations

import { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';

const B = {
  gold:'#E8A020',goldMuted:'rgba(232,160,32,0.08)',goldBorder:'rgba(232,160,32,0.20)',
  teal:'#14B8A6',purple:'#8B5CF6',green:'#22C55E',red:'#EF4444',
  fontMono:"'DM Mono', monospace",fontUI:"'Syne', system-ui, sans-serif",
  fontDisplay:"'Cormorant Garamond', Georgia, serif",
};
const CARD:React.CSSProperties={background:'var(--admin-bg-deep)',border:'1px solid var(--admin-bg-input)',borderRadius:12};
const MONO_LABEL:React.CSSProperties={fontFamily:B.fontMono,fontSize:9,letterSpacing:'0.12em',textTransform:'uppercase',color:'var(--admin-text-faint)',display:'block',marginBottom:5};
const CHANNELS=[
  {slug:'all',name:'All Channels',emoji:'📋'},{slug:'general',name:'General',emoji:'💬'},
  {slug:'introductions',name:'Introductions',emoji:'👋'},{slug:'career-wins',name:'Career Wins',emoji:'💼'},
  {slug:'accountability',name:'Accountability',emoji:'🤝'},{slug:'industry-talk',name:'Industry Talk',emoji:'🧠'},
  {slug:'cv-review',name:'CV Review',emoji:'📄'},{slug:'opportunities',name:'Opportunities',emoji:'🎯'},
];
const CATEGORY_COLOR:Record<string,string>={Technology:B.teal,Finance:B.gold,Leadership:B.purple,Entrepreneurship:B.gold,Consulting:B.purple,'Career Growth':B.teal,Executive:B.purple,Diversity:B.green,Other:B.gold};

function Spinner({size=22}:{size?:number}){return(<div style={{width:size,height:size,borderRadius:'50%',border:`2px solid var(--admin-bg-input)`,borderTopColor:B.gold,animation:'asc-spin 0.7s linear infinite',flexShrink:0}}/>);}
function Tag({text,color=B.gold}:{text:string;color?:string}){return(<span style={{fontFamily:B.fontMono,fontSize:9,letterSpacing:'0.1em',textTransform:'uppercase',color,padding:'2px 8px',background:`${color}12`,border:`1px solid ${color}28`,borderRadius:100,whiteSpace:'nowrap'}}>{text}</span>);}
function fmtTime(iso:string){const d=new Date(iso);return d.toLocaleString([],{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'});}

interface ProfileRow{id:string;full_name:string|null;current_role:string|null;industry:string|null;goal_role:string|null;biggest_challenge:string|null;time_commitment:string|null;created_at:string;}
interface GoalRow{user_id:string;goal_text:string;}
interface CommunityRec{id:string;name:string;description:string;category:string;icon:string;rationale:string;estimated_members:number;user_ids:string[];tags:string[];editing:boolean;}
interface AnalysisResult{total_users_analysed:number;summary:string;recommendations:CommunityRec[];}
interface AdminMessage{id:string;user_id:string;channel:string;content:string;flagged:boolean;deleted:boolean;created_at:string;author_name:string;}

export default function CommunityIntelPage(){
  const supabase=useRef(createClient()).current;
  const [tab,setTab]=useState<'monitor'|'channels'|'intel'>('monitor');
  return(
    <div style={{animation:'asc-fade-up 0.35s ease both'}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600;700&family=Syne:wght@400;600;700;800&family=DM+Mono:wght@400;500&display=swap');
        @keyframes asc-fade-up{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        @keyframes asc-spin{to{transform:rotate(360deg)}}
        .msg-row:hover{background:rgba(255,255,255,0.02);border-radius:8px;}
      `}</style>
      <div style={{marginBottom:20}}>
        <h1 style={{fontFamily:B.fontDisplay,fontSize:28,fontWeight:700,color:'var(--admin-text-heading)',margin:'0 0 4px'}}>Community</h1>
        <p style={{fontFamily:B.fontMono,fontSize:10,letterSpacing:'0.1em',textTransform:'uppercase',color:'var(--admin-text-faint)',margin:0}}>Monitor conversations · Manage channels · AI recommendations</p>
      </div>
      <div style={{display:'flex',gap:4,marginBottom:24,background:'var(--admin-bg-deep)',borderRadius:10,padding:4,border:'1px solid var(--admin-bg-input)',width:'fit-content'}}>
        {([
          {key:'monitor',  label:'💬 Messages'},
          {key:'channels', label:'# Channels'},
          {key:'intel',    label:'✦ Intelligence'},
        ] as const).map(t=>(
          <button key={t.key} onClick={()=>setTab(t.key)} style={{padding:'8px 18px',borderRadius:7,border:'none',background:tab===t.key?B.gold:'transparent',color:tab===t.key?'#0C0B08':'var(--admin-text-muted)',fontFamily:B.fontUI,fontWeight:600,fontSize:12,cursor:'pointer',transition:'background 0.15s'}}>{t.label}</button>
        ))}
      </div>
      {tab==='monitor' ? <MessageMonitor supabase={supabase}/> : tab==='channels' ? <ChannelsManager supabase={supabase}/> : <IntelPanel supabase={supabase}/>}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// CHANNELS MANAGER TAB
// ════════════════════════════════════════════════════════════
const EMOJIS=['💬','👋','💼','🤝','🧠','📄','🎯','🚀','💡','🔥','🌍','📢','🎓','💪','🏆','❓'];
interface ChannelRow{slug:string;name:string;emoji:string;description:string;sort_order:number;}

function ChannelsManager({supabase}:{supabase:ReturnType<typeof createClient>}){
  const[channels,setChannels]=useState<ChannelRow[]>([]);
  const[loading,setLoading]=useState(true);
  const[saving,setSaving]=useState<Record<string,boolean>>({});
  const[deleting,setDeleting]=useState<Record<string,boolean>>({});
  const[toast,setToast]=useState<{msg:string;ok:boolean}|null>(null);
  const[showForm,setShowForm]=useState(false);
  const[form,setForm]=useState({name:'',emoji:'💬',description:'',slug:''});
  const[creating,setCreating]=useState(false);
  const[editing,setEditing]=useState<string|null>(null);
  const[editForm,setEditForm]=useState<Partial<ChannelRow>>({});
  const showToast=(msg:string,ok=true)=>{setToast({msg,ok});setTimeout(()=>setToast(null),3500);};

  const load=useCallback(async()=>{
    setLoading(true);
    const{data}=await supabase.from('community_channels').select('*').order('sort_order',{ascending:true});
    setChannels(data||[]);setLoading(false);
  },[supabase]);
  useEffect(()=>{load();},[load]);

  function slugify(name:string){return name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');}

  async function createChannel(){
    if(!form.name.trim())return;
    setCreating(true);
    const slug=form.slug.trim()||slugify(form.name);
    const maxOrder=channels.reduce((m,c)=>Math.max(m,c.sort_order),0);
    const{error}=await supabase.from('community_channels').insert({slug,name:form.name.trim(),emoji:form.emoji,description:form.description.trim(),sort_order:maxOrder+1});
    if(error){showToast(error.message,false);}
    else{showToast(`#${slug} created`);setShowForm(false);setForm({name:'',emoji:'💬',description:'',slug:''});load();}
    setCreating(false);
  }

  async function saveEdit(slug:string){
    setSaving(s=>({...s,[slug]:true}));
    const{error}=await supabase.from('community_channels').update({name:editForm.name,emoji:editForm.emoji,description:editForm.description}).eq('slug',slug);
    if(error){showToast(error.message,false);}else{showToast('Channel updated');setEditing(null);load();}
    setSaving(s=>({...s,[slug]:false}));
  }

  async function moveChannel(slug:string,dir:'up'|'down'){
    const idx=channels.findIndex(c=>c.slug===slug);
    if((dir==='up'&&idx===0)||(dir==='down'&&idx===channels.length-1))return;
    const swapIdx=dir==='up'?idx-1:idx+1;
    const a=channels[idx],b=channels[swapIdx];
    await supabase.from('community_channels').update({sort_order:b.sort_order}).eq('slug',a.slug);
    await supabase.from('community_channels').update({sort_order:a.sort_order}).eq('slug',b.slug);
    load();
  }

  async function deleteChannel(slug:string){
    if(!confirm(`Delete #${slug}? Messages in this channel will be hidden.`))return;
    setDeleting(d=>({...d,[slug]:true}));
    const{error}=await supabase.from('community_channels').delete().eq('slug',slug);
    if(error){showToast(error.message,false);}else{showToast(`#${slug} deleted`);load();}
    setDeleting(d=>({...d,[slug]:false}));
  }

  const INPUT_S={width:'100%',padding:'8px 12px',borderRadius:7,border:'1px solid var(--admin-bg-input)',background:'var(--admin-bg-card)',color:'var(--admin-text)',fontSize:13,fontFamily:B.fontUI,outline:'none',boxSizing:'border-box' as const};

  return(
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20,flexWrap:'wrap',gap:10}}>
        <div>
          <h2 style={{fontFamily:B.fontDisplay,fontSize:22,fontWeight:700,color:'var(--admin-text-heading)',margin:0}}>Chat Channels</h2>
          <p style={{fontFamily:B.fontMono,fontSize:10,letterSpacing:'0.1em',textTransform:'uppercase',color:'var(--admin-text-faint)',marginTop:4,marginBottom:0}}>{channels.length} channels · changes reflect instantly in the app</p>
        </div>
        <button onClick={()=>setShowForm(f=>!f)} style={{padding:'10px 20px',borderRadius:9,border:'none',background:showForm?'var(--admin-bg-input)':B.gold,color:showForm?'var(--admin-text-muted)':'#0C0B08',fontFamily:B.fontUI,fontWeight:700,fontSize:13,cursor:'pointer'}}>
          {showForm?'✕ Cancel':'+ New Channel'}
        </button>
      </div>

      {toast&&<div style={{padding:'9px 14px',borderRadius:8,marginBottom:14,background:toast.ok?'rgba(34,197,94,0.08)':'rgba(239,68,68,0.08)',border:`1px solid ${toast.ok?'rgba(34,197,94,0.2)':'rgba(239,68,68,0.2)'}`,color:toast.ok?B.green:B.red,fontFamily:B.fontMono,fontSize:11}}>{toast.msg}</div>}

      {showForm&&(
        <div style={{...CARD,padding:'20px 24px',marginBottom:20,borderColor:B.goldBorder}}>
          <p style={{...MONO_LABEL,color:B.gold,marginBottom:16}}>New Channel</p>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:12}}>
            <div><span style={MONO_LABEL}>Channel Name</span><input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value,slug:slugify(e.target.value)}))} placeholder="e.g. Job Alerts" style={INPUT_S}/></div>
            <div><span style={MONO_LABEL}>Slug (auto)</span><input value={form.slug} onChange={e=>setForm(f=>({...f,slug:e.target.value}))} placeholder="job-alerts" style={{...INPUT_S,fontFamily:B.fontMono}}/></div>
          </div>
          <div style={{marginBottom:12}}><span style={MONO_LABEL}>Description</span><input value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} placeholder="What is this channel for?" style={INPUT_S}/></div>
          <div style={{marginBottom:16}}>
            <span style={MONO_LABEL}>Emoji</span>
            <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
              {EMOJIS.map(e=><button key={e} onClick={()=>setForm(f=>({...f,emoji:e}))} style={{width:36,height:36,borderRadius:8,border:`2px solid ${form.emoji===e?B.gold:'var(--admin-bg-input)'}`,background:form.emoji===e?B.goldMuted:'transparent',fontSize:18,cursor:'pointer'}}>{e}</button>)}
            </div>
          </div>
          <button onClick={createChannel} disabled={!form.name.trim()||creating} style={{padding:'10px 24px',borderRadius:8,border:'none',background:form.name.trim()?B.gold:'var(--admin-bg-input)',color:form.name.trim()?'#0C0B08':'var(--admin-text-muted)',fontFamily:B.fontUI,fontWeight:700,fontSize:13,cursor:form.name.trim()?'pointer':'not-allowed'}}>
            {creating?'Creating…':`Create #${form.slug||slugify(form.name)||'channel'}`}
          </button>
        </div>
      )}

      {loading?(<div style={{...CARD,padding:48,display:'flex',justifyContent:'center'}}><Spinner/></div>):(
        <div style={{display:'flex',flexDirection:'column',gap:8}}>
          {channels.map((ch,idx)=>(
            <div key={ch.slug} style={{...CARD,padding:'14px 18px'}}>
              {editing===ch.slug?(
                <div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:10}}>
                    <div><span style={MONO_LABEL}>Name</span><input value={editForm.name||''} onChange={e=>setEditForm(f=>({...f,name:e.target.value}))} style={INPUT_S}/></div>
                    <div><span style={MONO_LABEL}>Description</span><input value={editForm.description||''} onChange={e=>setEditForm(f=>({...f,description:e.target.value}))} style={INPUT_S}/></div>
                  </div>
                  <div style={{marginBottom:12}}>
                    <span style={MONO_LABEL}>Emoji</span>
                    <div style={{display:'flex',gap:5,flexWrap:'wrap'}}>
                      {EMOJIS.map(e=><button key={e} onClick={()=>setEditForm(f=>({...f,emoji:e}))} style={{width:32,height:32,borderRadius:7,border:`2px solid ${editForm.emoji===e?B.gold:'var(--admin-bg-input)'}`,background:editForm.emoji===e?B.goldMuted:'transparent',fontSize:16,cursor:'pointer'}}>{e}</button>)}
                    </div>
                  </div>
                  <div style={{display:'flex',gap:8}}>
                    <button onClick={()=>saveEdit(ch.slug)} disabled={saving[ch.slug]} style={{padding:'7px 16px',borderRadius:7,border:'none',background:B.gold,color:'#0C0B08',fontFamily:B.fontUI,fontWeight:700,fontSize:12,cursor:'pointer'}}>{saving[ch.slug]?'Saving…':'Save'}</button>
                    <button onClick={()=>setEditing(null)} style={{padding:'7px 16px',borderRadius:7,border:'1px solid var(--admin-bg-input)',background:'transparent',color:'var(--admin-text-muted)',fontFamily:B.fontMono,fontSize:11,cursor:'pointer'}}>Cancel</button>
                  </div>
                </div>
              ):(
                <div style={{display:'flex',alignItems:'center',gap:12}}>
                  <span style={{fontSize:22,flexShrink:0}}>{ch.emoji}</span>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:2}}>
                      <span style={{fontFamily:B.fontUI,fontSize:14,fontWeight:600,color:'var(--admin-text)'}}>#{ch.name}</span>
                      <span style={{fontFamily:B.fontMono,fontSize:9,color:'var(--admin-text-faint)',letterSpacing:'0.08em'}}>{ch.slug}</span>
                    </div>
                    <span style={{fontFamily:B.fontUI,fontSize:12,color:'var(--admin-text-muted)'}}>{ch.description}</span>
                  </div>
                  <div style={{display:'flex',flexDirection:'column',gap:2,flexShrink:0}}>
                    <button onClick={()=>moveChannel(ch.slug,'up')} disabled={idx===0} style={{width:24,height:20,borderRadius:4,border:'1px solid var(--admin-bg-input)',background:'transparent',color:idx===0?'var(--admin-bg-input)':'var(--admin-text-muted)',fontSize:10,cursor:idx===0?'not-allowed':'pointer',lineHeight:1}}>▲</button>
                    <button onClick={()=>moveChannel(ch.slug,'down')} disabled={idx===channels.length-1} style={{width:24,height:20,borderRadius:4,border:'1px solid var(--admin-bg-input)',background:'transparent',color:idx===channels.length-1?'var(--admin-bg-input)':'var(--admin-text-muted)',fontSize:10,cursor:idx===channels.length-1?'not-allowed':'pointer',lineHeight:1}}>▼</button>
                  </div>
                  <button onClick={()=>{setEditing(ch.slug);setEditForm({name:ch.name,emoji:ch.emoji,description:ch.description});}} style={{padding:'5px 12px',borderRadius:6,border:'1px solid var(--admin-bg-input)',background:'transparent',color:'var(--admin-text-muted)',fontFamily:B.fontMono,fontSize:11,cursor:'pointer',flexShrink:0}}>Edit</button>
                  <button onClick={()=>deleteChannel(ch.slug)} disabled={deleting[ch.slug]} style={{padding:'5px 12px',borderRadius:6,border:'1px solid rgba(239,68,68,0.25)',background:'transparent',color:B.red,fontFamily:B.fontMono,fontSize:11,cursor:'pointer',flexShrink:0}}>{deleting[ch.slug]?'…':'Delete'}</button>
                </div>
              )}
            </div>
          ))}
          {channels.length===0&&(<div style={{...CARD,padding:40,textAlign:'center'}}><p style={{fontFamily:B.fontDisplay,fontSize:18,color:'var(--admin-text-heading)',margin:'0 0 8px'}}>No channels yet</p><p style={{fontFamily:B.fontUI,fontSize:13,color:'var(--admin-text-muted)',margin:0}}>Click "New Channel" to create your first one.</p></div>)}
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// MESSAGE MONITOR TAB
// ════════════════════════════════════════════════════════════
function MessageMonitor({supabase}:{supabase:ReturnType<typeof createClient>}){
  const [messages,setMessages]=useState<AdminMessage[]>([]);
  const [loading,setLoading]=useState(true);
  const [channel,setChannel]=useState('all');
  const [flaggedOnly,setFlaggedOnly]=useState(false);
  const [stats,setStats]=useState({total:0,flagged:0});
  const [toast,setToast]=useState<{msg:string;ok:boolean}|null>(null);
  const [acting,setActing]=useState<Record<string,boolean>>({});
  const showToast=(msg:string,ok=true)=>{setToast({msg,ok});setTimeout(()=>setToast(null),3500);};

  const load=useCallback(async()=>{
    setLoading(true);
    const{data:{session}}=await supabase.auth.getSession();
    const token=session?.access_token;
    if(!token){setLoading(false);return;}
    const params=new URLSearchParams({limit:'200'});
    if(channel!=='all')params.set('channel',channel);
    if(flaggedOnly)params.set('flagged','true');
    const res=await fetch(`/api/admin/community-messages?${params}`,{headers:{Authorization:`Bearer ${token}`}});
    const data=await res.json();
    setMessages(data.messages||[]);
    setStats({total:data.totalCount||0,flagged:data.flaggedCount||0});
    setLoading(false);
  },[supabase,channel,flaggedOnly]);

  useEffect(()=>{load();},[load]);

  useEffect(()=>{
    const sub=supabase.channel('admin-community-monitor')
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'community_messages'},(payload:any)=>{
        const m=payload.new;
        if(m.deleted)return;
        if(channel!=='all'&&m.channel!==channel)return;
        if(flaggedOnly&&!m.flagged)return;
        supabase.from('profiles').select('full_name').eq('id',m.user_id).single().then(({data})=>{
          setMessages(prev=>[{...m,author_name:data?.full_name||'Unknown'},...prev]);
          setStats(s=>({...s,total:s.total+1}));
        });
      })
      .on('postgres_changes',{event:'UPDATE',schema:'public',table:'community_messages'},(payload:any)=>{
        const u=payload.new;
        if(u.deleted)setMessages(prev=>prev.filter(m=>m.id!==u.id));
        else setMessages(prev=>prev.map(m=>m.id===u.id?{...m,flagged:u.flagged}:m));
      })
      .subscribe();
    return()=>{supabase.removeChannel(sub);};
  },[supabase,channel,flaggedOnly]);

  async function act(id:string,action:'delete'|'flag'|'unflag'){
    setActing(a=>({...a,[id]:true}));
    const{data:{session}}=await supabase.auth.getSession();
    const res=await fetch('/api/admin/community-messages',{method:'PATCH',headers:{'Content-Type':'application/json',Authorization:`Bearer ${session?.access_token}`},body:JSON.stringify({id,action})});
    const data=await res.json();
    if(data.ok){
      if(action==='delete'){setMessages(prev=>prev.filter(m=>m.id!==id));showToast('Message deleted');}
      else{setMessages(prev=>prev.map(m=>m.id===id?{...m,flagged:action==='flag'}:m));showToast(action==='flag'?'Message flagged':'Flag removed');}
    }else{showToast(data.error||'Action failed',false);}
    setActing(a=>({...a,[id]:false}));
  }

  return(
    <div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(140px, 1fr))',gap:12,marginBottom:20}}>
        {[{label:'Total Messages',value:stats.total,color:B.gold},{label:'Flagged',value:stats.flagged,color:B.red},{label:'Channels',value:7,color:B.teal}].map(s=>(
          <div key={s.label} style={{...CARD,padding:'14px 16px'}}>
            <span style={MONO_LABEL}>{s.label}</span>
            <span style={{fontFamily:B.fontDisplay,fontSize:26,fontWeight:700,color:s.color}}>{s.value}</span>
          </div>
        ))}
      </div>
      <div style={{display:'flex',gap:10,marginBottom:16,flexWrap:'wrap',alignItems:'center'}}>
        <select value={channel} onChange={e=>setChannel(e.target.value)} style={{padding:'8px 12px',borderRadius:8,border:'1px solid var(--admin-bg-input)',background:'var(--admin-bg-card)',color:'var(--admin-text)',fontFamily:B.fontMono,fontSize:11,cursor:'pointer'}}>
          {CHANNELS.map(c=><option key={c.slug} value={c.slug}>{c.emoji} {c.name}</option>)}
        </select>
        <button onClick={()=>setFlaggedOnly(f=>!f)} style={{padding:'8px 14px',borderRadius:8,border:`1px solid ${flaggedOnly?B.red:'var(--admin-bg-input)'}`,background:flaggedOnly?'rgba(239,68,68,0.08)':'transparent',color:flaggedOnly?B.red:'var(--admin-text-muted)',fontFamily:B.fontMono,fontSize:11,cursor:'pointer',fontWeight:500}}>🚩 Flagged {flaggedOnly?'✓':''}</button>
        <button onClick={load} style={{padding:'8px 14px',borderRadius:8,border:'1px solid var(--admin-bg-input)',background:'transparent',color:'var(--admin-text-muted)',fontFamily:B.fontMono,fontSize:11,cursor:'pointer'}}>↺ Refresh</button>
        <span style={{fontFamily:B.fontMono,fontSize:10,color:'var(--admin-text-faint)',marginLeft:'auto'}}>{messages.length} shown · Live</span>
      </div>
      {toast&&<div style={{padding:'9px 14px',borderRadius:8,marginBottom:14,background:toast.ok?'rgba(34,197,94,0.08)':'rgba(239,68,68,0.08)',border:`1px solid ${toast.ok?'rgba(34,197,94,0.2)':'rgba(239,68,68,0.2)'}`,color:toast.ok?B.green:B.red,fontFamily:B.fontMono,fontSize:11}}>{toast.msg}</div>}
      {loading?(<div style={{...CARD,padding:48,display:'flex',justifyContent:'center'}}><Spinner/></div>):messages.length===0?(
        <div style={{...CARD,padding:48,textAlign:'center'}}>
          <p style={{fontFamily:B.fontDisplay,fontSize:20,color:'var(--admin-text-heading)',margin:'0 0 8px'}}>No messages</p>
          <p style={{fontFamily:B.fontUI,fontSize:13,color:'var(--admin-text-muted)',margin:0}}>{flaggedOnly?'No flagged messages.':'No messages in this channel yet.'}</p>
        </div>
      ):(
        <div style={{display:'flex',flexDirection:'column',gap:6}}>
          {messages.map(msg=>(
            <div key={msg.id} className="msg-row" style={{...CARD,padding:'12px 16px',borderColor:msg.flagged?'rgba(239,68,68,0.3)':'var(--admin-bg-input)',background:msg.flagged?'rgba(239,68,68,0.04)':'var(--admin-bg-deep)'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:12}}>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6,flexWrap:'wrap'}}>
                    <span style={{fontFamily:B.fontUI,fontSize:12,fontWeight:600,color:'var(--admin-text)'}}>{msg.author_name}</span>
                    <Tag text={`#${msg.channel}`} color={B.teal}/>
                    {msg.flagged&&<Tag text="🚩 Flagged" color={B.red}/>}
                    <span style={{fontFamily:B.fontMono,fontSize:10,color:'var(--admin-text-faint)',marginLeft:'auto'}}>{fmtTime(msg.created_at)}</span>
                  </div>
                  <p style={{fontFamily:B.fontUI,fontSize:13,color:'var(--admin-text)',margin:0,lineHeight:1.6,wordBreak:'break-word',whiteSpace:'pre-wrap'}}>{msg.content}</p>
                </div>
                <div style={{display:'flex',gap:6,flexShrink:0}}>
                  <button onClick={()=>act(msg.id,msg.flagged?'unflag':'flag')} disabled={acting[msg.id]} style={{padding:'5px 10px',borderRadius:6,fontSize:11,border:`1px solid ${msg.flagged?'rgba(239,68,68,0.3)':'var(--admin-bg-input)'}`,background:'transparent',color:msg.flagged?B.red:'var(--admin-text-muted)',fontFamily:B.fontMono,cursor:'pointer'}}>{msg.flagged?'Unflag':'🚩 Flag'}</button>
                  <button onClick={()=>act(msg.id,'delete')} disabled={acting[msg.id]} style={{padding:'5px 10px',borderRadius:6,fontSize:11,border:'1px solid rgba(239,68,68,0.25)',background:'transparent',color:B.red,fontFamily:B.fontMono,cursor:'pointer'}}>{acting[msg.id]?'…':'Delete'}</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function IntelPanel({supabase}:{supabase:ReturnType<typeof createClient>}){
  const[profiles,setProfiles]=useState<ProfileRow[]>([]);
  const[goals,setGoals]=useState<GoalRow[]>([]);
  const[loading,setLoading]=useState(true);
  const[analysing,setAnalysing]=useState(false);
  const[result,setResult]=useState<AnalysisResult|null>(null);
  const[error,setError]=useState('');
  const[creating,setCreating]=useState<Record<string,boolean>>({});
  const[created,setCreated]=useState<Record<string,boolean>>({});
  const[globalMsg,setGlobalMsg]=useState('');

  const loadData=useCallback(async()=>{
    setLoading(true);
    const{data:profileData}=await supabase.from('profiles').select('id,full_name,current_role,industry,goal_role,biggest_challenge,time_commitment,created_at').eq('onboarding_completed',true).order('created_at',{ascending:false});
    const{data:goalData}=await supabase.from('user_goals').select('user_id,goal_text');
    setProfiles(profileData||[]);setGoals(goalData||[]);setLoading(false);
  },[supabase]);
  useEffect(()=>{loadData();},[loadData]);

  async function runAnalysis(){
    if(profiles.length<2){setError('Need at least 2 completed onboarding profiles.');return;}
    setAnalysing(true);setError('');setResult(null);
    try{
      const goalMap:Record<string,string>={};
      goals.forEach(g=>{goalMap[g.user_id]=g.goal_text;});
      const userSummaries=profiles.map(p=>({current_role:p.current_role||'Unknown',industry:p.industry||'Unknown',goal_role:p.goal_role||'Unknown',biggest_challenge:p.biggest_challenge||'None',time_commitment:p.time_commitment||'Unknown',goal_text:goalMap[p.id]||'No goal set'}));
      const prompt=`You are an expert community strategist for Ascentor, an AI-powered leadership development platform for African professionals.\n\nAnalyse these ${profiles.length} user profiles and recommend 3-6 communities to create.\n\nUSER PROFILES:\n${JSON.stringify(userSummaries,null,2)}\n\nRespond ONLY with valid JSON, no markdown:\n{"total_users_analysed":<number>,"summary":"<overview>","recommendations":[{"id":"<slug>","name":"<name max 5 words>","description":"<1-2 sentences>","category":"<Technology|Finance|Leadership|Entrepreneurship|Consulting|Career Growth|Executive|Diversity|Other>","icon":"users","rationale":"<1 sentence>","estimated_members":<number>,"user_ids":[],"tags":["<tag>"],"editing":false}]}`;
      const res=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:'claude-sonnet-4-6',max_tokens:1000,messages:[{role:'user',content:prompt}]})});
      const data=await res.json();
      if(!res.ok)throw new Error(data?.error?.message||'API error');
      const text=data.content?.filter((b:any)=>b.type==='text').map((b:any)=>b.text).join('')||'';
      const parsed:AnalysisResult=JSON.parse(text.replace(/```json|```/g,'').trim());
      parsed.recommendations=parsed.recommendations.map((r,i)=>({...r,id:r.id||`rec-${i}`,editing:false}));
      setResult(parsed);
    }catch(e:any){setError(e?.message||'Analysis failed.');}
    setAnalysing(false);
  }

  async function createCommunity(rec:CommunityRec){
    setCreating(c=>({...c,[rec.id]:true}));
    const{data:{user}}=await supabase.auth.getUser();
    const{error:err}=await supabase.from('cohorts').insert({name:rec.name.trim(),description:rec.description.trim(),category:rec.category,icon:'users',is_public:true,member_count:0,created_by:user?.id||null});
    if(err){setGlobalMsg(`Error: ${err.message}`);}else{setCreated(c=>({...c,[rec.id]:true}));setGlobalMsg(`"${rec.name}" created!`);setTimeout(()=>setGlobalMsg(''),4000);}
    setCreating(c=>({...c,[rec.id]:false}));
  }

  const industryBreakdown=profiles.reduce<Record<string,number>>((acc,p)=>{const k=p.industry||'Unknown';acc[k]=(acc[k]||0)+1;return acc;},{});
  const topIndustries=Object.entries(industryBreakdown).sort((a,b)=>b[1]-a[1]).slice(0,5);

  return(
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:16,flexWrap:'wrap',gap:10}}>
        <div>
          <h2 style={{fontFamily:B.fontDisplay,fontSize:22,fontWeight:700,color:'var(--admin-text-heading)',margin:0}}>Community Intelligence</h2>
          <p style={{fontFamily:B.fontMono,fontSize:10,letterSpacing:'0.1em',textTransform:'uppercase',color:'var(--admin-text-faint)',marginTop:4,marginBottom:0}}>AI analysis of user profiles → cohort recommendations</p>
        </div>
        <button onClick={runAnalysis} disabled={analysing||loading||profiles.length<2} style={{padding:'10px 22px',borderRadius:9,border:'none',background:analysing?'var(--admin-bg-input)':B.gold,color:analysing?'var(--admin-text-muted)':'#0C0B08',fontFamily:B.fontUI,fontWeight:700,fontSize:13,cursor:(analysing||loading||profiles.length<2)?'not-allowed':'pointer',display:'flex',alignItems:'center',gap:8}}>
          {analysing?<><Spinner size={14}/>Analysing…</>:'✦ Run AI Analysis'}
        </button>
      </div>
      {globalMsg&&<div style={{padding:'10px 16px',borderRadius:8,marginBottom:16,background:globalMsg.startsWith('Error')?'rgba(239,68,68,0.08)':'rgba(34,197,94,0.08)',border:`1px solid ${globalMsg.startsWith('Error')?'rgba(239,68,68,0.2)':'rgba(34,197,94,0.2)'}`,color:globalMsg.startsWith('Error')?B.red:B.green,fontFamily:B.fontMono,fontSize:11}}>{globalMsg}</div>}
      {error&&<div style={{padding:'10px 16px',borderRadius:8,marginBottom:16,background:'rgba(239,68,68,0.08)',border:'1px solid rgba(239,68,68,0.2)',color:B.red,fontFamily:B.fontMono,fontSize:11}}>{error}</div>}
      {loading?(<div style={{padding:'60px 0',display:'flex',justifyContent:'center'}}><Spinner/></div>):(
        <>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(160px, 1fr))',gap:12,marginBottom:24}}>
            {[{label:'Total Users',value:profiles.length,color:B.gold},{label:'With Goals Set',value:goals.length,color:B.teal},{label:'Industries',value:Object.keys(industryBreakdown).length,color:B.purple},{label:'Top Industry',value:topIndustries[0]?.[0]||'—',color:B.green,small:true}].map(stat=>(
              <div key={stat.label} style={{...CARD,padding:'16px 18px'}}>
                <p style={{...MONO_LABEL,marginBottom:8}}>{stat.label}</p>
                <p style={{fontFamily:stat.small?B.fontUI:B.fontDisplay,fontSize:stat.small?14:28,fontWeight:700,color:stat.color,margin:0}}>{stat.value}</p>
              </div>
            ))}
          </div>
          <div style={{...CARD,padding:'18px 20px',marginBottom:24}}>
            <p style={MONO_LABEL}>User breakdown by industry</p>
            <div style={{display:'flex',flexWrap:'wrap',gap:8,marginTop:10}}>
              {topIndustries.map(([industry,count])=>(<div key={industry} style={{display:'flex',alignItems:'center',gap:8,padding:'5px 12px',borderRadius:8,background:'var(--admin-bg-card)',border:'1px solid var(--admin-bg-input)'}}><span style={{fontFamily:B.fontUI,fontSize:12,color:'var(--admin-text)'}}>{industry}</span><span style={{fontFamily:B.fontMono,fontSize:10,color:B.gold,background:B.goldMuted,border:`1px solid ${B.goldBorder}`,padding:'1px 7px',borderRadius:100}}>{count}</span></div>))}
            </div>
          </div>
          {result&&!analysing&&(
            <div>
              <div style={{...CARD,padding:'18px 22px',marginBottom:24,borderColor:B.goldBorder}}>
                <p style={{...MONO_LABEL,color:B.gold}}>AI Analysis Summary</p>
                <p style={{fontFamily:B.fontUI,fontSize:14,color:'var(--admin-text)',lineHeight:1.75,margin:'8px 0 12px'}}>{result.summary}</p>
              </div>
              <div style={{display:'flex',flexDirection:'column',gap:16}}>
                {result.recommendations.map((rec,idx)=>{
                  const color=CATEGORY_COLOR[rec.category]||B.gold;
                  const isCreated=created[rec.id],isCreating=creating[rec.id];
                  return(
                    <div key={rec.id} style={{...CARD,border:isCreated?'1px solid rgba(34,197,94,0.35)':'1px solid var(--admin-bg-input)',opacity:isCreated?0.75:1,overflow:'hidden'}}>
                      <div style={{padding:'16px 20px',borderBottom:'1px solid var(--admin-bg-input)',display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:12}}>
                        <div style={{display:'flex',gap:12,flex:1}}>
                          <div style={{width:28,height:28,borderRadius:8,flexShrink:0,background:`${color}14`,border:`1px solid ${color}28`,display:'flex',alignItems:'center',justifyContent:'center',fontFamily:B.fontMono,fontSize:11,color,fontWeight:500}}>{String(idx+1).padStart(2,'0')}</div>
                          <div><p style={{fontFamily:B.fontDisplay,fontSize:20,fontWeight:700,color:'var(--admin-text-heading)',margin:'0 0 4px'}}>{rec.name}</p>
                          <div style={{display:'flex',gap:6,flexWrap:'wrap'}}><Tag text={rec.category} color={color}/><Tag text={`~${rec.estimated_members} members`} color="var(--admin-text-faint)"/>{isCreated&&<Tag text="✓ Created" color={B.green}/>}</div></div>
                        </div>
                        <button onClick={()=>createCommunity(rec)} disabled={isCreated||isCreating} style={{padding:'5px 14px',borderRadius:6,fontSize:11,border:`1px solid ${isCreated?'rgba(34,197,94,0.3)':`${color}40`}`,background:'transparent',color:isCreated?B.green:color,fontFamily:B.fontUI,fontWeight:700,cursor:(isCreated||isCreating)?'not-allowed':'pointer',display:'flex',alignItems:'center',gap:6}}>
                          {isCreating?<><Spinner size={11}/>Creating…</>:isCreated?'✓ Created':'+ Create Community'}
                        </button>
                      </div>
                      <div style={{padding:'16px 20px'}}>
                        <p style={{fontFamily:B.fontUI,fontSize:13,color:'var(--admin-text)',lineHeight:1.75,margin:'0 0 12px'}}>{rec.description}</p>
                        <div style={{padding:'10px 14px',borderRadius:8,background:`${color}08`,border:`1px solid ${color}18`,display:'flex',gap:10}}><span style={{color,fontSize:12,flexShrink:0}}>✦</span><p style={{fontFamily:B.fontMono,fontSize:10,color:'var(--admin-text-muted)',margin:0,lineHeight:1.7}}><strong style={{color,letterSpacing:'0.1em',textTransform:'uppercase',fontSize:9}}>AI Rationale: </strong>{rec.rationale}</p></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {!result&&!analysing&&profiles.length>=2&&(<div style={{...CARD,padding:'56px 24px',textAlign:'center'}}><p style={{fontFamily:B.fontDisplay,fontSize:22,fontWeight:700,color:'var(--admin-text-heading)',margin:'0 0 8px'}}>Ready to analyse {profiles.length} users</p><button onClick={runAnalysis} style={{padding:'11px 28px',borderRadius:9,border:'none',background:B.gold,color:'#0C0B08',fontFamily:B.fontUI,fontWeight:700,fontSize:14,cursor:'pointer'}}>✦ Run AI Analysis</button></div>)}
          {profiles.length<2&&(<div style={{...CARD,padding:'48px 24px',textAlign:'center'}}><p style={{fontFamily:B.fontDisplay,fontSize:20,color:'var(--admin-text-heading)',margin:'0 0 8px'}}>Not enough data yet</p><p style={{fontFamily:B.fontUI,fontSize:13,color:'var(--admin-text-muted)',margin:0}}>Need at least 2 users who completed onboarding. You have {profiles.length}.</p></div>)}
        </>
      )}
    </div>
  );
}
