'use client';

// /admin/elevation-summit/registrations
// THE single page for Elevation Summit registrations: every registrant,
// onsite or virtual, confirmed or not. Registration is free -- this page has
// nothing to do with Paystack, checkout, or revenue. Donations are their own
// (separately paid) product and live on /admin/summit-donations.
//
// Single source of truth: summit_registrations. A registration counts as
// CONFIRMED once payment_status = 'paid' (kept as-is in the database so no
// migration was needed when registration went free; it just means confirmed
// now, whether that happened by the person registering or an admin issuing
// a ticket directly).
//
// Search, filters and pagination run on the server (AJAX, debounced). The PDF
// report exports everything matching the current search and filters.

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  RefreshCw, Trash2, Mail, Phone, MessageCircle,
  FileDown, ChevronLeft, ChevronRight, BellRing, TicketCheck,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { usePageSearch } from '@/components/shell/PageSearch';
import { confirmAction } from '@/components/Modal';
import OffCanvas from '@/components/admin/OffCanvas';
import Select from '@/components/admin/Select';

type StateFilter = 'all' | 'confirmed' | 'not_confirmed';
type TypeFilter = 'all' | 'onsite' | 'virtual';

interface Reg {
  id: string;
  full_name: string;
  email: string;
  whatsapp: string | null;
  location: string | null;
  organisation: string | null;
  current_role: string | null;
  attendance_type: 'onsite' | 'virtual' | null;
  confirmed: boolean;
  paid_at: string | null;
  confirmation_email_sent_at?: string | null;
  confirmation_email_error?: string | null;
  reminder_sent_at?: string | null;
  reminder_count?: number | null;
  created_at: string;
  source: string | null;
}

interface Stats {
  total: number; confirmed: number; notConfirmed: number; physicalConfirmed: number; virtualConfirmed: number;
}
const EMPTY_STATS: Stats = { total: 0, confirmed: 0, notConfirmed: 0, physicalConfirmed: 0, virtualConfirmed: 0 };
const PAGE_SIZE = 25;

const STATE: Record<'confirmed' | 'not_confirmed', { label: string; bg: string; fg: string }> = {
  confirmed:     { label: 'Confirmed',     bg: 'rgba(34,160,90,.15)',   fg: '#177245' },
  not_confirmed: { label: 'Not confirmed', bg: 'rgba(200,169,110,.22)', fg: '#8A6A1F' },
};

const STATE_FILTERS: { key: StateFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'not_confirmed', label: 'Not confirmed' },
];

const when = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-';
const waLink = (p: string) => `https://wa.me/${p.replace(/[^\d]/g, '')}`;

export default function ElevationSummitRegistrationsPage() {
  const supabase = useMemo(() => createClient(), []);
  const query = usePageSearch('Search name, email, phone…');

  const [regs, setRegs] = useState<Reg[]>([]);
  const [stats, setStats] = useState<Stats>(EMPTY_STATS);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [stateFilter, setStateFilter] = useState<StateFilter>('all'); // show every registration, confirmed or not, by default
  const [type, setType] = useState<TypeFilter>('all');
  const [debounced, setDebounced] = useState('');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const [open, setOpen] = useState<Reg | null>(null);
  const [busy, setBusy] = useState(false);
  const [panelMsg, setPanelMsg] = useState<string | null>(null);
  const [reminding, setReminding] = useState(false);

  // Bulk email (subject + message to everyone confirmed, or everyone pending)
  const [emailTargetStatus, setEmailTargetStatus] = useState<'confirmed' | 'pending'>('confirmed');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailMessage, setEmailMessage] = useState('');
  const [emailSending, setEmailSending] = useState(false);
  const [emailResult, setEmailResult] = useState<{ text: string; ok: boolean } | null>(null);

  const authed = useCallback(async (input: string, init: RequestInit = {}) => {
    const { data: { session } } = await supabase.auth.getSession();
    return fetch(input, {
      ...init,
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token ?? ''}`, ...(init.headers ?? {}) },
    });
  }, [supabase]);

  // Debounce the search box: the server is queried once typing pauses (AJAX search).
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  // Any search / filter change returns to page 1.
  useEffect(() => { setPage(1); }, [debounced, stateFilter, type]);

  const qs = useCallback((pageNum: number, size: string | number) =>
    new URLSearchParams({ paged: '1', q: debounced, type, state: stateFilter, page: String(pageNum), pageSize: String(size) }).toString(),
  [debounced, type, stateFilter]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authed(`/api/admin/summit-registrations?${qs(page, PAGE_SIZE)}`);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Could not load Summit registrations');
      const list: Reg[] = body.registrations ?? [];
      setRegs(list);
      setStats(body.stats ?? EMPTY_STATS);
      setTotal(body.total ?? list.length);
      setPages(body.pages ?? 1);
      setOpen(prev => (prev ? list.find(r => r.id === prev.id) ?? prev : null));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [authed, qs, page]);

  useEffect(() => { load(); }, [load]);

  // ── PDF report: everything matching the current search + filters ───────────
  const downloadPdf = async () => {
    setExporting(true); setNote(null);
    try {
      const res = await authed(`/api/admin/summit-registrations?${qs(1, 'all')}`);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Could not prepare the report');
      const list: Reg[] = body.registrations ?? [];
      const st: Stats = body.stats ?? stats;

      const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
      const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
      const W = doc.internal.pageSize.getWidth();
      const stamp = new Date();

      // Header band
      doc.setFillColor(15, 15, 14); doc.rect(0, 0, W, 64, 'F');
      doc.setFillColor(200, 169, 110); doc.rect(0, 64, W, 3, 'F');
      doc.setTextColor(200, 169, 110); doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
      doc.text('ASCENTOR  ·  THE ELEVATION SUMMIT  ·  19 NOVEMBER 2026', 36, 26);
      doc.setTextColor(255, 255, 255); doc.setFontSize(18);
      doc.text('Summit Registrations Report', 36, 48);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(200, 200, 200);
      doc.text(`Generated ${stamp.toLocaleString('en-GB')}`, W - 36, 48, { align: 'right' });

      // Filters applied
      const stateLabel: Record<StateFilter, string> = { all: 'All statuses', confirmed: 'Confirmed', not_confirmed: 'Not confirmed' };
      const typeLabel: Record<TypeFilter, string> = { all: 'Physical + Virtual', onsite: 'Physical only', virtual: 'Virtual only' };
      doc.setTextColor(90, 90, 90); doc.setFontSize(9);
      doc.text(
        `Filter: ${stateLabel[stateFilter]}  ·  ${typeLabel[type]}${debounced ? `  ·  Search: "${debounced}"` : ''}  ·  ${list.length} record${list.length === 1 ? '' : 's'}`,
        36, 88,
      );

      // Summary cards (overall figures, not affected by the filter)
      const cards: [string, string][] = [
        ['Total registrations', String(st.total)],
        ['Confirmed', `${st.confirmed}  (${st.physicalConfirmed} physical / ${st.virtualConfirmed} virtual)`],
        ['Not yet confirmed', String(st.notConfirmed)],
      ];
      const cw = (W - 72 - 2 * 10) / 3;
      cards.forEach(([k, v], i) => {
        const x = 36 + i * (cw + 10);
        doc.setDrawColor(225, 222, 214); doc.setFillColor(250, 249, 246); doc.roundedRect(x, 98, cw, 46, 4, 4, 'FD');
        doc.setTextColor(120, 120, 120); doc.setFontSize(7.5); doc.text(k.toUpperCase(), x + 8, 113);
        doc.setTextColor(15, 15, 14); doc.setFont('helvetica', 'bold'); doc.setFontSize(11.5); doc.text(v, x + 8, 133);
        doc.setFont('helvetica', 'normal');
      });

      autoTable(doc, {
        startY: 158,
        head: [['#', 'Name', 'Email', 'Phone', 'Ticket', 'Status', 'Registered on', 'Confirmed on']],
        body: list.map((r, i) => [
          String(i + 1), r.full_name, r.email, r.whatsapp || '-',
          r.attendance_type === 'virtual' ? 'Virtual' : 'Physical',
          STATE[r.confirmed ? 'confirmed' : 'not_confirmed'].label,
          new Date(r.created_at).toLocaleDateString('en-GB'),
          r.confirmed && r.paid_at ? new Date(r.paid_at).toLocaleDateString('en-GB') : '-',
        ]),
        styles: { fontSize: 7.5, cellPadding: 4, textColor: [30, 30, 30] },
        headStyles: { fillColor: [15, 15, 14], textColor: [200, 169, 110], fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [250, 249, 246] },
        columnStyles: { 0: { cellWidth: 22 } },
        didDrawPage: () => {
          const H = doc.internal.pageSize.getHeight();
          doc.setFontSize(7.5); doc.setTextColor(140, 140, 140);
          doc.text('Ascentor · The Elevation Summit · Confidential', 36, H - 16);
          doc.text(`Page ${doc.getNumberOfPages()}`, W - 36, H - 16, { align: 'right' });
        },
      });

      doc.save(`elevation-summit-registrations-${stamp.toISOString().slice(0, 10)}.pdf`);
      setNote(`PDF downloaded with ${list.length} record${list.length === 1 ? '' : 's'}.`);
    } catch (e) {
      setNote((e as Error).message);
    }
    setExporting(false);
  };

  const act = async (action: 'resend' | 'remind' | 'comp') => {
    if (!open) return;
    setBusy(true); setPanelMsg(null);
    const res = await authed('/api/admin/summit-registrations', { method: 'POST', body: JSON.stringify({ id: open.id, action }) });
    const b = await res.json().catch(() => ({}));
    setPanelMsg(b.message || b.error || (res.ok ? 'Done.' : 'Action failed.'));
    setBusy(false);
    if (res.ok && action === 'comp') await load();
  };

  const confirmTicket = async () => {
    if (!open) return;
    const yes = await confirmAction(
      `Confirm ${open.full_name}'s registration and email their ticket right away?`,
      { title: 'Confirm Registration', confirmLabel: 'Confirm + send ticket' },
    );
    if (!yes) return;
    await act('comp');
  };

  const remind = async () => {
    if (!open) return;
    const last = open.reminder_sent_at ? new Date(open.reminder_sent_at).getTime() : 0;
    if (last && Date.now() - last < 6 * 3600_000) {
      const yes = await confirmAction(
        `${open.full_name} was already reminded ${when(open.reminder_sent_at)}. Send another reminder anyway?`,
        { confirmLabel: 'Send anyway' },
      );
      if (!yes) return;
    }
    await act('remind');
  };

  const remindAll = async () => {
    const yes = await confirmAction(
      `Send a reminder email to all ${stats.notConfirmed} people who are not yet confirmed? Anyone reminded in the last 24 hours is skipped.`,
      { confirmLabel: 'Send reminders' },
    );
    if (!yes) return;
    setReminding(true); setNote(null);
    const res = await authed('/api/admin/summit-registrations', { method: 'POST', body: JSON.stringify({ action: 'remind_all' }) });
    const b = await res.json().catch(() => ({}));
    setNote(b.message || b.error || (res.ok ? 'Done.' : 'Reminders failed.'));
    setReminding(false);
    await load();
  };

  const handleEmailBlast = async () => {
    if (!emailSubject.trim() || !emailMessage.trim()) return;
    const audienceCount = emailTargetStatus === 'confirmed' ? stats.confirmed : stats.notConfirmed;
    const yes = await confirmAction(
      `Send this email to all ${audienceCount} ${emailTargetStatus === 'confirmed' ? 'confirmed' : 'not yet confirmed'} registrant${audienceCount === 1 ? '' : 's'}?`,
      { title: 'Send Email Blast', confirmLabel: 'Send' },
    );
    if (!yes) return;
    setEmailSending(true); setEmailResult(null);
    try {
      const res = await fetch('/api/summit/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: emailTargetStatus, subject: emailSubject, message: emailMessage }),
      });
      const data = await res.json();
      if (res.ok) {
        setEmailResult({ text: `Sent to ${data.sent} registrant${data.sent !== 1 ? 's' : ''}${data.failed > 0 ? ` (${data.failed} failed)` : ''}`, ok: true });
        setEmailSubject('');
        setEmailMessage('');
      } else {
        setEmailResult({ text: data.error || 'Send failed', ok: false });
      }
    } catch (e: any) {
      setEmailResult({ text: e.message, ok: false });
    }
    setEmailSending(false);
  };

  const remove = async (target: Reg) => {
    const yes = await confirmAction(
      target.confirmed
        ? `Delete the CONFIRMED registration of ${target.full_name}? This permanently removes it.`
        : `Delete the registration of ${target.full_name}? Only do this for test data.`,
      { confirmLabel: 'Delete permanently', danger: true },
    );
    if (!yes) return;
    setBusy(true);
    const res = await fetch('/api/admin/payments', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'summit_registration', id: target.id }),
    });
    const b = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setPanelMsg(b.error || 'Delete failed'); return; }
    setOpen(null); setNote(`${target.full_name} deleted.`);
    await load();
  };

  const cell: React.CSSProperties = { padding: '10px 12px', verticalAlign: 'middle' };
  const lab: React.CSSProperties = { fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ledger-ink-soft)', margin: '0 0 3px' };
  const val: React.CSSProperties = { fontSize: 13.5, color: 'var(--ledger-ink)', margin: 0, wordBreak: 'break-word' };
  const countFor = (k: StateFilter) => k === 'all' ? stats.total : k === 'confirmed' ? stats.confirmed : stats.notConfirmed;

  const Card = ({ title, value, sub, accent }: { title: string; value: string; sub?: string; accent?: string }) => (
    <div className="rounded-xl ledger-panel" style={{ padding: '12px 14px', borderTop: `3px solid ${accent ?? 'var(--ledger-line)'}` }}>
      <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ledger-ink-soft)' }}>{title}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--ledger-ink)', marginTop: 4 }}>{value}</div>
      {sub && <div style={{ fontSize: 11.5, color: 'var(--ledger-ink-soft)', marginTop: 2 }}>{sub}</div>}
    </div>
  );

  return (
    <div className="animate-fade-up" data-fullwidth>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
        <div>
          <p className="ledger-mono" style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', margin: 0, color: '#8A6A1F' }}>The Elevation Summit · 19 Nov 2026</p>
          <h1 className="ledger-h1" style={{ fontSize: 26, margin: '2px 0 0' }}>Summit Registrations</h1>
          <p className="ledger-mono" style={{ fontSize: 12, margin: '4px 0 0' }}>Every Elevation Summit registration, onsite and virtual. Registration is free; donations are tracked separately.</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {stats.notConfirmed > 0 && (
            <button type="button" className="ledger-btn ledger-btn-ghost" onClick={remindAll} disabled={reminding}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }} title="Email everyone who is not yet confirmed">
              <BellRing size={14} /> {reminding ? 'Sending…' : `Remind all not yet confirmed (${stats.notConfirmed})`}
            </button>
          )}
          <button type="button" className="ledger-btn ledger-btn-ghost" onClick={downloadPdf} disabled={exporting}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }} title="Download a PDF of the records matching the current search and filters">
            <FileDown size={14} /> {exporting ? 'Preparing…' : 'Download PDF'}
          </button>
          <button type="button" className="ledger-btn ledger-btn-primary" onClick={load} disabled={loading} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 14 }}>
        <Card title="Total registrations" value={String(stats.total)} accent="var(--ledger-line-strong)" />
        <Card title="Confirmed" value={String(stats.confirmed)} sub={`${stats.physicalConfirmed} physical · ${stats.virtualConfirmed} virtual`} accent="#177245" />
        <Card title="Not yet confirmed" value={String(stats.notConfirmed)} accent="#8A6A1F" />
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12, alignItems: 'center' }}>
        <Select
          ariaLabel="Filter by status"
          value={stateFilter}
          onValueChange={(v) => setStateFilter(v as StateFilter)}
          options={STATE_FILTERS.map(f => ({ value: f.key, label: `${f.label} (${countFor(f.key)})` }))}
        />
        <Select
          ariaLabel="Filter by attendance type"
          value={type}
          onValueChange={(v) => setType(v as TypeFilter)}
          options={[
            { value: 'all', label: 'Physical + Virtual' },
            { value: 'onsite', label: 'Physical only' },
            { value: 'virtual', label: 'Virtual only' },
          ]}
        />
        <span className="ledger-mono" style={{ fontSize: 12 }}>
          {loading ? 'Searching…' : `${total} record${total === 1 ? '' : 's'}${debounced ? ` matching "${debounced}"` : ''}`}
        </span>
      </div>

      {note && <p className="ledger-mono" style={{ fontSize: 12, marginBottom: 10 }}>{note}</p>}
      {error && <div className="rounded-lg p-3 mb-4 text-xs" style={{ background: 'var(--ledger-bad-bg)', color: 'var(--ledger-bad)' }}>{error}</div>}

      <div className="rounded-xl ledger-panel" style={{ overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: 'left', color: 'var(--ledger-ink-soft)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              <th style={{ ...cell, fontWeight: 600, borderBottom: '1px solid var(--ledger-line)' }}>Person</th>
              <th style={{ ...cell, fontWeight: 600, borderBottom: '1px solid var(--ledger-line)', width: 100 }}>Ticket</th>
              <th style={{ ...cell, fontWeight: 600, borderBottom: '1px solid var(--ledger-line)', width: 150 }}>Status</th>
              <th style={{ ...cell, fontWeight: 600, borderBottom: '1px solid var(--ledger-line)', width: 110 }}>Date</th>
            </tr>
          </thead>
          <tbody>
            {loading && regs.length === 0 ? (
              <tr><td colSpan={4} className="ledger-mono" style={{ padding: 28, textAlign: 'center' }}>Loading…</td></tr>
            ) : regs.length === 0 ? (
              <tr><td colSpan={4} className="ledger-mono" style={{ padding: 28, textAlign: 'center' }}>Nobody matches.</td></tr>
            ) : regs.map(r => {
              const st = STATE[r.confirmed ? 'confirmed' : 'not_confirmed'];
              return (
                <tr key={r.id} onClick={() => { setOpen(r); setPanelMsg(null); }} className="hover:bg-black/5"
                  style={{ borderTop: '1px solid var(--ledger-line)', cursor: 'pointer' }}>
                  <td style={{ ...cell, overflow: 'hidden' }}>
                    <div style={{ color: 'var(--ledger-ink)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.full_name}</div>
                    <div style={{ color: 'var(--ledger-ink-soft)', fontSize: 11.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.email}{r.whatsapp ? ` · ${r.whatsapp}` : ''}</div>
                  </td>
                  <td style={cell}>
                    <div style={{ color: 'var(--ledger-ink-soft)', fontSize: 12.5 }}>{r.attendance_type === 'virtual' ? 'Virtual' : 'Physical'}</div>
                  </td>
                  <td style={cell}>
                    <span style={{ background: st.bg, color: st.fg, padding: '3px 9px', borderRadius: 999, fontSize: 11.5, fontWeight: 600, whiteSpace: 'nowrap' }}>{st.label}</span>
                  </td>
                  <td style={{ ...cell, color: 'var(--ledger-ink-soft)', whiteSpace: 'nowrap' }}>{when(r.confirmed ? r.paid_at : r.created_at)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 12 }}>
          <button type="button" className="ledger-btn ledger-btn-ghost" disabled={page <= 1 || loading} onClick={() => setPage(p => Math.max(1, p - 1))}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><ChevronLeft size={14} /> Prev</button>
          <span className="ledger-mono" style={{ fontSize: 12 }}>Page {page} of {pages}</span>
          <button type="button" className="ledger-btn ledger-btn-ghost" disabled={page >= pages || loading} onClick={() => setPage(p => Math.min(pages, p + 1))}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>Next <ChevronRight size={14} /></button>
        </div>
      )}

      {/* Email every registrant with a given status, the one bulk-messaging tool
          for Summit registrants (separate from the per-person reminder/resend
          actions in the row detail panel). */}
      <div className="rounded-xl ledger-panel" style={{ padding: 20, marginTop: 24 }}>
        <h2 className="ledger-h2" style={{ fontSize: 15, marginBottom: 4 }}>Email Registrants</h2>
        <p className="ledger-mono" style={{ fontSize: 11.5, marginBottom: 14 }}>
          Send a message to everyone confirmed, or everyone not yet confirmed. Use {'{name}'} to personalise.
        </p>

        <div style={{ display: 'flex', gap: 10, marginBottom: 12, alignItems: 'center' }}>
          <label className="ledger-mono" style={{ fontSize: 11.5 }}>Send to:</label>
          <Select
            ariaLabel="Email audience"
            value={emailTargetStatus}
            onValueChange={(v) => setEmailTargetStatus(v as 'confirmed' | 'pending')}
            options={[
              { value: 'confirmed', label: `Confirmed (${stats.confirmed})` },
              { value: 'pending', label: `Not yet confirmed (${stats.notConfirmed})` },
            ]}
          />
        </div>

        <input
          placeholder="Subject line"
          value={emailSubject}
          onChange={(e) => setEmailSubject(e.target.value)}
          style={{ display: 'block', width: '100%', marginBottom: 10, padding: '9px 12px', borderRadius: 8, border: '1px solid var(--ledger-line-strong)', background: 'var(--ledger-bg-input)', color: 'var(--ledger-ink)', fontSize: 13, fontFamily: 'var(--ledger-font-ui)', outline: 'none', boxSizing: 'border-box' }}
        />
        <textarea
          placeholder={'Hi {name},\n\nThis is a message from the Ascentor team about The Elevation Summit...'}
          value={emailMessage}
          onChange={(e) => setEmailMessage(e.target.value)}
          rows={5}
          style={{ display: 'block', width: '100%', marginBottom: 12, padding: '9px 12px', borderRadius: 8, border: '1px solid var(--ledger-line-strong)', background: 'var(--ledger-bg-input)', color: 'var(--ledger-ink)', fontSize: 13, fontFamily: 'var(--ledger-font-ui)', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }}
        />

        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="ledger-btn ledger-btn-primary"
            onClick={handleEmailBlast}
            disabled={emailSending || !emailSubject.trim() || !emailMessage.trim()}
          >
            {emailSending ? 'Sending…' : `Send to ${emailTargetStatus === 'confirmed' ? stats.confirmed : stats.notConfirmed} registrant${(emailTargetStatus === 'confirmed' ? stats.confirmed : stats.notConfirmed) !== 1 ? 's' : ''}`}
          </button>
          {emailResult && (
            <span className="ledger-mono" style={{ fontSize: 11.5, color: emailResult.ok ? 'var(--ledger-good)' : 'var(--ledger-bad)' }}>
              {emailResult.text}
            </span>
          )}
        </div>
      </div>

      <OffCanvas
        open={!!open}
        onClose={() => setOpen(null)}
        title={open?.full_name ?? ''}
        subtitle={open ? `${open.attendance_type === 'virtual' ? 'Virtual' : 'Physical'} ticket · registered ${when(open.created_at)}` : undefined}
        footer={open ? (
          <>
            {/* Shown right next to the buttons that produce it: it's in the
                sticky footer, not the scrollable body, so the admin never has
                to scroll up to see what a click just did. */}
            {panelMsg && <p className="ledger-mono" style={{ fontSize: 12, padding: '9px 12px', borderRadius: 8, background: 'var(--ledger-gold-bg)', margin: '0 0 4px' }}>{panelMsg}</p>}
            {open.confirmed ? (
              <button type="button" disabled={busy} onClick={async () => {
                const yes = await confirmAction(`Resend the confirmation email and ticket to ${open.email}?`, { title: 'Resend Ticket', confirmLabel: 'Resend' });
                if (yes) await act('resend');
              }} className="ledger-btn ledger-btn-primary" style={{ display: 'inline-flex', gap: 6, alignItems: 'center', justifyContent: 'center' }}>
                <Mail size={14} /> {busy ? 'Sending…' : 'Resend confirmation email + ticket'}
              </button>
            ) : (
              <>
                <button type="button" disabled={busy} onClick={remind} className="ledger-btn ledger-btn-ghost" style={{ display: 'inline-flex', gap: 6, alignItems: 'center', justifyContent: 'center' }}>
                  <BellRing size={14} /> {busy ? 'Sending…' : 'Send reminder email'}
                </button>
                <button type="button" disabled={busy} onClick={confirmTicket} className="ledger-btn ledger-btn-primary" style={{ display: 'inline-flex', gap: 6, alignItems: 'center', justifyContent: 'center' }}>
                  <TicketCheck size={14} /> {busy ? 'Sending…' : 'Confirm + send ticket'}
                </button>
              </>
            )}
            <button type="button" disabled={busy} onClick={() => remove(open)} className="ledger-btn ledger-btn-ghost"
              style={{ color: 'var(--ledger-bad)', display: 'inline-flex', gap: 6, alignItems: 'center', justifyContent: 'center' }}>
              <Trash2 size={14} /> Delete record
            </button>
          </>
        ) : null}
      >
        {open && (() => {
          const st = STATE[open.confirmed ? 'confirmed' : 'not_confirmed'];
          return (
            <div style={{ display: 'grid', gap: 14 }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <span style={{ background: st.bg, color: st.fg, padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600 }}>{st.label}</span>
              </div>

              <div><p style={lab}>Email</p><p style={val}>{open.email}</p></div>
              <div>
                <p style={lab}>Phone</p>
                {open.whatsapp ? (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <p style={val}>{open.whatsapp}</p>
                    <a href={`tel:${open.whatsapp}`} className="ledger-btn ledger-btn-ghost" style={{ display: 'inline-flex', gap: 5, alignItems: 'center', padding: '4px 9px' }}><Phone size={13} /> Call</a>
                    <a href={waLink(open.whatsapp)} target="_blank" rel="noopener noreferrer" className="ledger-btn ledger-btn-ghost" style={{ display: 'inline-flex', gap: 5, alignItems: 'center', padding: '4px 9px' }}><MessageCircle size={13} /> WhatsApp</a>
                  </div>
                ) : <p style={{ ...val, color: 'var(--ledger-bad)' }}>not captured</p>}
              </div>
              <div><p style={lab}>Company / role</p><p style={val}>{[open.organisation, open.current_role].filter(Boolean).join(' · ') || '-'}</p></div>
              <div><p style={lab}>Location</p><p style={val}>{open.location || '-'}</p></div>
              <div><p style={lab}>Registered via</p><p style={val}>{open.source ?? 'web'}</p></div>

              {open.confirmed ? (
                <>
                  <div><p style={lab}>Confirmed on</p><p style={val}>{when(open.paid_at)}</p></div>
                  <div>
                    <p style={lab}>Confirmation email + ticket</p>
                    <p style={val}>
                      {open.confirmation_email_sent_at ? `Sent ${when(open.confirmation_email_sent_at)}`
                        : open.confirmation_email_error ? `FAILED: ${open.confirmation_email_error}`
                        : 'No delivery record. Resend it if the customer did not get it.'}
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <p style={lab}>Last reminder</p>
                    <p style={val}>{open.reminder_sent_at ? `${when(open.reminder_sent_at)} (${open.reminder_count ?? 1} sent)` : 'Never reminded'}</p>
                  </div>
                  {open.whatsapp && (
                    <a
                      href={`${waLink(open.whatsapp)}?text=${encodeURIComponent(`Hi ${open.full_name.split(' ')[0]}, this is Ascentor. Your Elevation Summit registration (${open.attendance_type === 'virtual' ? 'virtual' : 'physical'}) is saved but not confirmed yet. You can finish here: https://joinascentor.com/elevation-summit#register`)}`}
                      target="_blank" rel="noopener noreferrer" className="ledger-btn ledger-btn-ghost"
                      style={{ display: 'inline-flex', gap: 6, alignItems: 'center', justifyContent: 'center' }}
                    >
                      <MessageCircle size={14} /> Remind on WhatsApp
                    </a>
                  )}
                </>
              )}
            </div>
          );
        })()}
      </OffCanvas>
    </div>
  );
}
