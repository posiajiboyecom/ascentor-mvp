'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  ROLE_PERMISSIONS,
  PERMISSION_LABELS,
  type Permission,
  type UserRole,
} from '@/lib/permissions';

const G = {
  font: "'Syne', system-ui, sans-serif", mono: "'DM Mono', monospace",
  serif: "'Cormorant Garamond', Georgia, serif",
  gold: '#E8A020', goldPale: 'rgba(232,160,32,0.08)', goldBord: 'rgba(232,160,32,0.22)',
  teal: '#14B8A6', tealPale: 'rgba(20,184,166,0.08)', tealBord: 'rgba(20,184,166,0.22)',
  red: '#EF4444',  redPale:  'rgba(239,68,68,0.08)',  redBord:  'rgba(239,68,68,0.2)',
};

type Staff = { id: string; full_name: string|null; email: string; role: UserRole; permissions: Permission[]|null; };

const ADMIN_ONLY: Permission[] = [
  'users.edit_role','users.delete','users.export',
  'content.blog.delete','content.courses.delete','content.courses.publish',
  'experts.delete',
  'newsletter.send','newsletter.manage_subscribers',
  'audit.view_logs','security.view_sessions',
  'reports.export','payments.view','payments.refund',
];

const GROUPS = Object.entries(PERMISSION_LABELS).reduce<Record<string,{key:Permission;label:string;description:string;page?:string}[]>>((acc,[k,v])=>{
  if(!acc[v.group]) acc[v.group]=[];
  if(!acc[v.group].find(e=>e.key===k)) acc[v.group].push({key:k as Permission,label:v.label,description:v.description,page:v.page});
  return acc;
},{});

export default function PermissionsPage() {
  const sb = createClient();
  const [staff,setStaff]=useState<Staff[]>([]);
  const [sel,setSel]=useState<Staff|null>(null);
  const [draft,setDraft]=useState<Permission[]>([]);
  const [saving,setSaving]=useState(false);
  const [saved,setSaved]=useState(false);
  const [loading,setLoading]=useState(true);
  const [myRole,setMyRole]=useState<UserRole|null>(null);
  const [search,setSearch]=useState('');
  const [searching,setSearching]=useState(false);
  const [found,setFound]=useState<Staff|null|'none'>(null);
  const timer=useRef<any>(null);

  useEffect(()=>{init();},[]);

  async function init(){
    setLoading(true);
    const {data:{user}}=await sb.auth.getUser();
    if(user){const{data:me}=await sb.from('profiles').select('role').eq('id',user.id).single();setMyRole(me?.role as UserRole||null);}
    const{data}=await sb.from('profiles').select('id,full_name,email,role,permissions').in('role',['admin','moderator']).order('role').order('full_name');
    setStaff(data||[]);setLoading(false);
  }

  function pick(m:Staff){setSel(m);setSaved(false);setDraft(m.permissions?.length?[...m.permissions]:[...(ROLE_PERMISSIONS[m.role]||[])]);}

  async function doSearch(email: string) {
    setSearching(true);
    setFound(null);
    try {
      const res = await fetch('/api/admin/users', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ email: email.trim() }) });
      const d = await res.json();
      setFound(d.user ? d.user as Staff : 'none');
    } catch(err) {
      console.error('find-user error:', err);
      setFound('none');
    } finally {
      setSearching(false);
    }
  }

  function onSearch(e:React.ChangeEvent<HTMLInputElement>){
    const v=e.target.value;setSearch(v);setFound(null);
    if(timer.current)clearTimeout(timer.current);
    if(v.includes('@') && v.length > 5)
      timer.current=setTimeout(()=>doSearch(v), 700);
  }

  async function grant(m:Staff){
    const base:Permission[]=['admin.access','admin.view_stats'];
    await sb.from('profiles').update({role:'moderator',permissions:base}).eq('id',m.id);
    const u={...m,role:'moderator' as UserRole,permissions:base};
    setStaff(p=>[...p.filter(s=>s.id!==m.id),u].sort((a,b)=>a.role.localeCompare(b.role)));
    setSearch('');setFound(null);pick(u);
  }

  async function revoke(m:Staff){
    if(!confirm(`Remove ${m.full_name||m.email} from the admin team?`))return;
    await sb.from('profiles').update({role:'member',permissions:null}).eq('id',m.id);
    setStaff(p=>p.filter(s=>s.id!==m.id));
    if(sel?.id===m.id)setSel(null);
  }

  function toggle(p:Permission){if(ADMIN_ONLY.includes(p))return;setDraft(d=>d.includes(p)?d.filter(x=>x!==p):[...d,p]);setSaved(false);}

  function allOn(group:string){
    const ps=(GROUPS[group]||[]).map(x=>x.key).filter(x=>!ADMIN_ONLY.includes(x));
    setDraft(d=>{const n=new Set(d);ps.forEach(p=>n.add(p));return[...n]});setSaved(false);
  }
  function allOff(group:string){
    const ps=(GROUPS[group]||[]).map(x=>x.key);
    setDraft(d=>d.filter(p=>!ps.includes(p)));setSaved(false);
  }

  async function save(){
    if(!sel)return;setSaving(true);
    const ts=draft.length>0&&!draft.includes('admin.access')?['admin.access' as Permission,...draft]:draft;
    await sb.from('profiles').update({permissions:ts}).eq('id',sel.id);
    setStaff(p=>p.map(s=>s.id===sel.id?{...s,permissions:ts}:s));
    setSel(p=>p?{...p,permissions:ts}:null);
    setSaving(false);setSaved(true);
  }

  const inp:React.CSSProperties={width:'100%',padding:'10px 14px',borderRadius:8,border:'1px solid var(--admin-bg-input)',background:'var(--admin-bg)',color:'var(--admin-text)',fontFamily:G.mono,fontSize:12,outline:'none',boxSizing:'border-box'};

  if(myRole!=='admin')return <div style={{padding:'60px 0',textAlign:'center'}}><p style={{fontFamily:G.serif,fontSize:28,color:'var(--admin-text-faint)'}}>Admin only</p></div>;

  return(
    <>
      <style>{`.pm-card{background:var(--admin-bg-card);border:1px solid var(--admin-bg-input);border-radius:12px}.pm-row{padding:14px 16px;border-radius:10px;cursor:pointer;transition:all .12s}.pm-row:hover{background:var(--admin-bg-input)}.pm-row.sel{background:${G.goldPale};border:1px solid ${G.goldBord}}.pm-p{display:flex;align-items:flex-start;gap:12px;padding:10px 12px;border-radius:8px;cursor:pointer;border:1px solid transparent;transition:all .12s}.pm-p:hover{background:var(--admin-bg-input)}.pm-p.on{background:${G.goldPale};border-color:${G.goldBord}}.pm-p.grant{background:${G.tealPale};border-color:${G.tealBord}}.pm-p.locked{cursor:not-allowed;opacity:.4}@media(max-width:768px){.pm-wrap{flex-direction:column!important}}`}</style>

      <div style={{fontFamily:G.font}}>
        <div style={{marginBottom:28}}>
          <h1 style={{fontFamily:G.serif,fontSize:'clamp(24px,3vw,32px)',fontWeight:700,color:'var(--admin-text-heading)',margin:0}}>Team Permissions</h1>
          <p style={{fontFamily:G.mono,fontSize:11,color:'var(--admin-text-faint)',marginTop:6,letterSpacing:'0.04em'}}>ADD TEAM MEMBERS · CONTROL EXACTLY WHAT EACH PERSON CAN ACCESS AND DO</p>
          <div style={{height:1,background:`linear-gradient(90deg,${G.gold},transparent 60%)`,marginTop:16}}/>
        </div>

        {/* Search */}
        <div className="pm-card" style={{padding:20,marginBottom:20}}>
          <p style={{fontFamily:G.mono,fontSize:10,color:G.gold,letterSpacing:'0.1em',marginBottom:12}}>ADD TEAM MEMBER BY EMAIL</p>
          <input style={{...inp}} placeholder="team@example.com" value={search} onChange={onSearch}/>
          {searching&&<p style={{fontFamily:G.mono,fontSize:11,color:'var(--admin-text-faint)',marginTop:8}}>Searching…</p>}
          {found&&found!=='none'&&(
            <div style={{marginTop:12,padding:'14px 16px',borderRadius:10,background:'var(--admin-bg)',border:`1px solid ${G.goldBord}`,display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,flexWrap:'wrap'}}>
              <div>
                <p style={{fontFamily:G.font,fontWeight:600,fontSize:14,color:'var(--admin-text)',margin:0}}>{(found as Staff).full_name||'—'}</p>
                <p style={{fontFamily:G.mono,fontSize:11,color:'var(--admin-text-faint)',margin:'3px 0 0'}}>{(found as Staff).email} · currently: {(found as Staff).role}</p>
              </div>
              {(found as Staff).role==='member'?(
                <button onClick={()=>grant(found as Staff)} style={{padding:'8px 18px',borderRadius:8,border:'none',background:G.gold,color:'#0C0B08',fontFamily:G.font,fontSize:13,fontWeight:700,cursor:'pointer'}}>Grant Admin Access →</button>
              ):(
                <span style={{fontFamily:G.mono,fontSize:11,color:G.teal}}>Already in team — select from list</span>
              )}
            </div>
          )}
          {found==='none'&&<p style={{fontFamily:G.mono,fontSize:11,color:G.red,marginTop:10}}>No user found. They need to sign up on Ascentor first.</p>}
        </div>

        <div className="pm-wrap" style={{display:'flex',gap:20,alignItems:'flex-start'}}>

          {/* List */}
          <div style={{flex:'0 0 260px',display:'flex',flexDirection:'column',gap:8}}>
            <p style={{fontFamily:G.mono,fontSize:10,color:'var(--admin-text-faint)',letterSpacing:'0.08em',textTransform:'uppercase' as const,marginBottom:4}}>
              Team ({staff.length})
            </p>
            {loading?<p style={{fontFamily:G.mono,fontSize:11,color:'var(--admin-text-faint)'}}>Loading…</p>
            :staff.length===0?<div className="pm-card" style={{padding:20,textAlign:'center'}}><p style={{fontFamily:G.mono,fontSize:11,color:'var(--admin-text-faint)'}}>No team members yet</p></div>
            :staff.map(m=>(
              <div key={m.id} className={`pm-row${sel?.id===m.id?' sel':''}`} style={{borderLeft:`3px solid ${m.role==='admin'?G.gold:G.teal}`}} onClick={()=>pick(m)}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <p style={{fontFamily:G.font,fontWeight:600,fontSize:13,color:'var(--admin-text)',margin:0}}>{m.full_name||'—'}</p>
                  <span style={{fontFamily:G.mono,fontSize:9,padding:'2px 7px',borderRadius:100,background:m.role==='admin'?G.goldPale:G.tealPale,color:m.role==='admin'?G.gold:G.teal,border:`1px solid ${m.role==='admin'?G.goldBord:G.tealBord}`}}>
                    {m.role==='admin'?'⬡ Admin':'◈ Mod'}
                  </span>
                </div>
                <p style={{fontFamily:G.mono,fontSize:10,color:'var(--admin-text-faint)',margin:'3px 0 0',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' as const}}>{m.email}</p>
                {m.permissions&&m.permissions.length>0&&<p style={{fontFamily:G.mono,fontSize:10,color:G.gold,margin:'4px 0 0'}}>{m.permissions.length} permissions set</p>}
              </div>
            ))}
          </div>

          {/* Editor */}
          {sel?(
            <div className="pm-card" style={{flex:1,minWidth:0,overflow:'hidden',position:'sticky',top:80}}>
              <div style={{padding:'18px 22px',borderBottom:'1px solid var(--admin-bg-input)',background:'var(--admin-bg-deep)'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',flexWrap:'wrap',gap:12}}>
                  <div>
                    <p style={{fontFamily:G.serif,fontSize:20,fontWeight:700,color:'var(--admin-text-heading)',margin:0}}>{sel.full_name||sel.email}</p>
                    <p style={{fontFamily:G.mono,fontSize:10,color:'var(--admin-text-faint)',margin:'4px 0 0'}}>{sel.email} · {sel.role}</p>
                  </div>
                  <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                    {sel.role!=='admin'&&<button onClick={()=>revoke(sel)} style={{fontFamily:G.font,fontSize:11,fontWeight:600,padding:'7px 14px',borderRadius:8,cursor:'pointer',background:G.redPale,color:G.red,border:`1px solid ${G.redBord}`}}>Remove from team</button>}
                    <button onClick={()=>{setDraft([...(ROLE_PERMISSIONS[sel.role]||[])]);setSaved(false);}} style={{fontFamily:G.font,fontSize:11,fontWeight:600,padding:'7px 14px',borderRadius:8,cursor:'pointer',background:'transparent',color:'var(--admin-text-muted)',border:'1px solid var(--admin-bg-input)'}}>Reset defaults</button>
                    <button onClick={save} disabled={saving} style={{fontFamily:G.font,fontSize:11,fontWeight:700,padding:'7px 18px',borderRadius:8,cursor:saving?'not-allowed':'pointer',background:saved?G.tealPale:G.goldPale,color:saved?G.teal:G.gold,border:`1px solid ${saved?G.tealBord:G.goldBord}`,opacity:saving?.6:1}}>
                      {saving?'Saving…':saved?'✓ Saved':'Save Changes'}
                    </button>
                  </div>
                </div>
                {sel.role==='admin'&&<div style={{marginTop:14,padding:'10px 14px',borderRadius:8,background:G.goldPale,border:`1px solid ${G.goldBord}`}}><p style={{fontFamily:G.mono,fontSize:10,color:G.gold,margin:0}}>⬡ ROOT ADMIN — Always has full access. Permissions cannot be restricted.</p></div>}
              </div>

              <div style={{overflowY:'auto',maxHeight:'calc(100vh - 340px)',padding:'4px 0'}}>
                {Object.entries(GROUPS).map(([group,perms])=>{
                  const grantable=perms.filter(p=>!ADMIN_ONLY.includes(p.key));
                  return(
                    <div key={group} style={{padding:'16px 22px',borderBottom:'1px solid var(--admin-bg-input)'}}>
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
                        <div>
                          <p style={{fontFamily:G.mono,fontSize:10,fontWeight:500,letterSpacing:'0.08em',textTransform:'uppercase' as const,color:'var(--admin-text-muted)',margin:0}}>{group}</p>
                          {perms[0]?.page&&<p style={{fontFamily:G.mono,fontSize:9,color:'var(--admin-text-faint)',margin:'2px 0 0'}}>{perms[0].page}</p>}
                        </div>
                        {sel.role!=='admin'&&grantable.length>0&&(
                          <div style={{display:'flex',gap:6}}>
                            <button onClick={()=>allOn(group)} style={{fontFamily:G.mono,fontSize:9,padding:'3px 8px',borderRadius:6,border:`1px solid ${G.goldBord}`,background:G.goldPale,color:G.gold,cursor:'pointer'}}>ALL</button>
                            <button onClick={()=>allOff(group)} style={{fontFamily:G.mono,fontSize:9,padding:'3px 8px',borderRadius:6,border:'1px solid var(--admin-bg-input)',background:'transparent',color:'var(--admin-text-faint)',cursor:'pointer'}}>NONE</button>
                          </div>
                        )}
                      </div>
                      <div style={{display:'flex',flexDirection:'column',gap:6}}>
                        {perms.map(({key,label,description})=>{
                          const adminOnly=ADMIN_ONLY.includes(key);
                          const on=sel.role==='admin'?true:draft.includes(key);
                          const isDefault=(ROLE_PERMISSIONS[sel.role]||[]).includes(key);
                          const customGrant=on&&!isDefault;
                          const revoked=!on&&isDefault;
                          const locked=sel.role==='admin'||adminOnly;
                          return(
                            <div key={key} className={`pm-p${locked?' locked':customGrant?' grant':on?' on':''}`} onClick={()=>!locked&&toggle(key)}>
                              <div style={{width:18,height:18,borderRadius:5,flexShrink:0,marginTop:1,background:on?(customGrant?G.teal:G.gold):'transparent',border:`1.5px solid ${on?'transparent':'var(--admin-text-faint)'}`,display:'flex',alignItems:'center',justifyContent:'center'}}>
                                {on&&<svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="var(--admin-bg)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                              </div>
                              <div style={{flex:1,minWidth:0}}>
                                <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
                                  <span style={{fontFamily:G.font,fontSize:13,fontWeight:600,color:on?'var(--admin-text)':'var(--admin-text-faint)'}}>{label}</span>
                                  {adminOnly&&<span style={{fontFamily:G.mono,fontSize:9,color:G.gold,background:G.goldPale,border:`1px solid ${G.goldBord}`,padding:'1px 6px',borderRadius:4}}>ADMIN ONLY</span>}
                                  {customGrant&&<span style={{fontFamily:G.mono,fontSize:9,color:G.teal,background:G.tealPale,border:`1px solid ${G.tealBord}`,padding:'1px 6px',borderRadius:4}}>GRANTED</span>}
                                  {revoked&&<span style={{fontFamily:G.mono,fontSize:9,color:G.red,background:G.redPale,border:`1px solid ${G.redBord}`,padding:'1px 6px',borderRadius:4}}>REVOKED</span>}
                                </div>
                                <p style={{fontFamily:G.font,fontSize:12,color:'var(--admin-text-faint)',margin:'2px 0 0',lineHeight:1.4}}>{description}</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
                <div style={{height:24}}/>
              </div>
            </div>
          ):(
            <div className="pm-card" style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',padding:'80px 40px'}}>
              <div style={{textAlign:'center'}}>
                <p style={{fontFamily:G.serif,fontSize:28,color:'var(--admin-text-faint)',margin:0}}>Select a team member</p>
                <p style={{fontFamily:G.mono,fontSize:11,color:'var(--admin-text-faint)',marginTop:8}}>Choose from the list or add someone new above</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
