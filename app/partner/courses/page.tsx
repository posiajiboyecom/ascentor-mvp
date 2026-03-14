'use client';
// app/partner/courses/page.tsx — full partner course manager with tier gating
export const dynamic = 'force-dynamic';
import { useState, useEffect, useCallback } from 'react';

const DIFF_OPTS = ['beginner','intermediate','advanced'];
const CAT_OPTS  = ['Leadership','Career Development','Tech Skills','Soft Skills','Finance','Entrepreneurship','Other'];

const S: Record<string,React.CSSProperties> = {
  card:  { background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'10px', padding:'20px' },
  label: { fontSize:'11px', fontWeight:700, textTransform:'uppercase' as const, letterSpacing:'0.06em', color:'rgba(255,255,255,0.35)', marginBottom:'6px', display:'block' },
  input: { width:'100%', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'7px', padding:'9px 12px', color:'#f8fafc', fontSize:'13px', outline:'none', boxSizing:'border-box' as const },
  btn:   { padding:'9px 20px', borderRadius:'7px', border:'none', fontSize:'13px', fontWeight:600, cursor:'pointer' },
};

interface Course { id:string; title:string; description:string|null; youtube_id:string; thumbnail_url:string|null; category:string|null; difficulty:string|null; is_published:boolean; }
interface TierInfo { name:string; maxCourses:number; featureEnabled:boolean; courseCount:number; }

export default function PartnerCoursesPage() {
  const [courses,  setCourses]  = useState<Course[]>([]);
  const [tier,     setTier]     = useState<TierInfo|null>(null);
  const [loading,  setLoading]  = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState('');
  const [form, setForm] = useState({ title:'', description:'', youtube_id:'', difficulty:'', category:'' });

  const load = useCallback(async () => {
    setLoading(true);
    const [cRes, sRes] = await Promise.all([fetch('/api/partner/courses'), fetch('/api/partner/subscription')]);
    const [cData, sData] = await Promise.all([cRes.json(), sRes.json()]);
    if (!cRes.ok) { setError(cData.error||'Failed to load'); setLoading(false); return; }
    setCourses(cData.courses || []);
    if (sRes.ok) {
      const t = sData.plan?.tier;
      const cfg = sData.allTiers?.[t];
      setTier({ name: sData.plan?.name, maxCourses: cfg?.maxCourses ?? 0, featureEnabled: sData.plan?.features?.ownCourses ?? false, courseCount: sData.usage?.courses?.current ?? 0 });
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    if (!form.title.trim() || !form.youtube_id.trim()) { setError('Title and YouTube URL are required.'); return; }
    setSaving(true); setError('');
    const res = await fetch('/api/partner/courses', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(form) });
    const data = await res.json();
    if (!res.ok) { setError(data.error||'Failed to create.'); setSaving(false); return; }
    setShowForm(false);
    setForm({ title:'', description:'', youtube_id:'', difficulty:'', category:'' });
    await load(); setSaving(false);
  };

  const togglePublish = async (c: Course) => {
    await fetch('/api/partner/courses', { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ courseId:c.id, is_published:!c.is_published }) });
    await load();
  };

  const deleteCourse = async (id: string) => {
    if (!confirm('Delete this course?')) return;
    await fetch(`/api/partner/courses?courseId=${id}`, { method:'DELETE' });
    await load();
  };

  if (loading) return <div style={{ color:'rgba(255,255,255,0.4)', fontSize:'13px' }}>Loading…</div>;

  if (tier && !tier.featureEnabled) return (
    <div style={{ maxWidth:'560px' }}>
      <h1 style={{ fontSize:'20px', fontWeight:500, color:'#f8fafc', marginBottom:'4px' }}>Courses</h1>
      <p style={{ fontSize:'13px', color:'rgba(255,255,255,0.4)', marginBottom:'28px' }}>Create and publish your own course library.</p>
      <div style={{ ...S.card, border:'1px solid rgba(232,160,32,0.2)', background:'rgba(232,160,32,0.04)', textAlign:'center', padding:'48px 32px' }}>
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#E8A020" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin:'0 auto 12px', display:'block' }}><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
        <p style={{ fontSize:'16px', fontWeight:600, color:'#f8fafc', marginBottom:'8px' }}>Available on Growth &amp; Pro</p>
        <p style={{ fontSize:'13px', color:'rgba(255,255,255,0.45)', marginBottom:'24px', lineHeight:1.6 }}>Create your own branded course library with YouTube videos, difficulty levels, and categories.</p>
        <a href="/partner/subscription" style={{ ...S.btn, background:'#E8A020', color:'#0C0B08', textDecoration:'none', display:'inline-block' }}>Upgrade to Growth →</a>
      </div>
    </div>
  );

  const atLimit = tier ? (tier.maxCourses !== -1 && courses.length >= tier.maxCourses) : false;
  const limitStr = tier?.maxCourses === -1 ? `${courses.length} courses` : `${courses.length} of ${tier?.maxCourses}`;

  return (
    <div style={{ maxWidth:'720px' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'24px' }}>
        <div>
          <h1 style={{ fontSize:'20px', fontWeight:500, color:'#f8fafc', marginBottom:'4px' }}>Courses</h1>
          <p style={{ fontSize:'13px', color:'rgba(255,255,255,0.4)' }}>
            {limitStr} used{tier?.maxCourses !== -1 && <span style={{ color: atLimit?'#EF4444':'rgba(255,255,255,0.25)' }}> — {tier?.name} plan</span>}
          </p>
        </div>
        {!atLimit && !showForm
          ? <button onClick={() => setShowForm(true)} style={{ ...S.btn, background:'#E8A020', color:'#0C0B08' }}>+ Add course</button>
          : atLimit && <a href="/partner/subscription" style={{ ...S.btn, background:'rgba(255,255,255,0.05)', color:'rgba(255,255,255,0.4)', border:'1px solid rgba(255,255,255,0.1)', textDecoration:'none', display:'inline-block', fontSize:'12px' }}>Upgrade for more</a>
        }
      </div>

      {error && <p style={{ color:'#EF4444', fontSize:'13px', marginBottom:'12px' }}>{error}</p>}

      {showForm && (
        <div style={{ ...S.card, marginBottom:'20px', border:'1px solid rgba(232,160,32,0.2)' }}>
          <p style={{ fontSize:'14px', fontWeight:600, color:'#f8fafc', marginBottom:'16px' }}>New course</p>
          <div style={{ display:'grid', gap:'12px' }}>
            <div><label style={S.label}>Title *</label><input style={S.input} value={form.title} onChange={e => setForm(f=>({...f,title:e.target.value}))} placeholder="e.g. Mastering Product Strategy" /></div>
            <div><label style={S.label}>YouTube URL or video ID *</label><input style={S.input} value={form.youtube_id} onChange={e => setForm(f=>({...f,youtube_id:e.target.value}))} placeholder="https://youtube.com/watch?v=..." /></div>
            <div><label style={S.label}>Description</label><textarea style={{ ...S.input, height:'72px', resize:'vertical' as const }} value={form.description} onChange={e => setForm(f=>({...f,description:e.target.value}))} /></div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
              <div><label style={S.label}>Difficulty</label>
                <select style={S.input} value={form.difficulty} onChange={e => setForm(f=>({...f,difficulty:e.target.value}))}>
                  <option value="">Select…</option>{DIFF_OPTS.map(d=><option key={d} value={d}>{d.charAt(0).toUpperCase()+d.slice(1)}</option>)}
                </select>
              </div>
              <div><label style={S.label}>Category</label>
                <select style={S.input} value={form.category} onChange={e => setForm(f=>({...f,category:e.target.value}))}>
                  <option value="">Select…</option>{CAT_OPTS.map(c=><option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
          </div>
          <div style={{ display:'flex', gap:'10px', marginTop:'16px' }}>
            <button onClick={handleCreate} disabled={saving} style={{ ...S.btn, background:saving?'rgba(232,160,32,0.5)':'#E8A020', color:'#0C0B08' }}>{saving?'Saving…':'Create course'}</button>
            <button onClick={() => { setShowForm(false); setError(''); }} style={{ ...S.btn, background:'transparent', color:'rgba(255,255,255,0.4)', border:'1px solid rgba(255,255,255,0.1)' }}>Cancel</button>
          </div>
        </div>
      )}

      {courses.length === 0
        ? <div style={{ ...S.card, textAlign:'center', padding:'40px' }}><p style={{ color:'rgba(255,255,255,0.35)', fontSize:'13px' }}>No courses yet. Add your first course above.</p></div>
        : <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
            {courses.map(course => (
              <div key={course.id} style={{ ...S.card, display:'flex', gap:'14px', alignItems:'flex-start' }}>
                <img src={course.thumbnail_url || `https://img.youtube.com/vi/${course.youtube_id}/mqdefault.jpg`} alt={course.title} style={{ width:'100px', height:'62px', objectFit:'cover', borderRadius:'6px', flexShrink:0, background:'rgba(255,255,255,0.06)' }} />
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'3px' }}>
                    <p style={{ fontSize:'14px', fontWeight:500, color:'#f8fafc', margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{course.title}</p>
                    <span style={{ fontSize:'10px', padding:'2px 7px', borderRadius:'20px', fontWeight:700, flexShrink:0, background:course.is_published?'rgba(16,185,129,0.12)':'rgba(255,255,255,0.06)', color:course.is_published?'#10B981':'rgba(255,255,255,0.3)', border:`1px solid ${course.is_published?'rgba(16,185,129,0.2)':'rgba(255,255,255,0.1)'}` }}>
                      {course.is_published?'Published':'Draft'}
                    </span>
                  </div>
                  {(course.difficulty||course.category) && <p style={{ fontSize:'12px', color:'rgba(255,255,255,0.35)', margin:0 }}>{[course.difficulty,course.category].filter(Boolean).join(' · ')}</p>}
                </div>
                <div style={{ display:'flex', gap:'8px', flexShrink:0, alignItems:'center' }}>
                  <button onClick={() => togglePublish(course)} style={{ ...S.btn, padding:'6px 14px', fontSize:'12px', background:course.is_published?'rgba(255,255,255,0.06)':'rgba(16,185,129,0.1)', color:course.is_published?'rgba(255,255,255,0.4)':'#10B981', border:`1px solid ${course.is_published?'rgba(255,255,255,0.1)':'rgba(16,185,129,0.2)'}` }}>
                    {course.is_published?'Unpublish':'Publish'}
                  </button>
                  {!course.is_published && <button onClick={() => deleteCourse(course.id)} style={{ ...S.btn, padding:'6px 10px', fontSize:'12px', background:'transparent', color:'#EF4444', border:'1px solid rgba(239,68,68,0.2)' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                  </button>}
                </div>
              </div>
            ))}
          </div>
      }
    </div>
  );
}
