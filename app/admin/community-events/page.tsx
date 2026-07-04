'use client';
export const dynamic = 'force-dynamic';

// app/admin/community-events/page.tsx
// Admin CRUD for in-app community sessions (expert_sessions table).
// Field names match the real schema as confirmed by ExpertsClient.tsx:
//   title, expert_name, expert_bio, expert_avatar, status,
//   scheduled_at, duration_minutes, dimension, plan_tier,
//   meeting_url, registration_url, max_attendees, current_attendees.

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import SageLoader from '@/components/SageLoader';

const supabase = createClient();

const STATUSES   = ['scheduled', 'live', 'completed', 'cancelled'] as const;
const DIMENSIONS = ['Mind', 'Character', 'Vocation', 'Relationships', 'Community', 'Legacy'];

type Status = typeof STATUSES[number];

const STATUS_STYLE: Record<Status, { bg: string; color: string }> = {
  scheduled: { bg: 'rgba(59,130,246,0.09)',  color: '#3B82F6' },
  live:       { bg: 'rgba(239,68,68,0.09)',   color: '#EF4444' },
  completed:  { bg: 'rgba(16,185,129,0.09)',  color: '#10B981' },
  cancelled:  { bg: 'rgba(107,114,128,0.09)', color: '#6B7280' },
};

const TIER_OPTIONS = [
  { value: 'free',     label: 'Free — all members' },
  { value: 'explorer', label: 'Explorer and above' },
  { value: 'builder',  label: 'Builder and above' },
  { value: 'climber',  label: 'Climber only' },
];

const EMPTY_FORM = {
  title:             '',
  expert_name:       '',
  expert_bio:        '',
  expert_avatar:     '',
  scheduled_at:      '',
  duration_minutes:  60,
  max_attendees:     50,
  status:            'scheduled' as string,
  meeting_url:       '',
  registration_url:  '',
  dimension:         '',
  plan_tier:         'free',
};

const inputCls = "w-full px-3.5 py-2.5 text-sm rounded-xl outline-none transition-colors";
const inputStyle = {
  background: 'var(--bg-input)', color: 'var(--text)',
  border: '1px solid var(--border)',
};
const focusRing = {
  outline: 'none',
};
const labelStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, color: 'var(--text-dim)',
  display: 'block', marginBottom: 5,
  textTransform: 'uppercase', letterSpacing: '0.06em',
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  );
}

export default function AdminCommunityEventsPage() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing]   = useState<any>(null);
  const [saving, setSaving]     = useState(false);
  const [tab, setTab]           = useState<'upcoming' | 'past'>('upcoming');
  const [form, setForm]         = useState(EMPTY_FORM);
  const [error, setError]       = useState<string | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from('expert_sessions')
      .select('*')
      .order('scheduled_at', { ascending: false });
    setSessions(data ?? []);
    setLoading(false);
  }

  function set(key: string, value: unknown) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function openCreate() {
    setForm(EMPTY_FORM);
    setEditing(null);
    setError(null);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function openEdit(s: any) {
    setForm({
      title:            s.title            ?? '',
      expert_name:      s.expert_name      ?? '',
      expert_bio:       s.expert_bio       ?? '',
      expert_avatar:    s.expert_avatar    ?? '',
      scheduled_at:     s.scheduled_at ? new Date(s.scheduled_at).toISOString().slice(0, 16) : '',
      duration_minutes: s.duration_minutes ?? 60,
      max_attendees:    s.max_attendees    ?? 50,
      status:           s.status           ?? 'scheduled',
      meeting_url:      s.meeting_url      ?? '',
      registration_url: s.registration_url ?? '',
      dimension:        s.dimension        ?? '',
      plan_tier:        s.plan_tier        ?? 'free',
    });
    setEditing(s);
    setError(null);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function handleSave() {
    if (!form.title.trim() || !form.expert_name.trim() || !form.scheduled_at) {
      setError('Title, expert name, and date & time are required.');
      return;
    }
    setSaving(true);
    setError(null);

    const payload = {
      title:            form.title.trim(),
      expert_name:      form.expert_name.trim(),
      expert_bio:       form.expert_bio.trim()       || null,
      expert_avatar:    form.expert_avatar.trim()    || null,
      scheduled_at:     new Date(form.scheduled_at).toISOString(),
      duration_minutes: Number(form.duration_minutes) || 60,
      max_attendees:    Number(form.max_attendees)    || 50,
      status:           form.status,
      meeting_url:      form.meeting_url.trim()      || null,
      registration_url: form.registration_url.trim() || null,
      dimension:        form.dimension               || null,
      plan_tier:        form.plan_tier,
      is_free:          form.plan_tier === 'free',
    };

    const { error: dbErr } = editing
      ? await supabase.from('expert_sessions').update(payload).eq('id', editing.id)
      : await supabase.from('expert_sessions').insert(payload);

    setSaving(false);
    if (dbErr) { setError('Save failed: ' + dbErr.message); return; }
    setShowForm(false);
    setEditing(null);
    load();
  }

  async function handleDelete(id: string, title: string) {
    if (!confirm(`Delete "${title}"? This cannot be undone.`)) return;
    await supabase.from('expert_sessions').delete().eq('id', id);
    load();
  }

  const upcoming = sessions.filter((s) => ['scheduled', 'live'].includes(s.status));
  const past     = sessions.filter((s) => ['completed', 'cancelled'].includes(s.status));
  const listed   = tab === 'upcoming' ? upcoming : past;

  if (loading) return (
    <div className="py-20 text-center">
      <SageLoader size="sm" />
      <p className="text-sm mt-3" style={{ color: 'var(--text-muted)' }}>Loading sessions…</p>
    </div>
  );

  return (
    <div className="animate-fade-up max-w-3xl">

      {/* Header */}
      <div className="flex justify-between items-start mb-6 gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold"
            style={{ fontFamily: "var(--font-display,'Plus Jakarta Sans',sans-serif)", color: 'var(--text)' }}>
            Community Sessions
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            Manage expert sessions shown at <span style={{ color: 'var(--accent)' }}>/experts</span>.
            These are in-app only — separate from public events.
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-dim)' }}>
            {upcoming.length} upcoming · {past.length} past
          </p>
        </div>
        <button onClick={openCreate}
          className="px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap shrink-0"
          style={{ background: 'var(--accent)', color: '#000' }}>
          + New Session
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="rounded-2xl p-5 mb-6"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--accent)' }}>
          <h3 className="text-sm font-bold mb-5" style={{ color: 'var(--text)' }}>
            {editing ? 'Edit Session' : 'New Community Session'}
          </h3>

          <div className="flex flex-col gap-4">

            {/* Title */}
            <Field label="Session Title *">
              <input className={inputCls} style={inputStyle}
                value={form.title} onChange={(e) => set('title', e.target.value)}
                placeholder="e.g. Building a Leadership Mindset" />
            </Field>

            {/* Expert */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Expert / Host Name *">
                <input className={inputCls} style={inputStyle}
                  value={form.expert_name} onChange={(e) => set('expert_name', e.target.value)}
                  placeholder="Full name" />
              </Field>
              <Field label="Expert Bio (short)">
                <input className={inputCls} style={inputStyle}
                  value={form.expert_bio} onChange={(e) => set('expert_bio', e.target.value)}
                  placeholder="e.g. Author, executive coach" />
              </Field>
            </div>

            {/* Avatar URL */}
            <Field label="Expert Avatar URL">
              <input className={inputCls} style={inputStyle}
                value={form.expert_avatar} onChange={(e) => set('expert_avatar', e.target.value)}
                placeholder="https://… (leave blank to use initials)" />
            </Field>

            {/* Date, Duration, Capacity */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Field label="Date & Time *">
                <input type="datetime-local" className={inputCls} style={inputStyle}
                  value={form.scheduled_at} onChange={(e) => set('scheduled_at', e.target.value)} />
              </Field>
              <Field label="Duration (minutes)">
                <input type="number" className={inputCls} style={inputStyle}
                  min={15} max={480} value={form.duration_minutes}
                  onChange={(e) => set('duration_minutes', Number(e.target.value))} />
              </Field>
              <Field label="Max Attendees">
                <input type="number" className={inputCls} style={inputStyle}
                  min={1} value={form.max_attendees}
                  onChange={(e) => set('max_attendees', Number(e.target.value))} />
              </Field>
            </div>

            {/* Dimension & Status */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Dimension (The 6 pillars)">
                <select className={inputCls} style={{ ...inputStyle, cursor: 'pointer' }}
                  value={form.dimension} onChange={(e) => set('dimension', e.target.value)}>
                  <option value="">— None —</option>
                  {DIMENSIONS.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </Field>
              <Field label="Status">
                <select className={inputCls} style={{ ...inputStyle, cursor: 'pointer' }}
                  value={form.status} onChange={(e) => set('status', e.target.value)}>
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                  ))}
                </select>
              </Field>
            </div>

            {/* Links */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Registration Link">
                <input className={inputCls} style={inputStyle}
                  value={form.registration_url} onChange={(e) => set('registration_url', e.target.value)}
                  placeholder="Zoom / Meet / Typeform URL" />
              </Field>
              <Field label="Meeting / Join Link">
                <input className={inputCls} style={inputStyle}
                  value={form.meeting_url} onChange={(e) => set('meeting_url', e.target.value)}
                  placeholder="Shared with attendees on the day" />
              </Field>
            </div>

            {/* Access tier */}
            <Field label="Access — Who can register?">
              <select className={inputCls} style={{ ...inputStyle, cursor: 'pointer' }}
                value={form.plan_tier} onChange={(e) => set('plan_tier', e.target.value)}>
                {TIER_OPTIONS.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </Field>

            {/* Error */}
            {error && (
              <p className="text-sm px-3 py-2.5 rounded-xl"
                style={{ background: 'rgba(239,68,68,0.08)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.2)' }}>
                {error}
              </p>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-1">
              <button onClick={handleSave}
                disabled={saving || !form.title.trim() || !form.expert_name.trim() || !form.scheduled_at}
                className="px-5 py-2.5 rounded-xl text-sm font-bold disabled:opacity-40 transition-opacity"
                style={{ background: 'var(--accent)', color: '#000' }}>
                {saving ? 'Saving…' : editing ? 'Update Session' : 'Create Session'}
              </button>
              <button onClick={() => { setShowForm(false); setEditing(null); setError(null); }}
                className="px-4 py-2.5 rounded-xl text-sm"
                style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tab switcher */}
      <div className="flex gap-1 p-1 rounded-xl mb-5" style={{ background: 'var(--bg-input)' }}>
        {(['upcoming', 'past'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className="flex-1 py-2 rounded-lg text-xs font-semibold transition-all capitalize"
            style={{
              background: tab === t ? 'var(--bg-card)' : 'transparent',
              color: tab === t ? 'var(--accent)' : 'var(--text-dim)',
            }}>
            {t} ({t === 'upcoming' ? upcoming.length : past.length})
          </button>
        ))}
      </div>

      {/* Session list */}
      <div className="flex flex-col gap-3">
        {listed.map((s) => {
          const ss = STATUS_STYLE[s.status as Status] ?? STATUS_STYLE.cancelled;
          const date = s.scheduled_at
            ? new Date(s.scheduled_at).toLocaleDateString('en-US', {
                weekday: 'short', month: 'short', day: 'numeric',
                hour: 'numeric', minute: '2-digit',
              })
            : '—';

          return (
            <div key={s.id} className="rounded-2xl p-4 md:p-5"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>

              {/* Top row */}
              <div className="flex justify-between items-start gap-3 mb-3">
                <div className="min-w-0 flex-1">
                  <h4 className="text-sm font-bold truncate mb-0.5" style={{ color: 'var(--text)' }}>
                    {s.title}
                  </h4>
                  <p className="text-xs" style={{ color: 'var(--text-dim)' }}>
                    {s.expert_name}
                    {s.expert_bio ? ` · ${s.expert_bio}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {s.dimension && (
                    <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full"
                      style={{ background: 'rgba(200,169,110,0.1)', color: 'var(--accent)' }}>
                      {s.dimension}
                    </span>
                  )}
                  <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full"
                    style={{ background: ss.bg, color: ss.color }}>
                    {s.status}
                  </span>
                </div>
              </div>

              {/* Meta */}
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] mb-3"
                style={{ color: 'var(--text-dim)' }}>
                <span>📅 {date}</span>
                <span>⏱ {s.duration_minutes ?? 60} min</span>
                <span>👥 {s.max_attendees ?? '—'} max</span>
                {s.current_attendees != null && (
                  <span>✅ {s.current_attendees} registered</span>
                )}
                {s.plan_tier && s.plan_tier !== 'free' && (
                  <span style={{ color: 'var(--accent)' }}>🔒 {s.plan_tier}+</span>
                )}
                {s.registration_url && <span>📋 Reg link</span>}
                {s.meeting_url && <span>🔗 Join link</span>}
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-3 border-t" style={{ borderColor: 'var(--border)' }}>
                <button onClick={() => openEdit(s)}
                  className="text-xs px-3.5 py-1.5 rounded-lg transition-colors"
                  style={{ color: 'var(--accent)', border: '1px solid rgba(200,169,110,0.3)' }}>
                  Edit
                </button>
                {s.registration_url && (
                  <a href={s.registration_url} target="_blank" rel="noopener noreferrer"
                    className="text-xs px-3.5 py-1.5 rounded-lg transition-colors"
                    style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                    Reg link ↗
                  </a>
                )}
                {s.meeting_url && (
                  <a href={s.meeting_url} target="_blank" rel="noopener noreferrer"
                    className="text-xs px-3.5 py-1.5 rounded-lg transition-colors"
                    style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                    Join link ↗
                  </a>
                )}
                <button onClick={() => handleDelete(s.id, s.title)}
                  className="text-xs px-3.5 py-1.5 rounded-lg transition-colors ml-auto"
                  style={{ color: '#EF4444', border: '1px solid rgba(239,68,68,0.25)' }}>
                  Delete
                </button>
              </div>
            </div>
          );
        })}

        {listed.length === 0 && (
          <div className="text-center py-16 rounded-2xl"
            style={{ border: '1px dashed var(--border)' }}>
            <p className="text-sm font-semibold mb-1" style={{ color: 'var(--text)' }}>
              No {tab} sessions
            </p>
            <p className="text-xs" style={{ color: 'var(--text-dim)' }}>
              {tab === 'upcoming'
                ? 'Create a session — it will appear at /experts for members.'
                : 'Completed and cancelled sessions will appear here.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
