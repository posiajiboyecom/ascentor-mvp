// ============================================================
// app/partner/courses/page.tsx
// Partner course management — create, publish, reorder courses
// scoped entirely to this partner's platform
// ============================================================

'use client';

import { useState, useEffect, useRef } from 'react';

type Difficulty = 'beginner' | 'intermediate' | 'advanced';
type AccessTier = 'free' | 'explorer' | 'builder' | 'climber';

interface Course {
  id: string;
  title: string;
  description: string | null;
  youtube_id: string;
  category: string | null;
  difficulty: Difficulty | null;
  duration: string | null;
  thumbnail_url: string | null;
  is_published: boolean;
  sort_order: number;
  access_tier: AccessTier | null;
  enrollment_count: number;
  created_at: string;
}

const CATEGORIES = [
  'Leadership', 'Career Growth', 'Marketing', 'Finance',
  'Communication', 'Networking', 'Entrepreneurship',
  'Personal Development', 'African Context', 'General',
];

const DIFFICULTIES: { value: Difficulty; label: string; color: string }[] = [
  { value: 'beginner',     label: 'Beginner',      color: '#14B8A6' },
  { value: 'intermediate', label: 'Intermediate',   color: '#E8A020' },
  { value: 'advanced',     label: 'Advanced',       color: '#8B5CF6' },
];

const TIERS: { value: AccessTier; label: string }[] = [
  { value: 'free',    label: 'Free (all members)' },
  { value: 'explorer', label: 'Explorer+' },
  { value: 'builder',  label: 'Builder+' },
  { value: 'climber',  label: 'Climber only' },
];

const inputStyle: React.CSSProperties = {
  background: 'var(--bg-input)', color: 'var(--text)',
  border: '1px solid var(--border)', outline: 'none',
  borderRadius: 10, padding: '10px 14px',
  fontSize: 13, width: '100%',
};

// ── Toast ─────────────────────────────────────────────────
function Toast({ msg, onDismiss }: { msg: { type: 'success' | 'error'; text: string }; onDismiss: () => void }) {
  useEffect(() => { const t = setTimeout(onDismiss, 4000); return () => clearTimeout(t); }, [msg]);
  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 999,
      background: msg.type === 'success' ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
      border: `1px solid ${msg.type === 'success' ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
      borderRadius: 12, padding: '12px 18px',
      display: 'flex', alignItems: 'center', gap: 10,
      boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
    }}>
      <span>{msg.type === 'success' ? '✓' : '✗'}</span>
      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{msg.text}</span>
    </div>
  );
}

// ── Course Form (create / edit) ───────────────────────────
function CourseForm({
  initial,
  onSave,
  onCancel,
  saving,
}: {
  initial?: Partial<Course>;
  onSave: (data: any) => Promise<void>;
  onCancel: () => void;
  saving: boolean;
}) {
  const [title, setTitle]             = useState(initial?.title || '');
  const [description, setDescription] = useState(initial?.description || '');
  const [youtubeUrl, setYoutubeUrl]   = useState(initial?.youtube_id || '');
  const [category, setCategory]       = useState(initial?.category || '');
  const [difficulty, setDifficulty]   = useState<Difficulty | ''>(initial?.difficulty || '');
  const [duration, setDuration]       = useState(initial?.duration || '');
  const [accessTier, setAccessTier]   = useState<AccessTier>(initial?.access_tier || 'free');

  const isEdit = !!initial?.id;
  const ytPreviewId = youtubeUrl.match(/(?:v=|youtu\.be\/|embed\/)([a-zA-Z0-9_-]{11})/)?.[1]
    || (/^[a-zA-Z0-9_-]{11}$/.test(youtubeUrl) ? youtubeUrl : '');

  const handleSubmit = () => {
    if (!title.trim()) return;
    if (!youtubeUrl.trim()) return;
    onSave({ title, description, youtube_id: youtubeUrl, category, difficulty: difficulty || null, duration, access_tier: accessTier });
  };

  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--border)',
      borderRadius: 14, padding: '22px 24px',
    }}>
      <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 20,
        fontFamily: "'Cormorant Garamond', Georgia, serif" }}>
        {isEdit ? 'Edit Course' : 'New Course'}
      </h3>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Title */}
        <div style={{ gridColumn: '1 / -1' }}>
          <Label>Course Title *</Label>
          <input value={title} onChange={e => setTitle(e.target.value)}
            placeholder="e.g. Mastering Executive Presence"
            style={inputStyle} />
        </div>

        {/* YouTube */}
        <div style={{ gridColumn: '1 / -1' }}>
          <Label>YouTube Video URL or ID *</Label>
          <input value={youtubeUrl} onChange={e => setYoutubeUrl(e.target.value)}
            placeholder="https://youtube.com/watch?v=... or video ID"
            style={inputStyle} />
          {ytPreviewId && (
            <div style={{ marginTop: 10, borderRadius: 8, overflow: 'hidden', aspectRatio: '16/9', maxWidth: 300 }}>
              <img
                src={`https://img.youtube.com/vi/${ytPreviewId}/mqdefault.jpg`}
                alt="Thumbnail preview"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            </div>
          )}
        </div>

        {/* Description */}
        <div style={{ gridColumn: '1 / -1' }}>
          <Label>Description</Label>
          <textarea value={description} onChange={e => setDescription(e.target.value)}
            rows={3} placeholder="What will members learn?"
            style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }} />
        </div>

        {/* Category */}
        <div>
          <Label>Category</Label>
          <select value={category} onChange={e => setCategory(e.target.value)} style={inputStyle}>
            <option value="">Select category</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {/* Difficulty */}
        <div>
          <Label>Difficulty</Label>
          <select value={difficulty} onChange={e => setDifficulty(e.target.value as Difficulty)} style={inputStyle}>
            <option value="">Any level</option>
            {DIFFICULTIES.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
          </select>
        </div>

        {/* Duration */}
        <div>
          <Label>Duration</Label>
          <input value={duration} onChange={e => setDuration(e.target.value)}
            placeholder="e.g. 45 min" style={inputStyle} />
        </div>

        {/* Access tier */}
        <div>
          <Label>Access Tier</Label>
          <select value={accessTier} onChange={e => setAccessTier(e.target.value as AccessTier)} style={inputStyle}>
            {TIERS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
        <button onClick={handleSubmit} disabled={saving || !title.trim() || !youtubeUrl.trim()}
          style={{
            padding: '10px 24px', borderRadius: 10, border: 'none',
            background: 'var(--accent)', color: '#000',
            fontSize: 13, fontWeight: 700, cursor: 'pointer',
            opacity: (saving || !title.trim() || !youtubeUrl.trim()) ? 0.5 : 1,
          }}>
          {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Course'}
        </button>
        <button onClick={onCancel}
          style={{
            padding: '10px 18px', borderRadius: 10,
            background: 'transparent', color: 'var(--text-dim)',
            border: '1px solid var(--border)', fontSize: 13, cursor: 'pointer',
          }}>
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Course card ───────────────────────────────────────────
function CourseCard({
  course,
  onEdit,
  onTogglePublish,
  onDelete,
  publishing,
}: {
  course: Course;
  onEdit: () => void;
  onTogglePublish: () => void;
  onDelete: () => void;
  publishing: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const diff = DIFFICULTIES.find(d => d.value === course.difficulty);

  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '100px 1fr auto',
      gap: 16, alignItems: 'center',
      background: 'var(--bg-card)', border: '1px solid var(--border)',
      borderRadius: 12, padding: '14px 16px',
      opacity: course.is_published ? 1 : 0.75,
      transition: 'opacity 0.15s',
    }}>
      {/* Thumbnail */}
      <div style={{ borderRadius: 8, overflow: 'hidden', aspectRatio: '16/9', background: 'var(--bg-input)' }}>
        <img
          src={course.thumbnail_url || `https://img.youtube.com/vi/${course.youtube_id}/mqdefault.jpg`}
          alt={course.title}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      </div>

      {/* Info */}
      <div style={{ overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', margin: 0 }}>
            {course.title}
          </p>
          {/* Published badge */}
          <span style={{
            fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 20,
            textTransform: 'uppercase', letterSpacing: '0.08em',
            background: course.is_published ? 'rgba(16,185,129,0.08)' : 'rgba(255,255,255,0.05)',
            color: course.is_published ? '#10B981' : 'var(--text-dim)',
            border: `1px solid ${course.is_published ? 'rgba(16,185,129,0.2)' : 'var(--border)'}`,
          }}>
            {course.is_published ? 'Live' : 'Draft'}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {course.category && (
            <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>{course.category}</span>
          )}
          {diff && (
            <span style={{ fontSize: 11, color: diff.color, fontWeight: 600 }}>{diff.label}</span>
          )}
          {course.duration && (
            <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>{course.duration}</span>
          )}
          <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>
            {course.enrollment_count} enrolled
          </span>
        </div>
      </div>

      {/* Actions */}
      <div ref={menuRef} style={{ position: 'relative', flexShrink: 0 }}>
        <button onClick={() => setMenuOpen(o => !o)} style={{
          padding: '5px 10px', borderRadius: 8,
          border: '1px solid var(--border)', background: 'transparent',
          color: 'var(--text-dim)', cursor: 'pointer', fontSize: 16,
        }}>···</button>
        {menuOpen && (
          <div style={{
            position: 'absolute', right: 0, top: 'calc(100% + 4px)', zIndex: 50,
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            borderRadius: 10, overflow: 'hidden', minWidth: 160,
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          }}>
            {[
              { label: 'Edit', action: onEdit },
              { label: course.is_published ? 'Unpublish' : 'Publish', action: onTogglePublish },
              { label: 'Delete', action: onDelete, danger: true },
            ].map(item => (
              <button key={item.label} onClick={() => { item.action(); setMenuOpen(false); }}
                disabled={item.label.includes('ublish') && publishing}
                style={{
                  display: 'block', width: '100%', textAlign: 'left',
                  padding: '10px 14px', border: 'none', background: 'transparent',
                  cursor: 'pointer', fontSize: 12, fontWeight: 600,
                  color: item.danger ? '#EF4444' : 'var(--text)',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                {item.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label style={{
      display: 'block', fontSize: 11, fontWeight: 700,
      textTransform: 'uppercase', letterSpacing: '0.08em',
      color: 'var(--text-dim)', marginBottom: 6,
    }}>
      {children}
    </label>
  );
}

// ── Main page ─────────────────────────────────────────────
export default function PartnerCoursesPage() {
  const [courses, setCourses]     = useState<Course[]>([]);
  const [loading, setLoading]     = useState(true);
  const [showForm, setShowForm]   = useState(false);
  const [editCourse, setEditCourse] = useState<Course | null>(null);
  const [saving, setSaving]       = useState(false);
  const [publishing, setPublishing] = useState<string | null>(null);
  const [toast, setToast]         = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const showToast = (type: 'success' | 'error', text: string) => setToast({ type, text });

  const load = async () => {
    setLoading(true);
    const res = await fetch('/api/partner/courses');
    if (res.ok) {
      const data = await res.json();
      setCourses(data.courses || []);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (data: any) => {
    setSaving(true);
    const res = await fetch('/api/partner/courses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const result = await res.json();
    if (res.ok) {
      showToast('success', 'Course created');
      setShowForm(false);
      await load();
    } else {
      showToast('error', result.error || 'Failed to create course');
    }
    setSaving(false);
  };

  const handleUpdate = async (data: any) => {
    if (!editCourse) return;
    setSaving(true);
    const res = await fetch('/api/partner/courses', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ courseId: editCourse.id, ...data }),
    });
    const result = await res.json();
    if (res.ok) {
      showToast('success', 'Course updated');
      setEditCourse(null);
      await load();
    } else {
      showToast('error', result.error || 'Failed to update course');
    }
    setSaving(false);
  };

  const handleTogglePublish = async (course: Course) => {
    setPublishing(course.id);
    const res = await fetch('/api/partner/courses', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ courseId: course.id, is_published: !course.is_published }),
    });
    if (res.ok) {
      showToast('success', course.is_published ? 'Course unpublished' : 'Course is now live');
      await load();
    } else {
      showToast('error', 'Failed to update');
    }
    setPublishing(null);
  };

  const handleDelete = async (courseId: string) => {
    const res = await fetch('/api/partner/courses', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ courseId }),
    });
    const result = await res.json();
    if (res.ok) {
      showToast('success', 'Course deleted');
      setDeleteConfirm(null);
      await load();
    } else {
      showToast('error', result.error || 'Failed to delete');
      setDeleteConfirm(null);
    }
  };

  const published = courses.filter(c => c.is_published).length;

  return (
    <div style={{ maxWidth: 820, margin: '0 auto' }} className="animate-fade-up">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 28,
            color: 'var(--text)', marginBottom: 4 }}>
            Courses
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-dim)' }}>
            {courses.length} course{courses.length !== 1 ? 's' : ''} · {published} live
          </p>
        </div>
        {!showForm && !editCourse && (
          <button onClick={() => setShowForm(true)}
            style={{
              padding: '10px 20px', borderRadius: 10, border: 'none',
              background: 'var(--accent)', color: '#000',
              fontSize: 13, fontWeight: 700, cursor: 'pointer',
            }}>
            + Add Course
          </button>
        )}
      </div>

      {/* Info banner */}
      {courses.length === 0 && !showForm && !loading && (
        <div style={{
          padding: '16px 20px', borderRadius: 12, marginBottom: 24,
          background: 'rgba(232,160,32,0.05)', border: '1px solid rgba(232,160,32,0.2)',
        }}>
          <p style={{ fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.6 }}>
            Add your first course using a YouTube video. Members on your platform will be able to
            watch it based on their subscription tier. Courses are exclusively yours — not shown
            on Ascentor's main platform.
          </p>
        </div>
      )}

      {/* Create form */}
      {showForm && (
        <div style={{ marginBottom: 24 }}>
          <CourseForm
            onSave={handleCreate}
            onCancel={() => setShowForm(false)}
            saving={saving}
          />
        </div>
      )}

      {/* Edit form */}
      {editCourse && (
        <div style={{ marginBottom: 24 }}>
          <CourseForm
            initial={editCourse}
            onSave={handleUpdate}
            onCancel={() => setEditCourse(null)}
            saving={saving}
          />
        </div>
      )}

      {/* Course list */}
      {loading ? (
        <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-dim)', fontSize: 13 }}>
          Loading courses...
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {courses.map(course => (
            deleteConfirm === course.id ? (
              <div key={course.id} style={{
                background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)',
                borderRadius: 12, padding: '16px 20px',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
              }}>
                <p style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>
                  Delete <strong>"{course.title}"</strong>? This cannot be undone.
                </p>
                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                  <button onClick={() => handleDelete(course.id)}
                    style={{
                      padding: '8px 16px', borderRadius: 8, border: 'none',
                      background: '#EF4444', color: '#fff',
                      fontSize: 12, fontWeight: 700, cursor: 'pointer',
                    }}>
                    Delete
                  </button>
                  <button onClick={() => setDeleteConfirm(null)}
                    style={{
                      padding: '8px 14px', borderRadius: 8,
                      background: 'transparent', color: 'var(--text-dim)',
                      border: '1px solid var(--border)', fontSize: 12, cursor: 'pointer',
                    }}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <CourseCard
                key={course.id}
                course={course}
                onEdit={() => { setEditCourse(course); setShowForm(false); }}
                onTogglePublish={() => handleTogglePublish(course)}
                onDelete={() => setDeleteConfirm(course.id)}
                publishing={publishing === course.id}
              />
            )
          ))}
        </div>
      )}

      {toast && <Toast msg={toast} onDismiss={() => setToast(null)} />}
    </div>
  );
}
