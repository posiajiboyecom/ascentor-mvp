'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useModal } from '@/components/Modal';

// ─────────────────────────────────────────────
// ASCENTOR BRAND TOKENS (Brand Book v1.0 · 2026)
// Display : Cormorant Garamond 700 / Italic 600
// UI      : Syne 400–800
// Mono    : DM Mono 400/500
// Gold    : #E8A020  Dark: var(--admin-bg)
// ─────────────────────────────────────────────

type Application = {
  id: string;
  full_name: string;
  email: string;
  phone?: string;
  country: string;
  role_title: string;
  company: string;
  years_experience: string;
  industry: string;
  linkedin_url?: string;
  career_summary: string;
  why_mentor: string;
  mentor_style: string;
  success_story?: string;
  age_groups: string;
  availability_hours: string;
  has_mentored_before: string;
  status: 'pending' | 'approved' | 'rejected' | 'active';
  applied_at: string;
  notes?: string;
};

// Brand-aligned status palette
const STATUS_CONFIG: Record<string, { bg: string; border: string; color: string; label: string }> = {
  pending:  { bg: 'rgba(232,160,32,0.08)',  border: 'rgba(232,160,32,0.25)', color: '#E8A020', label: 'Pending'  },
  approved: { bg: 'rgba(20,184,166,0.08)',  border: 'rgba(20,184,166,0.25)', color: '#14B8A6', label: 'Approved' },
  active:   { bg: 'rgba(139,92,246,0.08)',  border: 'rgba(139,92,246,0.25)', color: '#8B5CF6', label: 'Active'   },
  rejected: { bg: 'rgba(239,68,68,0.07)',   border: 'rgba(239,68,68,0.18)',  color: '#EF4444', label: 'Rejected' },
};

// Stage colors from brand book
const STAGE_COLORS = {
  explorer: '#14B8A6',
  builder:  '#E8A020',
  climber:  '#8B5CF6',
};

// ─── Inline brand styles (works in any Next.js app without extra CSS imports) ───
const brand = {
  fontDisplay: "'Cormorant Garamond', 'Georgia', serif",
  fontUI:      "'Syne', 'system-ui', sans-serif",
  fontMono:    "'DM Mono', 'Courier New', monospace",
  gold:        '#E8A020',
  goldMuted:   'rgba(232,160,32,0.12)',
  goldBorder:  'rgba(232,160,32,0.22)',
  dark:        'var(--admin-bg)',
  dark700:     'var(--admin-bg-card)',
  dark600:     'var(--admin-bg-input)',
  dark500:     'var(--admin-text-faint)',
  dark400:     'var(--admin-text-muted)',
  dark200:     'var(--admin-text)',
  dark50: 'var(--admin-text-heading)',
  card:        'var(--admin-bg-deep)',
  cardHover:   'var(--admin-bg-card)',
  border:      'var(--admin-border)',
  borderGold:  'rgba(232,160,32,0.22)',
};

export default function AdminMentorsPage() {
  const supabase = createClient();
  const { confirm, prompt, alert } = useModal();

  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'pending' | 'approved' | 'active' | 'rejected' | 'all'>('pending');
  const [selected, setSelected] = useState<Application | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    const { data } = await supabase
      .from('mentor_applications')
      .select('*')
      .order('applied_at', { ascending: false });
    setApplications(data || []);
    setLoading(false);
  }

  async function updateStatus(id: string, status: Application['status']) {
    await supabase.from('mentor_applications').update({ status }).eq('id', id);
    setApplications(prev => prev.map(a => a.id === id ? { ...a, status } : a));
    if (selected?.id === id) setSelected(prev => prev ? { ...prev, status } : null);
  }

  async function saveNotes(id: string, notes: string) {
    await supabase.from('mentor_applications').update({ notes }).eq('id', id);
    setApplications(prev => prev.map(a => a.id === id ? { ...a, notes } : a));
    if (selected?.id === id) setSelected(prev => prev ? { ...prev, notes } : null);
  }

  async function handleDelete(app: Application) {
    const ok = await confirm(`Permanently delete application from ${app.full_name}?`, 'Delete Application');
    if (!ok) return;
    await supabase.from('mentor_applications').delete().eq('id', app.id);
    setApplications(prev => prev.filter(a => a.id !== app.id));
    if (selected?.id === app.id) setSelected(null);
  }

  async function handleAddNote(app: Application) {
    const note = await prompt('Add or update internal notes for this applicant:', {
      title: 'Internal Notes',
      placeholder: 'e.g. Spoke with by phone on March 5 — very impressive...',
    });
    if (note !== null) await saveNotes(app.id, note);
  }

  const filtered = applications.filter(a => {
    const matchTab = tab === 'all' || a.status === tab;
    const q = search.toLowerCase();
    const matchSearch = !q ||
      a.full_name.toLowerCase().includes(q) ||
      a.email.toLowerCase().includes(q) ||
      a.industry.toLowerCase().includes(q) ||
      a.country.toLowerCase().includes(q);
    return matchTab && matchSearch;
  });

  const counts = {
    pending:  applications.filter(a => a.status === 'pending').length,
    approved: applications.filter(a => a.status === 'approved').length,
    active:   applications.filter(a => a.status === 'active').length,
    rejected: applications.filter(a => a.status === 'rejected').length,
    all:      applications.length,
  };

  const fmt = (d: string) =>
    new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  // ─── Mono label helper (brand book: DM Mono · metadata tags) ───
  const MonoTag = ({ children, color = brand.dark400 }: { children: React.ReactNode; color?: string }) => (
    <span style={{
      fontFamily: brand.fontMono,
      fontSize: '10px',
      fontWeight: 500,
      letterSpacing: '0.06em',
      color,
      textTransform: 'uppercase' as const,
    }}>
      {children}
    </span>
  );

  const StatusPill = ({ status }: { status: string }) => {
    const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
    return (
      <span style={{
        fontFamily: brand.fontMono,
        fontSize: '10px',
        fontWeight: 500,
        letterSpacing: '0.05em',
        textTransform: 'uppercase' as const,
        padding: '3px 10px',
        borderRadius: '999px',
        background: cfg.bg,
        color: cfg.color,
        border: `1px solid ${cfg.border}`,
      }}>
        {cfg.label}
      </span>
    );
  };

  return (
    <>
      {/* Font imports — brand book spec */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,600;0,700;1,600&family=Syne:wght@400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap');
      `}</style>

      <div className="animate-fade-up" style={{ fontFamily: brand.fontUI }}>

        {/* ── HEADER ── */}
        <div style={{ marginBottom: '6px' }}>
          <div className="ascentor-header-row" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '4px' }}>
            <div>
              {/* Cormorant Garamond display headline — brand spec */}
              <h1 style={{
                fontFamily: brand.fontDisplay,
                fontWeight: 700,
                fontSize: 'clamp(24px, 3vw, 32px)',
                color: brand.dark50,
                lineHeight: 1.15,
                margin: 0,
              }}>
                Founding Mentors
              </h1>
              {/* DM Mono metadata line — brand spec */}
              <p style={{
                fontFamily: brand.fontMono,
                fontSize: '11px',
                fontWeight: 400,
                color: brand.dark400,
                marginTop: '6px',
                letterSpacing: '0.04em',
              }}>
                {counts.active} ACTIVE · {counts.pending} PENDING · {applications.length} TOTAL
              </p>
            </div>

            {/* Gold accent pill */}
            <span style={{
              fontFamily: brand.fontMono,
              fontSize: '10px',
              fontWeight: 500,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              padding: '6px 14px',
              borderRadius: '999px',
              background: brand.goldMuted,
              color: brand.gold,
              border: `1px solid ${brand.goldBorder}`,
              whiteSpace: 'nowrap' as const,
            }}>
              Mentor Review Dashboard
            </span>
          </div>

          {/* Gold rule — brand visual motif */}
          <div style={{ height: '1px', background: `linear-gradient(90deg, ${brand.gold} 0%, transparent 60%)`, marginTop: '16px', marginBottom: '24px' }} />
        </div>

        {/* ── STATS ROW — Stage colors from brand book ── */}
        <div className="ascentor-stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '28px' }}>
          {(['pending', 'approved', 'active', 'rejected'] as const).map(s => {
            const cfg = STATUS_CONFIG[s];
            return (
              <div
                key={s}
                onClick={() => setTab(s)}
                style={{
                  borderRadius: '12px',
                  padding: '14px 12px',
                  cursor: 'pointer',
                  background: brand.card,
                  border: `1px solid ${tab === s ? cfg.border : brand.border}`,
                  borderTop: `3px solid ${cfg.color}`,
                  transition: 'all 0.15s ease',
                  transform: tab === s ? 'translateY(-1px)' : undefined,
                }}
              >
                <p style={{
                  fontFamily: brand.fontDisplay,
                  fontWeight: 700,
                  fontSize: 'clamp(22px, 4vw, 32px)',
                  color: tab === s ? cfg.color : brand.dark50,
                  lineHeight: 1,
                  margin: 0,
                }}>
                  {counts[s]}
                </p>
                <MonoTag color={tab === s ? cfg.color : brand.dark400}>
                  {cfg.label}
                </MonoTag>
              </div>
            );
          })}
        </div>

        <div className="ascentor-layout" style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>

          {/* ── LEFT PANEL ── */}
          <div style={{ flex: 1, minWidth: 0 }}>

            {/* Search + Tabs */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
              <input
                placeholder="Search by name, email, industry, country…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{
                  fontFamily: brand.fontUI,
                  fontSize: '13px',
                  fontWeight: 400,
                  padding: '11px 16px',
                  borderRadius: '10px',
                  border: `1px solid ${brand.border}`,
                  background: brand.dark700,
                  color: brand.dark50,
                  outline: 'none',
                  width: '100%',
                  boxSizing: 'border-box' as const,
                }}
                onFocus={e => (e.target.style.borderColor = brand.goldBorder)}
                onBlur={e => (e.target.style.borderColor = brand.border)}
              />

              {/* Tab bar — Syne font, brand active state */}
              <div style={{
                display: 'flex',
                gap: '2px',
                padding: '4px',
                borderRadius: '10px',
                background: brand.dark700,
                overflowX: 'auto' as const,
                WebkitOverflowScrolling: 'touch' as any,
                scrollbarWidth: 'none' as any,
              }}>
                {(['pending', 'approved', 'active', 'rejected', 'all'] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    style={{
                      flex: '0 0 auto',
                      minWidth: 0,
                      padding: '8px 10px',
                      borderRadius: '7px',
                      border: 'none',
                      cursor: 'pointer',
                      fontFamily: brand.fontUI,
                      fontSize: '11px',
                      fontWeight: 600,
                      letterSpacing: '0.01em',
                      whiteSpace: 'nowrap' as const,
                      background: tab === t ? brand.card : 'transparent',
                      color: tab === t ? brand.gold : brand.dark400,
                      transition: 'all 0.12s ease',
                    }}
                  >
                    {t === 'all'
                      ? `All (${counts.all})`
                      : `${STATUS_CONFIG[t].label} (${counts[t]})`}
                  </button>
                ))}
              </div>
            </div>

            {/* ── TABLE ── */}
            {loading ? (
              <div style={{ textAlign: 'center', padding: '60px 0' }}>
                <MonoTag>Loading applications…</MonoTag>
              </div>
            ) : filtered.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 0' }}>
                <p style={{ fontFamily: brand.fontDisplay, fontSize: '28px', color: brand.dark500, marginBottom: '8px' }}>
                  No applications
                </p>
                <MonoTag color={brand.dark500}>
                  {search ? 'No results match your search.' : `No ${tab === 'all' ? '' : tab} applications yet.`}
                </MonoTag>
              </div>
            ) : (
              <>
                {/* Desktop table */}
                <div style={{
                  display: 'none',  // overridden below via className
                  borderRadius: '12px',
                  overflow: 'hidden',
                  background: brand.card,
                  border: `1px solid ${brand.border}`,
                }} className="ascentor-table-desktop">
                  {/* Table header */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '2fr 1.5fr 1fr 1fr 1fr 1.2fr',
                    gap: '8px',
                    padding: '12px 20px',
                    borderBottom: `1px solid ${brand.border}`,
                  }}>
                    {['Applicant', 'Role & Company', 'Industry', 'Country', 'Applied', 'Status'].map((h, i) => (
                      <div key={h} style={{
                        fontFamily: brand.fontMono,
                        fontSize: '10px',
                        fontWeight: 500,
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase' as const,
                        color: brand.dark500,
                        textAlign: i === 5 ? 'center' : 'left' as const,
                      }}>
                        {h}
                      </div>
                    ))}
                  </div>

                  {/* Rows */}
                  {filtered.map((app, idx) => (
                    <div
                      key={app.id}
                      onClick={() => setSelected(selected?.id === app.id ? null : app)}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '2fr 1.5fr 1fr 1fr 1fr 1.2fr',
                        gap: '8px',
                        padding: '14px 20px',
                        alignItems: 'center',
                        cursor: 'pointer',
                        borderBottom: idx < filtered.length - 1 ? `1px solid ${brand.border}` : 'none',
                        background: selected?.id === app.id ? brand.goldMuted : 'transparent',
                        borderLeft: selected?.id === app.id ? `2px solid ${brand.gold}` : '2px solid transparent',
                        transition: 'all 0.12s ease',
                      }}
                      onMouseEnter={e => {
                        if (selected?.id !== app.id) {
                          (e.currentTarget as HTMLElement).style.background = brand.dark600;
                        }
                      }}
                      onMouseLeave={e => {
                        if (selected?.id !== app.id) {
                          (e.currentTarget as HTMLElement).style.background = 'transparent';
                        }
                      }}
                    >
                      {/* Applicant */}
                      <div>
                        <p style={{ fontFamily: brand.fontUI, fontWeight: 600, fontSize: '13px', color: brand.dark50, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {app.full_name}
                        </p>
                        <MonoTag color={brand.dark400}>{app.email}</MonoTag>
                      </div>

                      {/* Role */}
                      <div>
                        <p style={{ fontFamily: brand.fontUI, fontWeight: 500, fontSize: '12px', color: brand.dark200, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {app.role_title}
                        </p>
                        <MonoTag color={brand.dark500}>{app.company}</MonoTag>
                      </div>

                      {/* Industry */}
                      <div>
                        <span style={{
                          fontFamily: brand.fontMono,
                          fontSize: '10px',
                          fontWeight: 500,
                          letterSpacing: '0.05em',
                          textTransform: 'uppercase' as const,
                          padding: '2px 8px',
                          borderRadius: '999px',
                          background: 'rgba(139,92,246,0.09)',
                          color: STAGE_COLORS.climber,
                          border: '1px solid rgba(139,92,246,0.2)',
                        }}>
                          {app.industry.split(' ')[0]}
                        </span>
                      </div>

                      {/* Country */}
                      <MonoTag color={brand.dark400}>{app.country}</MonoTag>

                      {/* Applied */}
                      <MonoTag color={brand.dark500}>{fmt(app.applied_at)}</MonoTag>

                      {/* Status */}
                      <div style={{ display: 'flex', justifyContent: 'center' }}>
                        <StatusPill status={app.status} />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Mobile cards */}
                <div className="ascentor-table-mobile" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {filtered.map(app => (
                    <div
                      key={app.id}
                      onClick={() => setSelected(selected?.id === app.id ? null : app)}
                      style={{
                        borderRadius: '12px',
                        padding: '16px',
                        cursor: 'pointer',
                        background: brand.card,
                        border: `1px solid ${selected?.id === app.id ? brand.goldBorder : brand.border}`,
                        borderLeft: `3px solid ${STATUS_CONFIG[app.status]?.color || brand.gold}`,
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                        <div>
                          <p style={{ fontFamily: brand.fontUI, fontWeight: 600, fontSize: '14px', color: brand.dark50, margin: 0 }}>
                            {app.full_name}
                          </p>
                          <p style={{ fontFamily: brand.fontUI, fontWeight: 400, fontSize: '12px', color: brand.dark400, margin: '2px 0 0' }}>
                            {app.role_title} · {app.company}
                          </p>
                        </div>
                        <StatusPill status={app.status} />
                      </div>
                      <MonoTag color={brand.dark500}>
                        {app.industry} · {app.country} · {fmt(app.applied_at)}
                      </MonoTag>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* ── RIGHT PANEL — DETAIL (desktop only) ── */}
          {selected && (
            <div className="ascentor-detail-panel" style={{
              width: '420px',
              flexShrink: 0,
              borderRadius: '14px',
              overflow: 'hidden',
              background: brand.card,
              border: `1px solid ${brand.border}`,
              position: 'sticky',
              top: '80px',
              height: 'fit-content',
            }}>

              {/* Panel header — Cormorant display name */}
              <div style={{
                padding: '20px 22px',
                borderBottom: `1px solid ${brand.border}`,
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                background: brand.dark700,
              }}>
                <div>
                  <p style={{
                    fontFamily: brand.fontDisplay,
                    fontWeight: 700,
                    fontSize: '20px',
                    color: brand.dark50,
                    margin: 0,
                    lineHeight: 1.2,
                  }}>
                    {selected.full_name}
                  </p>
                  <MonoTag color={brand.dark400}>{selected.email}</MonoTag>
                </div>
                <button
                  onClick={() => setSelected(null)}
                  style={{
                    background: 'transparent',
                    border: `1px solid ${brand.border}`,
                    borderRadius: '6px',
                    color: brand.dark400,
                    fontFamily: brand.fontUI,
                    fontSize: '14px',
                    cursor: 'pointer',
                    padding: '2px 8px',
                    lineHeight: '20px',
                  }}
                >
                  ✕
                </button>
              </div>

              {/* Scrollable body */}
              <div style={{ overflowY: 'auto', maxHeight: 'calc(100vh - 280px)' }}>

                {/* Status + Quick actions */}
                <div style={{ padding: '18px 22px', borderBottom: `1px solid ${brand.border}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
                    <StatusPill status={selected.status} />
                    <MonoTag color={brand.dark500}>Applied {fmt(selected.applied_at)}</MonoTag>
                  </div>

                  <div className="ascentor-action-row" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {selected.status !== 'approved' && (
                      <ActionButton
                        label="✓ Approve"
                        bg="rgba(20,184,166,0.08)"
                        color="#14B8A6"
                        border="rgba(20,184,166,0.25)"
                        onClick={() => updateStatus(selected.id, 'approved')}
                      />
                    )}
                    {selected.status !== 'active' && (
                      <ActionButton
                        label="▶ Activate"
                        bg="rgba(139,92,246,0.08)"
                        color="#8B5CF6"
                        border="rgba(139,92,246,0.25)"
                        onClick={() => updateStatus(selected.id, 'active')}
                      />
                    )}
                    {selected.status !== 'rejected' && (
                      <ActionButton
                        label="✕ Reject"
                        bg="rgba(239,68,68,0.06)"
                        color="#EF4444"
                        border="rgba(239,68,68,0.18)"
                        onClick={() => updateStatus(selected.id, 'rejected')}
                      />
                    )}
                    {selected.status !== 'pending' && (
                      <ActionButton
                        label="↩ Reset"
                        bg="transparent"
                        color={brand.dark400}
                        border={brand.border}
                        onClick={() => updateStatus(selected.id, 'pending')}
                      />
                    )}
                    <ActionButton
                      label="<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> Note"
                      bg="transparent"
                      color={brand.dark400}
                      border={brand.border}
                      onClick={() => handleAddNote(selected)}
                    />
                    <ActionButton
                      label="🗑 Delete"
                      bg="rgba(239,68,68,0.04)"
                      color="#EF4444"
                      border="rgba(239,68,68,0.15)"
                      onClick={() => handleDelete(selected)}
                    />
                  </div>
                </div>

                {/* Profile info — DM Mono labels + Syne values */}
                <div style={{ padding: '18px 22px', borderBottom: `1px solid ${brand.border}` }}>
                  <MonoTag color={brand.dark500}>Profile</MonoTag>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '12px' }}>
                    {[
                      ['Role', `${selected.role_title} · ${selected.company}`],
                      ['Industry', selected.industry],
                      ['Experience', selected.years_experience],
                      ['Country', selected.country],
                      ['Phone', selected.phone || '—'],
                      ['Availability', `${selected.availability_hours} hrs/month`],
                      ['Mentored Before', selected.has_mentored_before],
                      ['Age Groups', selected.age_groups],
                    ].map(([k, v]) => (
                      <div key={k} style={{ display: 'flex', gap: '12px' }}>
                        <span style={{
                          fontFamily: brand.fontMono,
                          fontSize: '10px',
                          fontWeight: 500,
                          letterSpacing: '0.05em',
                          textTransform: 'uppercase' as const,
                          color: brand.dark500,
                          width: '100px',
                          flexShrink: 0,
                          paddingTop: '2px',
                        }}>
                          {k}
                        </span>
                        <span style={{
                          fontFamily: brand.fontUI,
                          fontSize: '12px',
                          fontWeight: 500,
                          color: brand.dark200,
                          lineHeight: 1.5,
                        }}>
                          {v}
                        </span>
                      </div>
                    ))}
                    {selected.linkedin_url && (
                      <div style={{ display: 'flex', gap: '12px' }}>
                        <span style={{
                          fontFamily: brand.fontMono,
                          fontSize: '10px',
                          fontWeight: 500,
                          letterSpacing: '0.05em',
                          textTransform: 'uppercase' as const,
                          color: brand.dark500,
                          width: '100px',
                          flexShrink: 0,
                          paddingTop: '2px',
                        }}>
                          LinkedIn
                        </span>
                        <a
                          href={selected.linkedin_url}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            fontFamily: brand.fontUI,
                            fontSize: '12px',
                            fontWeight: 600,
                            color: brand.gold,
                            textDecoration: 'none',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap' as const,
                          }}
                        >
                          View profile →
                        </a>
                      </div>
                    )}
                  </div>
                </div>

                {/* Written responses — Cormorant section labels */}
                {[
                  { label: 'Career Summary', value: selected.career_summary },
                  { label: 'Why They Want to Mentor', value: selected.why_mentor },
                  { label: 'Mentoring Style', value: selected.mentor_style },
                  ...(selected.success_story ? [{ label: 'Success Story', value: selected.success_story }] : []),
                ].map(({ label, value }) => (
                  <div key={label} style={{ padding: '18px 22px', borderBottom: `1px solid ${brand.border}` }}>
                    <MonoTag color={brand.dark500}>{label}</MonoTag>
                    <p style={{
                      fontFamily: brand.fontUI,
                      fontSize: '13px',
                      fontWeight: 400,
                      color: brand.dark200,
                      lineHeight: 1.7,
                      margin: '10px 0 0',
                    }}>
                      {value}
                    </p>
                  </div>
                ))}

                {/* Internal notes — gold accent treatment */}
                {selected.notes && (
                  <div style={{
                    padding: '18px 22px',
                    background: brand.goldMuted,
                    borderLeft: `3px solid ${brand.gold}`,
                  }}>
                    <MonoTag color={brand.gold}>Internal Notes</MonoTag>
                    <p style={{
                      fontFamily: brand.fontUI,
                      fontSize: '13px',
                      fontWeight: 400,
                      color: brand.dark50,
                      lineHeight: 1.7,
                      margin: '10px 0 0',
                    }}>
                      {selected.notes}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── MOBILE BOTTOM SHEET ── */}
        {selected && (
          <div className="ascentor-bottom-sheet" style={{ display: 'none' }}>
            {/* Backdrop */}
            <div
              onClick={() => setSelected(null)}
              style={{
                position: 'fixed', inset: 0,
                background: 'rgba(0,0,0,0.65)',
                backdropFilter: 'blur(3px)',
                zIndex: 9998,
              }}
            />
            {/* Sheet */}
            <div
              className="ascentor-sheet-inner"
              style={{
                position: 'fixed',
                bottom: 0, left: 0, right: 0,
                background: brand.card,
                borderTop: `1px solid ${brand.border}`,
                borderRadius: '18px 18px 0 0',
                zIndex: 9999,
                maxHeight: '90vh',
                height: '90vh',
                display: 'flex',
                flexDirection: 'column',
                paddingBottom: 'env(safe-area-inset-bottom)',
              }}
            >
              {/* Drag handle */}
              <div style={{ padding: '12px 0 4px', display: 'flex', justifyContent: 'center' }}>
                <div style={{ width: '36px', height: '4px', borderRadius: '2px', background: brand.dark600 }} />
              </div>

              {/* Sheet header */}
              <div style={{
                padding: '8px 20px 14px',
                borderBottom: `1px solid ${brand.border}`,
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                background: brand.dark700,
              }}>
                <div>
                  <p style={{
                    fontFamily: brand.fontDisplay,
                    fontWeight: 700,
                    fontSize: '20px',
                    color: brand.dark50,
                    margin: 0,
                    lineHeight: 1.2,
                  }}>
                    {selected.full_name}
                  </p>
                  <MonoTag color={brand.dark400}>{selected.email}</MonoTag>
                </div>
                <button
                  onClick={() => setSelected(null)}
                  style={{
                    background: 'transparent',
                    border: `1px solid ${brand.border}`,
                    borderRadius: '6px',
                    color: brand.dark400,
                    fontFamily: brand.fontUI,
                    fontSize: '16px',
                    cursor: 'pointer',
                    padding: '4px 10px',
                    lineHeight: '20px',
                    marginTop: '2px',
                  }}
                >
                  ✕
                </button>
              </div>

              {/* Sheet scrollable content */}
              <div style={{ overflowY: 'auto', flex: 1 }}>
                {/* Status + actions */}
                <div style={{ padding: '16px 20px', borderBottom: `1px solid ${brand.border}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
                    <StatusPill status={selected.status} />
                    <MonoTag color={brand.dark500}>Applied {fmt(selected.applied_at)}</MonoTag>
                  </div>
                  <div className="ascentor-action-row" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {selected.status !== 'approved' && (
                      <ActionButton label="✓ Approve" bg="rgba(20,184,166,0.08)" color="#14B8A6" border="rgba(20,184,166,0.25)" onClick={() => updateStatus(selected.id, 'approved')} />
                    )}
                    {selected.status !== 'active' && (
                      <ActionButton label="▶ Activate" bg="rgba(139,92,246,0.08)" color="#8B5CF6" border="rgba(139,92,246,0.25)" onClick={() => updateStatus(selected.id, 'active')} />
                    )}
                    {selected.status !== 'rejected' && (
                      <ActionButton label="✕ Reject" bg="rgba(239,68,68,0.06)" color="#EF4444" border="rgba(239,68,68,0.18)" onClick={() => updateStatus(selected.id, 'rejected')} />
                    )}
                    <ActionButton label="<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> Note" bg="transparent" color={brand.dark400} border={brand.border} onClick={() => handleAddNote(selected)} />
                    <ActionButton label="🗑 Delete" bg="rgba(239,68,68,0.04)" color="#EF4444" border="rgba(239,68,68,0.15)" onClick={() => handleDelete(selected)} />
                  </div>
                </div>

                {/* Profile fields */}
                <div style={{ padding: '16px 20px', borderBottom: `1px solid ${brand.border}` }}>
                  <MonoTag color={brand.dark500}>Profile</MonoTag>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '12px' }}>
                    {[
                      ['Role', `${selected.role_title} · ${selected.company}`],
                      ['Industry', selected.industry],
                      ['Experience', selected.years_experience],
                      ['Country', selected.country],
                      ['Phone', selected.phone || '—'],
                      ['Availability', `${selected.availability_hours} hrs/month`],
                      ['Mentored Before', selected.has_mentored_before],
                      ['Age Groups', selected.age_groups],
                    ].map(([k, v]) => (
                      <div key={k} style={{ display: 'flex', gap: '12px' }}>
                        <span style={{
                          fontFamily: brand.fontMono,
                          fontSize: '10px',
                          fontWeight: 500,
                          letterSpacing: '0.05em',
                          textTransform: 'uppercase' as const,
                          color: brand.dark500,
                          width: '90px',
                          flexShrink: 0,
                          paddingTop: '2px',
                        }}>
                          {k}
                        </span>
                        <span style={{ fontFamily: brand.fontUI, fontSize: '13px', fontWeight: 500, color: brand.dark200, lineHeight: 1.5 }}>
                          {v}
                        </span>
                      </div>
                    ))}
                    {selected.linkedin_url && (
                      <div style={{ display: 'flex', gap: '12px' }}>
                        <span style={{
                          fontFamily: brand.fontMono, fontSize: '10px', fontWeight: 500,
                          letterSpacing: '0.05em', textTransform: 'uppercase' as const,
                          color: brand.dark500, width: '90px', flexShrink: 0, paddingTop: '2px',
                        }}>LinkedIn</span>
                        <a href={selected.linkedin_url} target="_blank" rel="noreferrer"
                          style={{ fontFamily: brand.fontUI, fontSize: '13px', fontWeight: 600, color: brand.gold, textDecoration: 'none' }}>
                          View profile →
                        </a>
                      </div>
                    )}
                  </div>
                </div>

                {/* Written responses */}
                {[
                  { label: 'Career Summary', value: selected.career_summary },
                  { label: 'Why They Want to Mentor', value: selected.why_mentor },
                  { label: 'Mentoring Style', value: selected.mentor_style },
                  ...(selected.success_story ? [{ label: 'Success Story', value: selected.success_story }] : []),
                ].map(({ label, value }) => (
                  <div key={label} style={{ padding: '16px 20px', borderBottom: `1px solid ${brand.border}` }}>
                    <MonoTag color={brand.dark500}>{label}</MonoTag>
                    <p style={{ fontFamily: brand.fontUI, fontSize: '13px', fontWeight: 400, color: brand.dark200, lineHeight: 1.7, margin: '10px 0 0' }}>
                      {value}
                    </p>
                  </div>
                ))}

                {selected.notes && (
                  <div style={{ padding: '16px 20px', background: brand.goldMuted, borderLeft: `3px solid ${brand.gold}` }}>
                    <MonoTag color={brand.gold}>Internal Notes</MonoTag>
                    <p style={{ fontFamily: brand.fontUI, fontSize: '13px', color: brand.dark50, lineHeight: 1.7, margin: '10px 0 0' }}>
                      {selected.notes}
                    </p>
                  </div>
                )}

                {/* Safe bottom padding for home indicator */}
                <div style={{ height: '32px' }} />
              </div>
            </div>
          </div>
        )}

        {/* ── Responsive overrides ── */}
        <style>{`
          @media (min-width: 768px) {
            .ascentor-table-desktop { display: block !important; }
            .ascentor-table-mobile  { display: none   !important; }
            .ascentor-detail-panel  { display: block !important; position: sticky !important; }
            .ascentor-bottom-sheet  { display: none !important; }
          }
          @media (max-width: 767px) {
            .ascentor-table-desktop { display: none   !important; }
            .ascentor-table-mobile  { display: flex   !important; }
            .ascentor-layout        { flex-direction: column !important; }
            .ascentor-detail-panel  { display: none !important; }
            .ascentor-bottom-sheet  { display: block !important; }
            .ascentor-stats-grid    { grid-template-columns: repeat(2, 1fr) !important; gap: 8px !important; }
            .ascentor-header-row    { flex-direction: column !important; align-items: flex-start !important; }
            .ascentor-search-row    { flex-direction: column !important; }
          }
          input::placeholder { color: var(--admin-text-faint); }
          input:focus { border-color: rgba(232,160,32,0.35) !important; }
          * { box-sizing: border-box; }

          /* Hide scrollbar on tab bar */
          .ascentor-tab-bar::-webkit-scrollbar { display: none; }

          /* Bottom sheet animation */
          @keyframes slideUp {
            from { transform: translateY(100%); opacity: 0; }
            to   { transform: translateY(0);    opacity: 1; }
          }
          .ascentor-sheet-inner {
            animation: slideUp 0.28s cubic-bezier(0.32, 0.72, 0, 1);
          }

          /* Action buttons wrap properly on small screens */
          @media (max-width: 400px) {
            .ascentor-action-row { gap: 6px !important; }
            .ascentor-action-row button { font-size: 10px !important; padding: 5px 8px !important; }
          }
        `}</style>
      </div>
    </>
  );
}

// ─── Reusable action button ───
function ActionButton({
  label, bg, color, border, onClick,
}: {
  label: string; bg: string; color: string; border: string; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        fontFamily: "'Syne', sans-serif",
        fontSize: '11px',
        fontWeight: 600,
        letterSpacing: '0.01em',
        padding: '6px 12px',
        borderRadius: '8px',
        cursor: 'pointer',
        background: bg,
        color,
        border: `1px solid ${border}`,
        transition: 'opacity 0.12s ease',
      }}
      onMouseEnter={e => ((e.currentTarget as HTMLElement).style.opacity = '0.75')}
      onMouseLeave={e => ((e.currentTarget as HTMLElement).style.opacity = '1')}
    >
      {label}
    </button>
  );
}
