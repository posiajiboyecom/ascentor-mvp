'use client';

// app/admin/lessons/page.tsx
// Manage rx_lessons — the lessons that feed the main /learn page and
// the 12-week pathway. Replaces the old /admin/courses page which
// managed a separate `courses` table disconnected from the member app.
//
// Fields managed here map 1-to-1 with the rx_lessons table:
//   title, slug (auto-derived, editable), dimension, sub, minutes,
//   format (Video | Reading), video_url, body, week_no, sort, published

import { useState, useEffect, useCallback, Suspense } from 'react';
import { VideoUploadField } from '@/components/admin/VideoUploadField';
import { Loader2, GripVertical, Pencil, Trash2, Eye, EyeOff, Plus, BookOpen, Video, FileText } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useSearchParams } from 'next/navigation';

export const dynamic = 'force-dynamic';

// ── Design tokens (matching the Ledger system used across admin) ────────────
const B = {
  bg:         'var(--ledger-bg)',
  bg2:        'var(--ledger-bg-input)',
  surface:    'var(--ledger-bg-card)',
  border:     'var(--ledger-line)',
  fg:         'var(--ledger-ink)',
  muted:      'var(--ledger-ink-soft)',
  gold:       'var(--ledger-gold)',
  goldBg:     'var(--ledger-gold-bg)',
  goldBorder: 'var(--ledger-gold-border)',
  good:       'var(--ledger-good)',
  goodBg:     'var(--ledger-good-bg)',
  bad:        'var(--ledger-bad)',
  badBg:      'var(--ledger-bad-bg)',
  warn:       'var(--ledger-warn)',
  warnBg:     'var(--ledger-warn-bg)',
  info:       'var(--ledger-info)',
  infoBg:     'var(--ledger-info-bg)',
  radius:     '6px',
  font:       'var(--ledger-font-ui)',
};

const DIMENSIONS = ['Mind', 'Character', 'Vocation', 'Relationships', 'Community', 'Legacy'] as const;
const FORMATS = ['Video', 'Reading'] as const;

// Sub-topics by dimension (matches lib/rx/constants.ts interests)
const SUBS: Record<string, string[]> = {
  Mind:          ['Mindset', 'Focus', 'Resilience', 'Self-awareness', 'Emotional intelligence'],
  Character:     ['Integrity', 'Discipline', 'Courage', 'Humility', 'Purpose'],
  Vocation:      ['Leadership', 'Communication', 'Strategy', 'Finance', 'Career Growth', 'Entrepreneurship'],
  Relationships: ['Conflict resolution', 'Trust', 'Influence', 'Networking', 'Family'],
  Community:     ['Service', 'Civic engagement', 'Regional Context', 'Mentorship'],
  Legacy:        ['Vision', 'Systems thinking', 'Frameworks', 'Impact'],
};

type Lesson = {
  id: string;
  slug: string;
  title: string;
  dimension: string;
  sub: string | null;
  minutes: number;
  format: 'Video' | 'Reading';
  video_url: string | null;
  video_id: string | null;
  thumbnail_url: string | null;
  body: string | null;
  week_no: number | null;
  sort: number;
  published: boolean;
  created_at: string;
};

type FormState = Omit<Lesson, 'id' | 'created_at'>;

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

const emptyForm = (): FormState => ({
  slug: '', title: '', dimension: 'Mind', sub: null,
  minutes: 10, format: 'Video', video_url: null, video_id: null, thumbnail_url: null, body: null,
  week_no: null, sort: 0, published: true,
});

// ── CSS injected once ───────────────────────────────────────────────────────
const CSS = `
.asl-page { padding: 28px 24px 60px; max-width: 1100px; margin: 0 auto; font-family: ${B.font}; }
.asl-header { display: flex; align-items: center; gap: 12px; margin-bottom: 24px; flex-wrap: wrap; }
.asl-title { font-size: 22px; font-weight: 700; color: ${B.fg}; flex: 1; }
.asl-stats { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
.asl-stat { font-size: 11px; font-weight: 600; letter-spacing: .07em; text-transform: uppercase; color: ${B.muted}; }
.asl-stat b { color: ${B.fg}; }
.asl-btn-primary {
  display: inline-flex; align-items: center; gap: 7px;
  height: 36px; padding: 0 16px; border-radius: ${B.radius}; border: 0; cursor: pointer;
  background: ${B.gold}; color: #1A1612; font: 600 13px/1 ${B.font}; letter-spacing: .01em;
}
.asl-btn-primary:hover { opacity: .88; }
.asl-btn-ghost {
  display: inline-flex; align-items: center; gap: 6px;
  height: 32px; padding: 0 12px; border-radius: ${B.radius};
  border: 1px solid ${B.border}; cursor: pointer;
  background: transparent; color: ${B.muted}; font: 500 12px/1 ${B.font};
  transition: border-color .15s, color .15s;
}
.asl-btn-ghost:hover { border-color: ${B.gold}; color: ${B.fg}; }
.asl-btn-danger {
  display: inline-flex; align-items: center; gap: 6px;
  height: 32px; padding: 0 12px; border-radius: ${B.radius};
  border: 1px solid transparent; cursor: pointer;
  background: transparent; color: ${B.bad}; font: 500 12px/1 ${B.font};
  transition: background .15s;
}
.asl-btn-danger:hover { background: ${B.badBg}; }

/* Table */
.asl-table-wrap { overflow-x: auto; border: 1px solid ${B.border}; border-radius: 8px; }
.asl-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.asl-table th {
  text-align: left; font-size: 10px; font-weight: 700; letter-spacing: .09em;
  text-transform: uppercase; color: ${B.muted}; padding: 10px 14px;
  border-bottom: 1px solid ${B.border}; white-space: nowrap;
}
.asl-table td { padding: 11px 14px; border-bottom: 1px solid ${B.border}; vertical-align: middle; color: ${B.fg}; }
.asl-table tr:last-child td { border-bottom: 0; }
.asl-table tr:hover td { background: var(--ledger-bg-card-hover, rgba(0,0,0,0.025)); }
.asl-drag-handle { cursor: grab; color: ${B.muted}; padding: 0 4px; }
.asl-drag-handle:active { cursor: grabbing; }
.asl-lesson-title { font-weight: 600; color: ${B.fg}; }
.asl-lesson-slug { font-size: 11px; color: ${B.muted}; font-family: monospace; }
.asl-tag {
  display: inline-block; padding: 2px 7px; border-radius: 999px;
  font-size: 11px; font-weight: 600; letter-spacing: .04em;
}
.asl-tag-dim { background: ${B.goldBg}; color: ${B.gold}; border: 1px solid ${B.goldBorder}; }
.asl-tag-pub { background: ${B.goodBg}; color: ${B.good}; }
.asl-tag-draft { background: ${B.warnBg}; color: ${B.warn}; }
.asl-tag-week { background: ${B.infoBg}; color: ${B.info}; font-size: 10px; }
.asl-row-actions { display: flex; gap: 4px; align-items: center; }
.asl-drag-row { opacity: .4; }

/* Modal / form */
.asl-backdrop {
  position: fixed; inset: 0; z-index: 200;
  background: rgba(20,16,10,0.45); backdrop-filter: blur(4px);
  display: flex; align-items: flex-start; justify-content: center;
  padding: 32px 16px 60px; overflow-y: auto;
}
.asl-modal {
  background: ${B.surface}; border: 1px solid ${B.border};
  border-radius: 10px; width: 100%; max-width: 640px;
  box-shadow: 0 20px 60px rgba(20,16,10,.18);
  color-scheme: light;
  color: ${B.fg};
  flex-shrink: 0;
}
.asl-modal-head {
  display: flex; align-items: center; padding: 18px 20px 14px;
  border-bottom: 1px solid ${B.border};
}
.asl-modal-title { flex: 1; font-size: 15px; font-weight: 700; color: ${B.fg}; }
.asl-modal-body { padding: 20px; display: flex; flex-direction: column; gap: 16px; }
.asl-modal-foot {
  padding: 14px 20px; border-top: 1px solid ${B.border};
  display: flex; justify-content: flex-end; gap: 8px;
}
.asl-field { display: flex; flex-direction: column; gap: 5px; }
.asl-label { font-size: 11px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: ${B.fg}; }
.asl-input, .asl-select, .asl-textarea {
  width: 100%; padding: 9px 12px; border-radius: ${B.radius};
  border: 1px solid ${B.border}; background: ${B.bg2};
  color: ${B.fg}; font: 14px/1.5 ${B.font};
  color-scheme: light;
  transition: border-color .15s;
}
.asl-input::placeholder, .asl-textarea::placeholder { color: ${B.muted}; opacity: 1; }
.asl-select option { background: ${B.surface}; color: ${B.fg}; }
.asl-input:focus, .asl-select:focus, .asl-textarea:focus {
  outline: none; border-color: ${B.gold};
}
.asl-textarea { min-height: 100px; resize: vertical; }
.asl-row2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.asl-row3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; }
.asl-hint { font-size: 11px; color: ${B.muted}; opacity: 1; }
.asl-toggle-row { display: flex; align-items: center; gap: 10px; }
.asl-toggle {
  position: relative; width: 40px; height: 22px; flex-shrink: 0;
}
.asl-toggle input { opacity: 0; width: 0; height: 0; position: absolute; }
.asl-toggle-track {
  position: absolute; inset: 0; border-radius: 999px;
  background: ${B.border}; cursor: pointer; transition: background .2s;
}
.asl-toggle input:checked + .asl-toggle-track { background: ${B.good}; }
.asl-toggle-thumb {
  position: absolute; top: 3px; left: 3px;
  width: 16px; height: 16px; border-radius: 50%;
  background: #fff; transition: transform .2s; pointer-events: none;
}
.asl-toggle input:checked ~ .asl-toggle-thumb { transform: translateX(18px); }
.asl-toggle-label { font-size: 13px; color: ${B.fg}; }
.asl-empty { padding: 48px 24px; text-align: center; color: ${B.muted}; font-size: 14px; }
.asl-saving { opacity: .5; pointer-events: none; }

/* Responsive */
@media (max-width: 600px) {
  .asl-row2, .asl-row3 { grid-template-columns: 1fr; }
  .asl-page { padding: 16px 12px 48px; }
}
`;

// ── Reusable field helpers ──────────────────────────────────────────────────
function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="asl-field">
      <label className="asl-label">{label}</label>
      {children}
      {hint && <span className="asl-hint">{hint}</span>}
    </div>
  );
}

// ── Main page (Suspense wrapper needed for useSearchParams) ─────────────────
export default function AdminLessonsPage() {
  return (
    <>
      <style>{CSS}</style>
      <Suspense fallback={<div className="asl-page" style={{ color: 'var(--ledger-ink-soft)' }}><Loader2 style={{ width: 18, height: 18 }} className="animate-spin" /> Loading…</div>}>
        <AdminLessonsInner />
      </Suspense>
    </>
  );
}

function AdminLessonsInner() {
  const supabase = createClient();
  const [uploading, setUploading] = useState(false);
  const [picError, setPicError] = useState('');
  const searchParams = useSearchParams();

  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(searchParams.get('action') === 'create');
  const [editing, setEditing] = useState<Lesson | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);

  const loadLessons = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('rx_lessons').select('*').order('sort');
    setLessons(data ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { void loadLessons(); }, [loadLessons]);

  // Auto-derive slug from title (only when creating new, and slug hasn't been manually edited)
  const slugDerived = !editing && form.slug === slugify(form.title);
  const setTitle = (v: string) => {
    setForm(f => ({
      ...f,
      title: v,
      slug: slugDerived || !f.slug ? slugify(v) : f.slug,
    }));
  };

  function openCreate() {
    const nextSort = lessons.length ? Math.max(...lessons.map(l => l.sort)) + 1 : 1;
    setEditing(null);
    setForm({ ...emptyForm(), sort: nextSort });
    setShowForm(true);
  }

  function openEdit(lesson: Lesson) {
    setEditing(lesson);
    setForm({
      slug: lesson.slug, title: lesson.title,
      dimension: lesson.dimension, sub: lesson.sub ?? null,
      minutes: lesson.minutes, format: lesson.format,
      video_url: lesson.video_url ?? null, video_id: lesson.video_id ?? null, thumbnail_url: lesson.thumbnail_url ?? null, body: lesson.body ?? null,
      week_no: lesson.week_no ?? null, sort: lesson.sort, published: lesson.published,
    });
    setShowForm(true);
  }

  function closeForm() { setShowForm(false); setEditing(null); setForm(emptyForm()); }

  // The picture is uploaded on its own (to Supabase Storage) and the URL it returns is saved with the rest of the form,
  // so a picture can be chosen before a brand-new lesson has been created.
  async function uploadPicture(file: File) {
    setPicError(''); setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      if (editing) fd.append('rowId', `l:${editing.id}`);
      const res = await fetch('/api/admin/lesson-thumbnail', { method: 'POST', body: fd });
      const j = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok || !j.url) { setPicError(j.error || 'The upload did not work. Try again.'); return; }
      setForm(f => ({ ...f, thumbnail_url: j.url! }));
    } catch {
      setPicError('The upload did not work. Check your connection.');
    } finally {
      setUploading(false);
    }
  }

  async function saveLesson() {
    if (!form.title.trim() || !form.slug.trim()) return;
    setSaving(true);
    const payload = {
      slug: form.slug.trim(),
      title: form.title.trim(),
      dimension: form.dimension,
      sub: form.sub || null,
      minutes: form.minutes,
      format: form.format,
      video_url: form.video_url?.trim() || null,
      video_id: form.video_id || null,
      thumbnail_url: form.thumbnail_url?.trim() || null,
      body: form.body?.trim() || null,
      week_no: form.week_no || null,
      sort: form.sort,
      published: form.published,
    };
    if (editing) {
      await supabase.from('rx_lessons').update(payload).eq('id', editing.id);
    } else {
      await supabase.from('rx_lessons').insert(payload);
    }
    setSaving(false);
    closeForm();
    void loadLessons();
  }

  async function togglePublish(lesson: Lesson) {
    await supabase.from('rx_lessons').update({ published: !lesson.published }).eq('id', lesson.id);
    void loadLessons();
  }

  async function deleteLesson(lesson: Lesson) {
    const ok = window.confirm(`Delete "${lesson.title}"? This cannot be undone.`);
    if (!ok) return;
    await supabase.from('rx_lessons').delete().eq('id', lesson.id);
    void loadLessons();
  }

  // ── drag-to-reorder ───────────────────────────────────────────────────────
  function handleDragStart(idx: number) { setDragIndex(idx); }
  function handleDragOver(e: React.DragEvent, idx: number) { e.preventDefault(); setDragOver(idx); }
  function handleDragEnd() { setDragIndex(null); setDragOver(null); }

  async function handleDrop(dropIdx: number) {
    if (dragIndex === null || dragIndex === dropIdx) { handleDragEnd(); return; }
    const reordered = [...lessons];
    const [moved] = reordered.splice(dragIndex, 1);
    reordered.splice(dropIdx, 0, moved);
    const updated = reordered.map((l, i) => ({ ...l, sort: i + 1 }));
    setLessons(updated);
    handleDragEnd();
    await Promise.all(updated.map(l => supabase.from('rx_lessons').update({ sort: l.sort }).eq('id', l.id)));
  }

  const published = lessons.filter(l => l.published).length;
  const drafts = lessons.length - published;

  return (
    <div className="asl-page">
      {/* Header */}
      <div className="asl-header">
        <div className="asl-title">Manage Lessons</div>
        <div className="asl-stats">
          <span className="asl-stat"><b>{published}</b> published</span>
          <span className="asl-stat">·</span>
          <span className="asl-stat"><b>{drafts}</b> drafts</span>
          <span className="asl-stat">·</span>
          <span className="asl-stat"><b>{lessons.length}</b> total</span>
        </div>
        <button className="asl-btn-primary" onClick={openCreate}>
          <Plus style={{ width: 15, height: 15 }} /> Add Lesson
        </button>
      </div>

      <p className="asl-hint" style={{ marginBottom: 16 }}>
        These lessons power the member <strong>/learn</strong> page and the 12-week pathway. Drag rows to reorder. Changes auto-save.
      </p>

      {loading ? (
        <div className="asl-empty"><Loader2 style={{ width: 20, height: 20 }} className="animate-spin" /></div>
      ) : lessons.length === 0 ? (
        <div className="asl-empty">
          <BookOpen style={{ width: 32, height: 32, opacity: .3, marginBottom: 12 }} />
          <p>No lessons yet. Add your first lesson to get started.</p>
          <button className="asl-btn-primary" style={{ marginTop: 16 }} onClick={openCreate}><Plus style={{ width: 15, height: 15 }} /> Add Lesson</button>
        </div>
      ) : (
        <div className="asl-table-wrap">
          <table className="asl-table">
            <thead>
              <tr>
                <th style={{ width: 32 }}></th>
                <th style={{ width: 76 }}>Picture</th>
                <th>Title</th>
                <th>Dimension</th>
                <th>Format</th>
                <th>Week</th>
                <th>Mins</th>
                <th>Status</th>
                <th style={{ width: 120 }}></th>
              </tr>
            </thead>
            <tbody>
              {lessons.map((lesson, idx) => (
                <tr
                  key={lesson.id}
                  className={dragIndex === idx ? 'asl-drag-row' : ''}
                  draggable
                  onDragStart={() => handleDragStart(idx)}
                  onDragOver={e => handleDragOver(e, idx)}
                  onDragEnd={handleDragEnd}
                  onDrop={() => handleDrop(idx)}
                  style={dragOver === idx && dragIndex !== idx ? { outline: `2px solid ${B.gold}`, outlineOffset: -2 } : undefined}
                >
                  <td>
                    <span className="asl-drag-handle"><GripVertical style={{ width: 15, height: 15 }} /></span>
                  </td>
                  <td>
                    <div style={{ width: 64, aspectRatio: '16/9', borderRadius: 5, overflow: 'hidden', background: '#F3F1EC', border: `1px solid ${B.border}`, display: 'grid', placeItems: 'center' }}>
                      {lesson.thumbnail_url
                        // eslint-disable-next-line @next/next/no-img-element
                        ? <img src={lesson.thumbnail_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : <span style={{ fontSize: 9, color: B.muted, letterSpacing: '.04em' }}>NONE</span>}
                    </div>
                  </td>
                  <td>
                    <div className="asl-lesson-title">{lesson.title}</div>
                    <div className="asl-lesson-slug">{lesson.slug}</div>
                  </td>
                  <td>
                    <span className="asl-tag asl-tag-dim">{lesson.dimension}</span>
                    {lesson.sub && <div style={{ fontSize: 11, color: B.muted, marginTop: 3 }}>{lesson.sub}</div>}
                  </td>
                  <td>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: B.muted, fontSize: 12 }}>
                      {lesson.format === 'Video' ? <Video style={{ width: 13, height: 13 }} /> : <FileText style={{ width: 13, height: 13 }} />}
                      {lesson.format}
                    </span>
                  </td>
                  <td>
                    {lesson.week_no ? <span className="asl-tag asl-tag-week">Wk {lesson.week_no}</span> : <span style={{ color: B.muted, fontSize: 12 }}>—</span>}
                  </td>
                  <td style={{ color: B.muted, fontSize: 12 }}>{lesson.minutes}m</td>
                  <td>
                    <span className={`asl-tag ${lesson.published ? 'asl-tag-pub' : 'asl-tag-draft'}`}>
                      {lesson.published ? 'Published' : 'Draft'}
                    </span>
                  </td>
                  <td>
                    <div className="asl-row-actions">
                      <button className="asl-btn-ghost" title="Edit" onClick={() => openEdit(lesson)}>
                        <Pencil style={{ width: 13, height: 13 }} />
                      </button>
                      <button className="asl-btn-ghost" title={lesson.published ? 'Unpublish' : 'Publish'} onClick={() => togglePublish(lesson)}>
                        {lesson.published ? <EyeOff style={{ width: 13, height: 13 }} /> : <Eye style={{ width: 13, height: 13 }} />}
                      </button>
                      <button className="asl-btn-danger" title="Delete" onClick={() => deleteLesson(lesson)}>
                        <Trash2 style={{ width: 13, height: 13 }} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add / Edit modal */}
      {showForm && (
        <div className="asl-backdrop" onClick={e => { if (e.target === e.currentTarget) closeForm(); }}>
          <div className={`asl-modal${saving ? ' asl-saving' : ''}`}>
            <div className="asl-modal-head">
              <span className="asl-modal-title">{editing ? 'Edit Lesson' : 'New Lesson'}</span>
              <button className="asl-btn-ghost" onClick={closeForm}>Cancel</button>
            </div>

            <div className="asl-modal-body">
              {/* Title */}
              <Field label="Title" hint="What the member sees on the Learn page">
                <input
                  className="asl-input"
                  value={form.title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="e.g. Small promises, kept"
                  autoFocus
                />
              </Field>

              {/* Slug */}
              <Field label="Slug (URL)" hint={`Members reach this lesson at /learn/lesson/${form.slug || '…'}`}>
                <input
                  className="asl-input"
                  value={form.slug}
                  onChange={e => setForm(f => ({ ...f, slug: slugify(e.target.value) }))}
                  placeholder="small-promises-kept"
                />
              </Field>

              {/* Dimension + Sub */}
              <div className="asl-row2">
                <Field label="Dimension">
                  <select
                    className="asl-select"
                    value={form.dimension}
                    onChange={e => setForm(f => ({ ...f, dimension: e.target.value, sub: null }))}
                  >
                    {DIMENSIONS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </Field>
                <Field label="Sub-topic (optional)">
                  <select
                    className="asl-select"
                    value={form.sub ?? ''}
                    onChange={e => setForm(f => ({ ...f, sub: e.target.value || null }))}
                  >
                    <option value="">None</option>
                    {(SUBS[form.dimension] ?? []).map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </Field>
              </div>

              {/* Format + Minutes + Week */}
              <div className="asl-row3">
                <Field label="Format">
                  <select
                    className="asl-select"
                    value={form.format}
                    onChange={e => setForm(f => ({ ...f, format: e.target.value as 'Video' | 'Reading' }))}
                  >
                    {FORMATS.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </Field>
                <Field label="Duration (minutes)">
                  <input
                    className="asl-input"
                    type="number"
                    min={1}
                    max={180}
                    value={form.minutes}
                    onChange={e => setForm(f => ({ ...f, minutes: Number(e.target.value) }))}
                  />
                </Field>
                <Field label="Pathway week" hint="1–12, or leave blank">
                  <input
                    className="asl-input"
                    type="number"
                    min={1}
                    max={12}
                    value={form.week_no ?? ''}
                    onChange={e => setForm(f => ({ ...f, week_no: e.target.value ? Number(e.target.value) : null }))}
                    placeholder="—"
                  />
                </Field>
              </div>

              {/* Lesson picture (shows on the lesson cards in Learn, and behind the video before it plays) */}
              <Field label="Lesson picture" hint="Shows on the lesson card in Learn, and over the video until it plays. 1280 × 720 px (16:9) · PNG, JPG or WebP · max 2 MB.">
                <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                  <div style={{ width: 200, aspectRatio: '16/9', borderRadius: 8, overflow: 'hidden', background: '#F3F1EC', border: `1px solid ${B.border}`, display: 'grid', placeItems: 'center', flex: 'none' }}>
                    {form.thumbnail_url
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={form.thumbnail_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <span className="asl-hint">No picture yet</span>}
                  </div>
                  <div style={{ display: 'grid', gap: 8 }}>
                    <label className="asl-btn-ghost" style={{ cursor: uploading ? 'wait' : 'pointer', justifyContent: 'center' }}>
                      {uploading ? 'Uploading…' : form.thumbnail_url ? 'Replace picture' : 'Upload picture'}
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        disabled={uploading}
                        style={{ display: 'none' }}
                        onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; if (file) void uploadPicture(file); }}
                      />
                    </label>
                    {form.thumbnail_url && (
                      <button type="button" className="asl-btn-ghost" onClick={() => setForm(f => ({ ...f, thumbnail_url: null }))}>Remove picture</button>
                    )}
                    {picError && <span className="asl-hint" style={{ color: '#B42318' }}>{picError}</span>}
                  </div>
                </div>
              </Field>

              {/* Video URL */}
              {form.format === 'Video' && (
                <Field label="Video" hint="Upload to Ascentor's own player: no YouTube logo, no pauses we can't control">
                  <VideoUploadField
                    value={form.video_id}
                    onChange={video_id => setForm(f => ({ ...f, video_id }))}
                    defaultTitle={form.title}
                  />
                </Field>
              )}

              {form.format === 'Video' && !form.video_id && (
                <Field label="Or a video link" hint="Vimeo, YouTube or a direct file. Used only when no video is uploaded above.">
                  <input
                    className="asl-input"
                    value={form.video_url ?? ''}
                    onChange={e => setForm(f => ({ ...f, video_url: e.target.value || null }))}
                    placeholder="https://vimeo.com/… or https://youtube.com/watch?v=…"
                  />
                </Field>
              )}

              {/* Body text */}
              <Field label="Body / Reading content" hint="Markdown supported. Required for Reading format; optional for Video.">
                <textarea
                  className="asl-textarea"
                  value={form.body ?? ''}
                  onChange={e => setForm(f => ({ ...f, body: e.target.value || null }))}
                  placeholder="Lesson content in Markdown…"
                  style={{ minHeight: 120 }}
                />
              </Field>

              {/* Sort order */}
              <Field label="Sort order" hint="Lower numbers appear first. Drag rows to reorder after saving.">
                <input
                  className="asl-input"
                  type="number"
                  min={0}
                  value={form.sort}
                  onChange={e => setForm(f => ({ ...f, sort: Number(e.target.value) }))}
                />
              </Field>

              {/* Published toggle */}
              <div className="asl-toggle-row">
                <label className="asl-toggle">
                  <input
                    type="checkbox"
                    checked={form.published}
                    onChange={e => setForm(f => ({ ...f, published: e.target.checked }))}
                  />
                  <div className="asl-toggle-track" />
                  <div className="asl-toggle-thumb" />
                </label>
                <span className="asl-toggle-label">
                  {form.published ? 'Published — visible to members' : 'Draft — hidden from members'}
                </span>
              </div>
            </div>

            <div className="asl-modal-foot">
              <button className="asl-btn-ghost" onClick={closeForm}>Cancel</button>
              <button
                className="asl-btn-primary"
                onClick={saveLesson}
                disabled={!form.title.trim() || !form.slug.trim() || saving}
              >
                {saving ? <Loader2 style={{ width: 14, height: 14 }} className="animate-spin" /> : null}
                {editing ? 'Save changes' : 'Create lesson'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
