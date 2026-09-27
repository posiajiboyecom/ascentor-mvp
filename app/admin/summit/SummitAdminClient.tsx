'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { SummitRegistration } from '@/database/database';
import { useModal } from '@/components/Modal';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

const B = {
  bg:       '#0F0F0E',
  card:     '#161614',
  border:   'rgba(255,255,255,0.08)',
  gold:     '#C8A96E',
  text:     '#FAFAF8',
  muted:    '#6B7280',
  dim:      '#4B5563',
  fontUI:   "'Metropolis', 'Plus Jakarta Sans', sans-serif",
  fontMono: "Metropolis, 'Inter', sans-serif",
};

// Email-blast audiences. "confirmed" = PAID (enforced server-side), "pending" = registered but unpaid.
const AUDIENCES: { value: string; label: string }[] = [
  { value: 'confirmed', label: 'Paid' },
  { value: 'pending', label: 'Not yet paid' },
];
const TICKET_TYPES = ['general', 'vip', 'speaker', 'partner', 'press'];

type PaymentState = 'paid' | 'in_progress' | 'abandoned' | 'not_started';
type Reg = SummitRegistration & {
  payment_state: PaymentState;
  attempt_count: number;
  attendance_type?: string | null;
  paystack_fee?: number | null;
  confirmation_email_sent_at?: string | null;
  confirmation_email_error?: string | null;
};

const STATE_META: Record<PaymentState, { label: string; color: string; bg: string }> = {
  paid:        { label: 'Paid',                 color: '#065F46', bg: '#D1FAE5' },
  in_progress: { label: 'Paying now',           color: '#1E40AF', bg: '#DBEAFE' },
  abandoned:   { label: 'Abandoned payment',    color: '#991B1B', bg: '#FEE2E2' },
  not_started: { label: 'Registered, not paid', color: '#92400E', bg: '#FEF3C7' },
};

// Paystack local card fee: 1.5% (+₦100 when the amount is ₦2,500 or more), capped at ₦2,000.
// Used only when Paystack's real fee was not stored for a payment.
function estimateFee(amount: number): number {
  if (!amount) return 0;
  return Math.min(amount * 0.015 + (amount >= 2500 ? 100 : 0), 2000);
}
const feeOf = (r: Reg) => (r.paystack_fee != null ? Number(r.paystack_fee) : estimateFee(Number(r.amount_paid ?? 0)));
const naira = (n: number) => `₦${Math.round(n).toLocaleString('en-NG')}`;
// A "paid" registration with no amount on file is a complimentary ticket the
// admin issued directly (see the "Send ticket" action), not a real payment.
const isComp = (r: Reg) => r.payment_state === 'paid' && !Number(r.amount_paid);

export default function SummitAdminClient() {
  const supabase = createClient();
  const { confirm } = useModal();
  const [regs, setRegs] = useState<Reg[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [localNotes, setLocalNotes] = useState<Record<string, string>>({});

  const [emailSubject, setEmailSubject] = useState('');
  const [emailMessage, setEmailMessage] = useState('');
  const [emailTargetStatus, setEmailTargetStatus] = useState('confirmed');
  const [emailSending, setEmailSending] = useState(false);
  const [emailResult, setEmailResult] = useState<string | null>(null);

  function formatAmount(amount: number | null, currency: string | null) {
    if (!amount) return '—';
    const symbol = currency === 'NGN' ? '₦' : `${currency || ''} `;
    return `${symbol}${Number(amount).toLocaleString()}`;
  }

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) { setLoading(false); return; }
      const res = await fetch('/api/admin/summit-registrations', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to load registrations');
        setLoading(false);
        return;
      }
      const list: Reg[] = data.registrations || [];
      setRegs(list);
      const notes: Record<string, string> = {};
      list.forEach((r) => { notes[r.id] = r.notes || ''; });
      setLocalNotes(notes);
    } catch (err) {
      setError('Failed to load registrations');
      console.error(err);
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    return regs.filter((r) => {
      const matchStatus = filterStatus === 'all' || r.payment_state === filterStatus;
      const matchType = filterType === 'all' || (r.attendance_type ?? 'onsite') === filterType;
      const q = search.toLowerCase();
      const matchSearch = !q ||
        r.full_name.toLowerCase().includes(q) ||
        r.email.toLowerCase().includes(q) ||
        (r.whatsapp || '').toLowerCase().includes(q) ||
        r.location.toLowerCase().includes(q) ||
        (r.organisation || '').toLowerCase().includes(q);
      return matchStatus && matchType && matchSearch;
    });
  }, [regs, filterStatus, filterType, search]);

  async function authedFetch(method: string, body: unknown) {
    const { data: { session } } = await supabase.auth.getSession();
    return fetch('/api/admin/summit-registrations', {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token ?? ''}` },
      body: JSON.stringify(body),
    });
  }

  async function updateField(id: string, updates: Partial<Reg>) {
    setSavingId(id);
    const res = await authedFetch('PATCH', { id, ...updates });
    if (res.ok) setRegs((prev) => prev.map((r) => r.id === id ? { ...r, ...updates } : r));
    else setActionMsg('Save failed. Nothing was changed.');
    setSavingId(null);
  }

  async function saveNotes(id: string) {
    setSavingId(id);
    const res = await authedFetch('PATCH', { id, notes: localNotes[id] || null });
    if (res.ok) setRegs((prev) => prev.map((r) => r.id === id ? { ...r, notes: localNotes[id] } : r));
    else setActionMsg('Could not save notes.');
    setSavingId(null);
  }

  async function runAction(id: string, action: 'verify' | 'resend' | 'comp') {
    if (action === 'comp') {
      const ok = await confirm('Send a free ticket to this person without taking payment?', 'Issue Complimentary Ticket');
      if (!ok) return;
    }
    setBusyId(id);
    setActionMsg(null);
    try {
      const res = await authedFetch('POST', { id, action });
      const data = await res.json().catch(() => ({}));
      setActionMsg(data.message || data.error || (res.ok ? 'Done.' : 'Action failed.'));
      if (action === 'verify' || action === 'comp') await load();
    } catch {
      setActionMsg('Action failed.');
    }
    setBusyId(null);
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
        setEmailResult(`Sent to ${data.sent} registrant${data.sent !== 1 ? 's' : ''}${data.failed > 0 ? ` (${data.failed} failed)` : ''}`);
        setEmailSubject('');
        setEmailMessage('');
      } else {
        setEmailResult(`${data.error || 'Send failed'}`);
      }
    } catch (err: any) {
      setEmailResult(`${err.message}`);
    }
    setEmailSending(false);
  }

  function exportCSV() {
    const cols = ['full_name','email','whatsapp','attendance_type','location','organisation','current_role','payment_state','amount_paid','paystack_fee','currency','paid_at','payment_reference','ticket_type','other_messages','consent','notes','created_at'];
    const rows = filtered.map((r) =>
      cols.map((c) => JSON.stringify(c === 'paystack_fee' ? (r.payment_state === 'paid' ? Math.round(feeOf(r)) : '') : ((r as any)[c] ?? ''))).join(',')
    );
    const csv = [cols.join(','), ...rows].join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `summit-registrations-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  }

  function exportToPdf() {
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFontSize(14);
    doc.text('Elevation Summit Registrations', 14, 15);
    doc.setFontSize(9);
    doc.text(`Generated ${new Date().toLocaleString()}`, 14, 21);

    autoTable(doc, {
      startY: 26,
      head: [['Name', 'Email', 'Phone', 'Type', 'Location', 'Company', 'Role', 'Payment', 'Amount', 'Paid At']],
      body: filtered.map((r) => [
        r.full_name,
        r.email,
        r.whatsapp,
        r.attendance_type === 'virtual' ? 'Virtual' : 'Physical',
        r.location,
        r.organisation,
        r.current_role,
        STATE_META[r.payment_state].label,
        formatAmount(r.amount_paid, r.currency),
        r.paid_at ? new Date(r.paid_at).toLocaleDateString() : '',
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [30, 30, 30] },
    });

    doc.save(`summit-registrations-${new Date().toISOString().slice(0, 10)}.pdf`);
  }

  function exportToExcel() {
    const data = filtered.map((r) => ({
      'Full Name': r.full_name,
      'Email': r.email,
      'Phone': r.whatsapp,
      'Attendance': r.attendance_type === 'virtual' ? 'Virtual' : 'Physical',
      'Location': r.location,
      'Company': r.organisation,
      'Role': r.current_role,
      'Payment': STATE_META[r.payment_state].label,
      'Amount Paid': r.amount_paid ?? '',
      'Paystack Fee': r.payment_state === 'paid' ? Math.round(feeOf(r)) : '',
      'Net': r.payment_state === 'paid' ? Math.round(Number(r.amount_paid ?? 0) - feeOf(r)) : '',
      'Currency': r.currency,
      'Paid At': r.paid_at ?? '',
      'Consent': r.consent ? 'Yes' : 'No',
      'Other Messages': r.other_messages ?? '',
      'Notes': r.notes ?? '',
      'Created At': r.created_at,
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Registrations');
    XLSX.writeFile(workbook, `summit-registrations-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  const stats = useMemo(() => {
    const paid = regs.filter((r) => r.payment_state === 'paid');
    const gross = paid.reduce((t, r) => t + Number(r.amount_paid ?? 0), 0);
    const fees = paid.reduce((t, r) => t + feeOf(r), 0);
    return {
      total: regs.length,
      paid: paid.length,
      unpaid: regs.length - paid.length,
      abandoned: regs.filter((r) => r.payment_state === 'abandoned').length,
      onsite: paid.filter((r) => (r.attendance_type ?? 'onsite') !== 'virtual').length,
      virtual: paid.filter((r) => r.attendance_type === 'virtual').length,
      gross, fees, net: gross - fees,
    };
  }, [regs]);

  return (
    <div style={{ padding: '32px', fontFamily: B.fontUI }}>
      <div style={{ marginBottom: '28px' }}>
        <p style={{ fontFamily: B.fontMono, fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: B.gold, margin: '0 0 6px' }}>
          Events · The Elevation Summit
        </p>
        <h1 style={{ margin: 0, fontSize: '26px', fontWeight: 700, color: B.text }}>Registrations</h1>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginBottom: '28px' }}>
        {[
          { label: 'Registered', value: stats.total },
          { label: 'Paid', value: stats.paid },
          { label: 'Not paid', value: stats.unpaid },
          { label: 'Abandoned', value: stats.abandoned },
          { label: 'Physical / Virtual', value: `${stats.onsite} / ${stats.virtual}` },
          { label: 'Gross revenue', value: naira(stats.gross) },
          { label: 'Paystack fees', value: naira(stats.fees) },
          { label: 'Net revenue', value: naira(stats.net) },
        ].map((s) => (
          <div key={s.label} style={{ background: B.card, border: `1px solid ${B.border}`, borderRadius: '10px', padding: '16px 20px' }}>
            <p style={{ margin: '0 0 4px', fontFamily: B.fontMono, fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', color: B.muted }}>{s.label}</p>
            <p style={{ margin: 0, fontSize: '24px', fontWeight: 700, color: B.text }}>{s.value}</p>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '20px', alignItems: 'center' }}>
        <input
          placeholder="Search name, email, location, org…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ padding: '8px 14px', background: B.card, border: `1px solid ${B.border}`, borderRadius: '8px', color: B.text, fontSize: '13px', fontFamily: B.fontUI, width: '260px', outline: 'none' }}
        />
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          style={{ padding: '8px 14px', background: B.card, border: `1px solid ${B.border}`, borderRadius: '8px', color: B.text, fontSize: '13px', fontFamily: B.fontUI, cursor: 'pointer', outline: 'none' }}
        >
          <option value="all">All payment states</option>
          {(Object.keys(STATE_META) as PaymentState[]).map((k) => <option key={k} value={k}>{STATE_META[k].label}</option>)}
        </select>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          style={{ padding: '8px 14px', background: B.card, border: `1px solid ${B.border}`, borderRadius: '8px', color: B.text, fontSize: '13px', fontFamily: B.fontUI, cursor: 'pointer', outline: 'none' }}
        >
          <option value="all">Physical + Virtual</option>
          <option value="onsite">Physical</option>
          <option value="virtual">Virtual</option>
        </select>
        <span style={{ fontFamily: B.fontMono, fontSize: '11px', color: B.muted }}>
          {filtered.length} of {regs.length}
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
          <button
            onClick={exportCSV}
            style={{ padding: '8px 16px', background: 'transparent', border: `1px solid ${B.border}`, borderRadius: '8px', color: B.gold, fontSize: '12px', fontFamily: B.fontUI, cursor: 'pointer', fontWeight: 600 }}
          >
            CSV
          </button>
          <button
            onClick={exportToPdf}
            style={{ padding: '8px 16px', background: 'transparent', border: `1px solid ${B.border}`, borderRadius: '8px', color: B.gold, fontSize: '12px', fontFamily: B.fontUI, cursor: 'pointer', fontWeight: 600 }}
          >
            PDF
          </button>
          <button
            onClick={exportToExcel}
            style={{ padding: '8px 16px', background: 'transparent', border: `1px solid ${B.border}`, borderRadius: '8px', color: B.gold, fontSize: '12px', fontFamily: B.fontUI, cursor: 'pointer', fontWeight: 600 }}
          >
            Excel
          </button>
        </div>
      </div>

      {actionMsg && (
        <p style={{ margin: '0 0 14px', padding: '10px 14px', borderRadius: '8px', background: 'rgba(200,169,110,0.12)', color: B.gold, fontFamily: B.fontMono, fontSize: '12px' }}>{actionMsg}</p>
      )}

      {error ? (
        <p style={{ color: '#EF4444', fontFamily: B.fontMono, fontSize: '13px' }}>{error}</p>
      ) : loading ? (
        <p style={{ color: B.muted, fontFamily: B.fontMono, fontSize: '12px' }}>Loading…</p>
      ) : filtered.length === 0 ? (
        <p style={{ color: B.muted, fontFamily: B.fontUI, fontSize: '14px' }}>No registrations match your filters.</p>
      ) : (
        <div style={{ background: B.card, border: `1px solid ${B.border}`, borderRadius: '12px', overflow: 'hidden', marginBottom: '32px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${B.border}` }}>
                {['Name', 'Email', 'Phone', 'Type', 'Location', 'Company', 'Payment', 'Amount', 'Fee', 'Paid At', 'Registered', ''].map((h) => (
                  <th key={h} style={{ padding: '12px 14px', textAlign: 'left', fontFamily: B.fontMono, fontSize: '10px', letterSpacing: '0.08em', textTransform: 'uppercase', color: B.muted, fontWeight: 500, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const sc = STATE_META[r.payment_state] || STATE_META.not_started;
                const isExpanded = expandedId === r.id;
                return (
                  <>
                    <tr key={r.id} style={{ borderBottom: `1px solid ${B.border}`, background: isExpanded ? 'rgba(200,169,110,0.04)' : 'transparent' }}>
                      <td style={{ padding: '12px 14px', color: B.text, fontSize: '13px', whiteSpace: 'nowrap' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {r.full_name}
                          {r.source === 'app' && (
                            <span style={{ fontFamily: B.fontMono, fontSize: '9px', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', padding: '1px 6px', borderRadius: '999px', background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.3)', color: '#8B5CF6', flexShrink: 0 }}>
                              App
                            </span>
                          )}
                        </span>
                      </td>
                      <td style={{ padding: '12px 14px', fontFamily: B.fontMono, fontSize: '11px', color: B.muted }}>{r.email}</td>
                      <td style={{ padding: '12px 14px', fontFamily: B.fontMono, fontSize: '11px', whiteSpace: 'nowrap' }}>
                        {r.whatsapp
                          ? <a href={`tel:${r.whatsapp}`} style={{ color: B.gold, textDecoration: 'none' }}>{r.whatsapp}</a>
                          : <span style={{ color: '#EF4444' }}>none</span>}
                      </td>
                      <td style={{ padding: '12px 14px', fontSize: '12px', color: B.muted, whiteSpace: 'nowrap' }}>{r.attendance_type === 'virtual' ? 'Virtual' : 'Physical'}</td>
                      <td style={{ padding: '12px 14px', fontSize: '12px', color: B.muted }}>{r.location}</td>
                      <td style={{ padding: '12px 14px', fontSize: '12px', color: B.muted, maxWidth: '160px' }}>{r.organisation || '—'}</td>
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{ display: 'inline-block', padding: '4px 8px', borderRadius: '6px', background: isComp(r) ? '#EDE9FE' : sc.bg, color: isComp(r) ? '#5B21B6' : sc.color, fontSize: '11px', fontWeight: 600, whiteSpace: 'nowrap' }}>
                          {isComp(r) ? 'Complimentary' : sc.label}
                        </span>
                      </td>
                      <td style={{ padding: '12px 14px', fontFamily: B.fontMono, fontSize: '11px', color: B.muted }}>
                        {r.payment_state === 'paid' ? formatAmount(r.amount_paid, r.currency) : '—'}
                      </td>
                      <td style={{ padding: '12px 14px', fontFamily: B.fontMono, fontSize: '11px', color: B.dim }}>
                        {r.payment_state === 'paid' && !isComp(r) ? naira(feeOf(r)) : '—'}
                      </td>
                      <td style={{ padding: '12px 14px', fontFamily: B.fontMono, fontSize: '10px', color: B.dim, whiteSpace: 'nowrap' }}>
                        {r.paid_at ? new Date(r.paid_at).toLocaleDateString() : '—'}
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

                    {isExpanded && (
                      <tr key={`${r.id}-detail`} style={{ borderBottom: `1px solid ${B.border}`, background: 'rgba(200,169,110,0.03)' }}>
                        <td colSpan={13} style={{ padding: '20px 24px' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px' }}>
                            <div>
                              <p style={{ fontFamily: B.fontMono, fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', color: B.gold, margin: '0 0 10px' }}>Contact</p>
                              <p style={{ margin: '0 0 5px', fontSize: '12px', color: B.muted }}><span style={{ color: B.dim, fontFamily: B.fontMono, fontSize: '10px' }}>Email: </span>{r.email}</p>
                              <p style={{ margin: '0 0 5px', fontSize: '12px', color: B.muted }}><span style={{ color: B.dim, fontFamily: B.fontMono, fontSize: '10px' }}>WhatsApp: </span>{r.whatsapp}</p>
                              <p style={{ margin: '0 0 5px', fontSize: '12px', color: B.muted }}><span style={{ color: B.dim, fontFamily: B.fontMono, fontSize: '10px' }}>Location: </span>{r.location}</p>
                            </div>

                            <div>
                              <p style={{ fontFamily: B.fontMono, fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', color: B.gold, margin: '0 0 10px' }}>Professional</p>
                              <p style={{ margin: '0 0 5px', fontSize: '12px', color: B.muted }}><span style={{ color: B.dim, fontFamily: B.fontMono, fontSize: '10px' }}>Role: </span>{r.current_role || '—'}</p>
                              <p style={{ margin: '0 0 5px', fontSize: '12px', color: B.muted }}><span style={{ color: B.dim, fontFamily: B.fontMono, fontSize: '10px' }}>Company: </span>{r.organisation || '—'}</p>
                              <p style={{ margin: '0 0 5px', fontSize: '12px', color: B.muted }}><span style={{ color: B.dim, fontFamily: B.fontMono, fontSize: '10px' }}>Ticket: </span>{r.ticket_type || '—'}</p>
                              <select
                                value={r.ticket_type || ''}
                                onChange={(e) => updateField(r.id, { ticket_type: e.target.value || null })}
                                style={{ marginTop: '8px', padding: '4px 8px', borderRadius: '6px', border: `1px solid ${B.border}`, background: B.bg, color: B.muted, fontSize: '11px', cursor: 'pointer', fontFamily: B.fontUI }}
                              >
                                <option value="">— type —</option>
                                {TICKET_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                              </select>
                            </div>

                            <div>
                              <p style={{ fontFamily: B.fontMono, fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', color: B.gold, margin: '0 0 10px' }}>Registration</p>
                              <p style={{ margin: '0 0 5px', fontSize: '12px', color: B.muted }}><span style={{ color: B.dim, fontFamily: B.fontMono, fontSize: '10px' }}>Payment: </span>{isComp(r) ? 'Complimentary (no payment taken)' : sc.label}{r.attempt_count ? ` (${r.attempt_count} attempt${r.attempt_count === 1 ? '' : 's'})` : ''}</p>
                              {r.payment_state === 'paid' && (
                                <p style={{ margin: '0 0 5px', fontSize: '12px', color: B.muted }}><span style={{ color: B.dim, fontFamily: B.fontMono, fontSize: '10px' }}>Ticket email: </span>{r.confirmation_email_sent_at ? `sent ${new Date(r.confirmation_email_sent_at).toLocaleString()}` : r.confirmation_email_error ? 'FAILED, use Resend' : 'not recorded, use Resend if unsure'}</p>
                              )}
                              <div style={{ display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
                                {r.payment_state !== 'paid' && (
                                  <>
                                    <button onClick={() => runAction(r.id, 'verify')} disabled={busyId === r.id}
                                      style={{ padding: '5px 12px', borderRadius: '6px', border: `1px solid ${B.gold}`, background: 'transparent', color: B.gold, fontSize: '11px', cursor: 'pointer', fontFamily: B.fontUI }}>
                                      {busyId === r.id ? 'Checking…' : 'Verify with Paystack'}
                                    </button>
                                    <button onClick={() => runAction(r.id, 'comp')} disabled={busyId === r.id}
                                      style={{ padding: '5px 12px', borderRadius: '6px', border: '1px solid #8B5CF6', background: 'transparent', color: '#8B5CF6', fontSize: '11px', cursor: 'pointer', fontFamily: B.fontUI }}>
                                      {busyId === r.id ? 'Sending…' : 'Send ticket (no payment)'}
                                    </button>
                                  </>
                                )}
                                {r.payment_state === 'paid' && (
                                  <button onClick={() => runAction(r.id, 'resend')} disabled={busyId === r.id}
                                    style={{ padding: '5px 12px', borderRadius: '6px', border: `1px solid ${B.gold}`, background: 'transparent', color: B.gold, fontSize: '11px', cursor: 'pointer', fontFamily: B.fontUI }}>
                                    {busyId === r.id ? 'Sending…' : 'Resend ticket email'}
                                  </button>
                                )}
                              </div>
                              <p style={{ margin: '0 0 5px', fontSize: '12px', color: B.muted }}><span style={{ color: B.dim, fontFamily: B.fontMono, fontSize: '10px' }}>Amount: </span>{isComp(r) ? 'Complimentary' : formatAmount(r.amount_paid, r.currency)}</p>
                              <p style={{ margin: '0 0 5px', fontSize: '12px', color: B.muted }}><span style={{ color: B.dim, fontFamily: B.fontMono, fontSize: '10px' }}>Consent: </span>{r.consent ? 'Yes' : 'No'}</p>
                              <p style={{ margin: '0 0 5px', fontSize: '12px', color: B.muted }}><span style={{ color: B.dim, fontFamily: B.fontMono, fontSize: '10px' }}>Ref: </span>{r.payment_reference || '—'}</p>
                            </div>

                            <div>
                              <p style={{ fontFamily: B.fontMono, fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', color: B.gold, margin: '0 0 10px' }}>Messages</p>
                              {r.other_messages && (
                                <div style={{ marginBottom: '10px' }}>
                                  <p style={{ margin: '0 0 3px', fontFamily: B.fontMono, fontSize: '10px', color: B.dim }}>Other messages</p>
                                  <p style={{ margin: 0, fontSize: '12px', color: B.muted, lineHeight: 1.6 }}>{r.other_messages}</p>
                                </div>
                              )}
                              <p style={{ fontFamily: B.fontMono, fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', color: B.gold, margin: '16px 0 8px' }}>Internal Notes</p>
                              <textarea
                                value={localNotes[r.id] ?? ''}
                                onChange={(e) => setLocalNotes((n) => ({ ...n, [r.id]: e.target.value }))}
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

      <div style={{ background: B.card, border: `1px solid ${B.border}`, borderRadius: '12px', padding: '24px' }}>
        <p style={{ fontFamily: B.fontMono, fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: B.gold, margin: '0 0 4px' }}>Email Registrants</p>
        <p style={{ fontSize: '12px', color: B.muted, margin: '0 0 16px' }}>
          Send a message to everyone who has paid, or everyone who registered but has not paid yet. Use <code style={{ fontFamily: B.fontMono, background: 'rgba(255,255,255,0.06)', padding: '1px 5px', borderRadius: 4 }}>{'{name}'}</code> to personalise.
        </p>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '12px', alignItems: 'center' }}>
          <label style={{ fontFamily: B.fontMono, fontSize: '11px', color: B.muted }}>Send to:</label>
          <select
            value={emailTargetStatus}
            onChange={(e) => setEmailTargetStatus(e.target.value)}
            style={{ padding: '7px 12px', background: B.bg, border: `1px solid ${B.border}`, borderRadius: '7px', color: B.text, fontSize: '12px', fontFamily: B.fontUI, cursor: 'pointer', outline: 'none' }}
          >
            {AUDIENCES.map((a) => (
              <option key={a.value} value={a.value}>
                {a.label} ({regs.filter((r) => (a.value === 'confirmed') === (r.payment_state === 'paid')).length})
              </option>
            ))}
          </select>
        </div>

        <input
          placeholder="Subject line"
          value={emailSubject}
          onChange={(e) => setEmailSubject(e.target.value)}
          style={{ display: 'block', width: '100%', marginBottom: '10px', padding: '9px 14px', background: B.bg, border: `1px solid ${B.border}`, borderRadius: '8px', color: B.text, fontSize: '13px', fontFamily: B.fontUI, outline: 'none', boxSizing: 'border-box' as const }}
        />
        <textarea
          placeholder={`Hi {name},\n\nThis is a message from the Ascentor team about The Elevation Summit…`}
          value={emailMessage}
          onChange={(e) => setEmailMessage(e.target.value)}
          rows={5}
          style={{ display: 'block', width: '100%', marginBottom: '12px', padding: '9px 14px', background: B.bg, border: `1px solid ${B.border}`, borderRadius: '8px', color: B.text, fontSize: '13px', fontFamily: B.fontUI, outline: 'none', resize: 'vertical', boxSizing: 'border-box' as const }}
        />

        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <button
            onClick={handleEmailBlast}
            disabled={emailSending || !emailSubject.trim() || !emailMessage.trim()}
            style={{ padding: '9px 20px', background: B.gold, border: 'none', borderRadius: '8px', color: '#0F0F0E', fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: B.fontUI, opacity: emailSending ? 0.7 : 1 }}
          >
            {emailSending ? 'Sending…' : `Send to ${regs.filter((r) => (emailTargetStatus === 'confirmed') === (r.payment_state === 'paid')).length} registrant${regs.filter((r) => (emailTargetStatus === 'confirmed') === (r.payment_state === 'paid')).length !== 1 ? 's' : ''}`}
          </button>
          {emailResult && (
            <span style={{ fontFamily: B.fontMono, fontSize: '11px', color: emailResult.startsWith('Sent') ? '#10B981' : '#EF4444' }}>
              {emailResult}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
