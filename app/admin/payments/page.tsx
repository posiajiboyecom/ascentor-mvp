'use client';

// /admin/payments - every checkout attempt (subscriptions + Summit tickets),
// with status filters, page-scoped search and a manual reconcile.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw, RotateCw } from 'lucide-react';
import { usePageSearch } from '@/components/shell/PageSearch';

interface Attempt {
  reference: string;
  kind: 'subscription' | 'summit';
  status: 'pending' | 'success' | 'failed' | 'abandoned' | 'duplicate';
  email: string | null;
  amount_kobo: number | null;
  currency: string | null;
  created_at: string;
  paid_at: string | null;
  abandoned_at: string | null;
  provider_status: string | null;
  failure_reason: string | null;
  recovery_sent_at: string | null;
}

const STATUSES = ['all', 'success', 'pending', 'abandoned', 'failed', 'duplicate'] as const;
type StatusFilter = (typeof STATUSES)[number];

const STATUS_STYLE: Record<Attempt['status'], { bg: string; fg: string; label: string }> = {
  success:   { bg: 'var(--ledger-good-bg, rgba(34,160,90,.14))', fg: 'var(--ledger-good)', label: 'Paid' },
  pending:   { bg: 'var(--ledger-info-bg, rgba(60,120,220,.14))', fg: 'var(--ledger-info)', label: 'Pending' },
  abandoned: { bg: 'var(--ledger-gold-bg)', fg: 'var(--ledger-gold-deep, var(--ledger-gold))', label: 'Abandoned' },
  failed:    { bg: 'var(--ledger-bad-bg)', fg: 'var(--ledger-bad)', label: 'Failed' },
  duplicate: { bg: 'var(--ledger-bad-bg)', fg: 'var(--ledger-bad)', label: 'Duplicate - refund' },
};

const naira = (kobo: number | null) => `₦${Math.round((kobo ?? 0) / 100).toLocaleString('en-NG')}`;
const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-';

export default function AdminPaymentsPage() {
  const query = usePageSearch('Filter by email or reference…');
  const [rows, setRows] = useState<Attempt[]>([]);
  const [status, setStatus] = useState<StatusFilter>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/payments?list=1&status=${status}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(res.status === 403 ? 'You do not have access to payments' : 'Could not load payments');
      setRows((await res.json()).attempts ?? []);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => { load(); }, [load]);

  const reconcile = async () => {
    setRunning(true);
    setNote(null);
    try {
      const res = await fetch('/api/admin/payments', { method: 'POST' });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Reconciliation failed');
      setNote(`Checked ${body.checked}: ${body.recovered} recovered, ${body.failed} failed, ${body.abandoned} newly abandoned.`);
      await load();
    } catch (e) {
      setNote((e as Error).message);
    }
    setRunning(false);
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(r => (r.email ?? '').toLowerCase().includes(q) || r.reference.toLowerCase().includes(q));
  }, [rows, query]);

  const totals = useMemo(() => {
    const t = { paid: 0, abandoned: 0 };
    for (const r of filtered) {
      if (r.status === 'success') t.paid += r.amount_kobo ?? 0;
      if (r.status === 'abandoned') t.abandoned += r.amount_kobo ?? 0;
    }
    return t;
  }, [filtered]);

  return (
    <div className="animate-fade-up">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <div>
          <h1 className="ledger-h1" style={{ fontSize: 26, margin: 0 }}>Payments</h1>
          <p className="ledger-mono" style={{ fontSize: 12, margin: '4px 0 0' }}>
            {filtered.length} attempts · {naira(totals.paid)} paid · {naira(totals.abandoned)} abandoned
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="ledger-btn ledger-btn-ghost" onClick={load} disabled={loading}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
          <button type="button" className="ledger-btn ledger-btn-primary" onClick={reconcile} disabled={running}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            title="Re-check pending payments with Paystack, recover paid ones, flag abandoned ones">
            <RotateCw size={14} className={running ? 'animate-spin' : ''} /> {running ? 'Reconciling…' : 'Reconcile now'}
          </button>
        </div>
      </div>

      <div role="tablist" aria-label="Filter by status" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
        {STATUSES.map(s => (
          <button
            key={s} type="button" role="tab" aria-selected={status === s}
            onClick={() => setStatus(s)}
            className={`ledger-btn ${status === s ? 'ledger-btn-primary' : 'ledger-btn-ghost'}`}
            style={{ textTransform: 'capitalize' }}
          >
            {s === 'success' ? 'Paid' : s}
          </button>
        ))}
      </div>

      {note && <p className="ledger-mono" style={{ fontSize: 12, marginBottom: 10 }}>{note}</p>}
      {error && (
        <div className="rounded-lg p-3 mb-4 text-xs" style={{ background: 'var(--ledger-bad-bg)', color: 'var(--ledger-bad)' }}>{error}</div>
      )}

      <div className="rounded-xl ledger-panel" style={{ overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760, fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: 'left', color: 'var(--ledger-ink-soft)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {['Customer', 'Type', 'Amount', 'Status', 'Started', 'Paid / abandoned', 'Reference'].map(h => (
                  <th key={h} style={{ padding: '12px 14px', fontWeight: 600, borderBottom: '1px solid var(--ledger-line)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && rows.length === 0 ? (
                <tr><td colSpan={7} style={{ padding: 28, textAlign: 'center' }} className="ledger-mono">Loading…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} style={{ padding: 28, textAlign: 'center' }} className="ledger-mono">No payment attempts found.</td></tr>
              ) : filtered.map(r => {
                const st = STATUS_STYLE[r.status] ?? STATUS_STYLE.pending;
                return (
                  <tr key={r.reference} style={{ borderBottom: '1px solid var(--ledger-line)' }}>
                    <td style={{ padding: '11px 14px', color: 'var(--ledger-ink)', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.email ?? '-'}</td>
                    <td style={{ padding: '11px 14px', textTransform: 'capitalize', color: 'var(--ledger-ink-soft)' }}>{r.kind}</td>
                    <td style={{ padding: '11px 14px', fontWeight: 600, color: 'var(--ledger-ink)', whiteSpace: 'nowrap' }}>{naira(r.amount_kobo)}</td>
                    <td style={{ padding: '11px 14px' }}>
                      <span title={r.failure_reason ?? undefined}
                        style={{ background: st.bg, color: st.fg, padding: '3px 9px', borderRadius: 999, fontSize: 11.5, fontWeight: 600, whiteSpace: 'nowrap' }}>
                        {st.label}
                      </span>
                    </td>
                    <td style={{ padding: '11px 14px', color: 'var(--ledger-ink-soft)', whiteSpace: 'nowrap' }}>{when(r.created_at)}</td>
                    <td style={{ padding: '11px 14px', color: 'var(--ledger-ink-soft)', whiteSpace: 'nowrap' }}>{when(r.paid_at ?? r.abandoned_at)}</td>
                    <td style={{ padding: '11px 14px', fontFamily: 'var(--ledger-font-mono, monospace)', fontSize: 11.5, color: 'var(--ledger-ink-soft)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.reference}>{r.reference}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
