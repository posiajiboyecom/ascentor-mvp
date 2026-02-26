'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useSearchParams } from 'next/navigation';

const CATEGORIES = ['Frameworks', 'African Context', 'Career Growth', 'Communication', 'Networking', 'Leadership', 'General'];
const DIFFICULTIES = ['beginner', 'intermediate', 'advanced'] as const;
const EMOJIS = ['📚', '🌱', '🏛️', '🔭', '💬', '🤝', '🧭', '🎯', '💡', '🔥', '📊', '🚀'];

// Difficulty → palette color
const DIFFICULTY_STYLE = {
  beginner:     { bg: 'rgba(207,255,94,0.12)',  color: '#5E8000', border: 'rgba(207,255,94,0.3)'  },
  intermediate: { bg: 'rgba(102,98,255,0.1)',   color: '#6662FF', border: 'rgba(102,98,255,0.25)' },
  advanced:     { bg: 'rgba(253,129,253,0.1)',  color: '#C040C0', border: 'rgba(253,129,253,0.28)' },
};

// Category → palette color
const CATEGORY_STYLE: Record<string, { bg: string; color: string; border: string }> = {
  'Frameworks':      { bg: 'rgba(102,98,255,0.1)',   color: '#6662FF', border: 'rgba(102,98,255,0.25)'  },
  'African Context': { bg: 'rgba(253,129,253,0.1)',  color: '#C040C0', border: 'rgba(253,129,253,0.28)' },
  'Career Growth':   { bg: 'rgba(207,255,94,0.12)',  color: '#5E8000', border: 'rgba(207,255,94,0.3)'   },
  'Communication':   { bg: 'rgba(166,162,255,0.12)', color: '#5550CC', border: 'rgba(166,162,255,0.3)'  },
  'Networking':      { bg: 'rgba(253,129,253,0.08)', color: '#A030A0', border: 'rgba(253,129,253,0.22)' },
  'Leadership':      { bg: 'rgba(102,98,255,0.12)',  color: '#5550CC', border: 'rgba(166,162,255,0.3)'  },
  'General':         { bg: 'rgba(166,162,255,0.1)',  color: '#A6A2FF', border: 'rgba(166,162,255,0.2)'  },
};
function getCat(cat: string) {
  return CATEGORY_STYLE[cat] || CATEGORY_STYLE['General'];
}

// Emoji picker background cycles through palette
const EMOJI_BG_CYCLE = [
  'rgba(102,98,255,0.12)',
  'rgba(207,255,94,0.12)',
  'rgba(253,129,253,0.1)',
  'rgba(166,162,255,0.12)',
];

function extractYoutubeId(url: string): string {
  if (!url) return '';
  if (!url.includes('/') && !url.includes('.')) return url;
  const match = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return match?.[1] || url;
}

const inputStyle: React.CSSProperties = {
  background: 'var(--bg-input)', color: 'var(--text)',
  border: '1px solid var(--border)', outline: 'none',
  transition: 'border-color 0.15s',
};

export default function AdminCoursesPage() {
  const supabase = createClient();
  const searchParams = useSearchParams();

  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(searchParams.get('action') === 'create');
  const [editing, setEditing] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  const emptyForm = {
    title: '', description: '', category: 'General', difficulty: 'beginner' as string,
    lessons: 1, duration: '', emoji: '📚', youtube_id: '', is_published: true,
  };
  const [form, setForm] = useState(emptyForm);

  useEffect(() => { loadCourses(); }, []);

  async function loadCourses() {
    const { data } = await supabase.from('courses').select('*').order('sort_order');
    setCourses(data || []);
    setLoading(false);
  }

  function openEdit(course: any) {
    setForm({
      title: course.title || '', description: course.description || '',
      category: course.category || 'General', difficulty: course.difficulty || 'beginner',
      lessons: course.lessons || 1, duration: course.duration || '',
      emoji: course.emoji || '📚', youtube_id: course.youtube_id || '',
      is_published: course.is_published ?? true,
    });
    setEditing(course);
    setShowForm(true);
  }

  function openCreate() {
    setForm(emptyForm);
    setEditing(null);
    setShowForm(true);
  }

  async function handleSave() {
    if (!form.title.trim()) return;
    setSaving(true);
    const payload = {
      ...form,
      youtube_id: extractYoutubeId(form.youtube_id),
      updated_at: new Date().toISOString(),
    };
    if (editing) {
      await supabase.from('courses').update(payload).eq('id', editing.id);
    } else {
      await supabase.from('courses').insert({ ...payload, sort_order: courses.length + 1 });
    }
    setSaving(false);
    setShowForm(false);
    setEditing(null);
    loadCourses();
  }

  async function togglePublish(id: string, current: boolean) {
    await supabase.from('courses').update({ is_published: !current }).eq('id', id);
    loadCourses();
  }

  async function handleDelete(id: string, title: string) {
    if (!confirm(`Delete course "${title}"?`)) return;
    await supabase.from('courses').delete().eq('id', id);
    loadCourses();
  }

  if (loading) {
    return (
      <div className="py-20 text-center">
        <div style={{
          width: 36, height: 36, borderRadius: '50%',
          border: '3px solid rgba(102,98,255,0.15)',
          borderTop: '3px solid #6662FF',
          animation: 'spin 0.9s linear infinite',
          margin: '0 auto 12px',
        }} />
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading courses...</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const published = courses.filter(c => c.is_published);
  const drafts = courses.filter(c => !c.is_published);
  const diffStyle = DIFFICULTY_STYLE[form.difficulty as keyof typeof DIFFICULTY_STYLE] || DIFFICULTY_STYLE.beginner;
  const catStyle = getCat(form.category);

  return (
    <div className="animate-fade-up">

      {/* ── Header ── */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-semibold"
            style={{ fontFamily: "'Syne', sans-serif", color: 'var(--text)', letterSpacing: '-0.02em' }}>
            Manage Courses
          </h1>
          <div className="flex items-center gap-2 mt-1.5">
            <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full"
              style={{ background: 'rgba(207,255,94,0.12)', color: '#5E8000', border: '1px solid rgba(207,255,94,0.3)' }}>
              ✓ {published.length} published
            </span>
            <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full"
              style={{ background: 'rgba(253,129,253,0.1)', color: '#A030A0', border: '1px solid rgba(253,129,253,0.25)' }}>
              ✎ {drafts.length} drafts
            </span>
          </div>
        </div>
        <button onClick={openCreate}
          className="px-4 py-2.5 rounded-xl text-sm font-semibold transition-all"
          style={{ background: '#6662FF', color: '#fff', boxShadow: '0 2px 14px rgba(102,98,255,0.4)' }}>
          + Add Course
        </button>
      </div>

      {/* ── Create / Edit Form ── */}
      {showForm && (
        <div className="rounded-2xl p-5 mb-6"
          style={{
            background: 'var(--bg-card)',
            border: '1px solid rgba(102,98,255,0.35)',
            boxShadow: '0 0 0 4px rgba(102,98,255,0.06)',
          }}>

          {/* Form header — gradient accent bar purple → green-yellow */}
          <div className="flex items-center gap-3 mb-5">
            <div style={{
              width: 4, height: 32, borderRadius: 4,
              background: 'linear-gradient(180deg, #6662FF, #CFFF5E)',
            }} />
            <h3 className="text-sm font-bold"
              style={{ fontFamily: "'Syne', sans-serif", color: 'var(--text)', letterSpacing: '-0.01em' }}>
              {editing ? 'Edit Course' : 'New Course'}
            </h3>
          </div>

          <div className="flex flex-col gap-3">
            {/* Title */}
            <input className="w-full px-3.5 py-2.5 text-sm rounded-xl" style={inputStyle}
              value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Course title"
              onFocus={(e) => e.target.style.borderColor = '#6662FF'}
              onBlur={(e) => e.target.style.borderColor = 'var(--border)'} />

            {/* Description */}
            <textarea className="w-full px-3.5 py-2.5 text-sm rounded-xl resize-none" style={inputStyle}
              value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Course description" rows={2}
              onFocus={(e) => e.target.style.borderColor = '#6662FF'}
              onBlur={(e) => e.target.style.borderColor = 'var(--border)'} />

            {/* Category + Difficulty + Duration */}
            <div className="grid grid-cols-3 gap-3">
              <select className="px-3 py-2.5 text-sm rounded-xl" style={{ ...inputStyle, background: 'var(--bg-input)' }}
                value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <select className="px-3 py-2.5 text-sm rounded-xl" style={{ ...inputStyle, background: 'var(--bg-input)' }}
                value={form.difficulty} onChange={(e) => setForm({ ...form, difficulty: e.target.value })}>
                {DIFFICULTIES.map((d) => <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>)}
              </select>
              <input className="px-3 py-2.5 text-sm rounded-xl" style={inputStyle}
                value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })}
                placeholder="e.g. 25 min"
                onFocus={(e) => e.target.style.borderColor = '#6662FF'}
                onBlur={(e) => e.target.style.borderColor = 'var(--border)'} />
            </div>

            {/* Live badge previews */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-dim)' }}>Preview:</span>
              <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full"
                style={{ background: catStyle.bg, color: catStyle.color, border: `1px solid ${catStyle.border}` }}>
                {form.category}
              </span>
              <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full"
                style={{ background: diffStyle.bg, color: diffStyle.color, border: `1px solid ${diffStyle.border}` }}>
                {form.difficulty}
              </span>
            </div>

            {/* YouTube URL */}
            <div>
              <label className="text-[11px] font-bold mb-1.5 block uppercase tracking-wider"
                style={{ color: 'var(--text-dim)' }}>YouTube URL or Video ID</label>
              <input className="w-full px-3.5 py-2.5 text-sm rounded-xl" style={inputStyle}
                value={form.youtube_id} onChange={(e) => setForm({ ...form, youtube_id: e.target.value })}
                placeholder="https://youtube.com/watch?v=... or just the video ID"
                onFocus={(e) => e.target.style.borderColor = '#6662FF'}
                onBlur={(e) => e.target.style.borderColor = 'var(--border)'} />
              {form.youtube_id && (
                <div className="mt-2 rounded-xl overflow-hidden inline-block"
                  style={{ border: '1px solid rgba(102,98,255,0.25)' }}>
                  <img
                    src={`https://img.youtube.com/vi/${extractYoutubeId(form.youtube_id)}/mqdefault.jpg`}
                    alt="Thumbnail preview" className="w-48 h-auto block" />
                </div>
              )}
            </div>

            {/* Emoji picker — cycling backgrounds */}
            <div>
              <label className="text-[11px] font-bold mb-2 block uppercase tracking-wider"
                style={{ color: 'var(--text-dim)' }}>Emoji</label>
              <div className="flex gap-2 flex-wrap">
                {EMOJIS.map((e, idx) => {
                  const isSelected = form.emoji === e;
                  const cycleBg = EMOJI_BG_CYCLE[idx % EMOJI_BG_CYCLE.length];
                  return (
                    <button key={e} onClick={() => setForm({ ...form, emoji: e })}
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-xl transition-all"
                      style={{
                        background: isSelected ? cycleBg : 'var(--bg-input)',
                        border: isSelected ? `1.5px solid ${catStyle.color}` : '1px solid var(--border)',
                        transform: isSelected ? 'scale(1.1)' : 'scale(1)',
                        boxShadow: isSelected ? `0 0 0 3px ${catStyle.bg}` : 'none',
                      }}>
                      {e}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Published toggle — green-yellow when on */}
            <label className="flex items-center gap-3 cursor-pointer">
              <div onClick={() => setForm({ ...form, is_published: !form.is_published })}
                className="relative w-10 h-5 rounded-full transition-all shrink-0"
                style={{
                  background: form.is_published ? '#CFFF5E' : 'var(--bg-input)',
                  border: `1px solid ${form.is_published ? '#CFFF5E' : 'var(--border)'}`,
                  boxShadow: form.is_published ? '0 0 0 3px rgba(207,255,94,0.2)' : 'none',
                  cursor: 'pointer',
                }}>
                <div className="w-3.5 h-3.5 rounded-full absolute top-0.5 transition-all"
                  style={{
                    background: form.is_published ? '#1E1E1E' : 'var(--text-dim)',
                    left: form.is_published ? '20px' : '3px',
                  }} />
              </div>
              <span className="text-sm font-medium"
                style={{ color: form.is_published ? '#5E8000' : 'var(--text-muted)' }}>
                {form.is_published ? 'Published (visible to users)' : 'Save as draft'}
              </span>
            </label>

            {/* Actions */}
            <div className="flex gap-2 mt-2 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
              <button onClick={handleSave} disabled={saving || !form.title.trim()}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-40 transition-all"
                style={{ background: '#6662FF', color: '#fff', boxShadow: '0 2px 12px rgba(102,98,255,0.4)' }}>
                {saving ? 'Saving...' : editing ? 'Update Course' : 'Create Course'}
              </button>
              <button onClick={() => { setShowForm(false); setEditing(null); }}
                className="px-4 py-2.5 rounded-xl text-sm font-medium transition-all"
                style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Courses List ── */}
      {courses.length === 0 ? (
        <div className="text-center py-16 rounded-2xl"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14,
            background: 'rgba(102,98,255,0.1)', border: '1.5px solid rgba(102,98,255,0.22)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 12px', fontSize: 22,
          }}>📚</div>
          <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>No courses yet</p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-dim)' }}>Click "Add Course" to create your first one</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {courses.map((c, idx) => {
            const diff = DIFFICULTY_STYLE[c.difficulty as keyof typeof DIFFICULTY_STYLE] || DIFFICULTY_STYLE.beginner;
            const cat = getCat(c.category || 'General');
            const thumbBg = EMOJI_BG_CYCLE[idx % EMOJI_BG_CYCLE.length];

            return (
              <div key={c.id}
                className="rounded-2xl p-4 flex items-center gap-4 transition-all"
                style={{
                  background: 'var(--bg-card)',
                  border: `1px solid ${c.is_published ? 'var(--border)' : 'rgba(107,114,128,0.2)'}`,
                  opacity: c.is_published ? 1 : 0.7,
                }}>

                {/* Thumbnail or emoji tile */}
                {c.youtube_id ? (
                  <div className="relative shrink-0">
                    <img
                      src={`https://img.youtube.com/vi/${c.youtube_id}/mqdefault.jpg`}
                      alt={c.title}
                      className="w-20 h-14 rounded-xl object-cover"
                      style={{ border: '1px solid rgba(102,98,255,0.2)' }}
                    />
                    {/* Play badge */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div style={{
                        width: 22, height: 22, borderRadius: '50%',
                        background: 'rgba(102,98,255,0.85)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 9, color: '#fff', paddingLeft: 2,
                      }}>▶</div>
                    </div>
                  </div>
                ) : (
                  <div className="w-20 h-14 rounded-xl flex items-center justify-center text-2xl shrink-0"
                    style={{ background: thumbBg, border: '1px solid rgba(102,98,255,0.1)' }}>
                    {c.emoji || '📚'}
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h4 className="text-sm font-semibold"
                      style={{ fontFamily: "'Syne', sans-serif", color: 'var(--text)' }}>
                      {c.title}
                    </h4>
                    {/* Draft badge — fuchsia */}
                    {!c.is_published && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0"
                        style={{ background: 'rgba(253,129,253,0.1)', color: '#A030A0', border: '1px solid rgba(253,129,253,0.25)' }}>
                        DRAFT
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {/* Category badge */}
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                      style={{ background: cat.bg, color: cat.color, border: `1px solid ${cat.border}` }}>
                      {c.category}
                    </span>
                    {/* Difficulty badge */}
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                      style={{ background: diff.bg, color: diff.color, border: `1px solid ${diff.border}` }}>
                      {c.difficulty}
                    </span>
                    {c.duration && (
                      <span className="text-[10px]" style={{ color: 'var(--text-dim)' }}>
                        · {c.duration}
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => togglePublish(c.id, c.is_published)}
                    className="text-xs px-3 py-1.5 rounded-lg font-semibold transition-all"
                    style={c.is_published ? {
                      color: 'var(--text-dim)', border: '1px solid var(--border)',
                    } : {
                      color: '#5E8000', border: '1px solid rgba(207,255,94,0.4)',
                      background: 'rgba(207,255,94,0.08)',
                    }}>
                    {c.is_published ? 'Unpublish' : '↑ Publish'}
                  </button>
                  <button onClick={() => openEdit(c)}
                    className="text-xs px-3 py-1.5 rounded-lg font-semibold transition-all"
                    style={{ color: '#6662FF', border: '1px solid rgba(102,98,255,0.3)', background: 'rgba(102,98,255,0.06)' }}>
                    Edit
                  </button>
                  <button onClick={() => handleDelete(c.id, c.title)}
                    className="text-xs px-3 py-1.5 rounded-lg font-semibold transition-all"
                    style={{ color: 'var(--error)', border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.04)' }}>
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
