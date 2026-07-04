'use client';
export const dynamic = 'force-dynamic';

// app/admin/summit/page.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Admin management page for Elevation Summit registrations.
//
// Features:
//   - Table of all registrants with all fields
//   - Filter by status + search by name/email/country
//   - Inline status update (pending → confirmed / waitlist / declined / cancelled)
//   - Ticket type assignment (general / vip / speaker / partner / press)
//   - Internal notes per registrant
//   - Expand row to see full registration details
//   - Email all registrants (or filtered subset) via /api/summit/notify
//   - CSV export
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';

const supabase = createClient();

const STATUS_COLORS: Record<string, { color: string; bg: string }> = {
  pending:   { color: '#92400E', bg: '#FEF3C7' },
  confirmed: { color: '#065F46', bg: '#D1FAE5' },
  waitlist:  { color: '#1E3A8A', bg: '#DBEAFE' },
  declined:  { color: '#7F1D1D', bg: '#FEE2E2' },
  cancelled: { color: '#374151', bg: '#F3F4F6' },
};

const STATUSES = ['pending', 'confirmed', 'waitlist', 'declined', 'cancelled'];
const TICKET_TYPES = ['general', 'vip', 'speaker', 'partner', 'press'];

const B = {
  bg:       '#0F0F0E',
  card:     '#161614',
  border:   'rgba(255,255,255,0.08)',
  gold:     '#C8A96E',
  text:     '#FAFAF8',
  muted:    '#6B7280',
  dim:      '#4B5563',
  fontUI:   "'Syne', 'Plus Jakarta Sans', sans-serif",
  fontMono: "'DM Mono', 'Courier New', monospace",
};

type Reg = {
  id: string;
  user_id: string | null;
  source: string | null;
  full_name: string;
  email: string;
  whatsapp: string;
  phone: string | null;
  country: string;
  city: string | null;
  current_role: string | null;
  organisation: string | null;
  industry: string | null;
  what_building: string | null;
  why_attend: string | null;
  how_heard: string | null;
  dietary_needs: string | null;
  accessibility: string | null;
  status: string;
  ticket_type: string | null;
  notes: string | null;
  confirmed_at: string | null;
  created_at: string;
};

export default function AdminSummitPage() {
  const [regs, setRegs] = useState<Reg[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [localNotes, setLocalNotes] = useState<Record<string, string>>({});

  // Email blast state
  const [emailSubject, setEmailSubject] = useState('');
  const [emailMessage, setEmailMessage] = useState('');
  const [emailSending, setEmailSending] = useState(false);
  const [emailResult, setEmailResult] = useState<string | null>(null);
  const [emailTargetStatus, setEmailTargetStatus] = useState('confirmed');

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from('summit_registrations')
      .select('*')
      .order('created_at', { ascending: false });
    setRegs(data || []);
    const notes: Record<string, string> = {};
    (data || []).forEach((r: Reg) => { notes[r.id] = r.notes || ''; });
    setLocalNotes(notes);
    setLoading(false);
  }

  const filtered = useMemo(() => regs.filter(r => {
    const matchStatus = filterStatus === 'all' || r.status === filterStatus;
    const q = search.toLowerCase();
    const matchSearch = !q ||
      r.full_name.toLowerCase().includes(q) ||
      r.email.toLowerCase().includes(q) ||
      r.country.toLowerCase().includes(q) ||
      (r.organisation || '').toLowerCase().includes(q);
    return matchStatus && matchSearch;
  }), [regs, filterStatus, search]);

  async function updateField(id: string, updates: Partial<Reg>) {
    setSavingId(id);
    await supabase.from('summit_registrations').update({
      ...updates,
      updated_at: new Date().toISOString(),
      ...(updates.status === 'confirmed' ? { confirmed_at: new Date().toISOString() } : {}),
    }).eq('id', id);
    setRegs(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r));
    setSavingId(null);
  }

  async function saveNotes(id: string) {
    setSavingId(id);
    await supabase.from('summit_registrations').update({ notes: localNotes[id] || null }).eq('id', id);
    setRegs(prev => prev.map(r => r.id === id ? { ...r, notes: localNotes[id] } : r));
    setSavingId(null);
  }

  async function handleEmailBlast() {
    if (!emailSubject.trim() || !emailMessage.trim()) return;
    setEmailSending(true);
    setEmailResult(null);
    try {
      const res = await fetch('/api/summit/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: emailTargetStatus, subject: emailSubject, message: emailMessage }),
      });
      const data = await res.json();
      if (res.ok) {
        setEmailResult(`✓ Sent to ${data.sent} registrant${data.sent !== 1 ? 's' : ''}${data.failed > 0 ? ` (${data.failed} failed)` : ''}`);
        setEmailSubject(''); setEmailMessage('');
      } else {
        setEmailResult(`✗ ${data.error || 'Send failed'}`);
      }
    } catch (err: any) {
      setEmailResult(`✗ ${err.message}`);
    } finally {
      setEmailSending(false);
    }
  }

  function exportCSV() {
    const cols = ['full_name','email','whatsapp','phone','country','city','current_role','organisation',
      'industry','status','ticket_type','what_building','why_attend','how_heard',
      'dietary_needs','accessibility','notes','created_at'];
    const rows = filtered.map(r =>
      cols.map(c => JSON.stringify((r as any)[c] ?? '')).join(',')
    );
    const csv = [cols.join(','), ...rows].join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `summit-registrations-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
  }

  const stats = useMemo(() => ({
    total:     regs.length,
    confirmed: regs.filter(r => r.status === 'confirmed').length,
    pending:   regs.filter(r => r.status === 'pending').length,
    waitlist:  regs.filter(r => r.status === 'waitlist').length,
  }), [regs]);

  return (
    <div style={{ padding: '32px', fontFamily: B.fontUI }}>

      {/* Header */}
      <div style={{ marginBottom: '28px' }}>
        <p style={{ fontFamily: B.fontMono, fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: B.gold, margin: '0 0 6px' }}>
          Events · The Elevation Summit
        </p>
        <h1 style={{ margin: 0, fontSize: '26px', fontWeight: 700, color: B.text }}>Registrations</h1>
      </div>

      {/* Stat tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginBottom: '28px' }}>
        {[
          { label: 'Total', value: stats.total },
          { label: 'Confirmed', value: stats.confirmed },
          { label: 'Pending', value: stats.pending },
          { label: 'Waitlist', value: stats.waitlist },
        ].map(s => (
          <div key={s.label} style={{ background: B.card, border: `1px solid ${B.border}`, borderRadius: '10px', padding: '16px 20px' }}>
            <p style={{ margin: '0 0 4px', fontFamily: B.fontMono, fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', color: B.muted }}>{s.label}</p>
            <p style={{ margin: 0, fontSize: '28px', fontWeight: 700, color: B.text }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters + actions */}
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '20px', alignItems: 'center' }}>
        <input
          placeholder="Search name, email, country, org…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ padding: '8px 14px', background: B.card, border: `1px solid ${B.border}`, borderRadius: '8px', color: B.text, fontSize: '13px', fontFamily: B.fontUI, width: '260px', outline: 'none' }}
        />
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          style={{ padding: '8px 14px', background: B.card, border: `1px solid ${B.border}`, borderRadius: '8px', color: B.text, fontSize: '13px', fontFamily: B.fontUI, cursor: 'pointer', outline: 'none' }}
        >
          <option value="all">All statuses</option>
          {STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
        </select>
        <span style={{ fontFamily: B.fontMono, fontSize: '11px', color: B.muted }}>
          {filtered.length} of {regs.length}
        </span>
        <button
          onClick={exportCSV}
          style={{ marginLeft: 'auto', padding: '8px 16px', background: 'transparent', border: `1px solid ${B.border}`, borderRadius: '8px', color: B.gold, fontSize: '12px', fontFamily: B.fontUI, cursor: 'pointer', fontWeight: 600 }}
        >
          Export CSV ↓
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <p style={{ color: B.muted, fontFamily: B.fontMono, fontSize: '12px' }}>Loading…</p>
      ) : filtered.length === 0 ? (
        <p style={{ color: B.muted, fontFamily: B.fontUI, fontSize: '14px' }}>No registrations match your filters.</p>
      ) : (
        <div style={{ background: B.card, border: `1px solid ${B.border}`, borderRadius: '12px', overflow: 'hidden', marginBottom: '32px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${B.border}` }}>
                {['Name', 'Email', 'WhatsApp', 'Country', 'Role / Org', 'Status', 'Ticket', 'Registered', ''].map(h => (
                  <th key={h} style={{ padding: '12px 14px', textAlign: 'left', fontFamily: B.fontMono, fontSize: '10px', letterSpacing: '0.08em', textTransform: 'uppercase', color: B.muted, fontWeight: 500, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => {
                const sc = STATUS_COLORS[r.status] || STATUS_COLORS.pending;
                const isExpanded = expandedId === r.id;
                return (
                  <>
                    <tr key={r.id} style={{ borderBottom: `1px solid ${B.border}`, background: isExpanded ? 'rgba(200,169,110,0.04)' : 'transparent' }}>
                      <td style={{ padding: '12px 14px', color: B.text, fontSize: '13px', whiteSpace: 'nowrap' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {r.full_name}
                          {r.source === 'app' && (
                            <span style={{
                              fontFamily: B.fontMono, fontSize: '9px', fontWeight: 600,
                              letterSpacing: '0.06em', textTransform: 'uppercase',
                              padding: '1px 6px', borderRadius: '999px',
                              background: 'rgba(139,92,246,0.12)',
                              border: '1px solid rgba(139,92,246,0.3)',
                              color: '#8B5CF6', flexShrink: 0,
                            }}>
                              App
                            </span>
                          )}
                        </span>
                      </td>
                      <td style={{ padding: '12px 14px', fontFamily: B.fontMono, fontSize: '11px', color: B.muted }}>{r.email}</td>
                      <td style={{ padding: '12px 14px', fontFamily: B.fontMono, fontSize: '11px', color: B.muted }}>{r.whatsapp}</td>
                      <td style={{ padding: '12px 14px', fontSize: '12px', color: B.muted }}>{r.city ? `${r.city}, ` : ''}{r.country}</td>
                      <td style={{ padding: '12px 14px', fontSize: '12px', color: B.muted, maxWidth: '160px' }}>
                        {[r.current_role, r.organisation].filter(Boolean).join(' · ') || '—'}
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <select
                          value={r.status}
                          onChange={e => updateField(r.id, { status: e.target.value })}
                          style={{ padding: '4px 8px', borderRadius: '6px', border: 'none', background: sc.bg, color: sc.color, fontSize: '11px', fontWeight: 600, cursor: 'pointer', fontFamily: B.fontUI }}
                        >
                          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <select
                          value={r.ticket_type || ''}
                          onChange={e => updateField(r.id, { ticket_type: e.target.value || null })}
                          style={{ padding: '4px 8px', borderRadius: '6px', border: `1px solid ${B.border}`, background: B.bg, color: B.muted, fontSize: '11px', cursor: 'pointer', fontFamily: B.fontUI }}
                        >
                          <option value="">— type —</option>
                          {TICKET_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </td>
                      <td style={{ padding: '12px 14px', fontFamily: B.fontMono, fontSize: '10px', color: B.dim, whiteSpace: 'nowrap' }}>
                        {new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : r.id)}
                          style={{ padding: '4px 10px', borderRadius: '6px', border: `1px solid ${B.border}`, background: 'transparent', color: B.gold, fontSize: '11px', cursor: 'pointer', fontFamily: B.fontUI }}
                        >
                          {isExpanded ? 'Close' : 'Details'}
                        </button>
                      </td>
                    </tr>

                    {/* Expanded detail row */}
                    {isExpanded && (
                      <tr key={`${r.id}-detail`} style={{ borderBottom: `1px solid ${B.border}`, background: 'rgba(200,169,110,0.03)' }}>
                        <td colSpan={9} style={{ padding: '20px 24px' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px' }}>

                            {/* Source / App user indicator */}
                            {r.source === 'app' && (
                              <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', borderRadius: '8px', background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)', marginBottom: '4px' }}>
                                <span style={{ fontFamily: B.fontMono, fontSize: '10px', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#8B5CF6' }}>Registered via Ascentor App</span>
                                {r.user_id && <span style={{ fontFamily: B.fontMono, fontSize: '10px', color: B.dim }}>user_id: {r.user_id}</span>}
                              </div>
                            )}

                            {/* Contact */}
                            <div>
                              <p style={{ fontFamily: B.fontMono, fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', color: B.gold, margin: '0 0 10px' }}>Contact</p>
                              {[
                                ['Email', r.email],
                                ['WhatsApp', r.whatsapp],
                                ['Phone', r.phone],
                                ['Country', r.country],
                                ['City', r.city],
                              ].filter(([, v]) => v).map(([k, v]) => (
                                <p key={k as string} style={{ margin: '0 0 5px', fontSize: '12px', color: B.muted }}>
                                  <span style={{ color: B.dim, fontFamily: B.fontMono, fontSize: '10px' }}>{k}: </span>{v}
                                </p>
                              ))}
                            </div>

                            {/* Professional */}
                            <div>
                              <p style={{ fontFamily: B.fontMono, fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', color: B.gold, margin: '0 0 10px' }}>Professional</p>
                              {[
                                ['Role', r.current_role],
                                ['Org', r.organisation],
                                ['Industry', r.industry],
                                ['Heard via', r.how_heard],
                              ].filter(([, v]) => v).map(([k, v]) => (
                                <p key={k as string} style={{ margin: '0 0 5px', fontSize: '12px', color: B.muted }}>
                                  <span style={{ color: B.dim, fontFamily: B.fontMono, fontSize: '10px' }}>{k}: </span>{v}
                                </p>
                              ))}
                            </div>

                            {/* Intent */}
                            <div>
                              <p style={{ fontFamily: B.fontMono, fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', color: B.gold, margin: '0 0 10px' }}>Intent</p>
                              {r.what_building && (
                                <div style={{ marginBottom: '10px' }}>
                                  <p style={{ margin: '0 0 3px', fontFamily: B.fontMono, fontSize: '10px', color: B.dim }}>What building</p>
                                  <p style={{ margin: 0, fontSize: '12px', color: B.muted, lineHeight: 1.6 }}>{r.what_building}</p>
                                </div>
                              )}
                              {r.why_attend && (
                                <div>
                                  <p style={{ margin: '0 0 3px', fontFamily: B.fontMono, fontSize: '10px', color: B.dim }}>Why attend</p>
                                  <p style={{ margin: 0, fontSize: '12px', color: B.muted, lineHeight: 1.6 }}>{r.why_attend}</p>
                                </div>
                              )}
                            </div>

                            {/* Logistics + Notes */}
                            <div>
                              <p style={{ fontFamily: B.fontMono, fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', color: B.gold, margin: '0 0 10px' }}>Logistics</p>
                              {[
                                ['Dietary', r.dietary_needs],
                                ['Accessibility', r.accessibility],
                              ].filter(([, v]) => v).map(([k, v]) => (
                                <p key={k as string} style={{ margin: '0 0 5px', fontSize: '12px', color: B.muted }}>
                                  <span style={{ color: B.dim, fontFamily: B.fontMono, fontSize: '10px' }}>{k}: </span>{v}
                                </p>
                              ))}

                              <p style={{ fontFamily: B.fontMono, fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', color: B.gold, margin: '16px 0 8px' }}>Internal Notes</p>
                              <textarea
                                value={localNotes[r.id] ?? ''}
                                onChange={e => setLocalNotes(n => ({ ...n, [r.id]: e.target.value }))}
                                rows={3}
                                placeholder="Private notes…"
                                style={{ width: '100%', resize: 'vertical', padding: '8px 10px', background: B.bg, border: `1px solid ${B.border}`, borderRadius: '7px', color: B.text, fontSize: '12px', fontFamily: B.fontUI, outline: 'none', boxSizing: 'border-box' as const }}
                              />
                              <button
                                onClick={() => saveNotes(r.id)}
                                disabled={savingId === r.id}
                                style={{ marginTop: '6px', padding: '5px 12px', borderRadius: '6px', border: `1px solid ${B.border}`, background: 'transparent', color: B.gold, fontSize: '11px', cursor: 'pointer', fontFamily: B.fontUI }}
                              >
                                {savingId === r.id ? 'Saving…' : 'Save notes'}
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Email blast panel */}
      <div style={{ background: B.card, border: `1px solid ${B.border}`, borderRadius: '12px', padding: '24px' }}>
        <p style={{ fontFamily: B.fontMono, fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: B.gold, margin: '0 0 4px' }}>Email Registrants</p>
        <p style={{ fontSize: '12px', color: B.muted, margin: '0 0 16px' }}>
          Send a message to all registrants with a given status. Use <code style={{ fontFamily: B.fontMono, background: 'rgba(255,255,255,0.06)', padding: '1px 5px', borderRadius: 4 }}>{'{name}'}</code> to personalise.
        </p>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '12px', alignItems: 'center' }}>
          <label style={{ fontFamily: B.fontMono, fontSize: '11px', color: B.muted }}>Send to:</label>
          <select
            value={emailTargetStatus}
            onChange={e => setEmailTargetStatus(e.target.value)}
            style={{ padding: '7px 12px', background: B.bg, border: `1px solid ${B.border}`, borderRadius: '7px', color: B.text, fontSize: '12px', fontFamily: B.fontUI, cursor: 'pointer', outline: 'none' }}
          >
            {STATUSES.map(s => (
              <option key={s} value={s}>
                {s.charAt(0).toUpperCase() + s.slice(1)} ({regs.filter(r => r.status === s).length})
              </option>
            ))}
          </select>
        </div>

        <input
          placeholder="Subject line"
          value={emailSubject}
          onChange={e => setEmailSubject(e.target.value)}
          style={{ display: 'block', width: '100%', marginBottom: '10px', padding: '9px 14px', background: B.bg, border: `1px solid ${B.border}`, borderRadius: '8px', color: B.text, fontSize: '13px', fontFamily: B.fontUI, outline: 'none', boxSizing: 'border-box' as const }}
        />
        <textarea
          placeholder={`Hi {name},\n\nThis is a message from the Ascentor team about The Elevation Summit…`}
          value={emailMessage}
          onChange={e => setEmailMessage(e.target.value)}
          rows={5}
          style={{ display: 'block', width: '100%', marginBottom: '12px', padding: '9px 14px', background: B.bg, border: `1px solid ${B.border}`, borderRadius: '8px', color: B.text, fontSize: '13px', fontFamily: B.fontUI, outline: 'none', resize: 'vertical', boxSizing: 'border-box' as const }}
        />

        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <button
            onClick={handleEmailBlast}
            disabled={emailSending || !emailSubject.trim() || !emailMessage.trim()}
            style={{ padding: '9px 20px', background: B.gold, border: 'none', borderRadius: '8px', color: '#0F0F0E', fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: B.fontUI, opacity: emailSending ? 0.7 : 1 }}
          >
            {emailSending ? 'Sending…' : `Send to ${regs.filter(r => r.status === emailTargetStatus).length} registrant${regs.filter(r => r.status === emailTargetStatus).length !== 1 ? 's' : ''}`}
          </button>
          {emailResult && (
            <span style={{ fontFamily: B.fontMono, fontSize: '11px', color: emailResult.startsWith('✓') ? '#10B981' : '#EF4444' }}>
              {emailResult}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
