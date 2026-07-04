'use client';

import { useState, useEffect, Suspense } from 'react';
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
  dark50: 'var(--admin-text-heading)',
  gold:        '#E8A020',
  gold600:     '#C87820',
  goldMuted:   'rgba(232,160,32,0.09)',
  goldBorder:  'rgba(232,160,32,0.25)',
  border:      'var(--admin-border)',
  // Stage colours (brand book pg 4) — repurposed as semantic status colours
  explorer:    '#14B8A6',   // scheduled  → teal (forward-looking, calm)
  climber:     '#8B5CF6',   // live       → purple (active, elevated)
  success:     '#10B981',   // completed  → green
  error:       '#EF4444',   // cancelled
};

// Status → brand colour mapping (no raw hex outside this map)
const STATUS_CFG: Record<string, { color: string; label: string }> = {
  scheduled: { color: B.explorer,  label: 'Scheduled' },
  live:      { color: B.climber,   label: 'Live'      },
  completed: { color: B.success,   label: 'Completed' },
  cancelled: { color: B.error,     label: 'Cancelled' },
};

const STATUSES = ['scheduled', 'live', 'completed', 'cancelled'] as const;

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

function StatusPill({ status }: { status: string }) {
  const cfg = STATUS_CFG[status] ?? { color: B.dark400, label: status };
  return (
    <span style={{
      fontFamily:    B.fontMono,
      fontSize:      '10px',
      fontWeight:    500,
      letterSpacing: '0.05em',
      textTransform: 'uppercase' as const,
      padding:       '3px 10px',
      borderRadius:  '999px',
      background:    `${cfg.color}12`,
      border:        `1px solid ${cfg.color}30`,
      color:         cfg.color,
      whiteSpace:    'nowrap' as const,
      flexShrink:    0,
    }}>
      {cfg.label}
    </span>
  );
}

// ── CSS strings ──────────────────────────────────────────────────
const FONTS = `@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,600;0,700;1,600&family=Syne:wght@400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap');`;

const FIELD_CSS = `
  .asc-field {
    width: 100%;
    padding: 12px 14px;
    border-radius: 10px;
    border: 1px solid ${B.border};
    background: ${B.dark700};
    color: ${B.dark50};
    font-family: ${B.fontUI};
    font-size: 13px;
    font-weight: 400;
    outline: none;
    transition: border-color 0.15s ease;
    box-sizing: border-box;
  }
  .asc-field::placeholder { color: ${B.dark500}; }
  .asc-field:focus        { border-color: ${B.goldBorder}; }
  textarea.asc-field      { resize: none; }
  select.asc-field {
    cursor: pointer;
    font-family: ${B.fontMono};
    font-size: 11px;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg width='12' height='8' viewBox='0 0 12 8' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L6 7L11 1' stroke='%234A4438' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 12px center;
    padding-right: 32px;
  }
  input[type="datetime-local"].asc-field::-webkit-calendar-picker-indicator {
    filter: invert(0.4);
    cursor: pointer;
  }
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
  .asc-btn-primary:disabled             { opacity: 0.45; cursor: not-allowed; }
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
    white-space: nowrap;
  }
  .asc-btn-ghost:hover { border-color: ${B.goldBorder}; color: ${B.dark200}; }
  .asc-event-card { transition: border-color 0.12s ease; }
  .asc-event-card:hover { border-color: var(--admin-border-strong) !important; }
  .asc-action-btn {
    padding: 7px 14px;
    border-radius: 8px;
    border: 1px solid ${B.border};
    cursor: pointer;
    background: transparent;
    font-family: ${B.fontUI};
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.01em;
    transition: all 0.12s ease;
  }
`;

// ────────────────────────────────────────────────────────────────
// MAIN EXPORT — Suspense wrapper
// ────────────────────────────────────────────────────────────────
export default function AdminExpertsPage() {
  return (
    <>
      <style>{FONTS + FIELD_CSS}</style>
      <Suspense fallback={<BrandLoader />}>
        <AdminExpertsPageInner />
      </Suspense>
    </>
  );
}

function BrandLoader() {
  return (
    <div style={{ padding: '80px 0', textAlign: 'center' }}>
      <MonoLabel color={B.dark600}>Loading events…</MonoLabel>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// INNER COMPONENT — All logic lives here
// ────────────────────────────────────────────────────────────────
function AdminExpertsPageInner() {
  const supabase     = createClient();
  const searchParams = useSearchParams();

  const [events,        setEvents]        = useState<any[]>([]);
  const [registrations, setRegistrations] = useState<Record<string, any[]>>({}); // sessionId → registrant rows
  const [expanded,      setExpanded]      = useState<Set<string>>(new Set());    // expanded registrant lists
  const [loading,       setLoading]       = useState(true);
  const [showForm,      setShowForm]      = useState(searchParams.get('action') === 'create');
  const [editing,       setEditing]       = useState<any>(null);
  const [saving,        setSaving]        = useState(false);
  const [tab,           setTab]           = useState<'upcoming' | 'past'>('upcoming');

  const emptyForm = {
    title: '', description: '', expert_name: '', expert_bio: '',
    scheduled_at: '', duration_minutes: 60, max_participants: 50,
    status: 'scheduled' as string, meeting_url: '', registration_url: '',
  };
  const [form, setForm] = useState(emptyForm);

  useEffect(() => { loadEvents(); }, []);

  async function loadEvents() {
    setLoading(true);
    const [{ data: sessions }, { data: regs }] = await Promise.all([
      supabase
        .from('expert_sessions')
        .select('*')
        .order('scheduled_at', { ascending: false }),
      supabase
        .from('session_registrations')
        .select('id, session_id, user_id, registered_at, profiles(full_name, email, avatar_url)')
        .order('registered_at', { ascending: true }),
    ]);
    setEvents(sessions || []);
    // Group registrations by session_id
    const grouped: Record<string, any[]> = {};
    for (const r of regs || []) {
      if (!grouped[r.session_id]) grouped[r.session_id] = [];
      grouped[r.session_id].push(r);
    }
    setRegistrations(grouped);
    setLoading(false);
  }

  function openEdit(event: any) {
    setForm({
      title:            event.title            || '',
      description:      event.description      || '',
      expert_name:      event.expert_name      || '',
      expert_bio:       event.expert_bio        || '',
      scheduled_at:     event.scheduled_at
        ? new Date(event.scheduled_at).toISOString().slice(0, 16)
        : '',
      duration_minutes: event.duration_minutes  || 60,
      max_participants: event.max_participants  || 50,
      status:           event.status            || 'scheduled',
      meeting_url:      event.meeting_url        || '',
      registration_url: event.registration_url  || '',
    });
    setEditing(event);
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
    if (!form.title.trim() || !form.expert_name.trim() || !form.scheduled_at) return;
    setSaving(true);

    const payload: any = {
      title:            form.title,
      description:      form.description      || null,
      expert_name:      form.expert_name,
      expert_bio:       form.expert_bio        || null,
      scheduled_at:     new Date(form.scheduled_at).toISOString(),
      duration_minutes: Number(form.duration_minutes) || 60,
      max_participants: Number(form.max_participants)  || 50,
      status:           form.status,
      meeting_url:      form.meeting_url        || null,
      registration_url: form.registration_url  || null,
    };

    let error;
    if (editing) {
      ({ error } = await supabase.from('expert_sessions').update(payload).eq('id', editing.id));
    } else {
      ({ error } = await supabase.from('expert_sessions').insert(payload));
    }

    if (error) {
      // TODO: replace with useModal() alert when modal provider is available here
      console.error('Save failed:', error.message);
    } else {
      setShowForm(false);
      setEditing(null);
      await loadEvents();
    }
    setSaving(false);
  }

  async function handleDelete(id: string, title: string) {
    // TODO: replace with useModal() confirm when modal provider is available here
    if (!window.confirm(`Delete "${title}"? This cannot be undone.`)) return;
    await supabase.from('expert_sessions').delete().eq('id', id);
    loadEvents();
  }

  const upcoming = events.filter(e => ['scheduled', 'live'].includes(e.status));
  const past     = events.filter(e => ['completed', 'cancelled'].includes(e.status));

  if (loading) return <BrandLoader />;

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
              Expert Events
            </h1>
            <p style={{
              fontFamily:    B.fontMono,
              fontSize:      '11px',
              color:         B.dark500,
              margin:        0,
              letterSpacing: '0.04em',
            }}>
              {upcoming.length} UPCOMING · {past.length} PAST · {Object.values(registrations).reduce((s, a) => s + a.length, 0)} REGISTRATIONS
            </p>
          </div>

          <button
            className="asc-btn-primary"
            onClick={openCreate}
            style={{ display: showForm && !editing ? 'none' : undefined }}
          >
            + New Event
          </button>
        </div>

        {/* Gold rule */}
        <div style={{
          height:     '1px',
          background: `linear-gradient(90deg, ${B.gold} 0%, transparent 60%)`,
          marginTop:  '16px',
        }} />
      </div>

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
          {/* Form header */}
          <div style={{ marginBottom: '20px' }}>
            <h3 style={{
              fontFamily: B.fontDisplay,
              fontWeight: 700,
              fontSize:   '20px',
              color:      B.dark50,
              margin:     '0 0 2px',
            }}>
              {editing ? 'Edit Event' : 'New Expert Event'}
            </h3>
            <MonoLabel color={B.dark500}>
              {editing ? `Editing · ${editing.title}` : 'Fill in the details below'}
            </MonoLabel>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

            {/* Title */}
            <div>
              <FieldLabel>Event Title *</FieldLabel>
              <input
                className="asc-field"
                value={form.title}
                onChange={e => setForm({ ...form, title: e.target.value })}
                placeholder="e.g. Navigating Your First VP Role in African Tech"
              />
            </div>

            {/* Description */}
            <div>
              <FieldLabel>Description</FieldLabel>
              <textarea
                className="asc-field"
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                placeholder="What will attendees learn? Who is this for?"
                rows={3}
              />
            </div>

            {/* Expert name + bio */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }} className="asc-form-grid">
              <div>
                <FieldLabel>Expert Name *</FieldLabel>
                <input
                  className="asc-field"
                  value={form.expert_name}
                  onChange={e => setForm({ ...form, expert_name: e.target.value })}
                  placeholder="Full name"
                />
              </div>
              <div>
                <FieldLabel>Expert Bio (short)</FieldLabel>
                <input
                  className="asc-field"
                  value={form.expert_bio}
                  onChange={e => setForm({ ...form, expert_bio: e.target.value })}
                  placeholder="e.g. COO at Paystack · 12 years in fintech"
                />
              </div>
            </div>

            {/* Date/time + Status */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }} className="asc-form-grid">
              <div>
                <FieldLabel>Date & Time *</FieldLabel>
                <input
                  type="datetime-local"
                  className="asc-field"
                  value={form.scheduled_at}
                  onChange={e => setForm({ ...form, scheduled_at: e.target.value })}
                />
              </div>
              <div>
                <FieldLabel>Status</FieldLabel>
                <select
                  className="asc-field"
                  value={form.status}
                  onChange={e => setForm({ ...form, status: e.target.value })}
                >
                  {STATUSES.map(s => (
                    <option key={s} value={s}>{STATUS_CFG[s]?.label ?? s}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Capacity row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }} className="asc-form-grid">
              <div>
                <FieldLabel>Duration (minutes)</FieldLabel>
                <input
                  type="number"
                  className="asc-field"
                  value={form.duration_minutes}
                  onChange={e => setForm({ ...form, duration_minutes: Number(e.target.value) })}
                  min={15}
                  step={15}
                />
              </div>
              <div>
                <FieldLabel>Max Participants</FieldLabel>
                <input
                  type="number"
                  className="asc-field"
                  value={form.max_participants}
                  onChange={e => setForm({ ...form, max_participants: Number(e.target.value) })}
                  min={1}
                />
              </div>
            </div>

            {/* Links */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }} className="asc-form-grid">
              <div>
                <FieldLabel>Registration Link</FieldLabel>
                <input
                  className="asc-field"
                  value={form.registration_url}
                  onChange={e => setForm({ ...form, registration_url: e.target.value })}
                  placeholder="Zoom / Meet / Luma registration URL"
                />
              </div>
              <div>
                <FieldLabel>Join Link</FieldLabel>
                <input
                  className="asc-field"
                  value={form.meeting_url}
                  onChange={e => setForm({ ...form, meeting_url: e.target.value })}
                  placeholder="Webinar / meeting join URL"
                />
              </div>
            </div>

            {/* Actions */}
            <div style={{
              display:    'flex',
              gap:        '10px',
              marginTop:  '8px',
              paddingTop: '16px',
              borderTop:  `1px solid ${B.border}`,
            }}>
              <button
                className="asc-btn-primary"
                onClick={handleSave}
                disabled={saving || !form.title.trim() || !form.expert_name.trim() || !form.scheduled_at}
              >
                {saving ? 'Saving…' : editing ? 'Update Event' : 'Create Event'}
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

      {/* ── TABS ── */}
      <div style={{
        display:      'flex',
        gap:          '2px',
        padding:      '4px',
        borderRadius: '10px',
        background:   B.dark700,
        marginBottom: '20px',
      }}>
        {(['upcoming', 'past'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              flex:          1,
              padding:       '9px 12px',
              borderRadius:  '7px',
              border:        'none',
              cursor:        'pointer',
              fontFamily:    B.fontUI,
              fontSize:      '12px',
              fontWeight:    600,
              letterSpacing: '0.01em',
              textTransform: 'capitalize' as const,
              background:    tab === t ? B.dark600 : 'transparent',
              color:         tab === t ? B.gold : B.dark400,
              transition:    'all 0.12s ease',
            }}
          >
            {t} ({t === 'upcoming' ? upcoming.length : past.length})
          </button>
        ))}
      </div>

      {/* ── EVENT CARDS ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {(tab === 'upcoming' ? upcoming : past).map(e => {
          const cfg = STATUS_CFG[e.status] ?? { color: B.dark400 };
          return (
            <div
              key={e.id}
              className="asc-event-card"
              style={{
                borderRadius: '12px',
                padding:      '18px 20px',
                background:   B.dark800,
                border:       `1px solid ${B.border}`,
                borderLeft:   `3px solid ${cfg.color}`,
              }}
            >
              {/* Card header */}
              <div style={{
                display:        'flex',
                justifyContent: 'space-between',
                alignItems:     'flex-start',
                gap:            '12px',
                marginBottom:   '10px',
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h4 style={{
                    fontFamily:   B.fontDisplay,
                    fontWeight:   700,
                    fontSize:     '18px',
                    color:        B.dark50,
                    margin:       '0 0 4px',
                    lineHeight:   1.2,
                    overflow:     'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace:   'nowrap' as const,
                  }}>
                    {e.title}
                  </h4>
                  <MonoLabel color={B.dark400}>
                    {e.expert_name} · {new Date(e.scheduled_at).toLocaleDateString('en-US', {
                      weekday: 'short', month: 'short', day: 'numeric',
                      hour: 'numeric', minute: '2-digit',
                    })}
                  </MonoLabel>
                </div>
                <StatusPill status={e.status} />
              </div>

              {/* Expert bio if present */}
              {e.expert_bio && (
                <p style={{
                  fontFamily:   B.fontUI,
                  fontSize:     '12px',
                  color:        B.dark400,
                  margin:       '0 0 10px',
                  lineHeight:   1.5,
                }}>
                  {e.expert_bio}
                </p>
              )}

              {/* Meta row */}
              <div style={{
                display:      'flex',
                gap:          '16px',
                alignItems:   'center',
                marginBottom: '14px',
                flexWrap:     'wrap',
              }}>
                <MonoLabel color={B.dark500}>
                  {e.duration_minutes} min · {e.max_participants} seats
                </MonoLabel>
                {e.registration_url && (
                  <span style={{
                    fontFamily:    B.fontMono,
                    fontSize:      '10px',
                    fontWeight:    500,
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase' as const,
                    padding:       '2px 8px',
                    borderRadius:  '999px',
                    background:    B.goldMuted,
                    color:         B.gold,
                    border:        `1px solid ${B.goldBorder}`,
                  }}>
                    Reg link set
                  </span>
                )}
                {e.meeting_url && (
                  <span style={{
                    fontFamily:    B.fontMono,
                    fontSize:      '10px',
                    fontWeight:    500,
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase' as const,
                    padding:       '2px 8px',
                    borderRadius:  '999px',
                    background:    `${B.explorer}12`,
                    color:         B.explorer,
                    border:        `1px solid ${B.explorer}30`,
                  }}>
                    Join link set
                  </span>
                )}
              </div>

              {/* Card actions */}
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                <button
                  className="asc-action-btn"
                  onClick={() => openEdit(e)}
                  style={{ color: B.gold, borderColor: B.goldBorder }}
                  onMouseEnter={el => ((el.currentTarget as HTMLElement).style.background = B.goldMuted)}
                  onMouseLeave={el => ((el.currentTarget as HTMLElement).style.background = 'transparent')}
                >
                  Edit
                </button>
                <button
                  className="asc-action-btn"
                  onClick={() => handleDelete(e.id, e.title)}
                  style={{ color: B.error, borderColor: `${B.error}30` }}
                  onMouseEnter={el => ((el.currentTarget as HTMLElement).style.background = `${B.error}08`)}
                  onMouseLeave={el => ((el.currentTarget as HTMLElement).style.background = 'transparent')}
                >
                  Delete
                </button>
                {e.registration_url && (
                  <a
                    href={e.registration_url}
                    target="_blank"
                    rel="noreferrer"
                    className="asc-action-btn"
                    style={{
                      color:          B.explorer,
                      borderColor:    `${B.explorer}30`,
                      textDecoration: 'none',
                      display:        'inline-block',
                    }}
                  >
                    Reg link →
                  </a>
                )}

                {/* Registrant count + toggle */}
                {(() => {
                  const regs = registrations[e.id] || [];
                  const isOpen = expanded.has(e.id);
                  if (regs.length === 0) return (
                    <span style={{
                      fontFamily: B.fontMono, fontSize: '10px', letterSpacing: '0.05em',
                      textTransform: 'uppercase', color: B.dark500, marginLeft: 'auto',
                    }}>
                      0 registered
                    </span>
                  );
                  return (
                    <button
                      className="asc-action-btn"
                      onClick={() => setExpanded(prev => {
                        const next = new Set(prev);
                        if (next.has(e.id)) next.delete(e.id); else next.add(e.id);
                        return next;
                      })}
                      style={{
                        color: B.climber, borderColor: `${B.climber}30`, marginLeft: 'auto',
                        display: 'flex', alignItems: 'center', gap: '6px',
                      }}
                      onMouseEnter={el => ((el.currentTarget as HTMLElement).style.background = `${B.climber}10`)}
                      onMouseLeave={el => ((el.currentTarget as HTMLElement).style.background = 'transparent')}
                    >
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        width: '18px', height: '18px', borderRadius: '50%',
                        background: B.climber, color: '#fff',
                        fontFamily: B.fontMono, fontSize: '9px', fontWeight: 700,
                      }}>
                        {regs.length}
                      </span>
                      {regs.length === 1 ? '1 registrant' : `${regs.length} registrants`}
                      <span style={{ fontSize: '10px', opacity: 0.7 }}>{isOpen ? '▲' : '▼'}</span>
                    </button>
                  );
                })()}
              </div>

              {/* Expandable registrant list */}
              {expanded.has(e.id) && (() => {
                const regs = registrations[e.id] || [];
                return (
                  <div style={{
                    marginTop: '12px',
                    borderTop: `1px solid ${B.border}`,
                    paddingTop: '12px',
                  }}>
                    <MonoLabel color={B.dark500}>Registered users</MonoLabel>
                    <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {regs.map((r: any, i: number) => {
                        const profile = r.profiles || {};
                        const name  = profile.full_name || '—';
                        const email = profile.email     || r.user_id?.slice(0, 8) + '…';
                        const date  = new Date(r.registered_at).toLocaleDateString('en-US', {
                          month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                        });
                        return (
                          <div key={r.id} style={{
                            display: 'flex', alignItems: 'center', gap: '10px',
                            padding: '7px 10px', borderRadius: '8px',
                            background: i % 2 === 0 ? B.dark700 : 'transparent',
                          }}>
                            {/* Avatar initials */}
                            <span style={{
                              width: '28px', height: '28px', borderRadius: '50%', flexShrink: 0,
                              background: `${B.climber}20`, border: `1px solid ${B.climber}40`,
                              color: B.climber, fontFamily: B.fontUI, fontSize: '10px', fontWeight: 700,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              textTransform: 'uppercase',
                            }}>
                              {name !== '—'
                                ? name.split(' ').filter(Boolean).map((p: string) => p[0]).join('').slice(0, 2)
                                : '?'}
                            </span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{
                                fontFamily: B.fontUI, fontSize: '12px', fontWeight: 600,
                                color: B.dark200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                              }}>
                                {name}
                              </div>
                              <div style={{
                                fontFamily: B.fontMono, fontSize: '10px', color: B.dark500,
                                letterSpacing: '0.03em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                              }}>
                                {email}
                              </div>
                            </div>
                            <span style={{
                              fontFamily: B.fontMono, fontSize: '10px', color: B.dark500,
                              letterSpacing: '0.03em', flexShrink: 0,
                            }}>
                              {date}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>
          );
        })}

        {/* Empty state */}
        {(tab === 'upcoming' ? upcoming : past).length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <p style={{
              fontFamily: B.fontDisplay,
              fontSize:   '26px',
              color:      B.dark500,
              margin:     '0 0 8px',
            }}>
              No {tab} events
            </p>
            <MonoLabel color={B.dark600}>
              {tab === 'upcoming' ? 'Create your first expert event above.' : 'Past events will appear here.'}
            </MonoLabel>
          </div>
        )}
      </div>

      {/* ── Responsive form grid ── */}
      <style>{`
        @media (max-width: 600px) {
          .asc-form-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
