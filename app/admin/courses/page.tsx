'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useSearchParams } from 'next/navigation';

const CATEGORIES = ['Frameworks', 'African Context', 'Career Growth', 'Communication', 'Networking', 'Leadership', 'General'];
const DIFFICULTIES = ['beginner', 'intermediate', 'advanced'] as const;
const EMOJIS = ['📚', '🌱', '🏛️', '🔭', '💬', '🤝', '🧭', '🎯', '💡', '🔥', '📊', '🚀'];

function extractYoutubeId(url: string): string {
  if (!url) return '';
  // Already an ID (no slashes)
  if (!url.includes('/') && !url.includes('.')) return url;
  const match = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return match?.[1] || url;
}

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
      await supabase.from('courses').insert({
        ...payload,
        sort_order: courses.length + 1,
      });
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
        <div className="text-2xl mb-2">⏳</div>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading courses...</p>
      </div>
    );
  }

  return (
    <div className="animate-fade-up">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-semibold"
            style={{ fontFamily: "'Playfair Display', serif", color: 'var(--text)' }}>
            Manage Courses
          </h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            {courses.filter((c) => c.is_published).length} published · {courses.filter((c) => !c.is_published).length} drafts
          </p>
        </div>
        <button onClick={openCreate}
          className="px-4 py-2 rounded-lg text-sm font-semibold"
          style={{ background: 'var(--accent)', color: '#000' }}>
          + Add Course
        </button>
      </div>

      {/* Create/Edit Form */}
      {showForm && (
        <div className="rounded-xl p-5 mb-6"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--accent)' }}>
          <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--text)' }}>
            {editing ? 'Edit Course' : 'New Course'}
          </h3>
          <div className="flex flex-col gap-3">
            <input
              className="w-full px-3.5 py-2.5 text-sm rounded-xl"
              style={{ background: 'var(--bg-input)', color: 'var(--text)', border: '1px solid var(--border)', outline: 'none' }}
              value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Course title"
            />
            <textarea
              className="w-full px-3.5 py-2.5 text-sm rounded-xl resize-none"
              style={{ background: 'var(--bg-input)', color: 'var(--text)', border: '1px solid var(--border)', outline: 'none' }}
              value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Course description" rows={2}
            />
            <div className="grid grid-cols-3 gap-3">
              <select
                className="px-3 py-2.5 text-sm rounded-xl"
                style={{ background: 'var(--bg-input)', color: 'var(--text)', border: '1px solid var(--border)' }}
                value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <select
                className="px-3 py-2.5 text-sm rounded-xl"
                style={{ background: 'var(--bg-input)', color: 'var(--text)', border: '1px solid var(--border)' }}
                value={form.difficulty} onChange={(e) => setForm({ ...form, difficulty: e.target.value })}>
                {DIFFICULTIES.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
              <input
                className="px-3 py-2.5 text-sm rounded-xl"
                style={{ background: 'var(--bg-input)', color: 'var(--text)', border: '1px solid var(--border)', outline: 'none' }}
                value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })}
                placeholder="e.g. 25 min"
              />
            </div>

            {/* YouTube URL */}
            <div>
              <label className="text-[11px] font-bold mb-1 block" style={{ color: 'var(--text-dim)' }}>
                YouTube URL or Video ID
              </label>
              <input
                className="w-full px-3.5 py-2.5 text-sm rounded-xl"
                style={{ background: 'var(--bg-input)', color: 'var(--text)', border: '1px solid var(--border)', outline: 'none' }}
                value={form.youtube_id}
                onChange={(e) => setForm({ ...form, youtube_id: e.target.value })}
                placeholder="https://youtube.com/watch?v=... or just the video ID"
              />
              {form.youtube_id && (
                <div className="mt-2 rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)' }}>
                  <img
                    src={`https://img.youtube.com/vi/${extractYoutubeId(form.youtube_id)}/mqdefault.jpg`}
                    alt="Thumbnail preview"
                    className="w-48 h-auto"
                  />
                </div>
              )}
            </div>

            {/* Emoji picker */}
            <div>
              <label className="text-[11px] font-bold mb-1.5 block" style={{ color: 'var(--text-dim)' }}>Emoji</label>
              <div className="flex gap-2 flex-wrap">
                {EMOJIS.map((e) => (
                  <button key={e} onClick={() => setForm({ ...form, emoji: e })}
                    className="w-9 h-9 rounded-lg flex items-center justify-center text-lg"
                    style={{
                      background: form.emoji === e ? 'rgba(245,158,11,0.15)' : 'var(--bg-input)',
                      border: form.emoji === e ? '1.5px solid var(--accent)' : '1px solid var(--border)',
                    }}>
                    {e}
                  </button>
                ))}
              </div>
            </div>

            {/* Published toggle */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.is_published}
                onChange={(e) => setForm({ ...form, is_published: e.target.checked })}
                className="w-4 h-4 rounded"
              />
              <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Published (visible to users)</span>
            </label>

            <div className="flex gap-2 mt-2">
              <button onClick={handleSave} disabled={saving || !form.title.trim()}
                className="px-5 py-2 rounded-lg text-sm font-semibold disabled:opacity-40"
                style={{ background: 'var(--accent)', color: '#000' }}>
                {saving ? 'Saving...' : editing ? 'Update' : 'Create Course'}
              </button>
              <button onClick={() => { setShowForm(false); setEditing(null); }}
                className="px-4 py-2 rounded-lg text-sm"
                style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Courses List */}
      <div className="flex flex-col gap-3">
        {courses.map((c) => (
          <div key={c.id} className="rounded-xl p-4 flex items-center gap-4"
            style={{
              background: 'var(--bg-card)',
              border: `1px solid ${c.is_published ? 'var(--border)' : 'rgba(107,114,128,0.3)'}`,
              opacity: c.is_published ? 1 : 0.6,
            }}>
            {/* Thumbnail */}
            {c.youtube_id ? (
              <img
                src={`https://img.youtube.com/vi/${c.youtube_id}/mqdefault.jpg`}
                alt={c.title}
                className="w-20 h-14 rounded-lg object-cover shrink-0"
              />
            ) : (
              <div className="w-20 h-14 rounded-lg flex items-center justify-center text-2xl shrink-0"
                style={{ background: 'var(--bg-input)' }}>
                {c.emoji || '📚'}
              </div>
            )}

            <div className="flex-1">
              <h4 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
                {c.title}
                {!c.is_published && (
                  <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded"
                    style={{ background: 'rgba(107,114,128,0.15)', color: 'var(--text-dim)' }}>
                    DRAFT
                  </span>
                )}
              </h4>
              <p className="text-xs" style={{ color: 'var(--text-dim)' }}>
                {c.category} · {c.difficulty} · {c.duration || 'No duration set'}
              </p>
            </div>

            <div className="flex gap-2 shrink-0">
              <button onClick={() => togglePublish(c.id, c.is_published)}
                className="text-xs px-3 py-1.5 rounded-lg"
                style={{
                  color: c.is_published ? 'var(--text-dim)' : 'var(--success)',
                  border: `1px solid ${c.is_published ? 'var(--border)' : 'rgba(16,185,129,0.3)'}`,
                }}>
                {c.is_published ? 'Unpublish' : 'Publish'}
              </button>
              <button onClick={() => openEdit(c)}
                className="text-xs px-3 py-1.5 rounded-lg"
                style={{ color: 'var(--accent)', border: '1px solid rgba(245,158,11,0.3)' }}>
                Edit
              </button>
              <button onClick={() => handleDelete(c.id, c.title)}
                className="text-xs px-3 py-1.5 rounded-lg"
                style={{ color: 'var(--error)', border: '1px solid rgba(239,68,68,0.3)' }}>
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
