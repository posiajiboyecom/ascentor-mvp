'use client';
export const dynamic = 'force-dynamic';

// app/admin/events/page.tsx
// Admin CRUD for public events. Create/edit events, manage registrations,
// toggle publish/registration-open, configure registration fields, email registrants.

import { useState, useEffect, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';

const B = {
  bg: '#0F0F0E', card: '#161614', border: 'rgba(255,255,255,0.08)',
  gold: '#C8A96E', text: '#FAFAF8', muted: '#6B7280', dim: '#4B5563',
  error: '#EF4444', success: '#10B981',
  fontUI: "'Syne','Plus Jakarta Sans',sans-serif",
  fontMono: "'DM Mono','Courier New',monospace",
};

const ALL_FIELDS = [
  { key: 'full_name',    label: 'Full Name' },
  { key: 'email',        label: 'Email' },
  { key: 'whatsapp',     label: 'WhatsApp' },
  { key: 'phone',        label: 'Phone' },
  { key: 'country',      label: 'Country' },
  { key: 'city',         label: 'City' },
  { key: 'current_role', label: 'Role' },
  { key: 'organisation', label: 'Organisation' },
  { key: 'industry',     label: 'Industry' },
  { key: 'what_building',label: 'What Building' },
  { key: 'why_attend',   label: 'Why Attend' },
  { key: 'how_heard',    label: 'How Heard' },
  { key: 'dietary_needs',label: 'Dietary Needs' },
  { key: 'accessibility',label: 'Accessibility' },
];

const STATUSES = ['pending','confirmed','waitlist','declined','cancelled'];

const EMPTY_EVENT = {
  slug: '', title: '', tagline: '', description: '',
  event_date: '', event_date_iso: '', location: '',
  is_published: false, is_featured: false, registration_open: true,
  cover_color: '#0F0F0E',
  registration_fields: ['full_name','email','whatsapp','country'],
  confirmation_subject: '', confirmation_body: '',
};

type PublicEvent = typeof EMPTY_EVENT & { id: string; created_at?: string };
type Reg = {
  id: string; event_id: string; full_name: string; email: string;
  whatsapp: string | null; country: string | null; city: string | null;
  current_role: string | null; organisation: string | null; industry: string | null;
  what_building: string | null; why_attend: string | null; how_heard: string | null;
  dietary_needs: string | null; accessibility: string | null;
  status: string; ticket_type: string | null; notes: string | null;
  created_at: string;
};

export default function AdminEventsPage() {
  const supabase = createClient();
  const [events, setEvents] = useState<PublicEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<PublicEvent> | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  // Registrant panel
  const [activeEventId, setActiveEventId] = useState<string | null>(null);
  const [regs, setRegs] = useState<Reg[]>([]);
  const [regsLoading, setRegsLoading] = useState(false);
  const [regSearch, setRegSearch] = useState('');
  const [regStatusFilter, setRegStatusFilter] = useState('all');
  const [localNotes, setLocalNotes] = useState<Record<string, string>>({});
  const [savingRegId, setSavingRegId] = useState<string | null>(null);
  const [expandedRegId, setExpandedRegId] = useState<string | null>(null);

  // Email blast
  const [emailSubject, setEmailSubject] = useState('');
  const [emailMessage, setEmailMessage] = useState('');
  const [emailStatus, setEmailStatus] = useState('confirmed');
  const [emailSending, setEmailSending] = useState(false);
  const [emailResult, setEmailResult] = useState<string | null>(null);

  useEffect(() => { loadEvents(); }, []);

  async function loadEvents() {
    setLoading(true);
    const { data } = await supabase
      .from('public_events').select('*').order('event_date_iso', { ascending: true });
    setEvents((data || []) as PublicEvent[]);
    setLoading(false);
  }

  async function loadRegs(eventId: string) {
    setRegsLoading(true);
    const { data } = await supabase
      .from('event_registrations').select('*')
      .eq('event_id', eventId).order('created_at', { ascending: false });
    const rows = (data || []) as Reg[];
    setRegs(rows);
    const notes: Record<string, string> = {};
    rows.forEach(r => { notes[r.id] = r.notes || ''; });
    setLocalNotes(notes);
    setRegsLoading(false);
  }

  async function handleSave() {
    if (!editing) return;
    setSaving(true); setSaveMsg('');
    const payload = { ...editing, updated_at: new Date().toISOString() };
    if (editing.id) {
      const { error } = await supabase.from('public_events').update(payload).eq('id', editing.id);
      if (error) { setSaveMsg('Error: ' + error.message); }
      else { setSaveMsg('Saved ✓'); await loadEvents(); setEditing(null); }
    } else {
      const { error } = await supabase.from('public_events').insert(payload);
      if (error) { setSaveMsg('Error: ' + error.message); }
      else { setSaveMsg('Created ✓'); await loadEvents(); setEditing(null); }
    }
    setSaving(false);
  }

  async function handleDelete(id: string, title: string) {
    if (!confirm(`Delete "${title}"? This also deletes all registrations.`)) return;
    await supabase.from('public_events').delete().eq('id', id);
    setEvents(prev => prev.filter(e => e.id !== id));
    if (activeEventId === id) setActiveEventId(null);
  }

  async function toggleField(field: string) {
    if (!editing) return;
    const cur = editing.registration_fields || [];
    const next = cur.includes(field) ? cur.filter(f => f !== field) : [...cur, field];
    setEditing({ ...editing, registration_fields: next });
  }

  async function updateRegField(id: string, updates: Partial<Reg>) {
    setSavingRegId(id);
    await supabase.from('event_registrations').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id);
    setRegs(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r));
    setSavingRegId(null);
  }

  async function saveRegNotes(id: string) {
    setSavingRegId(id);
    await supabase.from('event_registrations').update({ notes: localNotes[id] || null }).eq('id', id);
    setRegs(prev => prev.map(r => r.id === id ? { ...r, notes: localNotes[id] } : r));
    setSavingRegId(null);
  }

  async function handleEmailBlast() {
    if (!activeEventId || !emailSubject.trim() || !emailMessage.trim()) return;
    setEmailSending(true); setEmailResult(null);
    try {
      const res = await fetch('/api/events/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId: activeEventId, status: emailStatus, subject: emailSubject, message: emailMessage }),
      });
      const d = await res.json();
      if (res.ok) {
        setEmailResult(`✓ Sent to ${d.sent} registrant${d.sent !== 1 ? 's' : ''}${d.failed > 0 ? ` (${d.failed} failed)` : ''}`);
        setEmailSubject(''); setEmailMessage('');
      } else { setEmailResult(`✗ ${d.error || 'Failed'}`); }
    } catch (e: any) { setEmailResult(`✗ ${e.message}`); }
    finally { setEmailSending(false); }
  }

  function exportCSV() {
    const cols = ['full_name','email','whatsapp','phone','country','city','current_role',
      'organisation','industry','status','ticket_type','what_building','why_attend',
      'how_heard','dietary_needs','accessibility','notes','created_at'];
    const rows = filteredRegs.map(r => cols.map(c => JSON.stringify((r as any)[c] ?? '')).join(','));
    const csv = [cols.join(','), ...rows].join('\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv],{type:'text/csv'}));
    a.download = `event-registrations-${new Date().toISOString().slice(0,10)}.csv`; a.click();
  }

  const filteredRegs = useMemo(() => regs.filter(r => {
    const matchStatus = regStatusFilter === 'all' || r.status === regStatusFilter;
    const q = regSearch.toLowerCase();
    return matchStatus && (!q || r.full_name.toLowerCase().includes(q) || r.email.toLowerCase().includes(q) || (r.country || '').toLowerCase().includes(q));
  }), [regs, regStatusFilter, regSearch]);

  const activeEvent = events.find(e => e.id === activeEventId);

  const fieldSet = (f: Partial<PublicEvent>, key: keyof typeof EMPTY_EVENT) =>
    (v: string | boolean | string[]) => setEditing({ ...f, [key]: v });

  return (
    <div style={{ padding: '32px', fontFamily: B.fontUI, minHeight: '100vh' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '28px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <p style={{ fontFamily: B.fontMono, fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: B.gold, margin: '0 0 6px' }}>Marketing · Events</p>
          <h1 style={{ margin: 0, fontSize: '26px', fontWeight: 700, color: B.text }}>Public Events</h1>
        </div>
        <button onClick={() => { setEditing({ ...EMPTY_EVENT }); setSaveMsg(''); }}
          style={{ padding: '9px 20px', background: B.gold, border: 'none', borderRadius: '8px', color: '#0F0F0E', fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: B.fontUI }}>
          + New Event
        </button>
      </div>

      {/* ── Event editor modal ── */}
      {editing && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '40px 20px', overflowY: 'auto' }}>
          <div style={{ background: B.card, border: `1px solid ${B.border}`, borderRadius: '14px', width: '100%', maxWidth: '680px', padding: '32px' }}>
            <h2 style={{ margin: '0 0 24px', fontSize: '20px', fontWeight: 700, color: B.text, fontFamily: B.fontUI }}>
              {editing.id ? 'Edit Event' : 'New Event'}
            </h2>

            {/* Core fields */}
            {[
              ['Title *',    'title',       'text',     'The Elevation Summit'],
              ['Slug *',     'slug',        'text',     'elevation-summit-2027'],
              ['Tagline',    'tagline',     'text',     'One gathering. One decision.'],
              ['Event Date', 'event_date',  'text',     'February 2027'],
              ['Date (ISO)', 'event_date_iso','date',   ''],
              ['Location',   'location',    'text',     'Lagos, Nigeria'],
              ['Cover colour','cover_color','color',    '#0F0F0E'],
              ['Confirmation subject','confirmation_subject','text','You\'re registered!'],
            ].map(([label, key, type, ph]) => (
              <div key={key as string} style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontFamily: B.fontMono, fontSize: '10px', letterSpacing: '0.08em', textTransform: 'uppercase', color: B.muted, marginBottom: '5px' }}>{label}</label>
                <input type={type as string} value={(editing as any)[key] || ''} placeholder={ph as string}
                  onChange={e => setEditing({ ...editing, [key as string]: e.target.value })}
                  style={{ display: 'block', width: '100%', padding: '8px 12px', background: B.bg, border: `1px solid ${B.border}`, borderRadius: '7px', color: B.text, fontSize: '13px', fontFamily: B.fontUI, outline: 'none', boxSizing: 'border-box' }} />
              </div>
            ))}

            {/* Description */}
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontFamily: B.fontMono, fontSize: '10px', letterSpacing: '0.08em', textTransform: 'uppercase', color: B.muted, marginBottom: '5px' }}>Description</label>
              <textarea rows={4} value={editing.description || ''}
                onChange={e => setEditing({ ...editing, description: e.target.value })}
                style={{ display: 'block', width: '100%', padding: '8px 12px', background: B.bg, border: `1px solid ${B.border}`, borderRadius: '7px', color: B.text, fontSize: '13px', fontFamily: B.fontUI, outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} />
            </div>

            {/* Confirmation body */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontFamily: B.fontMono, fontSize: '10px', letterSpacing: '0.08em', textTransform: 'uppercase', color: B.muted, marginBottom: '5px' }}>Confirmation message (shown on success + in email)</label>
              <textarea rows={3} value={editing.confirmation_body || ''}
                onChange={e => setEditing({ ...editing, confirmation_body: e.target.value })}
                style={{ display: 'block', width: '100%', padding: '8px 12px', background: B.bg, border: `1px solid ${B.border}`, borderRadius: '7px', color: B.text, fontSize: '13px', fontFamily: B.fontUI, outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} />
            </div>

            {/* Toggles */}
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '20px' }}>
              {[
                ['is_published', 'Published'],
                ['is_featured', 'Featured'],
                ['registration_open', 'Registration open'],
              ].map(([key, label]) => (
                <label key={key as string} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', color: B.text }}>
                  <input type="checkbox" checked={!!(editing as any)[key]}
                    onChange={e => setEditing({ ...editing, [key as string]: e.target.checked })}
                    style={{ width: '15px', height: '15px', accentColor: B.gold }} />
                  {label}
                </label>
              ))}
            </div>

            {/* Registration fields */}
            <p style={{ fontFamily: B.fontMono, fontSize: '10px', letterSpacing: '0.08em', textTransform: 'uppercase', color: B.gold, marginBottom: '10px' }}>Registration fields</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '24px' }}>
              {ALL_FIELDS.map(({ key, label }) => {
                const checked = (editing.registration_fields || []).includes(key);
                return (
                  <button key={key} type="button" onClick={() => toggleField(key)}
                    style={{ padding: '5px 12px', borderRadius: '20px', border: `1px solid ${checked ? B.gold : B.border}`, background: checked ? 'rgba(200,169,110,0.12)' : 'transparent', color: checked ? B.gold : B.muted, fontSize: '11px', cursor: 'pointer', fontFamily: B.fontUI }}>
                    {label}
                  </button>
                );
              })}
            </div>
            <p style={{ fontFamily: B.fontMono, fontSize: '10px', color: B.dim, marginBottom: '20px' }}>
              Event URL: ascentorbi.com/events/<strong style={{ color: B.muted }}>{editing.slug || 'your-slug'}</strong>
            </p>

            {saveMsg && (
              <p style={{ fontFamily: B.fontMono, fontSize: '11px', color: saveMsg.startsWith('Error') ? B.error : B.success, marginBottom: '12px' }}>{saveMsg}</p>
            )}

            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={handleSave} disabled={saving}
                style={{ padding: '9px 22px', background: B.gold, border: 'none', borderRadius: '8px', color: '#0F0F0E', fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: B.fontUI }}>
                {saving ? 'Saving…' : editing.id ? 'Save changes' : 'Create event'}
              </button>
              <button onClick={() => setEditing(null)}
                style={{ padding: '9px 22px', background: 'transparent', border: `1px solid ${B.border}`, borderRadius: '8px', color: B.muted, fontSize: '13px', cursor: 'pointer', fontFamily: B.fontUI }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Events list ── */}
      {loading ? (
        <p style={{ color: B.muted, fontFamily: B.fontMono, fontSize: '12px' }}>Loading…</p>
      ) : events.length === 0 ? (
        <p style={{ color: B.muted }}>No events yet. Create one above.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '36px' }}>
          {events.map(ev => (
            <div key={ev.id} style={{ background: B.card, border: `1px solid ${activeEventId === ev.id ? B.gold : B.border}`, borderRadius: '12px', overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '18px 20px', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px', flexWrap: 'wrap' }}>
                    <p style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: B.text }}>{ev.title}</p>
                    {ev.is_featured && <span style={{ padding: '2px 8px', borderRadius: '4px', background: 'rgba(200,169,110,0.15)', color: B.gold, fontSize: '10px', fontFamily: B.fontMono, letterSpacing: '0.06em' }}>FEATURED</span>}
                    <span style={{ padding: '2px 8px', borderRadius: '4px', background: ev.is_published ? 'rgba(16,185,129,0.12)' : 'rgba(107,114,128,0.15)', color: ev.is_published ? '#10B981' : B.muted, fontSize: '10px', fontFamily: B.fontMono }}>
                      {ev.is_published ? 'PUBLISHED' : 'DRAFT'}
                    </span>
                    {!ev.registration_open && <span style={{ padding: '2px 8px', borderRadius: '4px', background: 'rgba(239,68,68,0.1)', color: B.error, fontSize: '10px', fontFamily: B.fontMono }}>REG CLOSED</span>}
                  </div>
                  <p style={{ margin: 0, fontFamily: B.fontMono, fontSize: '11px', color: B.muted }}>
                    /events/{ev.slug} · {ev.event_date} · {ev.location}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <a href={`/events/${ev.slug}`} target="_blank" rel="noreferrer"
                    style={{ padding: '6px 14px', borderRadius: '7px', border: `1px solid ${B.border}`, color: B.muted, fontSize: '12px', textDecoration: 'none', fontFamily: B.fontUI }}>
                    View →
                  </a>
                  <button onClick={() => { setEditing({ ...ev }); setSaveMsg(''); }}
                    style={{ padding: '6px 14px', borderRadius: '7px', border: `1px solid ${B.border}`, background: 'transparent', color: B.gold, fontSize: '12px', cursor: 'pointer', fontFamily: B.fontUI }}>
                    Edit
                  </button>
                  <button onClick={() => {
                    if (activeEventId === ev.id) { setActiveEventId(null); }
                    else { setActiveEventId(ev.id); loadRegs(ev.id); setEmailResult(null); }
                  }}
                    style={{ padding: '6px 14px', borderRadius: '7px', border: `1px solid ${activeEventId === ev.id ? B.gold : B.border}`, background: activeEventId === ev.id ? 'rgba(200,169,110,0.1)' : 'transparent', color: activeEventId === ev.id ? B.gold : B.muted, fontSize: '12px', cursor: 'pointer', fontFamily: B.fontUI }}>
                    Registrations {activeEventId === ev.id ? '↑' : '↓'}
                  </button>
                  <button onClick={() => handleDelete(ev.id, ev.title)}
                    style={{ padding: '6px 14px', borderRadius: '7px', border: '1px solid rgba(239,68,68,0.25)', background: 'transparent', color: B.error, fontSize: '12px', cursor: 'pointer', fontFamily: B.fontUI }}>
                    Delete
                  </button>
                </div>
              </div>

              {/* ── Registrations panel ── */}
              {activeEventId === ev.id && (
                <div style={{ borderTop: `1px solid ${B.border}`, padding: '20px' }}>
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '16px', alignItems: 'center' }}>
                    <p style={{ margin: 0, fontFamily: B.fontMono, fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', color: B.gold }}>
                      {regs.length} Registrations
                    </p>
                    <input placeholder="Search name/email/country…" value={regSearch} onChange={e => setRegSearch(e.target.value)}
                      style={{ padding: '6px 12px', background: B.bg, border: `1px solid ${B.border}`, borderRadius: '7px', color: B.text, fontSize: '12px', fontFamily: B.fontUI, outline: 'none' }} />
                    <select value={regStatusFilter} onChange={e => setRegStatusFilter(e.target.value)}
                      style={{ padding: '6px 12px', background: B.bg, border: `1px solid ${B.border}`, borderRadius: '7px', color: B.text, fontSize: '12px', fontFamily: B.fontUI, cursor: 'pointer', outline: 'none' }}>
                      <option value="all">All</option>
                      {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <button onClick={exportCSV}
                      style={{ marginLeft: 'auto', padding: '6px 14px', borderRadius: '7px', border: `1px solid ${B.border}`, background: 'transparent', color: B.gold, fontSize: '11px', cursor: 'pointer', fontFamily: B.fontUI }}>
                      Export CSV ↓
                    </button>
                  </div>

                  {regsLoading ? (
                    <p style={{ fontFamily: B.fontMono, fontSize: '11px', color: B.muted }}>Loading…</p>
                  ) : filteredRegs.length === 0 ? (
                    <p style={{ fontSize: '13px', color: B.muted }}>No registrations yet.</p>
                  ) : (
                    <div style={{ overflowX: 'auto', marginBottom: '24px' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '700px' }}>
                        <thead>
                          <tr style={{ borderBottom: `1px solid ${B.border}` }}>
                            {['Name','Email','WhatsApp','Country','Status','Ticket','Registered',''].map(h => (
                              <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontFamily: B.fontMono, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.07em', color: B.muted, fontWeight: 500 }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {filteredRegs.map(r => (
                            <>
                              <tr key={r.id} style={{ borderBottom: `1px solid ${B.border}` }}>
                                <td style={{ padding: '10px 12px', color: B.text, fontSize: '13px' }}>{r.full_name}</td>
                                <td style={{ padding: '10px 12px', fontFamily: B.fontMono, fontSize: '11px', color: B.muted }}>{r.email}</td>
                                <td style={{ padding: '10px 12px', fontFamily: B.fontMono, fontSize: '11px', color: B.muted }}>{r.whatsapp || '—'}</td>
                                <td style={{ padding: '10px 12px', fontSize: '12px', color: B.muted }}>{r.country || '—'}</td>
                                <td style={{ padding: '10px 12px' }}>
                                  <select value={r.status} onChange={e => updateRegField(r.id, { status: e.target.value })}
                                    style={{ padding: '3px 8px', borderRadius: '5px', border: 'none', background: 'rgba(200,169,110,0.15)', color: B.gold, fontSize: '11px', cursor: 'pointer', fontFamily: B.fontUI }}>
                                    {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                                  </select>
                                </td>
                                <td style={{ padding: '10px 12px' }}>
                                  <select value={r.ticket_type || ''} onChange={e => updateRegField(r.id, { ticket_type: e.target.value || null })}
                                    style={{ padding: '3px 8px', borderRadius: '5px', border: `1px solid ${B.border}`, background: B.bg, color: B.muted, fontSize: '11px', cursor: 'pointer', fontFamily: B.fontUI }}>
                                    <option value="">— type —</option>
                                    {['general','vip','speaker','partner','press'].map(t => <option key={t} value={t}>{t}</option>)}
                                  </select>
                                </td>
                                <td style={{ padding: '10px 12px', fontFamily: B.fontMono, fontSize: '10px', color: B.dim }}>
                                  {new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                </td>
                                <td style={{ padding: '10px 12px' }}>
                                  <button onClick={() => setExpandedRegId(expandedRegId === r.id ? null : r.id)}
                                    style={{ padding: '3px 10px', borderRadius: '5px', border: `1px solid ${B.border}`, background: 'transparent', color: B.gold, fontSize: '11px', cursor: 'pointer', fontFamily: B.fontUI }}>
                                    {expandedRegId === r.id ? 'Close' : 'Details'}
                                  </button>
                                </td>
                              </tr>
                              {expandedRegId === r.id && (
                                <tr key={`${r.id}-detail`} style={{ borderBottom: `1px solid ${B.border}`, background: 'rgba(200,169,110,0.03)' }}>
                                  <td colSpan={8} style={{ padding: '16px 20px' }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: '16px' }}>
                                      <div>
                                        {[['City', r.city],['Role', r.current_role],['Org', r.organisation],['Industry', r.industry],['Heard via', r.how_heard]].filter(([,v])=>v).map(([k,v]) => (
                                          <p key={k as string} style={{ margin: '0 0 4px', fontSize: '12px', color: B.muted }}><span style={{ color: B.dim, fontFamily: B.fontMono, fontSize: '10px' }}>{k}: </span>{v}</p>
                                        ))}
                                      </div>
                                      <div>
                                        {r.what_building && <><p style={{ margin: '0 0 3px', fontFamily: B.fontMono, fontSize: '10px', color: B.dim }}>What building</p><p style={{ margin: '0 0 10px', fontSize: '12px', color: B.muted, lineHeight: 1.6 }}>{r.what_building}</p></>}
                                        {r.why_attend && <><p style={{ margin: '0 0 3px', fontFamily: B.fontMono, fontSize: '10px', color: B.dim }}>Why attend</p><p style={{ margin: 0, fontSize: '12px', color: B.muted, lineHeight: 1.6 }}>{r.why_attend}</p></>}
                                      </div>
                                      <div>
                                        {[['Dietary', r.dietary_needs],['Accessibility', r.accessibility]].filter(([,v])=>v).map(([k,v]) => (
                                          <p key={k as string} style={{ margin: '0 0 4px', fontSize: '12px', color: B.muted }}><span style={{ color: B.dim, fontFamily: B.fontMono, fontSize: '10px' }}>{k}: </span>{v}</p>
                                        ))}
                                        <p style={{ fontFamily: B.fontMono, fontSize: '10px', color: B.gold, margin: '12px 0 6px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Notes</p>
                                        <textarea value={localNotes[r.id] ?? ''} onChange={e => setLocalNotes(n => ({ ...n, [r.id]: e.target.value }))} rows={2}
                                          style={{ width: '100%', resize: 'vertical', padding: '6px 8px', background: B.bg, border: `1px solid ${B.border}`, borderRadius: '6px', color: B.text, fontSize: '12px', fontFamily: B.fontUI, outline: 'none', boxSizing: 'border-box' }} />
                                        <button onClick={() => saveRegNotes(r.id)} disabled={savingRegId === r.id}
                                          style={{ marginTop: '5px', padding: '4px 10px', borderRadius: '5px', border: `1px solid ${B.border}`, background: 'transparent', color: B.gold, fontSize: '11px', cursor: 'pointer', fontFamily: B.fontUI }}>
                                          {savingRegId === r.id ? 'Saving…' : 'Save'}
                                        </button>
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Email blast */}
                  <div style={{ background: B.bg, border: `1px solid ${B.border}`, borderRadius: '10px', padding: '18px' }}>
                    <p style={{ fontFamily: B.fontMono, fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', color: B.gold, margin: '0 0 4px' }}>Email Registrants</p>
                    <p style={{ fontSize: '12px', color: B.muted, margin: '0 0 12px' }}>
                      Use <code style={{ fontFamily: B.fontMono, background: 'rgba(255,255,255,0.06)', padding: '1px 5px', borderRadius: 3 }}>{'{name}'}</code> to personalise.
                    </p>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap' }}>
                      <span style={{ fontFamily: B.fontMono, fontSize: '11px', color: B.muted }}>Send to:</span>
                      <select value={emailStatus} onChange={e => setEmailStatus(e.target.value)}
                        style={{ padding: '5px 10px', background: B.card, border: `1px solid ${B.border}`, borderRadius: '6px', color: B.text, fontSize: '12px', fontFamily: B.fontUI, cursor: 'pointer', outline: 'none' }}>
                        {STATUSES.map(s => <option key={s} value={s}>{s} ({regs.filter(r => r.status === s).length})</option>)}
                      </select>
                    </div>
                    <input placeholder="Subject" value={emailSubject} onChange={e => setEmailSubject(e.target.value)}
                      style={{ display: 'block', width: '100%', marginBottom: '8px', padding: '8px 12px', background: B.card, border: `1px solid ${B.border}`, borderRadius: '7px', color: B.text, fontSize: '13px', fontFamily: B.fontUI, outline: 'none', boxSizing: 'border-box' }} />
                    <textarea placeholder={`Hi {name},\n\nA note about the event…`} rows={4} value={emailMessage} onChange={e => setEmailMessage(e.target.value)}
                      style={{ display: 'block', width: '100%', marginBottom: '10px', padding: '8px 12px', background: B.card, border: `1px solid ${B.border}`, borderRadius: '7px', color: B.text, fontSize: '13px', fontFamily: B.fontUI, outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} />
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <button onClick={handleEmailBlast} disabled={emailSending || !emailSubject.trim() || !emailMessage.trim()}
                        style={{ padding: '8px 18px', background: B.gold, border: 'none', borderRadius: '7px', color: '#0F0F0E', fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: B.fontUI, opacity: emailSending ? 0.7 : 1 }}>
                        {emailSending ? 'Sending…' : `Send to ${regs.filter(r => r.status === emailStatus).length} registrant${regs.filter(r => r.status === emailStatus).length !== 1 ? 's' : ''}`}
                      </button>
                      {emailResult && <span style={{ fontFamily: B.fontMono, fontSize: '11px', color: emailResult.startsWith('✓') ? B.success : B.error }}>{emailResult}</span>}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
