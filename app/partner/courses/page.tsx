'use client';
// app/partner/courses/page.tsx - full partner course manager
export const dynamic = 'force-dynamic';
import { useState, useEffect, useCallback } from 'react';
import { confirmAction } from '@/components/Modal';
import { useApiBase } from '@/lib/useApiBase';

const DIFF_OPTS = ['beginner','intermediate','advanced'];
const CAT_OPTS  = ['Leadership','Purposeful Development','Tech Skills','Soft Skills','Finance','Entrepreneurship','Other'];

const S: Record<string,React.CSSProperties> = {
  card:  { background:'rgba(22,22,22,0.03)', border:'1px solid #E6E3DD', borderRadius:'10px', padding:'20px' },
  label: { fontSize:'11px', fontWeight:700, textTransform:'uppercase' as const, letterSpacing:'0.06em', color:'#5F6672', marginBottom:'6px', display:'block' },
  input: { width:'100%', background:'rgba(22,22,22,0.04)', border:'1px solid #E6E3DD', borderRadius:'7px', padding:'9px 12px', color:'#161616', fontSize:'13px', outline:'none', boxSizing:'border-box' as const },
  btn:   { padding:'9px 20px', borderRadius:'7px', border:'none', fontSize:'13px', fontWeight:600, cursor:'pointer' },
};

interface Course { id:string; title:string; description:string|null; youtube_id:string; thumbnail_url:string|null; category:string|null; difficulty:string|null; is_published:boolean; }

export default function PartnerCoursesPage() {
  const apiBase = useApiBase();
  const [courses,  setCourses]  = useState<Course[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState('');
  const [form, setForm] = useState({ title:'', description:'', youtube_id:'', difficulty:'', category:'' });

  const load = useCallback(async () => {
    setLoading(true);
    const cRes = await fetch(`${apiBase}/api/partner/courses`);
    const cData = await cRes.json();
    if (!cRes.ok) { setError(cData.error||'Failed to load'); setLoading(false); return; }
    setCourses(cData.courses || []);
    setLoading(false);
  }, [apiBase]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    if (!form.title.trim() || !form.youtube_id.trim()) { setError('Title and YouTube URL are required.'); return; }
    setSaving(true); setError('');
    const res = await fetch(`${apiBase}/api/partner/courses`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(form) });
    const data = await res.json();
    if (!res.ok) { setError(data.error||'Failed to create.'); setSaving(false); return; }
    setShowForm(false);
    setForm({ title:'', description:'', youtube_id:'', difficulty:'', category:'' });
    await load(); setSaving(false);
  };

  const togglePublish = async (c: Course) => {
    await fetch(`${apiBase}/api/partner/courses`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ courseId:c.id, is_published:!c.is_published }) });
    await load();
  };

  const deleteCourse = async (id: string) => {
    if (!(await confirmAction('Delete this course?'))) return;
    await fetch(`${apiBase}/api/partner/courses?courseId=${id}`, { method:'DELETE' });
    await load();
  };

  if (loading) return <div style={{ color:'#5F6672', fontSize:'13px' }}>Loading…</div>;

  return (
    <div style={{ maxWidth:'720px' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'24px' }}>
        <div>
          <h1 style={{ fontSize:'20px', fontWeight:500, color:'#161616', marginBottom:'4px' }}>Courses</h1>
          <p style={{ fontSize:'13px', color:'#5F6672' }}>
            {courses.length} {courses.length === 1 ? 'course' : 'courses'}
          </p>
        </div>
        {!showForm && <button onClick={() => setShowForm(true)} style={{ ...S.btn, background:'#E8A020', color:'#0C0B08' }}>+ Add course</button>}
      </div>

      {error && <p style={{ color:'#EF4444', fontSize:'13px', marginBottom:'12px' }}>{error}</p>}

      {showForm && (
        <div style={{ ...S.card, marginBottom:'20px', border:'1px solid rgba(232,160,32,0.2)' }}>
          <p style={{ fontSize:'14px', fontWeight:600, color:'#161616', marginBottom:'16px' }}>New course</p>
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
            <button onClick={() => { setShowForm(false); setError(''); }} style={{ ...S.btn, background:'transparent', color:'#5F6672', border:'1px solid #E6E3DD' }}>Cancel</button>
          </div>
        </div>
      )}

      {courses.length === 0
        ? <div style={{ ...S.card, textAlign:'center', padding:'40px' }}><p style={{ color:'#5F6672', fontSize:'13px' }}>No courses yet. Add your first course above.</p></div>
        : <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
            {courses.map(course => (
              <div key={course.id} style={{ ...S.card, display:'flex', gap:'14px', alignItems:'flex-start' }}>
                <img src={course.thumbnail_url || `https://img.youtube.com/vi/${course.youtube_id}/mqdefault.jpg`} alt={course.title} style={{ width:'100px', height:'62px', objectFit:'cover', borderRadius:'6px', flexShrink:0, background:'rgba(22,22,22,0.06)' }} />
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'3px' }}>
                    <p style={{ fontSize:'14px', fontWeight:500, color:'#161616', margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{course.title}</p>
                    <span style={{ fontSize:'10px', padding:'2px 7px', borderRadius:'20px', fontWeight:700, flexShrink:0, background:course.is_published?'rgba(16,185,129,0.12)':'rgba(22,22,22,0.06)', color:course.is_published?'#10B981':'rgba(22,22,22,0.3)', border:`1px solid ${course.is_published?'rgba(16,185,129,0.2)':'rgba(22,22,22,0.1)'}` }}>
                      {course.is_published?'Published':'Draft'}
                    </span>
                  </div>
                  {(course.difficulty||course.category) && <p style={{ fontSize:'12px', color:'#5F6672', margin:0 }}>{[course.difficulty,course.category].filter(Boolean).join(' · ')}</p>}
                </div>
                <div style={{ display:'flex', gap:'8px', flexShrink:0, alignItems:'center' }}>
                  <button onClick={() => togglePublish(course)} style={{ ...S.btn, padding:'6px 14px', fontSize:'12px', background:course.is_published?'rgba(22,22,22,0.06)':'rgba(16,185,129,0.1)', color:course.is_published?'rgba(22,22,22,0.4)':'#10B981', border:`1px solid ${course.is_published?'rgba(22,22,22,0.1)':'rgba(16,185,129,0.2)'}` }}>
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
