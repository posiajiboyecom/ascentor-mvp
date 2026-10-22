'use client';

// Subscriptions (Billing v2). Rules live on the server (app/admin/c/payments/subscriptions/actions.ts): this only draws them.
import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Check, Search, X } from 'lucide-react';
import { RANK, toneOf, type Level } from '@/lib/admin/areas';
import { SUB_STATE_ORDER, canRetryCharge, chargingNote, csvText, type ChargingModeKey } from '@/lib/admin/billing-admin';
import type { SubRow, SubKpis, EventLine } from '@/lib/admin/billing-admin-data';
import { cancelSubscriptionAdmin, extendTrial, retryChargeNow, subscriptionEvents } from '@/app/admin/c/payments/subscriptions/actions';
import '@/styles/admin-console.css';

const COLS = ['Member', 'Plan', 'Price', 'Billing', 'State', 'Trial ends', 'Next charge', 'Last charge', 'Failed', 'Card', 'Group', 'Credit'];
const cells = (r: SubRow) => [r.name, r.plan, r.priceType, r.cycle, r.state, r.trialEnd, r.nextCharge, r.lastCharge, String(r.failed), r.card, r.group, r.credit];
const tone = (v: string) => { const t = toneOf(v); return t === 'plain' ? '' : t; };

export default function SubscriptionsScreen({ rows, kpis, note, level, v2On, mode }: {
  rows: SubRow[]; kpis: SubKpis; note: string; level: Level; v2On: boolean; mode: ChargingModeKey;
}) {
  const router = useRouter();
  const [filter, setFilter] = useState('All');
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<string | null>(null);
  const [events, setEvents] = useState<EventLine[] | null>(null);
  const [confirm, setConfirm] = useState<{ id: 'cancel' | 'extend' | 'retry'; row: SubRow } | null>(null);
  const [toast, setToast] = useState('');
  const [busy, start] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flash = (t: string) => { setToast(t); if (timer.current) clearTimeout(timer.current); timer.current = setTimeout(() => setToast(''), 4500); };
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const can = (need: Level) => RANK[level] >= RANK[need];
  const banner = chargingNote(mode, v2On);
  const selected = sel ? rows.find((r) => r.userId === sel) ?? null : null;

  useEffect(() => {
    setEvents(null);
    if (!sel) return;
    let live = true;
    void subscriptionEvents(sel).then((e) => { if (live) setEvents(e); });
    return () => { live = false; };
  }, [sel]);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => (filter === 'All' || r.state === filter) && (!needle || cells(r).join(' ').toLowerCase().includes(needle)));
  }, [rows, filter, q]);

  const exportCsv = () => {
    const blob = new Blob([csvText(COLS, shown.map(cells))], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'subscriptions.csv'; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  const run = (id: 'cancel' | 'extend' | 'retry', r: SubRow) => {
    setConfirm(null);
    start(async () => {
      const res = id === 'cancel' ? await cancelSubscriptionAdmin(r.userId) : id === 'extend' ? await extendTrial(r.userId) : await retryChargeNow(r.userId);
      flash(res.ok ? res.message || 'Done.' : res.error || 'That did not work.');
      if (res.ok) { router.refresh(); setEvents(null); void subscriptionEvents(r.userId).then(setEvents); }
    });
  };

  const CONFIRM: Record<'cancel' | 'extend' | 'retry', [string, string]> = {
    cancel: ['Cancel subscription', 'A trial is cancelled at once and never charged. A paying member keeps access until the end of the period they paid for.'],
    extend: ['Extend trial by 7 days', 'Moves the trial end and the first charge date back by 7 days.'],
    retry: ['Retry charge now', 'This charges the default card for the failed renewal. Charging is live, so a real card is charged.'],
  };

  return (
    <div className="admc">
      <div className="pg screen">
        <div className="sb" style={{ alignItems: 'flex-end' }}>
          <div><p className="eyebrow">Revenue</p><h1 className="pt">Subscriptions</h1><span className="ul" /></div>
          <div className="row" style={{ gap: 8 }}>
            <Link href="/admin/c/payments" className="btn bs">Back to Payments</Link>
            <button type="button" className="btn bp" onClick={exportCsv}>Export CSV</button>
          </div>
        </div>
        <p className="p" style={{ maxWidth: 760 }}>Every Billing v2 subscription, its payment state and what happens next. Members on the old plans are not listed here.</p>

        <div className="rz" role="status" style={{ borderColor: banner.tone === 'bad' ? 'var(--err)' : banner.tone === 'warn' ? 'var(--gold)' : undefined }}>
          <p className="h3" style={{ margin: 0 }}><span className={`tag ${banner.tone}`}><i />{banner.title}</span></p>
          <p className="sm" style={{ color: 'var(--text)', marginTop: 6 }}>{banner.body}</p>
        </div>

        <div className="kpis">
          {([['On trial', String(kpis.trial)], ['Active', String(kpis.active)], ['In grace', String(kpis.grace)], ['Lapsed', String(kpis.lapsed)], ['MRR estimate', kpis.mrr], ['Failed this week', String(kpis.failedWeek)]] as const).map(([k, v]) => (
            <div key={k} className="card kpi"><span className="k">{k}</span><span className="v">{v}</span>{k === 'MRR estimate' ? <span className="sm">Catalog prices, active and grace only</span> : null}</div>
          ))}
        </div>

        {level === 'view' && <div className="rz"><p className="sm" style={{ color: 'var(--text)' }}>View only. Your role can look at this area but not change it.</p></div>}
        {note && <div className="rz"><p className="sm" style={{ color: 'var(--text)' }}>{note}</p></div>}

        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div className="opts" role="group" aria-label="Filter by state">
            {['All', ...SUB_STATE_ORDER].map((f) => {
              const n = f === 'All' ? rows.length : rows.filter((r) => r.state === f).length;
              return <button key={f} type="button" aria-pressed={filter === f} className={`opt${filter === f ? ' on' : ''}`} onClick={() => setFilter(f)}>{f} · {n}</button>;
            })}
          </div>
          <label className="search" style={{ display: 'flex', alignItems: 'center', gap: 8, height: 40, padding: '0 12px', border: '1px solid var(--border)', borderRadius: 10, background: 'var(--surface)', minWidth: 240 }}>
            <Search className="ic ics" aria-hidden />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search subscriptions" aria-label="Search subscriptions" style={{ border: 0, outline: 0, background: 'none', flex: 1, minWidth: 0 }} />
          </label>
        </div>

        <div className="tblwrap">
          <table className="tbl">
            <thead><tr>{COLS.map((c) => <th key={c} scope="col">{c}</th>)}<th scope="col"><span style={{ position: 'absolute', left: -9999 }}>Actions</span></th></tr></thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.userId} className={sel === r.userId ? 'sel' : ''}>
                  {cells(r).map((v, c) => (
                    <td key={c}>
                      {c === 0 ? <button type="button" className="rowbtn" onClick={() => setSel(r.userId)}>{v}</button>
                        : c === 4 ? <span className={`tag ${tone(v)}`}><i />{v}{r.leaving ? ', ending' : ''}</span>
                        : <span className="sm" style={{ color: 'var(--text)' }}>{v}</span>}
                    </td>
                  ))}
                  <td style={{ textAlign: 'right' }}><button type="button" className="lk" onClick={() => setSel(r.userId)}>Open</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          {shown.length === 0 && (
            <div className="empty"><p className="h3">Nothing here</p><p className="sm">{rows.length === 0 ? 'There are no Billing v2 subscriptions yet.' : 'No rows match this filter or search.'}</p></div>
          )}
        </div>
        <p className="sm">Showing {shown.length} of {rows.length}.</p>
      </div>

      {selected && (
        <>
          <button type="button" className="scrim" aria-label="Close details" onClick={() => setSel(null)} style={{ border: 0 }} />
          <aside className="drawer" role="dialog" aria-label={`${selected.name} subscription`}>
            <div className="dhead">
              <div style={{ flex: 1, minWidth: 0 }}>
                <p className="eyebrow">Subscription</p>
                <p className="h2" style={{ overflowWrap: 'anywhere' }}>{selected.name}</p>
                <p style={{ margin: '8px 0 0' }}><span className={`tag ${tone(selected.state)}`}><i />{selected.state}{selected.leaving ? ', ending' : ''}</span></p>
              </div>
              <button type="button" className="ib" aria-label="Close" onClick={() => setSel(null)} style={{ background: 'none', border: 0, cursor: 'pointer', width: 40, height: 40 }}><X className="ic" aria-hidden /></button>
            </div>
            <div className="dbody">
              <dl className="kv">
                {COLS.slice(1).map((k, j) => (<div key={k} style={{ display: 'contents' }}><dt>{k}</dt><dd>{cells(selected)[j + 1]}</dd></div>))}
              </dl>
              <div className="st8">
                <p className="sl">Actions</p>
                <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                  {canRetryCharge(mode, selected.state.toLowerCase()) && can('edit') && <button type="button" className="btn bs" disabled={busy} onClick={() => setConfirm({ id: 'retry', row: selected })}>Retry charge now</button>}
                  {can('edit') && (selected.state === 'Trial' || selected.state === 'Active' || selected.state === 'Grace') && !selected.leaving && <button type="button" className="btn bd" disabled={busy} onClick={() => setConfirm({ id: 'cancel', row: selected })}>Cancel subscription</button>}
                  {can('full') && selected.state === 'Trial' && <button type="button" className="btn bs" disabled={busy} onClick={() => setConfirm({ id: 'extend', row: selected })}>Extend trial by 7 days</button>}
                </div>
                {selected.state === 'Grace' && mode !== 'live' && <p className="sm">Charging is off, so a failed renewal cannot be retried from here.</p>}
                {level === 'view' && <p className="sm">View only.</p>}
                {level === 'edit' && selected.state === 'Trial' && <p className="sm">Extending a trial needs a role with Full access to Payments.</p>}
              </div>
              <div className="st8">
                <p className="sl">Billing timeline</p>
                {events === null ? <p className="sm">Loading...</p> : events.length === 0 ? <p className="sm">No billing events yet.</p> : events.map((e, i) => (
                  <div key={i} className="rz"><p className="p" style={{ fontWeight: 600 }}>{e.label}</p><p className="sm">{e.when}{e.detail ? `, ${e.detail}` : ''}</p></div>
                ))}
              </div>
            </div>
          </aside>
        </>
      )}

      {confirm && (
        <>
          <button type="button" className="scrim modalscrim" aria-label="Cancel" onClick={() => setConfirm(null)} style={{ border: 0 }} />
          <div className="modal" role="alertdialog" aria-label={`${CONFIRM[confirm.id][0]}?`}>
            <p className="h2">{CONFIRM[confirm.id][0]}?</p>
            <p className="p">{confirm.row.name}. {CONFIRM[confirm.id][1]}</p>
            <div className="row" style={{ justifyContent: 'flex-end', gap: 8 }}>
              <button type="button" className="btn bs" onClick={() => setConfirm(null)}>Go back</button>
              <button type="button" className={`btn ${confirm.id === 'cancel' ? 'bd' : 'bp'}`} onClick={() => run(confirm.id, confirm.row)}>{CONFIRM[confirm.id][0]}</button>
            </div>
          </div>
        </>
      )}

      {toast && <div className="toast" role="status" aria-live="polite"><Check className="gc" aria-hidden />{toast}</div>}
    </div>
  );
}
