'use client';

import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useSearchParams } from 'next/navigation';

// ============================================================
// ASCENTOR BRAND TOKENS · Brand Book v1.0 · 2026
// Display : Cormorant Garamond 700 / Italic 600
// UI      : Syne 400–800
// Mono    : DM Mono 400/500
// Gold    : #E8A020   Dark: var(--admin-bg)
// ============================================================
const B = {
  fontDisplay: "'Cormorant Garamond', Georgia, serif",
  fontUI:      "'Syne', system-ui, sans-serif",
  fontMono:    "'DM Mono', 'Courier New', monospace",
  dark:        'var(--admin-bg)',
  dark800:     'var(--admin-bg-deep)',
  dark700:     'var(--admin-bg-card)',
  dark600:     'var(--admin-bg-input)',
  dark500:     'var(--admin-text-faint)',
  dark400:     'var(--admin-text-muted)',
  dark200:     'var(--admin-text)',
  dark50:      '#F7F6F3',
  gold:        '#E8A020',
  gold300:     '#F9D97A',
  gold600:     '#C87820',
  goldMuted:   'rgba(232,160,32,0.09)',
  goldBorder:  'rgba(232,160,32,0.25)',
  border:      'var(--admin-border)',
  explorer:    '#14B8A6',
  climber:     '#8B5CF6',
  success:     '#10B981',
  successMuted:'rgba(16,185,129,0.09)',
  successBorder:'rgba(16,185,129,0.25)',
  error:       '#EF4444',
  errorMuted:  'rgba(239,68,68,0.08)',
};

// Difficulty → brand colour (stage metaphor: beginner=explorer, mid=builder, advanced=climber)
const DIFF_CFG: Record<string, { color: string; label: string }> = {
  beginner:     { color: B.explorer, label: 'Beginner'     },
  intermediate: { color: B.gold,     label: 'Intermediate' },
  advanced:     { color: B.climber,  label: 'Advanced'     },
};

const DEFAULT_CATEGORIES = ['Leadership', 'Marketing', 'Finance', 'Career Growth', 'Communication', 'Networking', 'Frameworks', 'African Context', 'Entrepreneurship', 'Personal Development', 'General'];
const DIFFICULTIES = ['beginner', 'intermediate', 'advanced'] as const;
const EMOJIS      = ['📚', '🌱', '🏛️', '🔭', '💬', '🤝', '🧭', '🎯', '💡', '🔥', '📊', '🚀'];

function extractYoutubeId(url: string): string {
  if (!url) return '';
  if (!url.includes('/') && !url.includes('.')) return url;
  const match = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return match?.[1] || url;
}

// ── Shared primitives ────────────────────────────────────────────
function MonoLabel({ children, color = B.dark500 }: { children: React.ReactNode; color?: string }) {
  return (
    <span style={{
      fontFamily:    B.fontMono,
      fontSize:      '10px',
      fontWeight:    500,
      letterSpacing: '0.07em',
      textTransform: 'uppercase' as const,
      color,
    }}>
      {children}
    </span>
  );
}

function FieldLabel({ children }: { children: string }) {
  return (
    <label style={{
      display:       'block',
      fontFamily:    B.fontMono,
      fontSize:      '10px',
      fontWeight:    500,
      letterSpacing: '0.07em',
      textTransform: 'uppercase' as const,
      color:         B.dark500,
      marginBottom:  '6px',
    }}>
      {children}
    </label>
  );
}

function ActionBtn({
  children, onClick, color = B.gold, borderColor = B.goldBorder, hoverBg = B.goldMuted,
}: {
  children: React.ReactNode;
  onClick: () => void;
  color?: string;
  borderColor?: string;
  hoverBg?: string;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding:       '7px 14px',
        borderRadius:  '8px',
        border:        `1px solid ${borderColor}`,
        cursor:        'pointer',
        background:    'transparent',
        color,
        fontFamily:    B.fontUI,
        fontSize:      '12px',
        fontWeight:    600,
        letterSpacing: '0.01em',
        transition:    'all 0.12s ease',
        whiteSpace:    'nowrap' as const,
      }}
      onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = hoverBg)}
      onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = 'transparent')}
    >
      {children}
    </button>
  );
}

// ── CSS ──────────────────────────────────────────────────────────
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,600;0,700;1,600&family=Syne:wght@400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap');
  *, *::before, *::after { box-sizing: border-box; }

  .asc-field {
    width: 100%;
    padding: 11px 14px;
    border-radius: 10px;
    border: 1px solid ${B.border};
    background: ${B.dark700};
    color: ${B.dark50};
    font-family: ${B.fontUI};
    font-size: 13px;
    outline: none;
    transition: border-color 0.15s ease;
  }
  .asc-field::placeholder { color: ${B.dark500}; }
  .asc-field:focus        { border-color: ${B.goldBorder}; }
  textarea.asc-field      { resize: none; }
  select.asc-field {
    cursor: pointer;
    font-family: ${B.fontMono};
    font-size: 10px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg width='12' height='8' viewBox='0 0 12 8' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L6 7L11 1' stroke='%234A4438' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 12px center;
    background-color: ${B.dark700};
    padding-right: 32px;
  }
  select.asc-field option { background: ${B.dark700}; text-transform: uppercase; }

  .asc-btn-primary {
    padding: 11px 22px;
    border-radius: 10px;
    border: none;
    cursor: pointer;
    background: ${B.gold};
    color: ${B.dark};
    font-family: ${B.fontUI};
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.02em;
    transition: background 0.15s ease, opacity 0.15s ease;
    white-space: nowrap;
  }
  .asc-btn-primary:hover:not(:disabled) { background: ${B.gold600}; }
  .asc-btn-primary:disabled { opacity: 0.45; cursor: not-allowed; }

  .asc-btn-ghost {
    padding: 10px 18px;
    border-radius: 10px;
    border: 1px solid ${B.border};
    cursor: pointer;
    background: transparent;
    color: ${B.dark400};
    font-family: ${B.fontUI};
    font-size: 13px;
    font-weight: 500;
    transition: all 0.12s ease;
  }
  .asc-btn-ghost:hover { border-color: ${B.goldBorder}; color: ${B.dark200}; }

  .asc-course-card { transition: border-color 0.12s ease; }
  .asc-course-card:hover { border-color: var(--admin-border-strong) !important; }

  /* Emoji picker button */
  .asc-emoji-btn {
    width: 38px; height: 38px;
    border-radius: 8px;
    border: 1px solid ${B.border};
    background: ${B.dark700};
    cursor: pointer;
    font-size: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.12s ease;
  }
  .asc-emoji-btn:hover { border-color: ${B.goldBorder}; }
  .asc-emoji-btn.selected {
    background: ${B.goldMuted};
    border: 1.5px solid ${B.gold};
  }

  /* Published toggle */
  .asc-toggle-wrap {
    display: flex;
    align-items: center;
    gap: 10px;
    cursor: pointer;
    user-select: none;
  }
  .asc-toggle-track {
    width: 36px; height: 20px;
    border-radius: 10px;
    border: 1px solid ${B.border};
    background: ${B.dark600};
    position: relative;
    transition: background 0.15s ease, border-color 0.15s ease;
    flex-shrink: 0;
  }
  .asc-toggle-track.on {
    background: ${B.goldMuted};
    border-color: ${B.goldBorder};
  }
  .asc-toggle-thumb {
    width: 14px; height: 14px;
    border-radius: 50%;
    background: ${B.dark400};
    position: absolute;
    top: 2px; left: 2px;
    transition: transform 0.15s ease, background 0.15s ease;
  }
  .asc-toggle-thumb.on {
    transform: translateX(16px);
    background: ${B.gold};
  }

  @media (max-width: 640px) {
    .asc-form-grid-3 { grid-template-columns: 1fr !important; }
    .asc-card-actions { flex-wrap: wrap; }
  }
`;

// ── Suspense entry point ─────────────────────────────────────────
export default function AdminCoursesPage() {
  return (
    <>
      <style>{CSS}</style>
      <Suspense fallback={
        <div style={{ padding: '80px 0', textAlign: 'center' }}>
          <MonoLabel color={B.dark600}>Loading courses…</MonoLabel>
        </div>
      }>
        <AdminCoursesInner />
      </Suspense>
    </>
  );
}

// ── Main component ───────────────────────────────────────────────
function AdminCoursesInner() {
  const supabase     = createClient();
  const searchParams = useSearchParams();

  const [courses,  setCourses]  = useState<any[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [showForm, setShowForm] = useState(searchParams.get('action') === 'create');
  const [editing,  setEditing]  = useState<any>(null);
  const [saving,   setSaving]   = useState(false);
  const [customCategories, setCustomCategories] = useState<string[]>(DEFAULT_CATEGORIES);
  const [newCatInput, setNewCatInput] = useState('');
  const [showCatManager, setShowCatManager] = useState(false);
  const [dragIndex, setDragIndex]   = useState<number | null>(null);
  const [dragOver, setDragOver]     = useState<number | null>(null);
  const [reordering, setReordering] = useState(false);

  const emptyForm = {
    title: '', description: '', category: 'General', difficulty: 'beginner' as string,
    lessons: 1, duration: '', emoji: '📚', youtube_id: '', is_published: true,
  };
  const [form, setForm] = useState(emptyForm);

  useEffect(() => { loadCourses(); }, []);

  async function loadCourses() {
    setLoading(true);
    const { data } = await supabase.from('courses').select('*').order('sort_order');
    const coursesData = data || [];
    setCourses(coursesData);
    // Derive categories from existing courses + defaults, preserving order
    const existingCats = [...new Set(coursesData.map((c: any) => c.category).filter(Boolean))] as string[];
    const merged = [...new Set([...existingCats, ...DEFAULT_CATEGORIES])];
    setCustomCategories(merged);
    setLoading(false);
  }

  // ── Drag-to-reorder ──────────────────────────────────────────
  function handleDragStart(idx: number) { setDragIndex(idx); }
  function handleDragOver(e: React.DragEvent, idx: number) {
    e.preventDefault();
    setDragOver(idx);
  }
  function handleDragEnd() { setDragIndex(null); setDragOver(null); }

  async function handleDrop(dropIdx: number) {
    if (dragIndex === null || dragIndex === dropIdx) {
      setDragIndex(null); setDragOver(null); return;
    }
    const reordered = [...courses];
    const [moved] = reordered.splice(dragIndex, 1);
    reordered.splice(dropIdx, 0, moved);
    const updated = reordered.map((c, i) => ({ ...c, sort_order: i + 1 }));
    setCourses(updated);
    setDragIndex(null); setDragOver(null);
    setReordering(true);
    await Promise.all(
      updated.map(c => supabase.from('courses').update({ sort_order: c.sort_order }).eq('id', c.id))
    );
    setReordering(false);
  }

  // ── Category manager ─────────────────────────────────────────
  function addCategory() {
    const cat = newCatInput.trim();
    if (!cat || customCategories.includes(cat)) return;
    setCustomCategories(prev => [...prev, cat]);
    setNewCatInput('');
  }
  function removeCategory(cat: string) {
    // Don't remove if courses use it
    const inUse = courses.some(c => c.category === cat);
    if (inUse) { alert(`"${cat}" is used by ${courses.filter(c=>c.category===cat).length} course(s). Reassign them first.`); return; }
    setCustomCategories(prev => prev.filter(c => c !== cat));
  }

  function openEdit(course: any) {
    setForm({
      title:        course.title        || '',
      description:  course.description  || '',
      category:     course.category     || 'General',
      difficulty:   course.difficulty   || 'beginner',
      lessons:      course.lessons      || 1,
      duration:     course.duration     || '',
      emoji:        course.emoji        || '📚',
      youtube_id:   course.youtube_id   || '',
      is_published: course.is_published ?? true,
    });
    setEditing(course);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function openCreate() {
    setForm(emptyForm);
    setEditing(null);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
    // TODO: swap for useModal() confirm when available in this subtree
    if (!window.confirm(`Delete "${title}"? This cannot be undone.`)) return;
    await supabase.from('courses').delete().eq('id', id);
    loadCourses();
  }

  const published = courses.filter(c => c.is_published).length;
  const drafts    = courses.filter(c => !c.is_published).length;
  const ytId      = extractYoutubeId(form.youtube_id);

  if (loading) {
    return (
      <div style={{ padding: '80px 0', textAlign: 'center' }}>
        <MonoLabel color={B.dark600}>Loading courses…</MonoLabel>
      </div>
    );
  }

  return (
    <div className="animate-fade-up" style={{ fontFamily: B.fontUI }}>

      {/* ── HEADER ── */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{
          display:        'flex',
          justifyContent: 'space-between',
          alignItems:     'flex-start',
          flexWrap:       'wrap',
          gap:            '12px',
          marginBottom:   '4px',
        }}>
          <div>
            <h1 style={{
              fontFamily: B.fontDisplay,
              fontWeight: 700,
              fontSize:   'clamp(24px, 3vw, 32px)',
              color:      B.dark50,
              margin:     '0 0 4px',
              lineHeight: 1.15,
            }}>
              Manage Courses
            </h1>
            <p style={{
              fontFamily:    B.fontMono,
              fontSize:      '11px',
              color:         B.dark500,
              margin:        0,
              letterSpacing: '0.04em',
            }}>
              {published} PUBLISHED · {drafts} DRAFTS · {courses.length} TOTAL
            </p>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              className="asc-btn-primary"
              onClick={openCreate}
              style={{ display: showForm && !editing ? 'none' : undefined }}
            >
              + Add Course
            </button>
            <button
              className="asc-btn-ghost"
              onClick={() => setShowCatManager(v => !v)}
              style={{ fontSize: 12 }}
            >
              {showCatManager ? 'Hide Categories' : '⚙ Categories'}
            </button>
          </div>
        </div>

        {/* Gold rule */}
        <div style={{
          height:     '1px',
          background: `linear-gradient(90deg, ${B.gold} 0%, transparent 60%)`,
          marginTop:  '16px',
        }} />
      </div>

      {/* ── CATEGORY MANAGER ── */}
      {showCatManager && (
        <div style={{
          borderRadius: 14, padding: '18px 20px', marginBottom: 20,
          background: B.dark800, border: `1px solid ${B.border}`,
          borderLeft: `3px solid ${B.dark500}`,
        }}>
          <p style={{ fontFamily: B.fontDisplay, fontSize: 17, fontWeight: 700, color: B.dark200, margin: '0 0 14px' }}>
            Manage Categories
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
            {customCategories.map(cat => {
              const inUse = courses.filter(c => c.category === cat).length;
              return (
                <div key={cat} style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '5px 10px 5px 12px', borderRadius: 20,
                  background: B.dark700, border: `1px solid ${B.border}`,
                  fontFamily: B.fontUI, fontSize: 12, color: B.dark200,
                }}>
                  <span>{cat}</span>
                  {inUse > 0 && (
                    <span style={{ fontFamily: B.fontMono, fontSize: 9, color: B.gold, background: B.goldMuted, borderRadius: 10, padding: '1px 5px' }}>
                      {inUse}
                    </span>
                  )}
                  <button onClick={() => removeCategory(cat)} style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: B.dark500, fontSize: 13, lineHeight: 1, padding: '0 0 0 2px',
                  }}>×</button>
                </div>
              );
            })}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              className="asc-field"
              value={newCatInput}
              onChange={e => setNewCatInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addCategory()}
              placeholder="New category name…"
              style={{ flex: 1, fontSize: 12 }}
            />
            <button className="asc-btn-primary" onClick={addCategory} style={{ fontSize: 12, padding: '0 16px' }}>
              Add
            </button>
          </div>
        </div>
      )}

      {/* ── FORM PANEL ── */}
      {showForm && (
        <div style={{
          borderRadius: '14px',
          padding:      '22px 24px',
          marginBottom: '28px',
          background:   B.dark800,
          border:       `1px solid ${B.goldBorder}`,
          borderLeft:   `3px solid ${B.gold}`,
        }}>
          <div style={{ marginBottom: '20px' }}>
            <h3 style={{
              fontFamily: B.fontDisplay,
              fontWeight: 700,
              fontSize:   '20px',
              color:      B.dark50,
              margin:     '0 0 2px',
            }}>
              {editing ? 'Edit Course' : 'New Course'}
            </h3>
            <MonoLabel color={B.dark500}>
              {editing ? `Editing · ${editing.title}` : 'Fill in the details below'}
            </MonoLabel>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

            {/* Title */}
            <div>
              <FieldLabel>Course Title *</FieldLabel>
              <input
                className="asc-field"
                value={form.title}
                onChange={e => setForm({ ...form, title: e.target.value })}
                placeholder="e.g. The Unspoken Rules of Nigerian Corporate Culture"
              />
            </div>

            {/* Description */}
            <div>
              <FieldLabel>Description</FieldLabel>
              <textarea
                className="asc-field"
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                placeholder="What will members learn? Keep it direct — not motivational."
                rows={3}
              />
            </div>

            {/* Category / Difficulty / Duration — 3-col grid */}
            <div
              style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}
              className="asc-form-grid-3"
            >
              <div>
                <FieldLabel>Category</FieldLabel>
                <select
                  className="asc-field"
                  value={form.category}
                  onChange={e => setForm({ ...form, category: e.target.value })}
                >
                  {customCategories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <FieldLabel>Difficulty</FieldLabel>
                <select
                  className="asc-field"
                  value={form.difficulty}
                  onChange={e => setForm({ ...form, difficulty: e.target.value })}
                >
                  {DIFFICULTIES.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <FieldLabel>Duration</FieldLabel>
                <input
                  className="asc-field"
                  value={form.duration}
                  onChange={e => setForm({ ...form, duration: e.target.value })}
                  placeholder="e.g. 25 min"
                />
              </div>
            </div>

            {/* YouTube */}
            <div>
              <FieldLabel>YouTube URL or Video ID</FieldLabel>
              <input
                className="asc-field"
                value={form.youtube_id}
                onChange={e => setForm({ ...form, youtube_id: e.target.value })}
                placeholder="https://youtube.com/watch?v=… or just the video ID"
              />
              {ytId && (
                <div style={{
                  marginTop:    '10px',
                  borderRadius: '10px',
                  overflow:     'hidden',
                  border:       `1px solid ${B.border}`,
                  width:        'fit-content',
                  position:     'relative',
                }}>
                  <img
                    src={`https://img.youtube.com/vi/${ytId}/mqdefault.jpg`}
                    alt="Thumbnail preview"
                    style={{ width: '200px', height: 'auto', display: 'block' }}
                  />
                  {/* Gold overlay badge */}
                  <div style={{
                    position:   'absolute',
                    bottom:     '6px',
                    left:       '6px',
                    padding:    '2px 8px',
                    borderRadius:'999px',
                    background: B.dark,
                    border:     `1px solid ${B.goldBorder}`,
                  }}>
                    <MonoLabel color={B.gold}>Preview</MonoLabel>
                  </div>
                </div>
              )}
            </div>

            {/* Emoji picker */}
            <div>
              <FieldLabel>Emoji Icon</FieldLabel>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {EMOJIS.map(emoji => (
                  <button
                    key={emoji}
                    className={`asc-emoji-btn${form.emoji === emoji ? ' selected' : ''}`}
                    onClick={() => setForm({ ...form, emoji })}
                    type="button"
                    title={emoji}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>

            {/* Published toggle — custom branded, not raw <input type="checkbox"> */}
            <div>
              <FieldLabel>Visibility</FieldLabel>
              <div
                className="asc-toggle-wrap"
                onClick={() => setForm({ ...form, is_published: !form.is_published })}
              >
                <div className={`asc-toggle-track${form.is_published ? ' on' : ''}`}>
                  <div className={`asc-toggle-thumb${form.is_published ? ' on' : ''}`} />
                </div>
                <span style={{
                  fontFamily: B.fontUI,
                  fontSize:   '13px',
                  fontWeight: 500,
                  color:      form.is_published ? B.dark200 : B.dark400,
                }}>
                  {form.is_published ? 'Published — visible to members' : 'Draft — hidden from members'}
                </span>
              </div>
            </div>

            {/* Form actions */}
            <div style={{
              display:    'flex',
              gap:        '10px',
              marginTop:  '4px',
              paddingTop: '16px',
              borderTop:  `1px solid ${B.border}`,
            }}>
              <button
                className="asc-btn-primary"
                onClick={handleSave}
                disabled={saving || !form.title.trim()}
              >
                {saving ? 'Saving…' : editing ? 'Update Course' : 'Create Course'}
              </button>
              <button
                className="asc-btn-ghost"
                onClick={() => { setShowForm(false); setEditing(null); }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── COURSE LIST ── */}
      {courses.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '70px 0' }}>
          <p style={{
            fontFamily: B.fontDisplay,
            fontSize:   '28px',
            color:      B.dark500,
            margin:     '0 0 8px',
          }}>
            No courses yet
          </p>
          <MonoLabel color={B.dark600}>Create your first course above.</MonoLabel>
        </div>
      ) : (
        <>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <p style={{ fontFamily: B.fontMono, fontSize: 10, color: B.dark500, letterSpacing: '0.06em', margin: 0 }}>
            DRAG ROWS TO REORDER · {reordering ? '⏳ Saving order…' : 'Auto-saved'}
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {courses.map((c, idx) => {
            const diffCfg = DIFF_CFG[c.difficulty] ?? { color: B.dark400, label: c.difficulty };
            const ytThumb = c.youtube_id
              ? `https://img.youtube.com/vi/${c.youtube_id}/mqdefault.jpg`
              : null;

            return (
              <div
                key={c.id}
                draggable
                onDragStart={() => handleDragStart(idx)}
                onDragOver={e => handleDragOver(e, idx)}
                onDrop={() => handleDrop(idx)}
                onDragEnd={handleDragEnd}
                className="asc-course-card"
                style={{
                  borderRadius: '12px',
                  padding:      '16px 18px',
                  background:   B.dark800,
                  border:       `1px solid ${dragOver === idx ? B.goldBorder : c.is_published ? B.border : B.dark600}`,
                  borderLeft:   `3px solid ${c.is_published ? B.gold : B.dark500}`,
                  display:      'flex',
                  alignItems:   'center',
                  gap:          '12px',
                  opacity:      dragIndex === idx ? 0.45 : 1,
                  transition:   'opacity 0.15s, border-color 0.15s',
                  cursor:       'grab',
                }}
              >
                {/* Drag handle */}
                <div style={{
                  display: 'flex', flexDirection: 'column', gap: 3,
                  cursor: 'grab', flexShrink: 0, padding: '2px 4px',
                }}>
                  {[0,1,2].map(i => (
                    <div key={i} style={{ width: 14, height: 1.5, borderRadius: 1, background: B.dark500 }} />
                  ))}
                </div>
                {/* Thumbnail / Emoji */}
                {ytThumb ? (
                  <img
                    src={ytThumb}
                    alt={c.title}
                    style={{
                      width:        '76px',
                      height:       '52px',
                      borderRadius: '8px',
                      objectFit:    'cover',
                      flexShrink:   0,
                      opacity:      c.is_published ? 1 : 0.5,
                    }}
                  />
                ) : (
                  <div style={{
                    width:           '76px',
                    height:          '52px',
                    borderRadius:    '8px',
                    background:      B.dark700,
                    border:          `1px solid ${B.border}`,
                    display:         'flex',
                    alignItems:      'center',
                    justifyContent:  'center',
                    fontSize:        '24px',
                    flexShrink:      0,
                    opacity:         c.is_published ? 1 : 0.5,
                  }}>
                    {c.emoji || '📚'}
                  </div>
                )}

                {/* Course info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                    <h4 style={{
                      fontFamily:   B.fontUI,
                      fontWeight:   600,
                      fontSize:     '14px',
                      color:        c.is_published ? B.dark50 : B.dark400,
                      margin:       0,
                      overflow:     'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace:   'nowrap' as const,
                    }}>
                      {c.title}
                    </h4>
                    {/* Draft badge — brand styled */}
                    {!c.is_published && (
                      <span style={{
                        fontFamily:    B.fontMono,
                        fontSize:      '9px',
                        fontWeight:    500,
                        letterSpacing: '0.07em',
                        textTransform: 'uppercase' as const,
                        padding:       '2px 7px',
                        borderRadius:  '999px',
                        background:    B.dark700,
                        color:         B.dark400,
                        border:        `1px solid ${B.dark500}`,
                        flexShrink:    0,
                      }}>
                        Draft
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <MonoLabel color={B.dark500}>{c.category}</MonoLabel>
                    <span style={{ color: B.dark600, fontFamily: B.fontMono, fontSize: '10px' }}>·</span>
                    {/* Difficulty pill — stage colour */}
                    <span style={{
                      fontFamily:    B.fontMono,
                      fontSize:      '10px',
                      fontWeight:    500,
                      letterSpacing: '0.05em',
                      textTransform: 'uppercase' as const,
                      color:         diffCfg.color,
                    }}>
                      {diffCfg.label}
                    </span>
                    {c.duration && (
                      <>
                        <span style={{ color: B.dark600, fontFamily: B.fontMono, fontSize: '10px' }}>·</span>
                        <MonoLabel color={B.dark500}>{c.duration}</MonoLabel>
                      </>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="asc-card-actions" style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                  {/* Publish toggle */}
                  <ActionBtn
                    onClick={() => togglePublish(c.id, c.is_published)}
                    color={c.is_published ? B.dark400 : B.success}
                    borderColor={c.is_published ? B.border : B.successBorder}
                    hoverBg={c.is_published ? B.dark700 : B.successMuted}
                  >
                    {c.is_published ? 'Unpublish' : 'Publish'}
                  </ActionBtn>

                  <ActionBtn
                    onClick={() => openEdit(c)}
                    color={B.gold}
                    borderColor={B.goldBorder}
                    hoverBg={B.goldMuted}
                  >
                    Edit
                  </ActionBtn>

                  <ActionBtn
                    onClick={() => handleDelete(c.id, c.title)}
                    color={B.error}
                    borderColor={`${B.error}30`}
                    hoverBg={B.errorMuted}
                  >
                    Delete
                  </ActionBtn>
                </div>
              </div>
            );
          })}
        </div>
        </>
      )}
    </div>
  );
}
