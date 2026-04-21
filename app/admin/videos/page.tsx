'use client';

// ═══════════════════════════════════════════════════════════
// Ascentor — Unified Videos Admin Page
// app/admin/videos/page.tsx
// ═══════════════════════════════════════════════════════════
import { useState, useEffect, useRef, useCallback } from 'react';
import VideoDrawer   from '../content/VideoDrawer';
import ClipCTADrawer from '../content/ClipCTADrawer';

const MONO: React.CSSProperties = { fontFamily: "'DM Mono', monospace" };
const SYNE: React.CSSProperties = { fontFamily: "'Syne', system-ui, sans-serif" };
const AMBER  = '#E8A020';
const DARK   = 'var(--admin-text-heading)';
const WARM   = 'var(--admin-bg)';
const CARD_BG= 'var(--admin-bg-card)';
const MUTED  = 'var(--admin-text-muted)';
const FAINT  = 'var(--admin-text-faint)';
const BORDER = 'rgba(212,207,195,0.15)';

type JobType   = 'kinetic' | 'clip-cta';
type JobStatus = 'queued' | 'processing' | 'complete' | 'failed';

interface UnifiedJob {
  id:          string;
  type:        JobType;
  status:      JobStatus;
  label:       string;
  subLabel:    string;
  videoUrl:    string | null;
  errorMsg:    string | null;
  createdAt:   string;
  completedAt: string | null;
  durationMs:  number | null;
  retryCount?: number | null;
  costTotal?:  number | null;
  renderMs?:   number | null;
}

function timeAgo(iso: string) {
  const d = Date.now() - new Date(iso).getTime();
  const m = Math.floor(d / 60000);
  if (m < 1)  return 'just now';
  if (m < 60) return m + 'm ago';
  const h = Math.floor(m / 60);
  if (h < 24) return h + 'h ago';
  return Math.floor(h / 24) + 'd ago';
}

function StatusBadge({ status }: { status: JobStatus }) {
  const map: Record<JobStatus,{bg:string;fg:string}> = {
    complete:   {bg:'rgba(16,185,129,0.12)',fg:'#10B981'},
    failed:     {bg:'rgba(239,68,68,0.10)', fg:'#EF4444'},
    processing: {bg:'rgba(232,160,32,0.12)',fg:AMBER},
    queued:     {bg:'rgba(107,114,128,0.10)',fg:'#6B7280'},
  };
  const {bg,fg}=map[status];
  return <span style={{...MONO,fontSize:9,padding:'3px 8px',borderRadius:999,background:bg,color:fg,whiteSpace:'nowrap'}}>{status}</span>;
}

function TypeBadge({ type }: { type: JobType }) {
  const isK = type === 'kinetic';
  return <span style={{...MONO,fontSize:9,padding:'2px 7px',borderRadius:4,background:isK?'rgba(232,160,32,0.10)':'rgba(99,102,241,0.10)',color:isK?AMBER:'#818CF8',whiteSpace:'nowrap'}}>{isK?'Kinetic':'Clip+CTA'}</span>;
}

function DownloadBtn({ url, jobId }: { url: string; jobId: string }) {
  const [busy,setBusy]=useState(false);
  async function go(){setBusy(true);try{const r=await fetch(url);const b=await r.blob();const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=`ascentor-${jobId.slice(0,8)}.mp4`;a.click();URL.revokeObjectURL(a.href);}catch{window.open(url,'_blank');}finally{setBusy(false);}}
  return <button onClick={go} disabled={busy} style={{...MONO,fontSize:10,padding:'5px 12px',borderRadius:6,border:`1px solid ${AMBER}`,background:'transparent',color:busy?FAINT:AMBER,cursor:busy?'not-allowed':'pointer',whiteSpace:'nowrap'}}>{busy?'…':'↓ Download'}</button>;
}

function JobCard({ job, onDelete, onRetry, retrying }: { job:UnifiedJob; onDelete:(j:UnifiedJob)=>void; onRetry:(j:UnifiedJob)=>void; retrying:boolean }) {
  const isInFlight = job.status==='queued'||job.status==='processing';
  return (
    <div style={{background:CARD_BG,border:`1px solid ${BORDER}`,borderRadius:10,padding:'13px 15px',marginBottom:10}}>
      <div style={{display:'flex',alignItems:'flex-start',gap:10}}>
        <div style={{flex:1,minWidth:0}}>
          <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:3,flexWrap:'wrap'}}>
            <TypeBadge type={job.type}/>
            <StatusBadge status={job.status}/>
          </div>
          <div style={{fontSize:13,fontWeight:500,color:DARK,...SYNE,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',marginBottom:2}}>{job.label}</div>
          <div style={{...MONO,fontSize:9,color:FAINT,display:'flex',flexWrap:'wrap',gap:'0 8px'}}>
            <span>{job.subLabel}</span>
            <span>{timeAgo(job.createdAt)}</span>
            {job.durationMs?<span>rendered in {(job.durationMs/1000).toFixed(0)}s</span>:null}
            {job.retryCount?<span>retried {job.retryCount}×</span>:null}
          </div>
        </div>
        <div style={{display:'flex',gap:8,alignItems:'center',flexShrink:0,flexWrap:'wrap',justifyContent:'flex-end'}}>
          {job.videoUrl&&<DownloadBtn url={job.videoUrl} jobId={job.id}/>}
          {job.videoUrl&&<a href={job.videoUrl} target="_blank" rel="noreferrer" style={{...MONO,fontSize:10,color:MUTED,textDecoration:'none'}}>↗ View</a>}
        </div>
      </div>

      {job.status==='complete'&&job.costTotal!=null&&(
        <div style={{...MONO,fontSize:9,color:FAINT,marginTop:5}}>${Number(job.costTotal).toFixed(4)} total{job.renderMs?` · render ${(job.renderMs/1000).toFixed(1)}s`:''}</div>
      )}

      {isInFlight&&(
        <div style={{...MONO,fontSize:9,color:AMBER,marginTop:6}}>
          <span style={{display:'inline-block',animation:'pulse 1.4s ease-in-out infinite',marginRight:4}}>●</span>
          {job.status==='queued'?'Waiting in queue…':'Processing…'}
        </div>
      )}

      {job.status==='failed'&&job.errorMsg&&(
        <div style={{...MONO,fontSize:9,color:'#EF4444',marginTop:5,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{job.errorMsg}</div>
      )}

      <div style={{marginTop:8,display:'flex',gap:14,alignItems:'center'}}>
        {job.status==='failed'&&job.type==='kinetic'&&(
          <button onClick={()=>onRetry(job)} disabled={retrying} style={{...MONO,fontSize:9,color:AMBER,background:'none',border:'none',cursor:retrying?'not-allowed':'pointer',padding:0}}>↻ Retry</button>
        )}
        {job.status==='failed'&&(
          <button onClick={()=>onDelete(job)} style={{...MONO,fontSize:9,color:'#EF4444',background:'none',border:'none',cursor:'pointer',padding:0}}>🗑 Delete</button>
        )}
        {job.status==='complete'&&(
          <button onClick={()=>onDelete(job)} style={{...MONO,fontSize:9,color:FAINT,background:'none',border:'none',cursor:'pointer',padding:0}}>🗑 Delete</button>
        )}
      </div>
    </div>
  );
}

function SectionHead({label,color=AMBER}:{label:string;color?:string}){
  return <div style={{...MONO,fontSize:10,color,letterSpacing:'0.1em',textTransform:'uppercase',marginBottom:12}}>{label}</div>;
}

export default function VideosAdminPage() {
  const [kineticDrawer,setKineticDrawer]=useState(false);
  const [clipCTADrawer,setClipCTADrawer]=useState(false);
  const [fabOpen,setFabOpen]=useState(false);
  const [jobs,setJobs]=useState<UnifiedJob[]>([]);
  const [loading,setLoading]=useState(true);
  const [retryingId,setRetryingId]=useState<string|null>(null);
  const [toast,setToast]=useState<{msg:string;ok:boolean}|null>(null);
  const pollRef=useRef<ReturnType<typeof setInterval>|null>(null);

  const showToast=useCallback((msg:string,ok=true)=>{setToast({msg,ok});setTimeout(()=>setToast(null),3200);},[]);

  async function loadJobs(){
    try{
      const [kRes,cRes]=await Promise.all([fetch('/api/admin/video/list'),fetch('/api/admin/clip-cta/list')]);
      const kData=await kRes.json();
      const cData=cRes.ok?await cRes.json():{jobs:[]};

      const kJobs:UnifiedJob[]=(kData.jobs??[]).map((j:any)=>({
        id:j.id,type:'kinetic' as JobType,status:j.status,
        label:j.goal??'Kinetic video',
        subLabel:[j.narrative_style,j.theme].filter(Boolean).join(' · '),
        videoUrl:j.video_url,errorMsg:j.error_message,
        createdAt:j.created_at,completedAt:j.completed_at,durationMs:j.duration_ms,
        retryCount:j.retry_count,costTotal:j.cost_usd_total,renderMs:j.timings?.render_ms??null,
      }));

      const cJobs:UnifiedJob[]=(cData.jobs??[]).map((j:any)=>({
        id:j.id,type:'clip-cta' as JobType,status:j.status,
        label:`Clip+CTA · ${j.cta_template}`,
        subLabel:[j.transition_type,j.cta_duration_s?`${j.cta_duration_s}s CTA`:null].filter(Boolean).join(' · '),
        videoUrl:j.video_url,errorMsg:j.error_message,
        createdAt:j.created_at,completedAt:j.completed_at,durationMs:j.duration_ms,
      }));

      const all=[...kJobs,...cJobs];
      const inFlight =all.filter(j=>j.status==='queued'||j.status==='processing').sort((a,b)=>new Date(b.createdAt).getTime()-new Date(a.createdAt).getTime());
      const completed=all.filter(j=>j.status==='complete').sort((a,b)=>new Date(b.completedAt??b.createdAt).getTime()-new Date(a.completedAt??a.createdAt).getTime());
      const failed   =all.filter(j=>j.status==='failed').sort((a,b)=>new Date(b.createdAt).getTime()-new Date(a.createdAt).getTime());
      setJobs([...inFlight,...completed,...failed]);
    }catch{/*non-fatal*/}
    setLoading(false);
  }

  useEffect(()=>{loadJobs();},[]);

  useEffect(()=>{
    const hasInFlight=jobs.some(j=>j.status==='queued'||j.status==='processing');
    if(hasInFlight&&!pollRef.current){pollRef.current=setInterval(loadJobs,4000);}
    else if(!hasInFlight&&pollRef.current){clearInterval(pollRef.current);pollRef.current=null;}
    return()=>{if(pollRef.current){clearInterval(pollRef.current);pollRef.current=null;}};
  },[jobs]);

  async function handleRetry(job:UnifiedJob){
    if(job.type!=='kinetic')return;
    setRetryingId(job.id);
    try{
      const res=await fetch(`/api/admin/video/retry?jobId=${job.id}`,{method:'POST'});
      const data=await res.json();
      if(!data.success){showToast('Retry failed: '+(data.error??'unknown'),false);return;}
      showToast('Retry queued…');await loadJobs();
    }catch(e:any){showToast('Retry error: '+e.message,false);}
    finally{setRetryingId(null);}
  }

  async function handleDelete(job:UnifiedJob){
    if(!confirm('Delete this video?'))return;
    const url=job.type==='kinetic'?`/api/admin/video/delete?jobId=${job.id}`:`/api/admin/clip-cta/delete?jobId=${job.id}`;
    try{
      const res=await fetch(url,{method:'POST'});
      const data=await res.json();
      if(!data.success){showToast('Delete failed: '+(data.error??'unknown'),false);return;}
      showToast('Deleted.');setJobs(prev=>prev.filter(j=>j.id!==job.id));
    }catch(e:any){showToast('Delete error: '+e.message,false);}
  }

  const inFlightJobs =jobs.filter(j=>j.status==='queued'||j.status==='processing');
  const completedJobs=jobs.filter(j=>j.status==='complete');
  const failedJobs   =jobs.filter(j=>j.status==='failed');
  const isEmpty=!loading&&jobs.length===0;

  return(
    <div style={{minHeight:'100vh',background:WARM,padding:'28px 16px 120px'}}>
      <div style={{maxWidth:680,margin:'0 auto'}}>

        <div style={{marginBottom:28}}>
          <div style={{...MONO,fontSize:10,color:AMBER,letterSpacing:'0.12em',textTransform:'uppercase',marginBottom:5}}>Admin · Video Engine</div>
          <h1 style={{fontSize:26,fontWeight:600,color:DARK,margin:0,marginBottom:4,...SYNE}}>Videos</h1>
          <p style={{...MONO,fontSize:11,color:MUTED,margin:0}}>Kinetic text · Clip+CTA</p>
        </div>

        {inFlightJobs.length>0&&(
          <div style={{marginBottom:28}}>
            <SectionHead label={`Rendering now (${inFlightJobs.length})`}/>
            {inFlightJobs.map(j=><JobCard key={j.id} job={j} onDelete={handleDelete} onRetry={handleRetry} retrying={retryingId===j.id}/>)}
          </div>
        )}

        {completedJobs.length>0&&(
          <div style={{marginBottom:28}}>
            <SectionHead label={`Completed (${completedJobs.length})`}/>
            {completedJobs.map(j=><JobCard key={j.id} job={j} onDelete={handleDelete} onRetry={handleRetry} retrying={retryingId===j.id}/>)}
          </div>
        )}

        {isEmpty&&(
          <div style={{textAlign:'center',padding:'60px 0'}}>
            <div style={{fontSize:40,marginBottom:12}}>🎬</div>
            <div style={{...MONO,fontSize:12,color:MUTED,marginBottom:6}}>No videos yet</div>
            <div style={{...MONO,fontSize:10,color:FAINT}}>Tap + to create your first video</div>
          </div>
        )}

        {loading&&<div style={{...MONO,fontSize:11,color:FAINT,textAlign:'center',padding:'40px 0'}}>Loading…</div>}

        {failedJobs.length>0&&(
          <div style={{marginTop:8}}>
            <SectionHead label={`Failed (${failedJobs.length})`} color="#EF4444"/>
            {failedJobs.map(j=><JobCard key={j.id} job={j} onDelete={handleDelete} onRetry={handleRetry} retrying={retryingId===j.id}/>)}
          </div>
        )}
      </div>

      {/* FAB cluster */}
      <div style={{position:'fixed',bottom:28,right:20,zIndex:100,display:'flex',flexDirection:'column',alignItems:'flex-end',gap:10}}>
        {fabOpen&&(
          <>
            <button onClick={()=>{setFabOpen(false);setClipCTADrawer(true);}} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 16px',borderRadius:24,background:'#4F46E5',color:'#fff',border:'none',...MONO,fontSize:12,fontWeight:700,cursor:'pointer',boxShadow:'0 4px 20px rgba(0,0,0,0.2)',whiteSpace:'nowrap'}}>
              🎬 Clip + CTA
            </button>
            <button onClick={()=>{setFabOpen(false);setKineticDrawer(true);}} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 16px',borderRadius:24,background:'#E8A020',color:'#0C0B08',border:'none',...MONO,fontSize:12,fontWeight:700,cursor:'pointer',boxShadow:'0 4px 20px rgba(0,0,0,0.2)',whiteSpace:'nowrap'}}>
              ✦ Kinetic video
            </button>
          </>
        )}
        <button onClick={()=>setFabOpen(o=>!o)} style={{width:54,height:54,borderRadius:'50%',background:'#E8A020',color:'#0C0B08',border:'none',fontSize:24,cursor:'pointer',boxShadow:'0 4px 24px rgba(0,0,0,0.22)',display:'flex',alignItems:'center',justifyContent:'center',transform:fabOpen?'rotate(45deg)':'none',transition:'transform 0.2s'}}>+</button>
      </div>

      <VideoDrawer open={kineticDrawer} onClose={()=>{setKineticDrawer(false);loadJobs();}} showToast={showToast}/>
      <ClipCTADrawer open={clipCTADrawer} onClose={()=>{setClipCTADrawer(false);loadJobs();}} showToast={showToast} onJobCreated={loadJobs}/>

      {toast&&(
        <div style={{position:'fixed',bottom:24,left:'50%',transform:'translateX(-50%)',background:toast.ok?'#1E1C17':'#7C2D2D',color:'#fff',padding:'10px 18px',borderRadius:8,...MONO,fontSize:12,boxShadow:'0 8px 32px rgba(0,0,0,0.18)',zIndex:300,maxWidth:'80%',whiteSpace:'nowrap'}}>{toast.msg}</div>
      )}

      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.3}}`}</style>
    </div>
  );
}
