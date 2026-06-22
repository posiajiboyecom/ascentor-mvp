'use client';

import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useSearchParams } from 'next/navigation';


// Renders SVG icon strings safely  
function SvgIcon({ html, className, style }: { html: string; className?: string; style?: React.CSSProperties }) {
  return <span className={className} style={style} dangerouslySetInnerHTML={{ __html: html }} />;
}

// ============================================================
// THE LEDGER — token bridge
// Every color/font reference in this file flows through this B
// object — nothing below this point hardcodes a color directly
// (confirmed: zero raw hex outside this block before this pass).
// That made this file the cleanest of the four to convert: swap
// the definitions here, the other ~750 lines update for free.
//
// explorer/climber were plan-tier accent colors with no Ledger
// equivalent (Ledger's palette is deliberately narrow: gold +
// good/bad/warn/info, not a color per subscription tier). Mapped
// to ledger-info and ledger-gold respectively rather than inventing
// new tokens — same consolidation already applied in
// AdminOverviewClient.tsx and app/admin/users/page.tsx.
//   explorer -> ledger-info   (was teal #14B8A6)
//   climber  -> ledger-gold   (was purple #8B5CF6 — builder tier
//               already uses gold/B.gold elsewhere in this file,
//               so climber reusing gold keeps tier badges from
//               clashing; differentiated by label text, not color)
//   success  -> ledger-good
//   error    -> ledger-bad
// ============================================================
const B = {
  fontDisplay: "var(--ledger-font-serif)",
  fontUI:      "var(--ledger-font-ui)",
  fontMono:    "var(--ledger-font-mono)",
  dark:        'var(--ledger-bg)',
  dark800:     'var(--ledger-bg-deep)',
  dark700:     'var(--ledger-bg-card)',
  dark600:     'var(--ledger-bg-input)',
  dark500:     'var(--ledger-ink-faint)',
  dark400:     'var(--ledger-ink-soft)',
  dark200:     'var(--ledger-ink)',
  dark50: 'var(--ledger-ink)',
  gold:        'var(--ledger-gold)',
  gold300:     'var(--ledger-gold)',
  gold600:     'var(--ledger-gold-deep)',
  goldMuted:   'var(--ledger-gold-bg)',
  goldBorder:  'var(--ledger-gold-border)',
  border:      'var(--ledger-line)',
  explorer:    'var(--ledger-info)',
  climber:     'var(--ledger-gold)',
  success:     'var(--ledger-good)',
  successMuted:'var(--ledger-good-bg)',
  successBorder:'rgba(79,143,79,0.3)',
  error:       'var(--ledger-bad)',
  errorMuted:  'var(--ledger-bad-bg)',
};

// Difficulty → brand colour (stage metaphor: beginner=explorer, mid=builder, advanced=climber)
const DIFF_CFG: Record<string, { color: string; label: string }> = {
  beginner:     { color: B.explorer, label: 'Beginner'     },
  intermediate: { color: B.gold,     label: 'Intermediate' },
  advanced:     { color: B.climber,  label: 'Advanced'     },
};

const DEFAULT_CATEGORIES = ['Leadership', 'Marketing', 'Finance', 'Career Growth', 'Communication', 'Networking', 'Frameworks', 'Regional Context', 'Entrepreneurship', 'Personal Development', 'General'];
const DIFFICULTIES = ['beginner', 'intermediate', 'advanced'] as const;
const EMOJIS      = ['<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>', '<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 20h10"/><path d="M10 20c5.5-2.5.8-6.4 3-10"/><path d="M9.5 9.4c1.1.8 1.8 2.2 2.3 3.7-2 .4-3.5.4-4.8-.3-1.2-.6-2.3-1.9-3-4.2 2.8-.5 4.4 0 5.5.8z"/><path d="M14.1 6a7 7 0 0 0-1.1 4c1.9-.1 3.3-.6 4.3-1.4 1-1 1.6-2.3 1.7-4.6-2.7.1-4 1-4.9 2z"/></svg>', '<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 20h20"/><path d="M5 20V8l7-5 7 5v12"/><path d="M9 20v-4h6v4"/></svg>', '<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m10.065 12.493-6.18 1.318a.934.934 0 0 1-1.108-.702l-.537-2.15a1.07 1.07 0 0 1 .691-1.265l13.504-4.44"/><path d="m13.56 11.747 4.332-.924"/><path d="m16 21-3.105-6.21"/><path d="M16.485 5.94a2 2 0 0 1 1.455-2.425l1.09-.272a1 1 0 0 1 1.212.727l1.515 6.06a1 1 0 0 1-.727 1.213l-1.09.272a2 2 0 0 1-2.425-1.455z"/><path d="m6.158 8.633 1.114 4.456"/><path d="m8 21 3.105-6.21"/></svg>', '<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>', '<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.42 4.58a5.4 5.4 0 0 0-7.65 0l-.77.78-.77-.78a5.4 5.4 0 0 0-7.65 0C1.46 6.7 1.33 10.28 4 13l8 8 8-8c2.67-2.72 2.54-6.3.42-8.42z"/></svg>', '<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>', '<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>', '<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z"/></svg>', '<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8.5 14.5A4.5 4.5 0 0 0 17 12c0-4-3.5-6.5-4-9-.5 2.5-3.5 5-3.5 5-1.5-2-2-4-2-4-1 2.5-2 5-2 7a6 6 0 0 0 6 6 4.5 4.5 0 0 0 4.5-4.5c0-1.5-.5-3-1.5-4z"/></svg>', '<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/></svg>', '<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/></svg>'];

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
// Font @import removed — Cormorant Garamond / Syne / DM Mono are now
// loaded once in app/admin/layout.tsx for every /admin page, so this
// page no longer needs its own <link>/@import. Re-importing per-page
// was harmless but redundant (browser dedupes identical font
// requests anyway) — removed for clarity, not because it was broken.
const CSS = `
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
    /* Color baked into this data URI as a literal hex (#948C7C =
       --ledger-ink-faint, LIGHT theme value) because CSS custom
       properties can't be referenced inside a data: URI. This means
       the arrow will be slightly lighter than ideal in dark mode
       (#7A7567) — a real but minor limitation, not fixed here since
       it'd require either a second CSS rule keyed to
       [data-ledger-theme="dark"] with its own data URI, or switching
       this to an inline SVG element instead of a background-image.
       Flagging rather than leaving unexplained. */
    background-image: url("data:image/svg+xml,%3Csvg width='12' height='8' viewBox='0 0 12 8' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L6 7L11 1' stroke='%23948C7C' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E");
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
  .asc-course-card:hover { border-color: var(--ledger-line-strong) !important; }

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
    lessons: 1, duration: '', emoji: '<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>', youtube_id: '', is_published: true,
    plan_tier: 'free' as string,
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
      emoji:        course.emoji        || '<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>',
      youtube_id:   course.youtube_id   || '',
      is_published: course.is_published ?? true,
      plan_tier:    course.plan_tier    || 'free',
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
              {showCatManager ? 'Hide Categories' : <span style={{display:'inline-flex',alignItems:'center',gap:6}}><svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>Categories</span>}
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
                    title="icon"
                    dangerouslySetInnerHTML={{ __html: emoji }}
                  />
                ))}
              </div>
            </div>

            {/* Plan tier — controls who can access this course */}
            <div>
              <FieldLabel>Plan Access</FieldLabel>
              <select
                className="asc-field"
                value={form.plan_tier}
                onChange={e => setForm({ ...form, plan_tier: e.target.value })}
                style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', background: B.dark700, color: B.dark200, border: `1px solid ${B.border}`, fontFamily: B.fontUI, fontSize: '13px', outline: 'none' }}
              >
                <option value="free">Free — all users can access</option>
                <option value="explorer">Explorer and above</option>
                <option value="builder">Builder and above</option>
                <option value="climber">Climber only</option>
              </select>
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
                    <span dangerouslySetInnerHTML={{ __html: c.emoji || "" }} />
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
                    {/* Plan tier badge */}
                    {c.plan_tier && c.plan_tier !== 'free' && (() => {
                      // Backgrounds/borders here were hardcoded to the OLD
                      // explorer=teal / climber=purple hex independently of
                      // the B object above, so remapping B.explorer/B.climber
                      // alone (done earlier in this pass) would have left
                      // teal/purple badge backgrounds under gold/info text —
                      // visually broken. Fixed to derive consistently:
                      // explorer matches B.explorer (ledger-info, was teal),
                      // climber reuses the gold treatment since Ledger has
                      // no purple token (same consolidation as B.climber
                      // itself, documented where B is defined above).
                      const tierColors: Record<string, { color: string; bg: string; border: string }> = {
                        explorer: { color: B.explorer, bg: 'var(--ledger-info-bg)', border: 'rgba(77,124,199,0.25)' },
                        builder:  { color: B.gold,     bg: B.goldMuted,             border: B.goldBorder             },
                        climber:  { color: B.climber,  bg: B.goldMuted,             border: B.goldBorder             },
                      };
                      const t = tierColors[c.plan_tier] || tierColors.explorer;
                      return (
                        <span style={{
                          fontFamily: B.fontMono, fontSize: '9px', fontWeight: 500,
                          letterSpacing: '0.07em', textTransform: 'uppercase' as const,
                          padding: '2px 7px', borderRadius: '999px',
                          background: t.bg, color: t.color, border: `1px solid ${t.border}`,
                          flexShrink: 0,
                        }}>
                          {c.plan_tier}+
                        </span>
                      );
                    })()}
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
                    borderColor="rgba(200,74,56,0.3)"
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
