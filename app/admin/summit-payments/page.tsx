'use client';

// /admin/summit-payments
// The ONE place to manage Elevation Summit money. Summit tickets only:
// subscriptions live on /admin/payments and are never mixed in here.
//
// Single source of truth: summit_registrations. A ticket counts as PAID only if
// payment_status = 'paid'. Each paid row shows whether Paystack recorded a
// transaction id, so a row not backed by a real payment is obvious.
//
// Search, filters and pagination run on the server (AJAX, debounced). The PDF
// report exports everything matching the current search and filters.

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  RefreshCw, RotateCw, Trash2, Copy, ShieldCheck, Mail, Phone, MessageCircle,
  FileDown, ChevronLeft, ChevronRight, BellRing,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { usePageSearch } from '@/components/shell/PageSearch';
import { confirmAction } from '@/components/Modal';
import OffCanvas from '@/components/admin/OffCanvas';

type PayState = 'paid' | 'in_progress' | 'abandoned' | 'not_started';
type StateFilter = 'all' | 'paid' | 'unpaid' | 'abandoned' | 'not_started' | 'in_progress';
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
  payment_state: PayState;
  attempt_count: number;
  amount_paid: number | string | null;
  paystack_fee?: number | string | null;
  paid_at: string | null;
  payment_reference: string | null;
  payment_provider_tx_id: string | null;
  confirmation_email_sent_at?: string | null;
  confirmation_email_error?: string | null;
  reminder_sent_at?: string | null;
  reminder_count?: number | null;
  created_at: string;
  source: string | null;
}

interface Stats {
  total: number; paid: number; unpaid: number; abandoned: number; in_progress: number; not_started: number;
  physicalPaid: number; virtualPaid: number; gross: number; fees: number; net: number;
  feesEstimated: boolean; unverified: number;
}
const EMPTY_STATS: Stats = {
  total: 0, paid: 0, unpaid: 0, abandoned: 0, in_progress: 0, not_started: 0,
  physicalPaid: 0, virtualPaid: 0, gross: 0, fees: 0, net: 0, feesEstimated: false, unverified: 0,
};
const PAGE_SIZE = 25;

const STATE: Record<PayState, { label: string; bg: string; fg: string }> = {
  paid:        { label: 'Confirmed',            bg: 'rgba(34,160,90,.15)',   fg: '#177245' },
  in_progress: { label: 'Paying now',           bg: 'rgba(60,120,220,.15)',  fg: '#2453A6' },
  abandoned:   { label: 'Left at payment',      bg: 'rgba(220,60,60,.13)',   fg: '#A32626' },
  not_started: { label: 'Registered, not paid', bg: 'rgba(200,169,110,.22)', fg: '#8A6A1F' },
};

const STATE_FILTERS: { key: StateFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'paid', label: 'Confirmed' },
  { key: 'unpaid', label: 'Pending' },
  { key: 'abandoned', label: 'Left at payment' },
  { key: 'not_started', label: 'Not started' },
  { key: 'in_progress', label: 'Paying now' },
];

const naira = (n: number) => `₦${Math.round(n).toLocaleString('en-NG')}`;
const num = (v: number | string | null | undefined) => Number(v ?? 0) || 0;
// Paystack local fee: 1.5% (+₦100 from ₦2,500), capped ₦2,000. Used only when the real fee was not stored.
const estFee = (a: number) => (a ? Math.min(a * 0.015 + (a >= 2500 ? 100 : 0), 2000) : 0);
const feeOf = (r: Reg) => (r.paystack_fee != null ? num(r.paystack_fee) : estFee(num(r.amount_paid)));
const when = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-';
const waLink = (p: string) => `https://wa.me/${p.replace(/[^\d]/g, '')}`;

export default function SummitPaymentsPage() {
  const supabase = useMemo(() => createClient(), []);
  const query = usePageSearch('Search name, email, phone…');

  const [regs, setRegs] = useState<Reg[]>([]);
  const [stats, setStats] = useState<Stats>(EMPTY_STATS);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [stateFilter, setStateFilter] = useState<StateFilter>('paid'); // land on confirmed payments only
  const [type, setType] = useState<TypeFilter>('all');
  const [debounced, setDebounced] = useState('');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [exporting, setExporting] = useState(false);

  const [open, setOpen] = useState<Reg | null>(null);
  const [busy, setBusy] = useState(false);
  const [panelMsg, setPanelMsg] = useState<string | null>(null);
  const [refInput, setRefInput] = useState('');
  const [reminding, setReminding] = useState(false);

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
      doc.text('Summit Payments Report', 36, 48);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(200, 200, 200);
      doc.text(`Generated ${stamp.toLocaleString('en-GB')}`, W - 36, 48, { align: 'right' });

      // Filters applied
      const stateLabel: Record<StateFilter, string> = {
        all: 'All statuses', paid: 'Confirmed (paid)', unpaid: 'Pending (not paid)',
        abandoned: 'Left at payment', not_started: 'Registered, not paid', in_progress: 'Paying now',
      };
      const typeLabel: Record<TypeFilter, string> = { all: 'Physical + Virtual', onsite: 'Physical only', virtual: 'Virtual only' };
      doc.setTextColor(90, 90, 90); doc.setFontSize(9);
      doc.text(
        `Filter: ${stateLabel[stateFilter]}  ·  ${typeLabel[type]}${debounced ? `  ·  Search: "${debounced}"` : ''}  ·  ${list.length} record${list.length === 1 ? '' : 's'}`,
        36, 88,
      );

      // Summary cards (overall figures, not affected by the filter)
      const cards: [string, string][] = [
        ['Confirmed tickets', `${st.paid}  (${st.physicalPaid} physical / ${st.virtualPaid} virtual)`],
        ['Gross revenue', naira(st.gross)],
        [st.feesEstimated ? 'Paystack fees (est.)' : 'Paystack fees', naira(st.fees)],
        ['Net revenue', naira(st.net)],
        ['Not paid yet', String(st.unpaid)],
      ];
      const cw = (W - 72 - 4 * 10) / 5;
      cards.forEach(([k, v], i) => {
        const x = 36 + i * (cw + 10);
        doc.setDrawColor(225, 222, 214); doc.setFillColor(250, 249, 246); doc.roundedRect(x, 98, cw, 46, 4, 4, 'FD');
        doc.setTextColor(120, 120, 120); doc.setFontSize(7.5); doc.text(k.toUpperCase(), x + 8, 113);
        doc.setTextColor(15, 15, 14); doc.setFont('helvetica', 'bold'); doc.setFontSize(11.5); doc.text(v, x + 8, 133);
        doc.setFont('helvetica', 'normal');
      });

      autoTable(doc, {
        startY: 158,
        head: [['#', 'Name', 'Email', 'Phone', 'Ticket', 'Status', 'Amount', 'Fee', 'Net', 'Paid on', 'Reference']],
        body: list.map((r, i) => {
          const amt = num(r.amount_paid);
          const isPaid = r.payment_state === 'paid';
          return [
            String(i + 1), r.full_name, r.email, r.whatsapp || '-',
            r.attendance_type === 'virtual' ? 'Virtual' : 'Physical',
            STATE[r.payment_state].label,
            isPaid ? naira(amt) : '-',
            isPaid ? naira(feeOf(r)) : '-',
            isPaid ? naira(amt - feeOf(r)) : '-',
            r.paid_at ? new Date(r.paid_at).toLocaleDateString('en-GB') : '-',
            r.payment_reference ? r.payment_reference.slice(-14) : '-',
          ];
        }),
        styles: { fontSize: 7.5, cellPadding: 4, textColor: [30, 30, 30] },
        headStyles: { fillColor: [15, 15, 14], textColor: [200, 169, 110], fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [250, 249, 246] },
        columnStyles: { 0: { cellWidth: 22 }, 6: { halign: 'right' }, 7: { halign: 'right' }, 8: { halign: 'right' } },
        didDrawPage: () => {
          const H = doc.internal.pageSize.getHeight();
          doc.setFontSize(7.5); doc.setTextColor(140, 140, 140);
          doc.text('Ascentor · The Elevation Summit · Confidential', 36, H - 16);
          doc.text(`Page ${doc.getNumberOfPages()}`, W - 36, H - 16, { align: 'right' });
        },
      });

      doc.save(`elevation-summit-payments-${stamp.toISOString().slice(0, 10)}.pdf`);
      setNote(`PDF downloaded with ${list.length} record${list.length === 1 ? '' : 's'}.`);
    } catch (e) {
      setNote((e as Error).message);
    }
    setExporting(false);
  };

  const reconcile = async () => {
    setRunning(true); setNote(null);
    try {
      const res = await fetch('/api/admin/payments', { method: 'POST' });
      const b = await res.json();
      if (!res.ok) throw new Error(b.error || 'Reconciliation failed');
      setNote(`Checked ${b.checked}. ${b.recovered} recovered, ${b.adopted ?? 0} older Paystack payments adopted, ${b.emailsRetried ?? 0} emails retried, ${b.feesBackfilled ?? 0} Paystack fees filled in.`);
      await load();
    } catch (e) { setNote((e as Error).message); }
    setRunning(false);
  };

  const act = async (action: 'verify' | 'resend' | 'remind', extra: Record<string, unknown> = {}) => {
    if (!open) return;
    setBusy(true); setPanelMsg(null);
    const res = await authed('/api/admin/summit-registrations', { method: 'POST', body: JSON.stringify({ id: open.id, action, ...extra }) });
    const b = await res.json().catch(() => ({}));
    setPanelMsg(b.message || b.error || (res.ok ? 'Done.' : 'Action failed.'));
    setBusy(false);
    if (res.ok) await load();
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
      `Send a payment reminder email to all ${stats.unpaid} people who have not paid? Anyone reminded in the last 24 hours is skipped.`,
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

  const remove = async (target: Reg) => {
    const isPaid = target.payment_state === 'paid';
    const yes = await confirmAction(
      isPaid
        ? `Delete the PAID registration of ${target.full_name} (${naira(num(target.amount_paid))})? This permanently removes it and its revenue. Only do this for test data.`
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
    setOpen(null); setNote(`${target.full_name} deleted. Totals updated.`);
    await load();
  };

  const cell: React.CSSProperties = { padding: '10px 12px', verticalAlign: 'middle' };
  const lab: React.CSSProperties = { fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ledger-ink-soft)', margin: '0 0 3px' };
  const val: React.CSSProperties = { fontSize: 13.5, color: 'var(--ledger-ink)', margin: 0, wordBreak: 'break-word' };
  const countFor = (k: StateFilter) =>
    k === 'all' ? stats.total : k === 'paid' ? stats.paid : k === 'unpaid' ? stats.unpaid
      : k === 'abandoned' ? stats.abandoned : k === 'not_started' ? stats.not_started : stats.in_progress;

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
          <h1 className="ledger-h1" style={{ fontSize: 26, margin: '2px 0 0' }}>Summit Payments</h1>
          <p className="ledger-mono" style={{ fontSize: 12, margin: '4px 0 0' }}>Tickets only. Subscription payments are on a separate page.</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {stats.unpaid > 0 && (
            <button type="button" className="ledger-btn ledger-btn-ghost" onClick={remindAll} disabled={reminding}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }} title="Email a payment reminder to everyone who has not paid">
              <BellRing size={14} /> {reminding ? 'Sending…' : `Remind all pending (${stats.unpaid})`}
            </button>
          )}
          <button type="button" className="ledger-btn ledger-btn-ghost" onClick={downloadPdf} disabled={exporting}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }} title="Download a PDF of the records matching the current search and filters">
            <FileDown size={14} /> {exporting ? 'Preparing…' : 'Download PDF'}
          </button>
          <button type="button" className="ledger-btn ledger-btn-ghost" onClick={load} disabled={loading} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
          <button type="button" className="ledger-btn ledger-btn-primary" onClick={reconcile} disabled={running} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            title="Ask Paystack about every unfinished Summit payment and confirm any that were actually paid">
            <RotateCw size={14} className={running ? 'animate-spin' : ''} /> {running ? 'Checking Paystack…' : 'Check Paystack now'}
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 14 }}>
        <Card title="Confirmed tickets" value={String(stats.paid)} sub={`${stats.physicalPaid} physical · ${stats.virtualPaid} virtual`} accent="#177245" />
        <Card title="Gross revenue" value={naira(stats.gross)} sub="what customers paid" accent="#C8A96E" />
        <Card title="Paystack fees" value={naira(stats.fees)} sub={stats.feesEstimated ? 'estimated' : 'from Paystack'} accent="#A32626" />
        <Card title="Net revenue" value={naira(stats.net)} sub="after Paystack fees" accent="#177245" />
        <Card title="Pending" value={String(stats.unpaid)} sub={`${stats.abandoned} left at payment`} accent="#8A6A1F" />
      </div>

      {stats.unverified > 0 && (
        <div className="rounded-lg p-3 mb-3 text-xs" style={{ background: 'var(--ledger-bad-bg)', color: 'var(--ledger-bad)' }}>
          {stats.unverified} confirmed ticket{stats.unverified === 1 ? ' has' : 's have'} no Paystack transaction id, so {stats.unverified === 1 ? 'it was' : 'they were'} not confirmed by a real payment. Open {stats.unverified === 1 ? 'it' : 'them'} to check.
        </div>
      )}

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8, alignItems: 'center' }}>
        {STATE_FILTERS.map(f => (
          <button key={f.key} type="button" aria-pressed={stateFilter === f.key} onClick={() => setStateFilter(f.key)}
            className={`ledger-btn ${stateFilter === f.key ? 'ledger-btn-primary' : 'ledger-btn-ghost'}`}>
            {f.label} ({countFor(f.key)})
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12, alignItems: 'center' }}>
        {([['all', 'Physical + Virtual'], ['onsite', 'Physical'], ['virtual', 'Virtual']] as const).map(([k, l]) => (
          <button key={k} type="button" aria-pressed={type === k} onClick={() => setType(k)}
            className={`ledger-btn ${type === k ? 'ledger-btn-primary' : 'ledger-btn-ghost'}`}>{l}</button>
        ))}
        <span className="ledger-mono" style={{ fontSize: 12, marginLeft: 6 }}>
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
              const st = STATE[r.payment_state];
              return (
                <tr key={r.id} onClick={() => { setOpen(r); setPanelMsg(null); setRefInput(''); }} className="hover:bg-black/5"
                  style={{ borderTop: '1px solid var(--ledger-line)', cursor: 'pointer' }}>
                  <td style={{ ...cell, overflow: 'hidden' }}>
                    <div style={{ color: 'var(--ledger-ink)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.full_name}</div>
                    <div style={{ color: 'var(--ledger-ink-soft)', fontSize: 11.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.email}{r.whatsapp ? ` · ${r.whatsapp}` : ''}</div>
                  </td>
                  <td style={cell}>
                    <div style={{ fontWeight: 600, color: 'var(--ledger-ink)' }}>{r.payment_state === 'paid' ? naira(num(r.amount_paid)) : '-'}</div>
                    <div style={{ color: 'var(--ledger-ink-soft)', fontSize: 11.5 }}>{r.attendance_type === 'virtual' ? 'Virtual' : 'Physical'}</div>
                  </td>
                  <td style={cell}>
                    <span style={{ background: st.bg, color: st.fg, padding: '3px 9px', borderRadius: 999, fontSize: 11.5, fontWeight: 600, whiteSpace: 'nowrap' }}>{st.label}</span>
                    {r.payment_state === 'paid' && !r.payment_provider_tx_id && (
                      <div style={{ color: 'var(--ledger-bad)', fontSize: 10.5, marginTop: 3 }}>no Paystack id</div>
                    )}
                  </td>
                  <td style={{ ...cell, color: 'var(--ledger-ink-soft)', whiteSpace: 'nowrap' }}>{when(r.payment_state === 'paid' ? r.paid_at : r.created_at)}</td>
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

      <OffCanvas
        open={!!open}
        onClose={() => setOpen(null)}
        title={open?.full_name ?? ''}
        subtitle={open ? `${open.attendance_type === 'virtual' ? 'Virtual' : 'Physical'} ticket · registered ${when(open.created_at)}` : undefined}
        footer={open ? (
          <>
            {open.payment_state === 'paid' ? (
              <button type="button" disabled={busy} onClick={() => act('resend')} className="ledger-btn ledger-btn-primary" style={{ display: 'inline-flex', gap: 6, alignItems: 'center', justifyContent: 'center' }}>
                <Mail size={14} /> {busy ? 'Sending…' : 'Resend confirmation email + ticket'}
              </button>
            ) : (
              <>
                <button type="button" disabled={busy} onClick={remind} className="ledger-btn ledger-btn-primary" style={{ display: 'inline-flex', gap: 6, alignItems: 'center', justifyContent: 'center' }}>
                  <BellRing size={14} /> {busy ? 'Sending…' : 'Send payment reminder email'}
                </button>
                <button type="button" disabled={busy} onClick={() => act('verify', refInput.trim() ? { reference: refInput.trim() } : {})} className="ledger-btn ledger-btn-ghost" style={{ display: 'inline-flex', gap: 6, alignItems: 'center', justifyContent: 'center' }}>
                  <ShieldCheck size={14} /> {busy ? 'Checking…' : 'Check Paystack for this person'}
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
          const st = STATE[open.payment_state];
          const isPaid = open.payment_state === 'paid';
          return (
            <div style={{ display: 'grid', gap: 14 }}>
              {panelMsg && <p className="ledger-mono" style={{ fontSize: 12, padding: '9px 12px', borderRadius: 8, background: 'var(--ledger-gold-bg)', margin: 0 }}>{panelMsg}</p>}

              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <span style={{ background: st.bg, color: st.fg, padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600 }}>{st.label}</span>
                {isPaid && <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--ledger-ink)' }}>{naira(num(open.amount_paid))}</span>}
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

              {isPaid ? (
                <>
                  <div><p style={lab}>Paid</p><p style={val}>{when(open.paid_at)}</p></div>
                  <div><p style={lab}>Paystack fee</p><p style={val}>{naira(feeOf(open))}{open.paystack_fee == null ? ' (estimated)' : ''} · net {naira(num(open.amount_paid) - feeOf(open))}</p></div>
                  <div>
                    <p style={lab}>Paystack transaction</p>
                    <p style={{ ...val, color: open.payment_provider_tx_id ? undefined : 'var(--ledger-bad)' }}>
                      {open.payment_provider_tx_id ? `#${open.payment_provider_tx_id}` : 'None recorded. Not confirmed by a real payment.'}
                    </p>
                  </div>
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
                  <div><p style={lab}>Payment attempts</p><p style={val}>{open.attempt_count === 0 ? 'Never reached the payment step.' : `${open.attempt_count} started, none completed.`}</p></div>
                  <div>
                    <p style={lab}>Last reminder</p>
                    <p style={val}>{open.reminder_sent_at ? `${when(open.reminder_sent_at)} (${open.reminder_count ?? 1} sent)` : 'Never reminded'}</p>
                  </div>
                  {open.whatsapp && (
                    <a
                      href={`${waLink(open.whatsapp)}?text=${encodeURIComponent(`Hi ${open.full_name.split(' ')[0]}, this is Ascentor. Your Elevation Summit registration (${open.attendance_type === 'virtual' ? 'virtual' : 'physical'}) is saved but not confirmed yet. You can complete your payment here: https://ascentorbi.com/elevation-summit#register`)}`}
                      target="_blank" rel="noopener noreferrer" className="ledger-btn ledger-btn-ghost"
                      style={{ display: 'inline-flex', gap: 6, alignItems: 'center', justifyContent: 'center' }}
                    >
                      <MessageCircle size={14} /> Remind on WhatsApp
                    </a>
                  )}
                  <div>
                    <p style={lab}>Already paid? Paste the Paystack reference (optional)</p>
                    <input
                      value={refInput} onChange={e => setRefInput(e.target.value)} placeholder="Reference from the Paystack dashboard"
                      style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--ledger-line-strong)', background: 'var(--ledger-bg-input)', color: 'var(--ledger-ink)', fontSize: 13, fontFamily: 'var(--ledger-font-mono, monospace)' }}
                    />
                    <p style={{ fontSize: 11.5, color: 'var(--ledger-ink-soft)', margin: '5px 0 0' }}>
                      Use this when the person paid with a different email. Paystack is asked to confirm it before anything changes.
                    </p>
                  </div>
                </>
              )}

              {open.payment_reference && (
                <div>
                  <p style={lab}>Reference</p>
                  <p style={{ ...val, fontFamily: 'var(--ledger-font-mono, monospace)', fontSize: 12 }}>
                    {open.payment_reference}{' '}
                    <button type="button" aria-label="Copy reference" onClick={() => navigator.clipboard?.writeText(open.payment_reference!)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ledger-ink-soft)', verticalAlign: 'middle' }}><Copy size={13} /></button>
                  </p>
                </div>
              )}
            </div>
          );
        })()}
      </OffCanvas>
    </div>
  );
}
