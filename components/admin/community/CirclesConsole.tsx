'use client';
// Admin → Circles. Every Circle (home, interest and demo), a new Circle form, members waiting to be placed, and the
// 48-hour formation run. Opening a Circle shows CircleDetail. The server checks every permission again.
import './community.css';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  createCircle, loadCircles, loadWaiting, placeAllWaiting, placeWaiting, runFormationNow,
  type CircleInput, type CircleRow, type CirclesOverview, type WaitingRow,
} from '@/app/admin/c/circles/actions';
import CircleDetail from './CircleDetail';
import { Avatar, ago, day, run, useFlash } from './ui';
import { CircleFields, MAX, meetingLabel, statusTag } from './circle-shared';

type Tab = 'circles' | 'waiting';
type View = { kind: 'list' } | { kind: 'new' } | { kind: 'circle'; id: string };
const FILTERS = [['open', 'Forming and active'], ['forming', 'Forming'], ['active', 'Active'], ['completed', 'Closed'], ['all', 'All']] as const;
const KINDS = [['all', 'All kinds'], ['home', 'Home Circles'], ['interest', 'Interest Circles'], ['demo', 'Demo Circles']] as const;

export default function CirclesConsole({ initial, loadError, canEdit, canFull, initialId }: { initial: CirclesOverview | null; loadError?: string; canEdit: boolean; canFull: boolean; initialId?: string | null }) {
  const [ov, setOv] = useState<CirclesOverview | null>(initial);
  const [tab, setTab] = useState<Tab>('circles');
  const [view, setView] = useState<View>(initialId ? { kind: 'circle', id: initialId } : { kind: 'list' });
  const [filter, setFilter] = useState<(typeof FILTERS)[number][0]>('open');
  const [kind, setKind] = useState<(typeof KINDS)[number][0]>('all');
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const { flash, node } = useFlash();

  const refresh = useCallback(async () => { const r = await loadCircles(); if (r.ok) setOv(r.overview); else flash(r.error, true); }, [flash]);
  // Keep ?id= in the address bar so a Circle can be linked to and survives a reload.
  useEffect(() => {
    const u = new URL(window.location.href);
    if (view.kind === 'circle') u.searchParams.set('id', view.id); else u.searchParams.delete('id');
    window.history.replaceState(null, '', u.toString());
  }, [view]);

  const rows = useMemo(() => {
    if (!ov) return [];
    const term = q.trim().toLowerCase();
    return ov.circles.filter((c) =>
      (filter === 'all' || (filter === 'open' ? c.status !== 'completed' : c.status === filter)) &&
      (kind === 'all' || c.kind === kind) &&
      (!term || `${c.title} ${c.number} ${c.language ?? ''} ${c.stage ?? ''} ${c.facilitator ?? ''} ${c.interest ?? ''}`.toLowerCase().includes(term)));
  }, [ov, q, filter, kind]);

  if (!ov) {
    return <div className="admc"><div className="pg screen"><p className="eyebrow">Circles</p><h1 className="pt">Circles</h1><span className="ul" /><div className="cm-note bad" style={{ marginTop: 16 }}>{loadError ?? 'We couldn’t load Circles.'}</div></div></div>;
  }

  const live = ov.circles.filter((c) => c.status !== 'completed' && c.kind !== 'demo');
  const forming = live.filter((c) => c.status === 'forming');
  const overdue = forming.filter((c) => c.kind === 'home' && c.ageHours >= 48);

  const formation = async () => {
    setBusy(true);
    const r = await run(flash, () => runFormationNow());
    if (r) flash(r.merged || r.started ? `Formation ran: ${r.merged} merged, ${r.started} started${r.waiting ? `, ${r.waiting} still waiting` : ''}.` : r.waiting ? `Nothing to change yet. ${r.waiting} ${r.waiting === 1 ? 'Circle is' : 'Circles are'} still waiting for members.` : 'Nothing to do: no Circle has been forming for 48 hours.');
    await refresh(); setBusy(false);
  };

  return (
    <div className="admc">
      <div className="pg screen">
        {view.kind === 'circle' ? (
          <CircleDetail id={view.id} circles={ov.circles} canEdit={canEdit} canFull={canFull} flash={flash}
            onBack={async () => { await refresh(); setView({ kind: 'list' }); }}
            onOpen={(id) => setView({ kind: 'circle', id })} onChanged={refresh} />
        ) : view.kind === 'new' ? (
          <NewCircle flash={flash} onCancel={() => setView({ kind: 'list' })} onCreated={async (id) => { await refresh(); setView({ kind: 'circle', id }); }} />
        ) : (
          <>
            <div className="sb" style={{ alignItems: 'flex-end', flexWrap: 'wrap', gap: 12 }}>
              <div><p className="eyebrow">Circles</p><h1 className="pt">Circles</h1><span className="ul" /></div>
              {canEdit && (
                <div className="cm-row">
                  <button type="button" className="btn bs" disabled={busy} onClick={formation} title="Merge or start Circles that have been forming for 48 hours">{busy ? 'Running…' : 'Run formation now'}</button>
                  <button type="button" className="btn bp" onClick={() => setView({ kind: 'new' })}>New Circle</button>
                </div>
              )}
            </div>

            <div className="kpis" style={{ marginTop: 18 }}>
              <div className="card kpi"><span className="k">Active</span><span className="v">{live.filter((c) => c.status === 'active').length}</span><span className="sm">running a 90-day cycle</span></div>
              <div className="card kpi"><span className="k">Forming</span><span className="v">{forming.length}</span><span className="sm">{overdue.length ? `${overdue.length} over 48 hours` : 'start at 4 members'}</span></div>
              <div className="card kpi"><span className="k">Members in a Circle</span><span className="v">{ov.seated.toLocaleString('en-GB')}</span><span className="sm">across all Circles</span></div>
              <div className="card kpi"><span className="k">Waiting</span><span className="v">{ov.waiting}</span><span className="sm">onboarded, no Circle yet</span></div>
            </div>

            <div className="cm-tabs" role="tablist">
              <button type="button" role="tab" aria-selected={tab === 'circles'} className={tab === 'circles' ? 'on' : ''} onClick={() => setTab('circles')}>Circles<span className="n">{ov.circles.length}</span></button>
              <button type="button" role="tab" aria-selected={tab === 'waiting'} className={tab === 'waiting' ? 'on' : ''} onClick={() => setTab('waiting')}>Waiting for a Circle<span className="n">{ov.waiting}</span></button>
            </div>

            {tab === 'circles' && (
              <>
                {overdue.length > 0 && (
                  <div className="cm-note" style={{ marginBottom: 14 }}>
                    {overdue.length} home {overdue.length === 1 ? 'Circle has' : 'Circles have'} been forming for over 48 hours. Formation runs every hour and merges or starts them; the ones left usually have fewer than 3 members and no Circle in the same language with room. Open one to move members, or start it as it is.
                  </div>
                )}
                <div className="cm-bar">
                  <input className="in cm-grow" placeholder="Search name, number, language, facilitator" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search Circles" />
                  <select className="in" value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)} aria-label="Status">{FILTERS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
                  <select className="in" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)} aria-label="Kind">{KINDS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
                </div>
                {rows.length === 0 ? (
                  <div className="card empty"><p className="h3">No Circles match</p><p className="sm">Try another filter. New members are placed in a Circle automatically when they finish onboarding.</p></div>
                ) : (
                  <div className="tblwrap"><table className="tbl">
                    <thead><tr><th>Circle</th><th>Status</th><th>Members</th><th>Facilitator</th><th>Language · stage</th><th>Meeting</th><th>Cycle</th></tr></thead>
                    <tbody>
                      {rows.map((c) => (
                        <tr key={c.id}>
                          <td><button type="button" className="rowbtn" onClick={() => setView({ kind: 'circle', id: c.id })}>{c.title}</button>
                            <span className="sm" style={{ display: 'block' }}>{c.kind === 'interest' ? 'Interest Circle' : c.kind === 'demo' ? 'Demo Circle' : 'Home Circle'}{c.merged_into ? ' · merged' : ''}</span></td>
                          <td>{statusTag(c.status)}{c.status === 'forming' && <span className="sm" style={{ display: 'block' }}>{c.ageHours < 48 ? `${c.ageHours}h old` : `${Math.floor(c.ageHours / 24)}d old`}</span>}</td>
                          <td><span className="cm-meter"><span><i style={{ width: `${Math.min(100, (c.members / MAX) * 100)}%` }} /></span>{c.members}/{MAX}</span></td>
                          <td className="sm">{c.facilitator ?? <span style={{ color: 'var(--muted)' }}>None</span>}</td>
                          <td className="sm">{c.language ?? 'English'}{c.stage ? ` · ${c.stage}` : ''}</td>
                          <td className="sm">{meetingLabel(c.meeting_dow, c.meeting_time)}</td>
                          <td className="sm">{c.status === 'active' ? `Week ${c.week ?? 1} of 12` : c.status === 'forming' ? 'Not started' : c.cycle_start ? `Began ${day(c.cycle_start)}` : '–'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table></div>
                )}
              </>
            )}

            {tab === 'waiting' && <Waiting circles={ov.circles} canEdit={canEdit} flash={flash} onChanged={refresh} />}
          </>
        )}
      </div>
      {node}
    </div>
  );
}

// ── new Circle ──────────────────────────────────────────────────────────────
function NewCircle({ flash, onCancel, onCreated }: { flash: (t: string, bad?: boolean) => void; onCancel: () => void; onCreated: (id: string) => void }) {
  const [v, setV] = useState<CircleInput>({ name: '', language: 'English', timezone: 'Africa/Lagos', meeting_dow: 4, meeting_time: '19:00', stage: null, interest: '' });
  const [busy, setBusy] = useState(false);
  return (
    <form className="cm-stack" onSubmit={async (e) => { e.preventDefault(); setBusy(true); const r = await run(flash, () => createCircle(v), 'Circle created.'); setBusy(false); if (r) onCreated(r.id); }}>
      <button type="button" className="cm-back" onClick={onCancel}>← All Circles</button>
      <div><p className="eyebrow">Circles</p><h1 className="pt">New Circle</h1><span className="ul" /></div>
      <div className="cm-card" style={{ maxWidth: 880 }}>
        <div className="fld"><label htmlFor="c-name">Name</label><input id="c-name" className="in" value={v.name ?? ''} maxLength={60} placeholder="Leave empty to use the next mountain peak" onChange={(e) => setV({ ...v, name: e.target.value })} /></div>
        <CircleFields v={v} set={(p) => setV({ ...v, ...p })} />
        <p className="sm">The Circle opens as Forming. Add members on the next screen, or let new members fill it: home Circles in the same language fill first and start at 4 members.</p>
        <div className="cm-row"><button type="submit" className="btn bp" disabled={busy}>{busy ? 'Creating…' : 'Create Circle'}</button><button type="button" className="btn bs" onClick={onCancel}>Cancel</button></div>
      </div>
    </form>
  );
}

// ── waiting members ─────────────────────────────────────────────────────────
function Waiting({ circles, canEdit, flash, onChanged }: { circles: CircleRow[]; canEdit: boolean; flash: (t: string, bad?: boolean) => void; onChanged: () => Promise<void> }) {
  const [rows, setRows] = useState<WaitingRow[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [pick, setPick] = useState<Record<string, string>>({});
  const load = useCallback(async () => { const r = await loadWaiting(); if (r.ok) setRows(r.rows); else flash(r.error, true); }, [flash]);
  useEffect(() => { void load(); }, [load]);
  const open = circles.filter((c) => c.status !== 'completed' && c.kind !== 'demo');

  const place = async (w: WaitingRow) => {
    setBusy(w.id);
    const target = pick[w.id] || null;
    const r = await run(flash, (force) => placeWaiting(w.id, target, { force }));
    if (r) flash(`${w.name} is now in ${r.circle}.`);
    setBusy(null); await load(); await onChanged();
  };

  if (!rows) return <p className="sm">Loading…</p>;
  return (
    <div className="cm-stack">
      <div className="sb" style={{ flexWrap: 'wrap', gap: 10 }}>
        <p className="sm">Members who finished onboarding but have no home Circle. “Best match” places them the way onboarding does: same language, then stage, times and time zone, filling Circles that are forming first.</p>
        {canEdit && rows.length > 0 && <button type="button" className="btn bp" disabled={!!busy} onClick={async () => { setBusy('all'); const r = await run(flash, () => placeAllWaiting()); if (r) flash(`Placed ${r.placed} ${r.placed === 1 ? 'member' : 'members'}${r.left ? `; ${r.left} still waiting` : ''}.`); setBusy(null); await load(); await onChanged(); }}>{busy === 'all' ? 'Placing…' : 'Place everyone (best match)'}</button>}
      </div>
      {rows.length === 0 ? (
        <div className="card empty"><p className="h3">Nobody is waiting</p><p className="sm">Members are placed in a Circle as they finish onboarding.</p></div>
      ) : (
        <div className="tblwrap"><table className="tbl">
          <thead><tr><th>Member</th><th>Language · stage</th><th>Times</th><th>Waiting</th>{canEdit && <th>Place in</th>}</tr></thead>
          <tbody>
            {rows.map((w) => (
              <tr key={w.id}>
                <td><div className="cm-person"><Avatar p={w} /><span><b>{w.name}</b><small>{w.email ?? ''}</small></span></div></td>
                <td className="sm">{w.language ?? 'English'}{w.stage ? ` · ${w.stage}` : ''}{w.timezone ? <span style={{ display: 'block' }}>{w.timezone}</span> : null}</td>
                <td className="sm">{w.slots.join(', ') || '–'}</td>
                <td className="sm">{ago(w.onboarded_at)}</td>
                {canEdit && (
                  <td><div className="cm-row" style={{ flexWrap: 'nowrap' }}>
                    <select className="in" style={{ minHeight: 34, width: 220 }} value={pick[w.id] ?? ''} onChange={(e) => setPick({ ...pick, [w.id]: e.target.value })} aria-label={`Circle for ${w.name}`}>
                      <option value="">Best match</option>
                      {open.map((c) => <option key={c.id} value={c.id}>{c.title} ({c.members}/{MAX}{c.language && c.language !== (w.language ?? 'English') ? `, ${c.language}` : ''})</option>)}
                    </select>
                    <button type="button" className="btn bs sm-btn" disabled={!!busy} onClick={() => place(w)}>{busy === w.id ? '…' : 'Place'}</button>
                  </div></td>
                )}
              </tr>
            ))}
          </tbody>
        </table></div>
      )}
    </div>
  );
}
