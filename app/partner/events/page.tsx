'use client';
// app/partner/events/page.tsx — partner expert event scheduler with tier gating
export const dynamic = 'force-dynamic';
import { useState, useEffect, useCallback } from 'react';
import { useApiBase } from '@/lib/useApiBase';
const S: Record<string,React.CSSProperties> = {
  card:  { background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'10px', padding:'20px' },
  label: { fontSize:'11px', fontWeight:700, textTransform:'uppercase' as const, letterSpacing:'0.06em', color:'rgba(255,255,255,0.35)', marginBottom:'6px', display:'block' },
  input: { width:'100%', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'7px', padding:'9px 12px', color:'#f8fafc', fontSize:'13px', outline:'none', boxSizing:'border-box' as const },
  btn:   { padding:'9px 20px', borderRadius:'7px', border:'none', fontSize:'13px', fontWeight:600, cursor:'pointer' },
};

interface Event { id:string; title:string; expert_name:string; expert_bio:string|null; scheduled_at:string; duration_minutes:number; max_attendees:number|null; meeting_url:string|null; topic:string|null; status:string; current_attendees:number; }
interface TierInfo { name:string; maxPerMonth:number; featureEnabled:boolean; eventsThisMonth:number; canCreate:boolean; }

const STATUS_STYLE: Record<string,{ bg:string; color:string }> = {
  draft:     { bg:'rgba(255,255,255,0.06)',  color:'rgba(255,255,255,0.4)' },
  published: { bg:'rgba(16,185,129,0.12)',   color:'#10B981' },
  cancelled: { bg:'rgba(239,68,68,0.1)',     color:'#EF4444' },
  completed: { bg:'rgba(139,92,246,0.12)',   color:'#8B5CF6' },
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-NG', { weekday:'short', day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });
}

export default function PartnerEventsPage() {
  const apiBase = useApiBase();
  const [events,   setEvents]   = useState<Event[]>([]);
  const [tier,     setTier]     = useState<TierInfo|null>(null);
  const [loading,  setLoading]  = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState('');
  const [view,     setView]     = useState<'upcoming'|'past'>('upcoming');
  const [form, setForm] = useState({
    title:'', expert_name:'', expert_bio:'', scheduled_at:'', duration_minutes:'60',
    max_attendees:'', meeting_url:'', topic:'', description:'',
  });

  const load = useCallback(async () => {
    setLoading(true);
    const [eRes, sRes] = await Promise.all([
      fetch(`${apiBase}/api/partner/events?view=${view}`),
      fetch(`${apiBase}/api/partner/subscription`),
    ]);
    const [eData, sData] = await Promise.all([eRes.json(), sRes.json()]);
    if (!eRes.ok) { setError(eData.error||'Failed to load'); setLoading(false); return; }
    setEvents(eData.events || []);
    if (eRes.ok) setTier({
      name:           eData.tier?.name        ?? '',
      maxPerMonth:    eData.tier?.maxEventsPerMonth ?? 0,
      featureEnabled: eData.tier?.featureEnabled ?? false,
      eventsThisMonth: eData.tier?.eventsThisMonth ?? 0,
      canCreate:      eData.tier?.canCreate   ?? false,
    });
    setLoading(false);
  }, [view, apiBase]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    if (!form.title.trim())       { setError('Title is required.'); return; }
    if (!form.expert_name.trim()) { setError('Expert name is required.'); return; }
    if (!form.scheduled_at)       { setError('Scheduled date is required.'); return; }
    setSaving(true); setError('');
    const res  = await fetch(`${apiBase}/api/partner/events`, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ ...form, duration_minutes: Number(form.duration_minutes)||60, max_attendees: form.max_attendees ? Number(form.max_attendees) : null }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error||'Failed to create event.'); setSaving(false); return; }
    setShowForm(false);
    setForm({ title:'', expert_name:'', expert_bio:'', scheduled_at:'', duration_minutes:'60', max_attendees:'', meeting_url:'', topic:'', description:'' });
    await load(); setSaving(false);
  };

  const setStatus = async (id:string, status:string) => {
    if (status==='cancelled' && !confirm('Cancel this event? Registered attendees will not be automatically notified.')) return;
    await fetch(`${apiBase}/api/partner/events`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ eventId:id, status }) });
    await load();
  };

  const deleteEvent = async (id:string) => {
    if (!confirm('Delete this draft event?')) return;
    await fetch(`${apiBase}/api/partner/events?eventId=${id}`, { method:'DELETE' });
    await load();
  };

  if (loading) return <div style={{ color:'rgba(255,255,255,0.4)', fontSize:'13px' }}>Loading…</div>;

  // Locked state
  if (tier && !tier.featureEnabled) return (
    <div style={{ maxWidth:'560px' }}>
      <h1 style={{ fontSize:'20px', fontWeight:500, color:'#f8fafc', marginBottom:'4px' }}>Expert Events</h1>
      <p style={{ fontSize:'13px', color:'rgba(255,255,255,0.4)', marginBottom:'28px' }}>Schedule live sessions, masterclasses, and Q&amp;As for your members.</p>
      <div style={{ ...S.card, border:'1px solid rgba(232,160,32,0.2)', background:'rgba(232,160,32,0.04)', textAlign:'center', padding:'48px 32px' }}>
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#E8A020" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin:'0 auto 12px', display:'block' }}>
          <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
        <p style={{ fontSize:'16px', fontWeight:600, color:'#f8fafc', marginBottom:'8px' }}>Available on Growth &amp; Pro</p>
        <p style={{ fontSize:'13px', color:'rgba(255,255,255,0.45)', marginBottom:'24px', lineHeight:1.6 }}>
          Schedule your own live sessions and masterclasses. Growth partners get 10 events per month. Pro partners get unlimited.
        </p>
        <a href="/admin/subscription" style={{ ...S.btn, background:'#E8A020', color:'#0C0B08', textDecoration:'none', display:'inline-block' }}>Upgrade to Growth →</a>
      </div>
    </div>
  );

  const atLimit = tier ? (tier.maxPerMonth !== -1 && tier.eventsThisMonth >= tier.maxPerMonth) : false;
  const monthStr = tier?.maxPerMonth === -1 ? 'Unlimited' : `${tier?.eventsThisMonth} of ${tier?.maxPerMonth} this month`;

  return (
    <div style={{ maxWidth:'720px' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'24px' }}>
        <div>
          <h1 style={{ fontSize:'20px', fontWeight:500, color:'#f8fafc', marginBottom:'4px' }}>Expert Events</h1>
          <p style={{ fontSize:'13px', color: atLimit?'#EF4444':'rgba(255,255,255,0.4)' }}>{monthStr}</p>
        </div>
        {!atLimit && !showForm
          ? <button onClick={() => setShowForm(true)} style={{ ...S.btn, background:'#E8A020', color:'#0C0B08' }}>+ Schedule event</button>
          : atLimit && <a href="/admin/subscription" style={{ ...S.btn, background:'rgba(255,255,255,0.05)', color:'rgba(255,255,255,0.4)', border:'1px solid rgba(255,255,255,0.1)', textDecoration:'none', display:'inline-block', fontSize:'12px' }}>Upgrade for unlimited</a>
        }
      </div>

      {error && <p style={{ color:'#EF4444', fontSize:'13px', marginBottom:'12px' }}>{error}</p>}

      {/* Create form */}
      {showForm && (
        <div style={{ ...S.card, marginBottom:'20px', border:'1px solid rgba(232,160,32,0.2)' }}>
          <p style={{ fontSize:'14px', fontWeight:600, color:'#f8fafc', marginBottom:'16px' }}>Schedule new event</p>
          <div style={{ display:'grid', gap:'12px' }}>
            <div><label style={S.label}>Event title *</label><input style={S.input} value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} placeholder="e.g. Breaking Into Product Management" /></div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
              <div><label style={S.label}>Expert / presenter name *</label><input style={S.input} value={form.expert_name} onChange={e=>setForm(f=>({...f,expert_name:e.target.value}))} placeholder="Amara Obi" /></div>
              <div><label style={S.label}>Topic / track</label><input style={S.input} value={form.topic} onChange={e=>setForm(f=>({...f,topic:e.target.value}))} placeholder="Leadership" /></div>
            </div>
            <div><label style={S.label}>Expert bio</label><textarea style={{ ...S.input, height:'60px', resize:'vertical' as const }} value={form.expert_bio} onChange={e=>setForm(f=>({...f,expert_bio:e.target.value}))} placeholder="Brief description of the presenter" /></div>
            <div><label style={S.label}>Event description</label><textarea style={{ ...S.input, height:'60px', resize:'vertical' as const }} value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} placeholder="What will attendees learn?" /></div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'12px' }}>
              <div><label style={S.label}>Date &amp; time *</label><input type="datetime-local" style={S.input} value={form.scheduled_at} onChange={e=>setForm(f=>({...f,scheduled_at:e.target.value}))} /></div>
              <div><label style={S.label}>Duration (minutes)</label><input type="number" style={S.input} value={form.duration_minutes} onChange={e=>setForm(f=>({...f,duration_minutes:e.target.value}))} min="15" max="480" /></div>
              <div><label style={S.label}>Max attendees</label><input type="number" style={S.input} value={form.max_attendees} onChange={e=>setForm(f=>({...f,max_attendees:e.target.value}))} placeholder="Leave blank for unlimited" /></div>
            </div>
            <div><label style={S.label}>Zoom / Meet link</label><input style={S.input} value={form.meeting_url} onChange={e=>setForm(f=>({...f,meeting_url:e.target.value}))} placeholder="https://zoom.us/j/..." /></div>
          </div>
          <div style={{ display:'flex', gap:'10px', marginTop:'16px' }}>
            <button onClick={handleCreate} disabled={saving} style={{ ...S.btn, background:saving?'rgba(232,160,32,0.5)':'#E8A020', color:'#0C0B08' }}>{saving?'Saving…':'Create event'}</button>
            <button onClick={() => { setShowForm(false); setError(''); }} style={{ ...S.btn, background:'transparent', color:'rgba(255,255,255,0.4)', border:'1px solid rgba(255,255,255,0.1)' }}>Cancel</button>
          </div>
        </div>
      )}

      {/* View toggle */}
      <div style={{ display:'flex', gap:'8px', marginBottom:'16px' }}>
        {(['upcoming','past'] as const).map(v => (
          <button key={v} onClick={() => setView(v)} style={{ ...S.btn, padding:'6px 16px', fontSize:'12px', background: view===v ? 'rgba(255,255,255,0.1)' : 'transparent', color: view===v ? '#f8fafc' : 'rgba(255,255,255,0.4)', border:'1px solid rgba(255,255,255,0.1)' }}>
            {v.charAt(0).toUpperCase()+v.slice(1)}
          </button>
        ))}
      </div>

      {/* Events list */}
      {events.length === 0
        ? <div style={{ ...S.card, textAlign:'center', padding:'40px' }}><p style={{ color:'rgba(255,255,255,0.35)', fontSize:'13px' }}>No {view} events. {view==='upcoming' && 'Schedule your first event above.'}</p></div>
        : <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
            {events.map(ev => {
              const ss = STATUS_STYLE[ev.status] || STATUS_STYLE.draft;
              return (
                <div key={ev.id} style={{ ...S.card }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:'12px' }}>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'4px' }}>
                        <p style={{ fontSize:'14px', fontWeight:500, color:'#f8fafc', margin:0 }}>{ev.title}</p>
                        <span style={{ fontSize:'10px', padding:'2px 7px', borderRadius:'20px', fontWeight:700, flexShrink:0, background:ss.bg, color:ss.color }}>{ev.status}</span>
                      </div>
                      <p style={{ fontSize:'12px', color:'rgba(255,255,255,0.5)', margin:'0 0 2px' }}>
                        {ev.expert_name}{ev.topic && ` · ${ev.topic}`}
                      </p>
                      <p style={{ fontSize:'12px', color:'rgba(255,255,255,0.35)', margin:0 }}>
                        {formatDate(ev.scheduled_at)} · {ev.duration_minutes}min
                        {ev.max_attendees && ` · ${ev.current_attendees}/${ev.max_attendees} registered`}
                        {!ev.max_attendees && ev.current_attendees > 0 && ` · ${ev.current_attendees} registered`}
                      </p>
                    </div>
                    <div style={{ display:'flex', gap:'6px', flexShrink:0 }}>
                      {ev.status === 'draft' && (
                        <>
                          <button onClick={() => setStatus(ev.id,'published')} style={{ ...S.btn, padding:'5px 12px', fontSize:'12px', background:'rgba(16,185,129,0.1)', color:'#10B981', border:'1px solid rgba(16,185,129,0.2)' }}>Publish</button>
                          <button onClick={() => deleteEvent(ev.id)} style={{ ...S.btn, padding:'5px 8px', fontSize:'12px', background:'transparent', color:'#EF4444', border:'1px solid rgba(239,68,68,0.2)' }}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                          </button>
                        </>
                      )}
                      {ev.status === 'published' && (
                        <>
                          <button onClick={() => setStatus(ev.id,'draft')} style={{ ...S.btn, padding:'5px 12px', fontSize:'12px', background:'rgba(255,255,255,0.06)', color:'rgba(255,255,255,0.4)', border:'1px solid rgba(255,255,255,0.1)' }}>Unpublish</button>
                          <button onClick={() => setStatus(ev.id,'cancelled')} style={{ ...S.btn, padding:'5px 12px', fontSize:'12px', background:'transparent', color:'#EF4444', border:'1px solid rgba(239,68,68,0.2)' }}>Cancel</button>
                        </>
                      )}
                      {ev.meeting_url && ev.status === 'published' && (
                        <a href={ev.meeting_url} target="_blank" rel="noopener noreferrer" style={{ ...S.btn, padding:'5px 12px', fontSize:'12px', background:'rgba(232,160,32,0.1)', color:'#E8A020', border:'1px solid rgba(232,160,32,0.2)', textDecoration:'none' }}>Join link</a>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
      }
    </div>
  );
}
