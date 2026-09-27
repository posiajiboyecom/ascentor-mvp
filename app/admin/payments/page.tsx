'use client';

// /admin/payments
//   Checkouts       every attempt (subscriptions + Summit tickets); click a row for the off-canvas
//   Revenue ledger  every PAID item that feeds the dashboard revenue figure, so the total can be audited
// Compact 4-column layout: it never needs a horizontal scrollbar.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw, RotateCw, Trash2, Copy, ShieldCheck, Mail } from 'lucide-react';
import { usePageSearch } from '@/components/shell/PageSearch';
import { confirmAction } from '@/components/Modal';
import OffCanvas from '@/components/admin/OffCanvas';

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

interface LedgerItem {
  source: 'summit' | 'subscription';
  id: string;
  name: string | null;
  email: string | null;
  detail: string;
  amount: number;
  paid_at: string | null;
  reference: string | null;
  verified_at_paystack: boolean;
}

interface Detail {
  attempt: Record<string, any>;
  registration: Record<string, any> | null;
  profile: { full_name: string | null; email: string | null } | null;
}

const STATUSES = ['all', 'success', 'pending', 'abandoned', 'failed', 'duplicate'] as const;
type StatusFilter = (typeof STATUSES)[number];
const UNPAID = ['pending', 'abandoned', 'failed'];

const STATUS_STYLE: Record<Attempt['status'], { bg: string; fg: string; label: string }> = {
  success:   { bg: 'var(--ledger-good-bg, rgba(34,160,90,.14))', fg: 'var(--ledger-good)', label: 'Paid' },
  pending:   { bg: 'var(--ledger-info-bg, rgba(60,120,220,.14))', fg: 'var(--ledger-info)', label: 'Pending' },
  abandoned: { bg: 'var(--ledger-gold-bg)', fg: 'var(--ledger-gold-deep, var(--ledger-gold))', label: 'Abandoned' },
  failed:    { bg: 'var(--ledger-bad-bg)', fg: 'var(--ledger-bad)', label: 'Failed' },
  duplicate: { bg: 'var(--ledger-bad-bg)', fg: 'var(--ledger-bad)', label: 'Duplicate' },
};

// Two completely different money streams. Never mix them visually.
const KIND = {
  summit:       { label: 'Summit ticket', short: 'SUMMIT', bg: 'rgba(200,169,110,.18)', fg: '#8A6A1F', bar: '#C8A96E' },
  subscription: { label: 'Subscription',  short: 'PLAN',   bg: 'rgba(60,120,220,.14)',  fg: '#2453A6', bar: '#3C78DC' },
} as const;
type KindKey = keyof typeof KIND;
type KindFilter = 'all' | KindKey;

function KindBadge({ kind }: { kind: KindKey }) {
  const k = KIND[kind] ?? KIND.subscription;
  return (
    <span style={{ background: k.bg, color: k.fg, padding: '2px 7px', borderRadius: 6, fontSize: 10, fontWeight: 700, letterSpacing: '0.07em', whiteSpace: 'nowrap' }}>{k.short}</span>
  );
}

const nairaKobo = (kobo: number | null) => `₦${Math.round((kobo ?? 0) / 100).toLocaleString('en-NG')}`;
const naira = (n: number) => `₦${Math.round(n).toLocaleString('en-NG')}`;
const when = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-';

export default function AdminPaymentsPage() {
  const query = usePageSearch('Filter by email or reference…');
  const [view, setView] = useState<'checkouts' | 'ledger'>('checkouts');
  const [rows, setRows] = useState<Attempt[]>([]);
  const [ledger, setLedger] = useState<LedgerItem[]>([]);
  const [status, setStatus] = useState<StatusFilter>('all');
  const [kindFilter, setKindFilter] = useState<KindFilter>('subscription');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  // off-canvas
  const [openRef, setOpenRef] = useState<string | null>(null);
  const [openLedger, setOpenLedger] = useState<LedgerItem | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [panelMsg, setPanelMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // The ledger always loads: it feeds the Summit / Subscription totals above the table.
      const listUrl = `/api/admin/payments?list=1&status=${status}&kind=${kindFilter}`;
      const [ledgerRes, listRes] = await Promise.all([
        fetch('/api/admin/payments?ledger=1', { cache: 'no-store' }),
        view === 'checkouts' ? fetch(listUrl, { cache: 'no-store' }) : Promise.resolve(null),
      ]);
      const bad = [ledgerRes, listRes].find(r => r && !r.ok);
      if (bad) throw new Error(bad.status === 403 ? 'You do not have access to payments' : 'Could not load payments');
      setLedger((await ledgerRes.json()).items ?? []);
      if (listRes) setRows((await listRes.json()).attempts ?? []);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [status, view, kindFilter]);

  useEffect(() => { load(); }, [load]);

  // Load the detail whenever an attempt is opened
  useEffect(() => {
    if (!openRef) { setDetail(null); return; }
    let cancelled = false;
    setDetailLoading(true);
    setPanelMsg(null);
    fetch(`/api/admin/payments?detail=${encodeURIComponent(openRef)}`, { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then(d => { if (!cancelled) setDetail(d); })
      .catch(() => { if (!cancelled) setPanelMsg('Could not load details.'); })
      .finally(() => { if (!cancelled) setDetailLoading(false); });
    return () => { cancelled = true; };
  }, [openRef]);

  const closePanel = () => { setOpenRef(null); setOpenLedger(null); setPanelMsg(null); };

  const reconcile = async () => {
    setRunning(true);
    setNote(null);
    try {
      const res = await fetch('/api/admin/payments', { method: 'POST' });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Reconciliation failed');
      setNote(`Checked ${body.checked}: ${body.recovered} recovered, ${body.adopted ?? 0} legacy payments adopted, ${body.failed} failed, ${body.abandoned} newly abandoned, ${body.emailsRetried ?? 0} emails retried.`);
      await load();
    } catch (e) {
      setNote((e as Error).message);
    }
    setRunning(false);
  };

  const call = async (method: string, body: unknown) => {
    const res = await fetch('/api/admin/payments', {
      method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, data };
  };

  const runAction = async (action: 'verify' | 'resend') => {
    if (!openRef) return;
    setBusy(true); setPanelMsg(null);
    const { ok, data } = await call('POST', { action, reference: openRef });
    setPanelMsg(data.message || data.error || (ok ? 'Done.' : 'Action failed.'));
    setBusy(false);
    if (ok) {
      await load();
      const d = await fetch(`/api/admin/payments?detail=${encodeURIComponent(openRef)}`, { cache: 'no-store' });
      if (d.ok) setDetail(await d.json());
    }
  };

  const deleteAttempt = async (reference: string) => {
    const yes = await confirmAction(
      'Delete this payment attempt? Use this only for test payments. If this customer later pays with this reference, their payment is recovered by the next Reconcile.',
      { confirmLabel: 'Delete', danger: true },
    );
    if (!yes) return;
    setBusy(true);
    const { ok, data } = await call('DELETE', { kind: 'attempt', reference });
    setBusy(false);
    if (!ok) { setPanelMsg(data.error || 'Delete failed'); return; }
    if (data.skipped) { setPanelMsg('Paid payments cannot be deleted here.'); return; }
    closePanel();
    setNote('Payment attempt deleted.');
    await load();
  };

  const deleteAllListed = async () => {
    const targets = filtered.filter(r => UNPAID.includes(r.status)).map(r => r.reference);
    if (!targets.length) return;
    const yes = await confirmAction(
      `Delete all ${targets.length} unpaid attempts currently listed? This is for clearing test payments. Paid payments are never deleted.`,
      { confirmLabel: `Delete ${targets.length}`, danger: true },
    );
    if (!yes) return;
    const { ok, data } = await call('DELETE', { kind: 'attempts', references: targets });
    setNote(ok ? `Deleted ${data.deleted} attempt${data.deleted === 1 ? '' : 's'}.` : (data.error || 'Delete failed'));
    await load();
  };

  const deleteLedgerItem = async (item: LedgerItem) => {
    const yes = await confirmAction(
      item.source === 'summit'
        ? `Delete the PAID Summit registration for ${item.name ?? item.email} (${naira(item.amount)})? This permanently removes the registration and its revenue. Only do this for test data.`
        : `Delete this recorded payment of ${naira(item.amount)}? It only removes it from revenue totals. It does not change the user's access.`,
      { confirmLabel: 'Delete permanently', danger: true },
    );
    if (!yes) return;
    setBusy(true);
    const { ok, data } = await call('DELETE', item.source === 'summit'
      ? { kind: 'summit_registration', id: item.id }
      : { kind: 'payment', id: item.id });
    setBusy(false);
    if (!ok) { setPanelMsg(data.error || 'Delete failed'); return; }
    closePanel();
    setNote('Deleted. Revenue totals updated.');
    await load();
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(r => (r.email ?? '').toLowerCase().includes(q) || r.reference.toLowerCase().includes(q));
  }, [rows, query]);

  const filteredLedger = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = kindFilter === 'all' ? ledger : ledger.filter(i => i.source === kindFilter);
    if (!q) return base;
    return base.filter(i => (i.email ?? '').toLowerCase().includes(q) || (i.name ?? '').toLowerCase().includes(q) || (i.reference ?? '').toLowerCase().includes(q));
  }, [ledger, query]);

  const totals = useMemo(() => {
    const t = { paid: 0, abandoned: 0 };
    for (const r of filtered) {
      if (r.status === 'success') t.paid += r.amount_kobo ?? 0;
      if (r.status === 'abandoned') t.abandoned += r.amount_kobo ?? 0;
    }
    return t;
  }, [filtered]);

  const ledgerTotal = filteredLedger.reduce((t, i) => t + i.amount, 0);
  const ledgerSummit = ledger.filter(i => i.source === 'summit').reduce((t, i) => t + i.amount, 0);
  const ledgerSub = ledger.filter(i => i.source === 'subscription').reduce((t, i) => t + i.amount, 0);
  const unpaidListed = filtered.filter(r => UNPAID.includes(r.status)).length;

  const panelOpen = !!openRef || !!openLedger;
  const att = detail?.attempt;
  const reg = detail?.registration;
  const isPaid = att?.status === 'success' || att?.status === 'duplicate';

  const cell: React.CSSProperties = { padding: '10px 12px', verticalAlign: 'middle' };
  const label: React.CSSProperties = { fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ledger-ink-soft)', margin: '0 0 3px' };
  const val: React.CSSProperties = { fontSize: 13.5, color: 'var(--ledger-ink)', margin: 0, wordBreak: 'break-word' };

  return (
    <div className="animate-fade-up" data-fullwidth>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
        <div>
          <h1 className="ledger-h1" style={{ fontSize: 26, margin: 0 }}>Subscription Payments</h1>
          <p className="ledger-mono" style={{ fontSize: 12, margin: '4px 0 0' }}>
            Elevation Summit registrations are managed on <a href="/admin/elevation-summit/registrations" style={{ color: '#8A6A1F', textDecoration: 'underline' }}>Summit Registrations</a>.
          </p>
          <p className="ledger-mono" style={{ fontSize: 12, margin: '4px 0 0' }}>
            {view === 'ledger'
              ? `${filteredLedger.length} paid items · ${naira(ledgerTotal)} counted as revenue`
              : `${filtered.length} attempts · ${nairaKobo(totals.paid)} paid · ${nairaKobo(totals.abandoned)} abandoned`}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
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

      <div role="tablist" aria-label="View" style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        {([['checkouts', 'Checkouts'], ['ledger', 'Revenue ledger']] as const).map(([k, l]) => (
          <button key={k} type="button" role="tab" aria-selected={view === k} onClick={() => setView(k)}
            className={`ledger-btn ${view === k ? 'ledger-btn-primary' : 'ledger-btn-ghost'}`}>{l}</button>
        ))}
      </div>

      {/* Summit tickets and subscriptions are separate revenue streams */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10, marginBottom: 12 }}>
        {(['summit', 'subscription'] as KindKey[]).map(k => {
          const active = kindFilter === k;
          return (
            <button key={k} type="button" aria-pressed={active}
              onClick={() => setKindFilter(active ? 'all' : k)}
              className="rounded-xl ledger-panel"
              style={{ textAlign: 'left', padding: '12px 14px', cursor: 'pointer', borderLeft: `4px solid ${KIND[k].bar}`, outline: active ? `2px solid ${KIND[k].bar}` : 'none', background: 'var(--ledger-panel, #fff)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <KindBadge kind={k} />
                <span style={{ fontSize: 12, color: 'var(--ledger-ink-soft)' }}>{k === 'summit' ? 'Elevation Summit tickets' : 'Plan subscriptions'}</span>
              </div>
              <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--ledger-ink)', marginTop: 6 }}>
                {naira(k === 'summit' ? ledgerSummit : ledgerSub)}
              </div>
              <div style={{ fontSize: 11, color: 'var(--ledger-ink-soft)' }}>
                paid · {ledger.filter(i => i.source === k).length} item{ledger.filter(i => i.source === k).length === 1 ? '' : 's'}{active ? ' · filtered' : ' · click to filter'}
              </div>
            </button>
          );
        })}
      </div>

      {view === 'checkouts' && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12, alignItems: 'center' }}>
          {STATUSES.map(s => (
            <button key={s} type="button" aria-pressed={status === s} onClick={() => setStatus(s)}
              className={`ledger-btn ${status === s ? 'ledger-btn-primary' : 'ledger-btn-ghost'}`}
              style={{ textTransform: 'capitalize' }}>
              {s === 'success' ? 'Paid' : s}
            </button>
          ))}
          {unpaidListed > 0 && status !== 'all' && status !== 'success' && status !== 'duplicate' && (
            <button type="button" onClick={deleteAllListed} className="ledger-btn ledger-btn-ghost"
              style={{ marginLeft: 'auto', color: 'var(--ledger-bad)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Trash2 size={14} /> Delete all {unpaidListed} listed
            </button>
          )}
        </div>
      )}

      {view === 'ledger' && (
        <p className="ledger-mono" style={{ fontSize: 12, margin: '0 0 12px' }}>
          Every line here is counted in the dashboard revenue. If a line is a test payment, open it and delete it.
        </p>
      )}

      {note && <p className="ledger-mono" style={{ fontSize: 12, marginBottom: 10 }}>{note}</p>}
      {error && (
        <div className="rounded-lg p-3 mb-4 text-xs" style={{ background: 'var(--ledger-bad-bg)', color: 'var(--ledger-bad)' }}>{error}</div>
      )}

      <div className="rounded-xl ledger-panel" style={{ overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: 'left', color: 'var(--ledger-ink-soft)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {(view === 'ledger'
                ? [['Customer', 'auto'], ['Amount', 90], ['Source', 110], ['Paid', 110]]
                : [['Customer', 'auto'], ['Amount', 90], ['Status', 110], ['Started', 110]]
              ).map(([h, w]) => (
                <th key={h as string} style={{ ...cell, fontWeight: 600, borderBottom: '1px solid var(--ledger-line)', width: w as any }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && (view === 'ledger' ? ledger : rows).length === 0 ? (
              <tr><td colSpan={4} style={{ padding: 28, textAlign: 'center' }} className="ledger-mono">Loading…</td></tr>
            ) : view === 'ledger' ? (
              filteredLedger.length === 0 ? (
                <tr><td colSpan={4} style={{ padding: 28, textAlign: 'center' }} className="ledger-mono">No paid items.</td></tr>
              ) : filteredLedger.map(i => (
                <tr key={`${i.source}-${i.id}`} onClick={() => { setOpenLedger(i); setOpenRef(null); setPanelMsg(null); }}
                  style={{ borderTop: '1px solid var(--ledger-line)', cursor: 'pointer' }} className="hover:bg-black/5">
                  <td style={{ ...cell, overflow: 'hidden', borderLeft: `4px solid ${KIND[i.source].bar}` }}>
                    <div style={{ color: 'var(--ledger-ink)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{i.name ?? i.email ?? '-'}</div>
                    <div style={{ color: 'var(--ledger-ink-soft)', fontSize: 11.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{i.name ? i.email : i.detail}</div>
                  </td>
                  <td style={{ ...cell, fontWeight: 600, color: 'var(--ledger-ink)', whiteSpace: 'nowrap' }}>{naira(i.amount)}</td>
                  <td style={cell}><KindBadge kind={i.source} /></td>
                  <td style={{ ...cell, color: 'var(--ledger-ink-soft)', whiteSpace: 'nowrap' }}>{when(i.paid_at)}</td>
                </tr>
              ))
            ) : filtered.length === 0 ? (
              <tr><td colSpan={4} style={{ padding: 28, textAlign: 'center' }} className="ledger-mono">No payment attempts found.</td></tr>
            ) : filtered.map(r => {
              const st = STATUS_STYLE[r.status] ?? STATUS_STYLE.pending;
              return (
                <tr key={r.reference} onClick={() => { setOpenRef(r.reference); setOpenLedger(null); }}
                  style={{ borderTop: '1px solid var(--ledger-line)', cursor: 'pointer' }} className="hover:bg-black/5">
                  <td style={{ ...cell, overflow: 'hidden', borderLeft: `4px solid ${KIND[r.kind]?.bar ?? '#999'}` }}>
                    <div style={{ color: 'var(--ledger-ink)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.email ?? '-'}</div>
                    <div style={{ marginTop: 3 }}><KindBadge kind={r.kind} /></div>
                  </td>
                  <td style={{ ...cell, fontWeight: 600, color: 'var(--ledger-ink)', whiteSpace: 'nowrap' }}>{nairaKobo(r.amount_kobo)}</td>
                  <td style={cell}>
                    <span style={{ background: st.bg, color: st.fg, padding: '3px 9px', borderRadius: 999, fontSize: 11.5, fontWeight: 600, whiteSpace: 'nowrap' }}>{st.label}</span>
                  </td>
                  <td style={{ ...cell, color: 'var(--ledger-ink-soft)', whiteSpace: 'nowrap' }}>{when(r.created_at)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Off-canvas (portal: see components/admin/OffCanvas.tsx) ───── */}
      <OffCanvas
        open={panelOpen}
        onClose={closePanel}
        title={
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            {openLedger ? 'Paid item' : 'Payment details'}
            {openLedger && <KindBadge kind={openLedger.source} />}
            {att && <KindBadge kind={att.kind} />}
          </span>
        }
        footer={!panelMsg && !openLedger && !att ? null : (
          <>
            {/* Shown right next to the buttons that produce it: it's in the
                sticky footer, not the scrollable body, so the admin never has
                to scroll up to see what a click just did. */}
            {panelMsg && <p className="ledger-mono" style={{ fontSize: 12, padding: '9px 12px', borderRadius: 8, background: 'var(--ledger-gold-bg)', margin: '0 0 4px' }}>{panelMsg}</p>}
            {openLedger ? (
              <button type="button" disabled={busy} onClick={() => deleteLedgerItem(openLedger)} className="ledger-btn ledger-btn-ghost"
                style={{ color: 'var(--ledger-bad)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <Trash2 size={14} /> Delete (test data)
              </button>
            ) : att ? (
              <>
                {!isPaid && (
                  <button type="button" disabled={busy} onClick={() => runAction('verify')} className="ledger-btn ledger-btn-primary" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    <ShieldCheck size={14} /> {busy ? 'Checking…' : 'Verify with Paystack'}
                  </button>
                )}
                {att.kind === 'summit' && (att.status === 'success' || reg?.payment_status === 'paid') && (
                  <button type="button" disabled={busy} onClick={() => runAction('resend')} className="ledger-btn ledger-btn-primary" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    <Mail size={14} /> {busy ? 'Sending…' : 'Send confirmation email + ticket'}
                  </button>
                )}
                {UNPAID.includes(att.status) && (
                  <button type="button" disabled={busy} onClick={() => deleteAttempt(att.reference)} className="ledger-btn ledger-btn-ghost"
                    style={{ color: 'var(--ledger-bad)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    <Trash2 size={14} /> Delete (test payment)
                  </button>
                )}
              </>
            ) : null}
          </>
        )}
      >
        {/* Revenue-ledger item */}
        {openLedger && (
          <div style={{ display: 'grid', gap: 14 }}>
            <div><p style={label}>Customer</p><p style={val}>{openLedger.name ?? '-'}</p><p style={{ ...val, color: 'var(--ledger-ink-soft)' }}>{openLedger.email ?? '-'}</p></div>
            <div><p style={label}>Amount counted</p><p style={{ ...val, fontWeight: 700, fontSize: 18 }}>{naira(openLedger.amount)}</p></div>
            <div><p style={label}>What for</p><p style={val}>{openLedger.detail}</p></div>
            <div><p style={label}>Paid</p><p style={val}>{when(openLedger.paid_at)}</p></div>
            <div><p style={label}>Reference</p><p style={{ ...val, fontFamily: 'var(--ledger-font-mono, monospace)', fontSize: 12 }}>{openLedger.reference ?? '-'}</p></div>
            <div>
              <p style={label}>Confirmed at Paystack</p>
              <p style={val}>{openLedger.verified_at_paystack ? 'Yes, a Paystack transaction id is recorded.' : 'No transaction id on record. This may be a test or manual entry.'}</p>
            </div>
          </div>
        )}

        {/* Attempt */}
        {openRef && (detailLoading && !att ? (
          <p className="ledger-mono" style={{ fontSize: 12 }}>Loading…</p>
        ) : att && (
          <div style={{ display: 'grid', gap: 14 }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              {(() => { const st = STATUS_STYLE[att.status as Attempt['status']] ?? STATUS_STYLE.pending; return (
                <span style={{ background: st.bg, color: st.fg, padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600 }}>{st.label}</span>
              ); })()}
              <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--ledger-ink)' }}>{nairaKobo(att.amount_kobo)}</span>
            </div>

            <div>
              <p style={label}>Customer</p>
              <p style={val}>{reg?.full_name ?? detail?.profile?.full_name ?? '-'}</p>
              <p style={{ ...val, color: 'var(--ledger-ink-soft)' }}>{att.email ?? reg?.email ?? detail?.profile?.email ?? '-'}</p>
            </div>

            {att.kind === 'summit' && reg && (
              <>
                <div>
                  <p style={label}>Phone</p>
                  <p style={val}>{reg.whatsapp ? <a href={`tel:${reg.whatsapp}`} style={{ color: 'var(--ledger-gold-deep, var(--ledger-gold))' }}>{reg.whatsapp}</a> : <span style={{ color: 'var(--ledger-bad)' }}>not captured</span>}</p>
                </div>
                <div><p style={label}>Attendance</p><p style={val}>{reg.attendance_type === 'virtual' ? 'Virtual' : 'Physical (Onsite, Lagos)'}</p></div>
                <div><p style={label}>Company</p><p style={val}>{reg.organisation || '-'}</p></div>
                <div><p style={label}>Registration</p><p style={val}>{reg.payment_status === 'paid' ? 'Paid and confirmed' : 'Registered, not paid'}</p></div>
                {reg.payment_status === 'paid' && (
                  <div>
                    <p style={label}>Ticket email</p>
                    <p style={val}>
                      {reg.confirmation_email_sent_at ? `Sent ${when(reg.confirmation_email_sent_at)}`
                        : reg.confirmation_email_error ? `FAILED: ${reg.confirmation_email_error}`
                        : 'No delivery record. Use Resend if the customer did not get it.'}
                    </p>
                  </div>
                )}
              </>
            )}

            <div><p style={label}>Type</p><p style={{ ...val, textTransform: 'capitalize' }}>{att.kind}</p></div>
            <div><p style={label}>Started</p><p style={val}>{when(att.created_at)}</p></div>
            {(att.paid_at || att.abandoned_at) && (
              <div><p style={label}>{att.paid_at ? 'Paid' : 'Abandoned'}</p><p style={val}>{when(att.paid_at ?? att.abandoned_at)}</p></div>
            )}
            {att.provider_status && <div><p style={label}>Paystack status</p><p style={val}>{att.provider_status}</p></div>}
            {att.failure_reason && <div><p style={label}>Note</p><p style={{ ...val, color: 'var(--ledger-bad)' }}>{att.failure_reason}</p></div>}
            <div>
              <p style={label}>Reference</p>
              <p style={{ ...val, fontFamily: 'var(--ledger-font-mono, monospace)', fontSize: 12 }}>
                {att.reference}{' '}
                <button type="button" aria-label="Copy reference" onClick={() => navigator.clipboard?.writeText(att.reference)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ledger-ink-soft)', verticalAlign: 'middle' }}><Copy size={13} /></button>
              </p>
            </div>

          </div>
        ))}
      </OffCanvas>
    </div>
  );
}
