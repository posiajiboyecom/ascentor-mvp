'use client';
export const dynamic = 'force-dynamic';

import { useState, useEffect, Suspense } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useSearchParams } from 'next/navigation';

// ── SVG icon set replacing emoji picker ─────────────────────────
type CohortIconKey = 'users'|'code'|'money'|'bank'|'rocket'|'globe'|'target'|'chart'|'fire'|'bulb';
const COHORT_SVG_ICONS: Record<CohortIconKey, React.ReactNode> = {
  users:  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="7" r="4"/><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/><path d="M21 21v-2a4 4 0 0 0-3-3.85"/></svg>,
  code:   <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>,
  money:  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
  bank:   <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="22" x2="21" y2="22"/><line x1="6" y1="18" x2="6" y2="11"/><line x1="10" y1="18" x2="10" y2="11"/><line x1="14" y1="18" x2="14" y2="11"/><line x1="18" y1="18" x2="18" y2="11"/><polygon points="12 2 20 7 4 7"/></svg>,
  rocket: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/></svg>,
  globe:  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>,
  target: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>,
  chart:  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>,
  fire:   <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 3z"/></svg>,
  bulb:   <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="9" y1="18" x2="15" y2="18"/><line x1="10" y1="22" x2="14" y2="22"/><path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14"/></svg>,
};
const ICON_KEYS = Object.keys(COHORT_SVG_ICONS) as CohortIconKey[];
const ICON_LABELS: Record<CohortIconKey, string> = {
  users:'Team', code:'Tech', money:'Finance', bank:'Banking', rocket:'Startup',
  globe:'Global', target:'Goals', chart:'Growth', fire:'Trending', bulb:'Ideas',
};
function CohortIconDisplay({ iconKey }: { iconKey: string }) {
  const key = (iconKey || 'users') as CohortIconKey;
  return <span className="flex items-center justify-center">{COHORT_SVG_ICONS[key] ?? COHORT_SVG_ICONS.users}</span>;
}


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
  dark50: 'var(--admin-text-heading)',
  gold:        '#E8A020',
  gold600:     '#C87820',
  goldMuted:   'rgba(232,160,32,0.09)',
  goldBorder:  'rgba(232,160,32,0.25)',
  border:      'var(--admin-border)',
  explorer:    '#14B8A6',
  climber:     '#8B5CF6',
  success:     '#10B981',
  error:       '#EF4444',
  errorMuted:  'rgba(239,68,68,0.08)',
};

// Category → stage colour (thematic mapping for visual interest)
const CAT_COLOR: Record<string, string> = {
  Technology:      B.explorer,
  Finance:         B.gold,
  Leadership:      B.climber,
  Diversity:       B.success,
  Entrepreneurship:B.gold,
  Consulting:      B.climber,
  'Career Growth': B.explorer,
  Executive:       B.climber,
};

const CATEGORIES = ['Technology', 'Finance', 'Leadership', 'Diversity', 'Entrepreneurship', 'Consulting', 'Career Growth', 'Executive'];
// ICONS replaced by COHORT_SVG_ICONS above

// ── Shared primitives ────────────────────────────────────────────
function MonoLabel({ children, color = B.dark500 }: { children: React.ReactNode; color?: string }) {
  return (
    <span style={{
      fontFamily: B.fontMono, fontSize: '10px', fontWeight: 500,
      letterSpacing: '0.07em', textTransform: 'uppercase' as const, color,
    }}>
      {children}
    </span>
  );
}

function FieldLabel({ children }: { children: string }) {
  return (
    <label style={{
      display: 'block', fontFamily: B.fontMono, fontSize: '10px', fontWeight: 500,
      letterSpacing: '0.07em', textTransform: 'uppercase' as const,
      color: B.dark500, marginBottom: '6px',
    }}>
      {children}
    </label>
  );
}

function ActionBtn({
  children, onClick, color = B.gold, borderColor = B.goldBorder, hoverBg = B.goldMuted,
}: {
  children: React.ReactNode; onClick: () => void;
  color?: string; borderColor?: string; hoverBg?: string;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '7px 14px', borderRadius: '8px', border: `1px solid ${borderColor}`,
        cursor: 'pointer', background: 'transparent', color,
        fontFamily: B.fontUI, fontSize: '12px', fontWeight: 600,
        letterSpacing: '0.01em', transition: 'all 0.12s ease', whiteSpace: 'nowrap' as const,
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
    width: 100%; padding: 11px 14px; border-radius: 10px;
    border: 1px solid ${B.border}; background: ${B.dark700};
    color: ${B.dark50}; font-family: ${B.fontUI}; font-size: 13px;
    outline: none; transition: border-color 0.15s ease;
  }
  .asc-field::placeholder { color: ${B.dark500}; }
  .asc-field:focus { border-color: ${B.goldBorder}; }
  textarea.asc-field { resize: none; }
  select.asc-field {
    cursor: pointer; font-family: ${B.fontMono}; font-size: 10px;
    letter-spacing: 0.06em; text-transform: uppercase; appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg width='12' height='8' viewBox='0 0 12 8' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L6 7L11 1' stroke='%234A4438' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E");
    background-repeat: no-repeat; background-position: right 12px center;
    background-color: ${B.dark700}; padding-right: 32px;
  }
  select.asc-field option { background: ${B.dark700}; text-transform: uppercase; }

  .asc-btn-primary {
    padding: 11px 22px; border-radius: 10px; border: none; cursor: pointer;
    background: ${B.gold}; color: ${B.dark}; font-family: ${B.fontUI};
    font-size: 13px; font-weight: 700; letter-spacing: 0.02em;
    transition: background 0.15s ease, opacity 0.15s ease; white-space: nowrap;
  }
  .asc-btn-primary:hover:not(:disabled) { background: ${B.gold600}; }
  .asc-btn-primary:disabled { opacity: 0.45; cursor: not-allowed; }

  .asc-btn-ghost {
    padding: 10px 18px; border-radius: 10px; border: 1px solid ${B.border};
    cursor: pointer; background: transparent; color: ${B.dark400};
    font-family: ${B.fontUI}; font-size: 13px; font-weight: 500;
    transition: all 0.12s ease;
  }
  .asc-btn-ghost:hover { border-color: ${B.goldBorder}; color: ${B.dark200}; }

  .asc-cohort-card { transition: border-color 0.12s ease; }
  .asc-cohort-card:hover { border-color: var(--admin-border-strong) !important; }

  .asc-emoji-btn {
    width: 38px; height: 38px; border-radius: 8px; border: 1px solid ${B.border};
    background: ${B.dark700}; cursor: pointer; font-size: 18px;
    display: flex; align-items: center; justify-content: center;
    transition: all 0.12s ease;
  }
  .asc-emoji-btn:hover  { border-color: ${B.goldBorder}; }
  .asc-emoji-btn.sel    { background: ${B.goldMuted}; border: 1.5px solid ${B.gold}; }

  /* Stat cards */
  .asc-stat-card {
    border-radius: 12px; padding: 18px 16px; background: ${B.dark800};
    border: 1px solid ${B.border}; cursor: default;
  }

  @media (max-width: 600px) {
    .asc-form-grid-2 { grid-template-columns: 1fr !important; }
    .asc-card-row    { flex-direction: column; align-items: flex-start !important; }
    .asc-card-actions { flex-wrap: wrap; }
  }
`;

// ── Suspense entry ───────────────────────────────────────────────
export default function AdminCohortsPage() {
  return (
    <>
      <style>{CSS}</style>
      <Suspense fallback={
        <div style={{ padding: '80px 0', textAlign: 'center' }}>
          <MonoLabel color={B.dark600}>Loading cohorts…</MonoLabel>
        </div>
      }>
        <AdminCohortsInner />
      </Suspense>
    </>
  );
}

// ── Main component ───────────────────────────────────────────────
function AdminCohortsInner() {
  const supabase     = createClient();
  const searchParams = useSearchParams();

  const [cohorts,  setCohorts]  = useState<any[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [showForm, setShowForm] = useState(searchParams.get('action') === 'create');
  const [editing,  setEditing]  = useState<any>(null);
  const [saving,   setSaving]   = useState(false);
  const [loadError, setLoadError] = useState('');

  const emptyForm = { name: '', description: '', category: 'Technology', customCategory: '', icon: 'users', max_members: 1000, is_free: false, is_general: false, plan_tier: 'free' };
  const [form, setForm] = useState(emptyForm);

  useEffect(() => { loadCohorts(); }, []);

  async function loadCohorts() {
    setLoading(true);
    setLoadError('');
    // Use API route so service role bypasses RLS entirely
    try {
      const res = await fetch('/api/admin/cohorts');
      if (res.ok) {
        const json = await res.json();
        setCohorts(json.cohorts || []);
      } else {
        const json = await res.json().catch(() => ({}));
        // Fallback: try direct client query and log error
        const { data, error } = await supabase.from('cohorts').select('*').order('member_count', { ascending: false });
        if (error) setLoadError(error.message);
        setCohorts(data || []);
      }
    } catch(e: any) {
      // Fallback to direct query
      const { data, error } = await supabase.from('cohorts').select('*').order('member_count', { ascending: false });
      if (error) setLoadError(error.message);
      setCohorts(data || []);
    }
    setLoading(false);
  }

  function openEdit(cohort: any) {
    const isBuiltin = CATEGORIES.includes(cohort.category || '');
    setForm({
      name:           cohort.name,
      description:    cohort.description  || '',
      category:       isBuiltin ? (cohort.category || 'Technology') : 'custom',
      customCategory: isBuiltin ? '' : (cohort.category || ''),
      icon:           cohort.icon         || 'users',
      max_members:    cohort.max_members  || 1000,
      is_free:        cohort.is_free      || false,
      is_general:     cohort.is_general   || false,
      plan_tier:      cohort.plan_tier    || (cohort.is_free || cohort.is_general ? 'free' : 'explorer'),
    });
    setEditing(cohort);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function openCreate() {
    setForm(emptyForm);
    setEditing(null);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const [saveError, setSaveError] = useState('');

  async function handleSave() {
    if (!form.name.trim()) return;
    setSaving(true);
    setSaveError('');

    const resolvedCategory = form.category === 'custom'
      ? (form.customCategory.trim() || 'Other')
      : form.category;

    const payload = {
      name:        form.name.trim(),
      description: form.description.trim(),
      category:    resolvedCategory,
      icon:        form.icon,
      max_members: form.max_members,
      plan_tier:   form.plan_tier || 'free',
      is_free:     form.plan_tier === 'free',      // keep in sync for any legacy code
      is_general:  form.plan_tier === 'free',      // keep in sync for any legacy code
    };

    let errorMsg = '';
    try {
      if (editing) {
        const res = await fetch('/api/admin/cohorts', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editing.id, ...payload }),
        });
        if (!res.ok) { const d = await res.json(); errorMsg = d.error || 'Update failed'; }
      } else {
        const res = await fetch('/api/admin/cohorts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) { const d = await res.json(); errorMsg = d.error || 'Create failed'; }
      }
    } catch(e: any) { errorMsg = e.message; }

    if (errorMsg) {
      setSaveError(errorMsg);
      setSaving(false);
      return;
    }

    setSaving(false);
    setShowForm(false);
    setEditing(null);
    loadCohorts();
  }

  async function handleDelete(id: string, name: string) {
    // TODO: swap for useModal() when available in this subtree
    if (!window.confirm(`Delete "${name}"? This removes all posts and members inside it.`)) return;
    await fetch('/api/admin/cohorts', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    loadCohorts();
  }

  // Aggregate stats
  const totalMembers = cohorts.reduce((sum, c) => sum + (c.member_count || 0), 0);
  const largestCohort = cohorts[0]; // already sorted by member_count desc

  if (loading) {
    return (
      <div style={{ padding: '80px 0', textAlign: 'center' }}>
        <MonoLabel color={B.dark600}>Loading cohorts…</MonoLabel>
      </div>
    );
  }

  return (
    <div className="animate-fade-up" style={{ fontFamily: B.fontUI }}>

      {/* ── HEADER ── */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between',
          alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginBottom: '4px',
        }}>
          <div>
            <h1 style={{
              fontFamily: B.fontDisplay, fontWeight: 700,
              fontSize: 'clamp(24px, 3vw, 32px)', color: B.dark50,
              margin: '0 0 4px', lineHeight: 1.15,
            }}>
              Manage Cohorts
            </h1>
            <p style={{
              fontFamily: B.fontMono, fontSize: '11px', color: B.dark500,
              margin: 0, letterSpacing: '0.04em',
            }}>
              {cohorts.length} COHORTS · {totalMembers.toLocaleString()} TOTAL MEMBERS
            </p>
          </div>
          <button
            className="asc-btn-primary"
            onClick={openCreate}
            style={{ display: showForm && !editing ? 'none' : undefined }}
          >
            + Create Cohort
          </button>
        </div>

        {/* Gold rule */}
        <div style={{
          height: '1px',
          background: `linear-gradient(90deg, ${B.gold} 0%, transparent 60%)`,
          marginTop: '16px',
        }} />
      </div>

      {/* Load error — shows exact DB error so we can diagnose */}
      {loadError && (
        <div style={{ padding: '12px 16px', borderRadius: 8, marginBottom: 16,
          background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
          <span style={{ fontFamily: B.fontMono, fontSize: 11, color: B.error }}>
            DB error: {loadError}
          </span>
        </div>
      )}

      {/* ── STAT CARDS ── */}
      {cohorts.length > 0 && (
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: '12px', marginBottom: '28px',
        }}>
          {/* Total cohorts */}
          <div className="asc-stat-card" style={{ borderTop: `3px solid ${B.gold}` }}>
            <p style={{
              fontFamily: B.fontDisplay, fontWeight: 700, fontSize: '32px',
              color: B.dark50, lineHeight: 1, margin: 0,
            }}>
              {cohorts.length}
            </p>
            <MonoLabel color={B.dark400}>Cohorts</MonoLabel>
          </div>
          {/* Total members */}
          <div className="asc-stat-card" style={{ borderTop: `3px solid ${B.explorer}` }}>
            <p style={{
              fontFamily: B.fontDisplay, fontWeight: 700, fontSize: '32px',
              color: B.dark50, lineHeight: 1, margin: 0,
            }}>
              {totalMembers.toLocaleString()}
            </p>
            <MonoLabel color={B.dark400}>Total Members</MonoLabel>
          </div>
          {/* Largest cohort */}
          {largestCohort && (
            <div className="asc-stat-card" style={{ borderTop: `3px solid ${B.climber}` }}>
              <p style={{
                fontFamily: B.fontDisplay, fontWeight: 700, fontSize: '32px',
                color: B.dark50, lineHeight: 1, margin: 0,
              }}>
                {largestCohort.member_count || 0}
              </p>
              <MonoLabel color={B.dark400}>Largest · {largestCohort.name}</MonoLabel>
            </div>
          )}
        </div>
      )}

      {/* ── FORM PANEL ── */}
      {showForm && (
        <div style={{
          borderRadius: '14px', padding: '22px 24px', marginBottom: '28px',
          background: B.dark800, border: `1px solid ${B.goldBorder}`,
          borderLeft: `3px solid ${B.gold}`,
        }}>
          <div style={{ marginBottom: '20px' }}>
            <h3 style={{
              fontFamily: B.fontDisplay, fontWeight: 700, fontSize: '20px',
              color: B.dark50, margin: '0 0 2px',
            }}>
              {editing ? 'Edit Cohort' : 'New Cohort'}
            </h3>
            <MonoLabel color={B.dark500}>
              {editing ? `Editing · ${editing.name}` : 'Fill in the details below'}
            </MonoLabel>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

            {/* Name */}
            <div>
              <FieldLabel>Cohort Name *</FieldLabel>
              <input
                className="asc-field"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Product Leaders · Q2 2026"
              />
            </div>

            {/* Description */}
            <div>
              <FieldLabel>Description</FieldLabel>
              <textarea
                className="asc-field"
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                placeholder="Who is this cohort for? What connects them?"
                rows={2}
              />
            </div>

            {/* Category + Max members */}
            <div
              style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}
              className="asc-form-grid-2"
            >
              <div>
                <FieldLabel>Category</FieldLabel>
                <select
                  className="asc-field"
                  value={form.category}
                  onChange={e => setForm({ ...form, category: e.target.value })}
                >
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  <option value="custom">+ Custom category…</option>
                </select>
                {form.category === 'custom' && (
                  <input
                    className="asc-field"
                    style={{ marginTop: 8 }}
                    value={form.customCategory}
                    onChange={e => setForm({ ...form, customCategory: e.target.value })}
                    placeholder="Type your category name"
                  />
                )}
              </div>
              <div>
                <FieldLabel>Max Members</FieldLabel>
                <input
                  type="number"
                  className="asc-field"
                  value={form.max_members}
                  onChange={e => setForm({ ...form, max_members: Number(e.target.value) })}
                  min={1}
                />
              </div>
            </div>

            {/* Icon picker */}
            <div>
              <FieldLabel>Icon</FieldLabel>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {ICON_KEYS.map(key => (
                  <button
                    key={key}
                    type="button"
                    className={`asc-emoji-btn${form.icon === key ? ' sel' : ''}`}
                    onClick={() => setForm({ ...form, icon: key })}
                    title={ICON_LABELS[key]}
                    style={{ display:'flex', alignItems:'center', justifyContent:'center', padding:'6px' }}
                  >
                    {COHORT_SVG_ICONS[key]}
                  </button>
                ))}
              </div>
            </div>

            {/* Plan tier — single source of truth for access control */}
            <div>
              <div style={{ fontFamily: B.fontMono, fontSize: 11, fontWeight: 600, color: B.dark400, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
                Plan Access
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const }}>
                {([
                  { value: 'free',     label: 'Free',     desc: 'All users',          color: B.dark400,  bg: B.dark700,   border: B.border      },
                  { value: 'explorer', label: 'Explorer', desc: 'Explorer and above',  color: B.explorer, bg: 'rgba(20,184,166,0.09)',  border: 'rgba(20,184,166,0.25)' },
                  { value: 'builder',  label: 'Builder',  desc: 'Builder and above',   color: B.gold,     bg: B.goldMuted, border: B.goldBorder  },
                  { value: 'climber',  label: 'Climber',  desc: 'Climber only',        color: B.climber,  bg: 'rgba(139,92,246,0.09)', border: 'rgba(139,92,246,0.25)' },
                ] as const).map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setForm({ ...form, plan_tier: opt.value })}
                    style={{
                      padding: '8px 14px', borderRadius: 10, cursor: 'pointer',
                      background: form.plan_tier === opt.value ? opt.bg : B.dark800,
                      border: `1px solid ${form.plan_tier === opt.value ? opt.border : B.border}`,
                      transition: 'all 0.15s',
                    }}
                  >
                    <div style={{ fontFamily: B.fontUI, fontSize: 13, fontWeight: 600, color: form.plan_tier === opt.value ? opt.color : B.dark400, marginBottom: 2 }}>
                      {opt.label}
                    </div>
                    <div style={{ fontFamily: B.fontMono, fontSize: 10, color: form.plan_tier === opt.value ? opt.color : B.dark500, opacity: 0.8 }}>
                      {opt.desc}
                    </div>
                  </button>
                ))}
              </div>
            </div>


            {/* Save error */}
            {saveError && (
              <div style={{ padding: '10px 14px', borderRadius: 8, background: B.errorMuted, border: `1px solid ${B.error}30` }}>
                <span style={{ fontFamily: B.fontMono, fontSize: 11, color: B.error }}>{saveError}</span>
              </div>
            )}

            {/* Actions */}
            <div style={{
              display: 'flex', gap: '10px', marginTop: '4px',
              paddingTop: '16px', borderTop: `1px solid ${B.border}`,
            }}>
              <button
                className="asc-btn-primary"
                onClick={handleSave}
                disabled={saving || !form.name.trim()}
              >
                {saving ? 'Saving…' : editing ? 'Update Cohort' : 'Create Cohort'}
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

      {/* ── COHORT LIST ── */}
      {cohorts.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '70px 0' }}>
          <p style={{
            fontFamily: B.fontDisplay, fontSize: '28px',
            color: B.dark500, margin: '0 0 8px',
          }}>
            No cohorts yet
          </p>
          <MonoLabel color={B.dark600}>Create your first cohort above.</MonoLabel>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {cohorts.map(c => {
            const catColor     = CAT_COLOR[c.category] ?? B.dark400;
            const fillPct      = Math.min(100, Math.round(((c.member_count || 0) / (c.max_members || 1000)) * 100));
            const fillColor    = fillPct >= 90 ? B.error : fillPct >= 60 ? B.gold : B.explorer;

            return (
              <div
                key={c.id}
                className="asc-cohort-card"
                style={{
                  borderRadius: '12px',
                  padding:      '16px 18px',
                  background:   B.dark800,
                  border:       `1px solid ${B.border}`,
                  borderLeft:   `3px solid ${catColor}`,
                }}
              >
                <div
                  className="asc-card-row"
                  style={{ display: 'flex', alignItems: 'center', gap: '14px' }}
                >
                  {/* Icon badge */}
                  <div style={{
                    width:          '48px',
                    height:         '48px',
                    borderRadius:   '10px',
                    background:     `${catColor}12`,
                    border:         `1px solid ${catColor}30`,
                    display:        'flex',
                    alignItems:     'center',
                    justifyContent: 'center',
                    fontSize:       '22px',
                    flexShrink:     0,
                  }}>
                    <CohortIconDisplay iconKey={c.icon || 'users'} />
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                      <h4 style={{
                        fontFamily: B.fontUI, fontWeight: 600, fontSize: '14px',
                        color: B.dark50, margin: 0,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const,
                      }}>
                        {c.name}
                      </h4>
                      {/* Category pill */}
                      <span style={{
                        fontFamily: B.fontMono, fontSize: '9px', fontWeight: 500,
                        letterSpacing: '0.06em', textTransform: 'uppercase' as const,
                        padding: '2px 7px', borderRadius: '999px',
                        background: `${catColor}12`, color: catColor,
                        border: `1px solid ${catColor}30`, flexShrink: 0,
                      }}>
                        {c.category}
                      </span>
                      {c.is_free && (
                        <span style={{
                          fontFamily: B.fontMono, fontSize: '9px', fontWeight: 500,
                          letterSpacing: '0.06em', textTransform: 'uppercase' as const,
                          padding: '2px 7px', borderRadius: '999px',
                          background: `${B.success}12`, color: B.success,
                          border: `1px solid ${B.success}30`, flexShrink: 0,
                        }}>Free</span>
                      )}
                      {c.is_general && (
                        <span style={{
                          fontFamily: B.fontMono, fontSize: '9px', fontWeight: 500,
                          letterSpacing: '0.06em', textTransform: 'uppercase' as const,
                          padding: '2px 7px', borderRadius: '999px',
                          background: `${B.explorer}12`, color: B.explorer,
                          border: `1px solid ${B.explorer}30`, flexShrink: 0,
                        }}>General</span>
                      )}
                    </div>

                    {/* Member count + capacity bar */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                      <MonoLabel color={B.dark400}>
                        {(c.member_count || 0).toLocaleString()} / {(c.max_members || 1000).toLocaleString()} members
                      </MonoLabel>
                      {/* Capacity bar */}
                      <div style={{
                        flex: 1, minWidth: '80px', maxWidth: '140px',
                        height: '4px', borderRadius: '2px', background: B.dark600,
                        overflow: 'hidden',
                      }}>
                        <div style={{
                          height: '100%', width: `${fillPct}%`,
                          background: fillColor,
                          borderRadius: '2px',
                          transition: 'width 0.3s ease',
                        }} />
                      </div>
                      <MonoLabel color={fillColor}>{fillPct}%</MonoLabel>
                    </div>
                  </div>

                  {/* Actions */}
                  <div
                    className="asc-card-actions"
                    style={{ display: 'flex', gap: '8px', flexShrink: 0 }}
                  >
                    <ActionBtn
                      onClick={() => openEdit(c)}
                      color={B.gold}
                      borderColor={B.goldBorder}
                      hoverBg={B.goldMuted}
                    >
                      Edit
                    </ActionBtn>
                    <ActionBtn
                      onClick={() => handleDelete(c.id, c.name)}
                      color={B.error}
                      borderColor={`${B.error}30`}
                      hoverBg={B.errorMuted}
                    >
                      Delete
                    </ActionBtn>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
