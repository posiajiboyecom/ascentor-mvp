'use client';
export const dynamic = 'force-dynamic';

import { useState, useEffect, Suspense } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useSearchParams } from 'next/navigation';

// ============================================================
// ASCENTOR BRAND TOKENS · Brand Book v1.0 · 2026
// Display : Cormorant Garamond 700 / Italic 600
// UI      : Syne 400–800
// Mono    : DM Mono 400/500
// Gold    : #E8A020   Dark: #0C0B08
// ============================================================
const B = {
  fontDisplay: "'Cormorant Garamond', Georgia, serif",
  fontUI:      "'Syne', system-ui, sans-serif",
  fontMono:    "'DM Mono', 'Courier New', monospace",
  dark:        '#0C0B08',
  dark800:     '#141310',
  dark700:     '#1E1C17',
  dark600:     '#2E2A22',
  dark500:     '#4A4438',
  dark400:     '#7A7260',
  dark200:     '#D4CFC3',
  dark50:      '#F7F6F3',
  gold:        '#E8A020',
  gold600:     '#C87820',
  goldMuted:   'rgba(232,160,32,0.09)',
  goldBorder:  'rgba(232,160,32,0.25)',
  border:      'rgba(212,207,195,0.10)',
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
const ICONS      = ['👥', '💻', '💰', '🏛️', '🚀', '🌍', '🎯', '📈', '🔥', '💡'];

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
  .asc-cohort-card:hover { border-color: rgba(212,207,195,0.20) !important; }

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

  const emptyForm = { name: '', description: '', category: 'Technology', icon: '👥', max_members: 1000 };
  const [form, setForm] = useState(emptyForm);

  useEffect(() => { loadCohorts(); }, []);

  async function loadCohorts() {
    setLoading(true);
    const { data } = await supabase.from('cohorts').select('*').order('member_count', { ascending: false });
    setCohorts(data || []);
    setLoading(false);
  }

  function openEdit(cohort: any) {
    setForm({
      name:        cohort.name,
      description: cohort.description  || '',
      category:    cohort.category     || 'Technology',
      icon:        cohort.icon         || '👥',
      max_members: cohort.max_members  || 1000,
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

  async function handleSave() {
    if (!form.name.trim()) return;
    setSaving(true);

    if (editing) {
      await supabase.from('cohorts').update(form).eq('id', editing.id);
    } else {
      await supabase.from('cohorts').insert({ ...form, member_count: 0 });
    }

    setSaving(false);
    setShowForm(false);
    setEditing(null);
    loadCohorts();
  }

  async function handleDelete(id: string, name: string) {
    // TODO: swap for useModal() when available in this subtree
    if (!window.confirm(`Delete "${name}"? This removes all posts and members inside it.`)) return;
    await supabase.from('cohorts').delete().eq('id', id);
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
                placeholder="e.g. Lagos Fintech Builders · Q1 2026"
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
                </select>
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
                {ICONS.map(icon => (
                  <button
                    key={icon}
                    type="button"
                    className={`asc-emoji-btn${form.icon === icon ? ' sel' : ''}`}
                    onClick={() => setForm({ ...form, icon })}
                    title={icon}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </div>

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
                    {c.icon || '👥'}
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
