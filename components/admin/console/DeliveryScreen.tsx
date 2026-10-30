'use client';

// Summit ticket-email delivery: who has been sent their ticket, who has not, and a one-press "Resend all unsent" that keeps going
// until everyone is done. The rules live on the server (app/admin/c/registrations/delivery/actions.ts); this only draws them and
// drives the loop. State is in the database, so closing the page and pressing the button again continues where it stopped.
import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { exportDeliveryCsv, resendOneAction, sendBatchAction } from '@/app/admin/c/registrations/delivery/actions';
import { countDelivery, filterDelivery, owed, progressText, statusLabel, type DeliveryFilter, type DeliveryRow } from '@/lib/summitDeliveryCore';

type RunState = 'idle' | 'running' | 'pausing' | 'paused' | 'stopped' | 'done';
interface Run { state: RunState; sent: number; failed: number; total: number; message: string }

const TABS: { id: DeliveryFilter; label: string }[] = [{ id: 'all', label: 'All' }, { id: 'sent', label: 'Sent' }, { id: 'unsent', label: 'Not sent' }, { id: 'failed', label: 'Failed' }];
const TONE = { sent: 'good', unsent: 'warn', failed: 'bad', unknown: 'warn' } as const;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString('en-GB', { timeZone: 'Africa/Lagos', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true }) : '-');

export default function DeliveryScreen({ rows, unconfirmed, canSend, canExport, loadError }: { rows: DeliveryRow[]; unconfirmed: number; canSend: boolean; canExport: boolean; loadError: string }) {
  const router = useRouter();
  const [filter, setFilter] = useState<DeliveryFilter>('all');
  const [q, setQ] = useState('');
  const [toast, setToast] = useState('');
  const [run, setRun] = useState<Run>({ state: 'idle', sent: 0, failed: 0, total: 0, message: '' });
  const [busy, start] = useTransition();
  const [rowBusy, setRowBusy] = useState<string | null>(null);
  const stopRef = useRef(false);
  const runningRef = useRef(false);
  const failedIds = useRef<string[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flash = (t: string) => { setToast(t); if (timer.current) clearTimeout(timer.current); timer.current = setTimeout(() => setToast(''), 5000); };
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); stopRef.current = true; }, []);

  const counts = useMemo(() => countDelivery(rows), [rows]);
  const shown = useMemo(() => filterDelivery(rows, filter, q), [rows, filter, q]);
  const owing = owed(counts);
  const running = run.state === 'running' || run.state === 'pausing';

  async function drive(resume: boolean) {
    if (runningRef.current) return; // a second press while a run is going does nothing
    runningRef.current = true;
    stopRef.current = false;
    if (!resume) failedIds.current = [];
    let sent = resume ? run.sent : 0;
    let failed = resume ? run.failed : 0;
    const total = resume ? run.total : owing;
    let busyTries = 0, badBatches = 0;
    setRun({ state: 'running', sent, failed, total, message: '' });
    let end: Run | null = null;
    try {
      while (!stopRef.current) {
        const r = await sendBatchAction(failedIds.current);
        if ('error' in r) { end = { state: 'stopped', sent, failed, total, message: r.error }; break; }
        sent += r.sent; failed += r.failed; failedIds.current.push(...r.failedIds);
        setRun({ state: stopRef.current ? 'pausing' : 'running', sent, failed, total: Math.max(total, sent + failed + r.remaining), message: '' });
        start(() => router.refresh());
        if (r.stopMessage) { end = { state: 'stopped', sent, failed, total, message: `${r.stopMessage} ${r.remaining} still unsent. Fix that, then press Resend again to continue.` }; break; }
        if (r.remaining === 0) { end = { state: 'done', sent, failed, total, message: failed ? `Finished. ${failed} could not be sent, see the Failed tab.` : 'Everyone has been sent their ticket.' }; break; }
        if (r.busy) {
          if (++busyTries >= 4) { end = { state: 'stopped', sent, failed, total, message: 'Another send is holding the rest (someone else may be resending). Wait a few minutes and press Resend again.' }; break; }
          await sleep(5000); continue;
        }
        busyTries = 0;
        badBatches = r.sent === 0 && r.failed > 0 ? badBatches + 1 : 0;
        if (badBatches >= 2) { end = { state: 'stopped', sent, failed, total, message: 'Several tickets in a row failed, so the run stopped. See the Failed tab for the reason.' }; break; }
      }
      if (!end) end = { state: 'paused', sent, failed, total, message: 'Paused. Press Resume to carry on.' };
    } catch {
      end = { state: 'stopped', sent, failed, total, message: 'The connection dropped. Press Resend again to continue where it left off.' };
    } finally {
      runningRef.current = false;
    }
    setRun(end);
    start(() => router.refresh());
  }

  const pause = () => { stopRef.current = true; setRun((r) => ({ ...r, state: 'pausing', message: 'Pausing after the current batch.' })); };

  const resendOne = async (r: DeliveryRow) => {
    setRowBusy(r.id);
    try {
      const res = await resendOneAction(r.id);
      flash(res.ok ? res.message : res.error);
      start(() => router.refresh());
    } catch { flash('That did not work. Please try again.'); }
    finally { setRowBusy(null); }
  };

  const download = async () => {
    const res = await exportDeliveryCsv(filter, q);
    if (!res.ok) { flash(res.error); return; }
    try {
      const url = URL.createObjectURL(new Blob([res.csv], { type: 'text/csv;charset=utf-8' }));
      const a = document.createElement('a');
      a.href = url; a.download = `summit-delivery-${filter}.csv`; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch { flash('Could not save the file.'); }
  };

  const pct = run.total > 0 ? Math.min(100, Math.round(((run.sent + run.failed) / run.total) * 100)) : 0;
  const tiles: [string, number][] = [['Confirmed', counts.total], ['Sent', counts.sent], ['Not sent', counts.unsent], ['Failed', counts.failed], ['Unknown', counts.unknown]];

  return (
    <div className="admc">
      <div className="pg screen">
        <div className="sb" style={{ alignItems: 'flex-end' }}>
          <div><p className="eyebrow">Elevation Summit</p><h1 className="pt">Ticket email delivery</h1><span className="ul" /></div>
          <div className="row" style={{ gap: 8 }}>
            <Link href="/admin/c/registrations" className="btn bs">Back to Registrations</Link>
            {canExport && <button type="button" className="btn bs" onClick={download}>Export CSV</button>}
          </div>
        </div>
        <p className="p" style={{ maxWidth: 780 }}>Everyone with a confirmed registration is owed a ticket email. Sent means our mail server accepted it. If an address does not exist, the rejection comes back to the sending mailbox as a separate email, so it cannot be shown here.{unconfirmed > 0 ? ` ${unconfirmed} unconfirmed registrations are not listed.` : ''}</p>

        <div className="kpis" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
          {tiles.map(([k, v]) => <div key={k} className="card kpi"><span className="k">{k}</span><span className="v">{v}</span></div>)}
        </div>

        {loadError && <div className="rz" role="alert"><p className="sm" style={{ color: 'var(--err)' }}>{loadError}</p></div>}
        {!canSend && <div className="rz"><p className="sm" style={{ color: 'var(--text)' }}>View only. Your role can look at this area but not send tickets.</p></div>}

        {canSend && (
          <div className="card st8" aria-live="polite">
            <div className="sb" style={{ alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <p className="h3" style={{ margin: 0 }}>{owing === 0 && run.state === 'idle' ? 'Everyone has been sent their ticket' : `${owing} still to send`}</p>
                <p className="sm p" style={{ margin: '4px 0 0' }}>One press sends them all, a few at a time. You can close this page: press the button again and it carries on where it stopped. Nobody gets two emails.</p>
              </div>
              <div className="row" style={{ gap: 8 }}>
                {!running && run.state !== 'paused' && <button type="button" className="btn bp" disabled={busy || owing === 0} onClick={() => drive(false)}>Resend all unsent{owing ? ` (${owing})` : ''}</button>}
                {run.state === 'paused' && <button type="button" className="btn bp" onClick={() => drive(true)}>Resume</button>}
                {running && <button type="button" className="btn bs" disabled={run.state === 'pausing'} onClick={pause}>{run.state === 'pausing' ? 'Pausing...' : 'Pause'}</button>}
              </div>
            </div>
            {run.state !== 'idle' && (
              <div style={{ marginTop: 12 }}>
                <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="Sending progress" style={{ height: 10, borderRadius: 999, background: 'var(--surface2, var(--border))', overflow: 'hidden' }}>
                  <div style={{ width: `${pct}%`, height: '100%', background: run.state === 'stopped' ? 'var(--err)' : 'var(--rust)', transition: 'width .3s' }} />
                </div>
                <p className="sm" style={{ margin: '6px 0 0', color: 'var(--text)' }}><strong>{progressText(run.sent, run.total, run.failed)}</strong>{run.message ? `. ${run.message}` : ''}</p>
              </div>
            )}
          </div>
        )}

        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div className="opts" role="group" aria-label="Filter by delivery">
            {TABS.map((t) => {
              const n = filterDelivery(rows, t.id, '').length;
              return <button key={t.id} type="button" aria-pressed={filter === t.id} className={`opt${filter === t.id ? ' on' : ''}`} onClick={() => setFilter(t.id)}>{t.label} · {n}</button>;
            })}
          </div>
          <label className="search" style={{ display: 'flex', alignItems: 'center', gap: 8, height: 40, padding: '0 12px', border: '1px solid var(--border)', borderRadius: 10, background: 'var(--surface)', minWidth: 240 }}>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or email" aria-label="Search by name or email" style={{ border: 0, outline: 0, background: 'none', flex: 1, minWidth: 0 }} />
          </label>
        </div>

        <div className="tblwrap">
          <table className="tbl">
            <thead><tr><th scope="col">Name</th><th scope="col">Email</th><th scope="col">Status</th><th scope="col">Attempts</th><th scope="col">Last attempt</th><th scope="col">Last error</th>{canSend && <th scope="col"><span style={{ position: 'absolute', left: -9999 }}>Actions</span></th>}</tr></thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.id}>
                  <td>{r.name}</td>
                  <td><span className="sm" style={{ color: 'var(--text)', wordBreak: 'break-all' }}>{r.email}</span></td>
                  <td><span className={`tag ${TONE[r.status]}`}><i />{statusLabel(r.status)}</span></td>
                  <td><span className="sm" style={{ color: 'var(--text)' }}>{r.attempts}</span></td>
                  <td><span className="sm" style={{ color: 'var(--text)' }}>{when(r.lastAttemptAt ?? r.sentAt)}</span></td>
                  <td><span className="sm" style={{ color: 'var(--text)' }}>{r.error || '-'}</span></td>
                  {canSend && <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}><button type="button" className="btn bs sm-btn" disabled={busy || running || rowBusy === r.id} onClick={() => resendOne(r)}>{rowBusy === r.id ? 'Sending...' : 'Resend this one'}</button></td>}
                </tr>
              ))}
            </tbody>
          </table>
          {shown.length === 0 && (
            <div className="empty">
              <p className="h3">Nothing here</p>
              <p className="sm">{rows.length === 0 ? 'There are no confirmed registrations yet.' : 'No one matches this filter or search.'}</p>
              {rows.length > 0 && <button type="button" className="lk" onClick={() => { setFilter('all'); setQ(''); }}>Clear filters</button>}
            </div>
          )}
        </div>
        {toast && <div className="toast" role="status">{toast}</div>}
      </div>
    </div>
  );
}
