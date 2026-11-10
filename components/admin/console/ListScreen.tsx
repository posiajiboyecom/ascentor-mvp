'use client';

// The generic admin list screen, built to the admin prototype: header with buttons, KPI tiles, status filter chips with
// counts, search, a table with coloured status tags and a one-click action per row, a detail drawer (fields, actions,
// history), confirm dialogs and toasts. All data and all rules come from the server: this component only draws them.
// Buttons the role may not use are hidden or disabled here for clarity, and refused again by the server action.

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Mail, MessageCircle, Phone, Search, X } from 'lucide-react';
import { contactLinks } from '@/lib/admin/contact';
import { RANK, toneOf, type Level } from '@/lib/admin/areas';
import type { ActionSpec, Kpi, RowData, ScreenSpec } from '@/lib/admin/types';
import type { AuditRow } from '@/lib/admin/audit';
import { loadHistory, runButton, runRowAction } from '@/app/admin/c/actions';
import { VideoUploadField } from '@/components/admin/VideoUploadField';
import '@/styles/admin-console.css';

interface Props {
  spec: ScreenSpec;
  rows: RowData[];
  kpis?: Kpi[];
  note?: string;
  /** The level used to DRAW the screen (the preview level while an admin is viewing as a teammate). */
  level: Level;
  initialFilter?: string;
  loadError?: string;
}

export default function ListScreen({ spec, rows: serverRows, kpis, note, level, initialFilter, loadError }: Props) {
  const router = useRouter();
  const [rows, setRows] = useState<RowData[]>(serverRows);
  const [filter, setFilter] = useState(initialFilter ?? 'All');
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<string | null>(null);
  const [history, setHistory] = useState<AuditRow[] | null>(null);
  const [confirm, setConfirm] = useState<{ a: ActionSpec; row: RowData } | null>(null);
  const [toast, setToast] = useState('');
  const [busy, startBusy] = useTransition();
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // New data from the server (after an action or a refresh) replaces the optimistic copy.
  useEffect(() => { setRows(serverRows); }, [serverRows]);

  const flash = useCallback((t: string) => {
    setToast(t);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 4500);
  }, []);
  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);

  const can = (need: Level) => RANK[level] >= RANK[need];
  const needOf = (a: ActionSpec): Level => (a.admin || a.danger ? 'full' : 'edit');
  const sc = spec.statusCol;

  const statuses = useMemo(() => {
    const out: string[] = [];
    if (sc >= 0) rows.forEach((r) => { const s = r.cells[sc]; if (s && !out.includes(s)) out.push(s); });
    return out;
  }, [rows, sc]);
  const activeFilter = sc >= 0 && statuses.includes(filter) ? filter : 'All';

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => (activeFilter === 'All' || r.cells[sc] === activeFilter) && (!needle || r.cells.join(' ').toLowerCase().includes(needle)));
  }, [rows, activeFilter, q, sc]);

  /** An action applies to a row if its "when" matches and it would actually change something. */
  const applies = (r: RowData, a: ActionSpec) => {
    if (a.when && !(Array.isArray(a.when) ? a.when : [a.when]).includes(r.cells[sc])) return false;
    if (a.keep || a.col === undefined) return true;
    return r.cells[a.col] !== a.to;
  };

  const selected = sel ? rows.find((r) => r.id === sel) ?? null : null;
  useEffect(() => {
    setHistory(null);
    if (!selected) return;
    let live = true;
    void loadHistory(spec.area, selected.cells[0]).then((h) => { if (live) setHistory(h); });
    return () => { live = false; };
  }, [selected?.id, spec.area]); // eslint-disable-line react-hooks/exhaustive-deps

  const download = (d: { filename: string; mime: string; content: string }) => {
    const blob = new Blob([d.content], { type: d.mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = d.filename; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  const doAction = (a: ActionSpec, r: RowData) => {
    setConfirm(null);
    startBusy(async () => {
      const res = await runRowAction(spec.area, a.id, r.id, r.cells);
      if (!res.ok) { flash(res.error || 'That did not work.'); return; }
      // Show the change straight away; the refresh below replaces it with what the database holds.
      setRows((prev) => prev.map((x) => {
        if (x.id !== r.id) return x;
        if (res.cells) return { ...x, cells: res.cells };
        if (!a.keep && a.col !== undefined && a.to !== undefined) { const c = x.cells.slice(); c[a.col] = a.to; return { ...x, cells: c }; }
        return x;
      }));
      if (res.download) download(res.download);
      flash(res.message || a.done || a.label);
      if (res.refresh) router.refresh();
    });
  };

  const [uploading, setUploading] = useState(false);
  const uploadFile = async (rowId: string, endpoint: string, file: File) => {
    setUploading(true);
    try {
      const fd = new FormData(); fd.append('file', file); fd.append('rowId', rowId);
      const res = await fetch(endpoint, { method: 'POST', body: fd });
      const j = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok || !j.url) { flash(j.error || 'The upload did not work.'); return; }
      setRows((prev) => prev.map((x) => (x.id === rowId && x.upload ? { ...x, upload: { ...x.upload, current: j.url } } : x)));
      flash('Image uploaded and saved.');
      router.refresh();
    } catch { flash('The upload did not work. Check your connection.'); }
    finally { setUploading(false); }
  };

  // Attach (or detach) an uploaded video to the row's record as soon as it is chosen, so there is no separate Save.
  const attachVideo = async (r: RowData, videoId: string | null) => {
    if (!r.video) return;
    const prev = r.video.current;
    setRows((rs) => rs.map((x) => (x.id === r.id && x.video ? { ...x, video: { ...x.video, current: videoId } } : x)));
    try {
      const res = await fetch('/api/admin/videos/attach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: r.video.kind, targetId: r.video.targetId, videoId }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(j.error || 'Could not save the video to this lesson.');
      flash(videoId ? 'Video saved to this lesson.' : 'Video removed from this lesson.');
      router.refresh();
    } catch (e) {
      setRows((rs) => rs.map((x) => (x.id === r.id && x.video ? { ...x, video: { ...x.video, current: prev } } : x)));
      flash(e instanceof Error ? e.message : 'Could not save the video to this lesson.');
    }
  };

  const pick = (a: ActionSpec, r: RowData) => {
    if (!can(needOf(a))) { flash('Only an admin can do this.'); return; }
    if (a.confirm) setConfirm({ a, row: r }); else doAction(a, r);
  };

  const buttons = useMemo(() => {
    const bb = (spec.buttons ?? []).slice();
    if (!bb.some((b) => b.label.startsWith('Export'))) bb.unshift({ id: 'export', label: 'Export', needs: 'full' });
    return bb.filter((b) => can(b.needs ?? 'edit'));
  }, [spec.buttons, level]); // eslint-disable-line react-hooks/exhaustive-deps

  const pressButton = (id: string, href?: string) => {
    if (href) { router.push(href); return; }
    startBusy(async () => {
      const res = await runButton(spec.area, id);
      if (!res.ok) { flash(res.error || 'That did not work.'); return; }
      if (res.download) download(res.download);
      flash(res.message || 'Done.');
      if (res.refresh) router.refresh();
    });
  };

  const viewOnly = level === 'view' && spec.actions.length > 0;
  const quick = spec.quick !== undefined ? spec.actions[spec.quick] : undefined;
  const hasActionCol = quick !== undefined || spec.actions.length > 0;
  const [ask, setAsk] = useState('');

  return (
    <div className="admc">
      <div className="pg screen">
        <div className="sb" style={{ alignItems: 'flex-end' }}>
          <div>
            <p className="eyebrow">{spec.group}</p>
            <h1 className="pt">{spec.title}</h1>
            <span className="ul" />
          </div>
          <div className="row" style={{ gap: 8 }}>
            {buttons.map((b, i) => (
              <button key={b.id} type="button" disabled={busy} className={`btn ${i === buttons.length - 1 && !b.label.startsWith('Export') ? 'bp' : 'bs'}`} onClick={() => pressButton(b.id, b.href)}>{b.label}</button>
            ))}
          </div>
        </div>

        <p className="p" style={{ maxWidth: 760 }}>{spec.sub}</p>

        {kpis && kpis.length > 0 && (
          <div className="kpis">
            {kpis.map((k) => (
              <div key={k.label} className="card kpi"><span className="k">{k.label}</span><span className="v">{k.value}</span>{k.note ? <span className="sm">{k.note}</span> : null}</div>
            ))}
          </div>
        )}

        {viewOnly && <div className="rz"><p className="sm" style={{ color: 'var(--text)' }}>View only. Your role can look at this area but not change it.</p></div>}
        {(note || spec.note) && <div className="rz"><p className="sm" style={{ color: 'var(--text)' }}>{note || spec.note}</p></div>}
        {loadError && <div className="rz" role="alert"><p className="sm" style={{ color: 'var(--err)' }}>{loadError}</p></div>}

        {spec.ask && (
          <div className="card st8">
            <p className="h3">Ask a question about the platform</p>
            <div className="row nw">
              <input className="in" value={ask} onChange={(e) => setAsk(e.target.value)} placeholder="For example: why are trials not converting?" aria-label="Ask a question about the platform" />
              <button type="button" className="btn bp" onClick={() => router.push(`/admin/c/analysis${ask.trim() ? `?q=${encodeURIComponent(ask.trim())}` : ''}`)}>Ask Sage</button>
            </div>
          </div>
        )}

        <div className="row" style={{ justifyContent: 'space-between' }}>
          {sc >= 0 ? (
            <div className="opts" role="group" aria-label="Filter by status">
              {['All', ...statuses].map((f) => {
                const n = f === 'All' ? rows.length : rows.filter((r) => r.cells[sc] === f).length;
                const on = activeFilter === f;
                return <button key={f} type="button" aria-pressed={on} className={`opt${on ? ' on' : ''}`} onClick={() => { setFilter(f); setSel(null); }}>{f} · {n}</button>;
              })}
            </div>
          ) : <span />}
          <label className="search" style={{ display: 'flex', alignItems: 'center', gap: 8, height: 40, padding: '0 12px', border: '1px solid var(--border)', borderRadius: 10, background: 'var(--surface)', minWidth: 240 }}>
            <Search className="ic ics" aria-hidden />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${spec.title.toLowerCase()}`} aria-label={`Search ${spec.title}`} style={{ border: 0, outline: 0, background: 'none', flex: 1, minWidth: 0 }} />
          </label>
        </div>

        <div className="tblwrap">
          <table className="tbl">
            <thead><tr>{spec.cols.map((c) => <th key={c} scope="col">{c}</th>)}{hasActionCol && <th scope="col"><span className="sr-only" style={{ position: 'absolute', left: -9999 }}>Actions</span></th>}</tr></thead>
            <tbody>
              {shown.map((r) => {
                const qa = quick && applies(r, quick) && can(needOf(quick)) ? quick : null;
                return (
                  <tr key={r.id} className={sel === r.id ? 'sel' : ''}>
                    {r.cells.map((v, c) => (
                      <td key={c}>
                        {c === 0 ? <button type="button" className="rowbtn" onClick={() => setSel(r.id)}>{v}</button>
                          : c === sc ? <span className={`tag ${toneOf(v) === 'plain' ? '' : toneOf(v)}`}><i />{v}</span>
                          : <span className="sm" style={{ color: 'var(--text)' }}>{v}</span>}
                      </td>
                    ))}
                    {hasActionCol && (
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        {qa && <button type="button" disabled={busy} className="btn bs sm-btn" onClick={() => pick(qa, r)}>{qa.label}</button>}{' '}
                        <button type="button" className="lk" onClick={() => setSel(r.id)}>Open</button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
          {shown.length === 0 && (
            <div className="empty">
              <p className="h3">Nothing here</p>
              <p className="sm">{rows.length === 0 ? 'There is nothing to show yet.' : 'No rows match this filter or search.'}</p>
              {rows.length > 0 && <button type="button" className="lk" onClick={() => { setFilter('All'); setQ(''); }}>Clear filters</button>}
            </div>
          )}
        </div>
        <p className="sm">Showing {shown.length} of {rows.length}.</p>
      </div>

      {selected && (
        <>
          <button type="button" className="scrim" aria-label="Close details" onClick={() => setSel(null)} style={{ border: 0 }} />
          <aside className="drawer" role="dialog" aria-label={`${selected.cells[0]} details`}>
            <div className="dhead">
              <div style={{ flex: 1, minWidth: 0 }}>
                <p className="eyebrow">{spec.title}</p>
                <p className="h2" style={{ overflowWrap: 'anywhere' }}>{selected.cells[0]}</p>
                {sc > 0 && <p style={{ margin: '8px 0 0' }}><span className={`tag ${toneOf(selected.cells[sc]) === 'plain' ? '' : toneOf(selected.cells[sc])}`}><i />{selected.cells[sc]}</span></p>}
              </div>
              <button type="button" className="ib" aria-label="Close" onClick={() => setSel(null)} style={{ background: 'none', border: 0, cursor: 'pointer', width: 40, height: 40 }}><X className="ic" aria-hidden /></button>
            </div>
            <div className="dbody">
              {selected.contact && (() => {
                const l = contactLinks(selected.contact);
                const none = !l.call && !l.whatsapp && !l.email;
                return (
                  <div className="st8">
                    <p className="sl">Reach out</p>
                    <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                      {l.call && <a className="btn bs" href={l.call}><Phone className="ic" aria-hidden /> Call</a>}
                      {l.whatsapp && <a className="btn bs" href={l.whatsapp} target="_blank" rel="noopener noreferrer"><MessageCircle className="ic" aria-hidden /> WhatsApp</a>}
                      {l.email && <a className="btn bs" href={l.email}><Mail className="ic" aria-hidden /> Email</a>}
                      {none && <p className="sm">No phone number or email on this registration.</p>}
                    </div>
                  </div>
                );
              })()}
              {!selected.details && <dl className="kv">
                {spec.cols.slice(1).map((k, j) => (<div key={k} style={{ display: 'contents' }}><dt>{k}</dt><dd>{selected.cells[j + 1]}</dd></div>))}
              </dl>}
              {selected.details?.map((g) => (
                <div key={g.heading} className="st8">
                  <p className="sl">{g.heading}</p>
                  <dl className="kv">
                    {g.items.map(([k, v]) => (<div key={k} style={{ display: 'contents' }}><dt>{k}</dt><dd>{v || '-'}</dd></div>))}
                  </dl>
                </div>
              ))}
              {selected.editHref && can('edit') && (
                <div className="st8">
                  <a className="btn bs" href={selected.editHref} style={{ alignSelf: 'flex-start' }}>Edit lesson</a>
                </div>
              )}
              {selected.video && (
                <div className="st8">
                  <p className="sl">Video</p>
                  {can('edit') ? (
                    <VideoUploadField
                      value={selected.video.current}
                      onChange={(id) => void attachVideo(selected, id)}
                      defaultTitle={selected.cells[0]}
                    />
                  ) : <p className="sm">{selected.video.current ? 'Uploaded.' : 'None uploaded yet.'} View only.</p>}
                </div>
              )}
              {selected.upload && (
                <div className="st8">
                  <p className="sl">{selected.upload.label}</p>
                  {selected.upload.current
                    ? <img src={selected.upload.current} alt="" style={{ width: '100%', maxWidth: 360, aspectRatio: '16/9', objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)' }} />
                    : <p className="sm">None uploaded yet.</p>}
                  {can('edit') ? (
                    <label className="btn bs" style={{ cursor: uploading ? 'wait' : 'pointer', alignSelf: 'flex-start' }}>
                      {uploading ? 'Uploading…' : selected.upload.current ? 'Replace image' : 'Upload image'}
                      <input type="file" accept={selected.upload.accept} disabled={uploading} style={{ display: 'none' }}
                        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f && selected.upload) void uploadFile(selected.id, selected.upload.endpoint, f); }} />
                    </label>
                  ) : <p className="sm">View only.</p>}
                  {selected.upload.hint && <p className="sm">{selected.upload.hint}</p>}
                </div>
              )}
              <div className="st8">
                <p className="sl">Actions</p>
                {(() => {
                  const offered = spec.actions.filter((a) => applies(selected, a));
                  const allowed = offered.filter((a) => can(needOf(a)));
                  return (
                    <>
                      <div className="row" style={{ gap: 8 }}>
                        {allowed.map((a) => (
                          <button key={a.id} type="button" disabled={busy} className={`btn ${a.danger ? 'bd' : 'bs'}`} onClick={() => pick(a, selected)}>{a.label}</button>
                        ))}
                        {allowed.length === 0 && <p className="sm">{viewOnly ? 'View only.' : 'Nothing to do on this one right now.'}</p>}
                      </div>
                      {offered.length > allowed.length && level !== 'view' && <p className="sm">Some actions need a role with Full access to this area.</p>}
                    </>
                  );
                })()}
              </div>
              <div className="st8">
                <p className="sl">History</p>
                {history === null ? <p className="sm">Loading…</p> : history.length === 0 ? <p className="sm">No admin changes yet.</p> : history.map((h, i) => (
                  <div key={i} className="rz"><p className="p" style={{ fontWeight: 600 }}>{h.what}</p><p className="sm">{h.who} · {h.when}</p></div>
                ))}
              </div>
            </div>
          </aside>
        </>
      )}

      {confirm && (
        <>
          <button type="button" className="scrim modalscrim" aria-label="Cancel" onClick={() => setConfirm(null)} style={{ border: 0 }} />
          <div className="modal" role="alertdialog" aria-label={`${confirm.a.label}?`}>
            <p className="h2">{confirm.a.label}?</p>
            <p className="p">{confirm.a.confirm}</p>
            <div className="row" style={{ justifyContent: 'flex-end', gap: 8 }}>
              <button type="button" className="btn bs" onClick={() => setConfirm(null)}>Cancel</button>
              <button type="button" className={`btn ${confirm.a.danger ? 'bd' : 'bp'}`} onClick={() => doAction(confirm.a, confirm.row)}>{confirm.a.label}</button>
            </div>
          </div>
        </>
      )}

      {toast && <div className="toast" role="status" aria-live="polite"><Check className="gc" aria-hidden />{toast}</div>}
    </div>
  );
}
