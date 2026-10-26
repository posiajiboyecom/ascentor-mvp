'use client';

// Community · Conversations, built to the admin prototype: tabs, a list per tab, search, a transcript panel ("View logged"),
// and the export dialog. Reading and exporting are both recorded in the audit log by the server actions.
import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { Check, Lock, Search } from 'lucide-react';
import { TABS, type ExportRequest, type TabKey } from '@/lib/admin/conversations-meta';
import type { ListRow, OpenedConvo } from '@/lib/admin/conversations';
import { exportAction, loadTabAction, openConversationAction } from '@/app/admin/c/chats/actions';
import ConversationsExport, { type ExportChoice, type ScopeChoice } from './ConversationsExport';
import '@/styles/admin-console.css';

interface Props {
  initialTab: TabKey;
  initialRows: ListRow[];
  initialNote?: string;
  loadError?: string;
  canExport: boolean;
  canAnalyse: boolean;
}

interface Dlg { title: string; scopes: ScopeChoice[]; defaultRange?: 'All time'; tab?: TabKey; id?: string }

export default function Conversations({ initialTab, initialRows, initialNote, loadError, canExport, canAnalyse }: Props) {
  const [tab, setTab] = useState<TabKey>(initialTab);
  const [rows, setRows] = useState<ListRow[]>(initialRows);
  const [note, setNote] = useState(initialNote);
  const [err, setErr] = useState(loadError);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<{ tab: TabKey; id: string; name: string; conv: OpenedConvo } | null>(null);
  const [dlg, setDlg] = useState<Dlg | null>(null);
  const [dlgErr, setDlgErr] = useState<string>();
  const [toast, setToast] = useState('');
  const [busy, setBusy] = useState(false);
  const [pending, start] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const meta = TABS.find((t) => t.key === tab)!;
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const flash = (m: string) => { setToast(m); if (timer.current) clearTimeout(timer.current); timer.current = setTimeout(() => setToast(''), 4500); };

  const pickTab = (t: TabKey) => {
    if (t === tab) return;
    setTab(t); setOpen(null); setQ(''); setRows([]); setErr(undefined);
    start(async () => {
      const r = await loadTabAction(t);
      if (r.ok) { setRows(r.list.rows); setNote(r.list.note); } else setErr(r.error);
    });
  };

  const read = (r: ListRow) => {
    start(async () => {
      const res = await openConversationAction(tab, r.id, r.cells[0]);
      if (res.ok) setOpen({ tab, id: r.id, name: r.cells[0], conv: res.conv });
      else flash(res.error);
    });
  };

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? rows.filter((r) => r.cells.join(' ').toLowerCase().includes(s)) : rows;
  }, [rows, q]);

  const run = async (c: ExportChoice) => {
    if (!dlg) return;
    setBusy(true); setDlgErr(undefined);
    const req: ExportRequest = {
      scope: c.scope.scope, tab: c.scope.tab ?? dlg.tab, id: dlg.id, title: dlg.title, scopeLabel: c.scope.label,
      format: c.format, range: c.range, attach: c.attach, meta: c.meta, anon: c.anon,
    };
    const res = await exportAction(req);
    setBusy(false);
    if (!res.ok) { setDlgErr(res.error); return; }
    const bin = atob(res.base64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const url = URL.createObjectURL(new Blob([bytes], { type: res.mime }));
    const a = document.createElement('a');
    a.href = url; a.download = res.filename; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    setDlg(null);
    flash(`Exported ${res.messages.toLocaleString('en-GB')} messages as ${c.format}.${res.capped ? ' It stopped at 20,000 messages.' : ''}`);
  };

  const analyseHref = (name: string, src: TabKey) => `/admin/c/analysis?narrow=${encodeURIComponent(name)}&src=${src}`;

  const exportTab = () => setDlg({ title: meta.label, tab, scopes: [{ label: 'Everything in this tab', scope: 'tab', tab }, { label: 'Everything: all conversations, agendas and posts', scope: 'everything' }] });
  const exportAll = () => setDlg({
    title: 'all conversation data', defaultRange: 'All time',
    scopes: [
      { label: 'Everything: Sage, direct messages, Circles, groups, agendas, posts and replies', scope: 'everything' },
      { label: 'Only Sage', scope: 'sage' }, { label: 'Only direct messages', scope: 'dm' }, { label: 'Only Circle and group chats', scope: 'circlegroup' },
      { label: 'Only posts and replies', scope: 'posts' }, { label: 'Only agendas', scope: 'agenda' },
    ],
  });
  const exportOne = () => {
    if (!open) return;
    setDlg({
      title: open.name, tab: open.tab, id: open.id,
      scopes: [{ label: 'This conversation', scope: 'one', tab: open.tab }, { label: 'Everything from these members', scope: 'members', tab: open.tab }, { label: `Everything in ${TABS.find((t) => t.key === open.tab)!.label.toLowerCase()}`, scope: 'tab', tab: open.tab }],
    });
  };

  return (
    <div className="admc">
      <div className="pg screen">
        <div className="sb" style={{ alignItems: 'flex-end' }}>
          <div><p className="eyebrow">Community</p><h1 className="pt">Conversations</h1><span className="ul" /></div>
          <div className="row">
            {canAnalyse && <Link className="btn bs" href={analyseHref('', tab)}>Analyse with AI</Link>}
            {canExport && <><button type="button" className="btn bs" onClick={exportTab}>Export this tab</button><button type="button" className="btn bp" onClick={exportAll}>Export all conversation data</button></>}
          </div>
        </div>
        <div className="rz row nw" style={{ gap: 10, alignItems: 'flex-start' }}>
          <Lock className="ic ics" aria-hidden style={{ marginTop: 3, color: 'var(--goldt)' }} />
          <p className="p sm" style={{ color: 'var(--text)' }}>Admins can read and export every conversation: Sage, direct messages, Circle and group chats, session agendas, and posts with replies. Each view and export is recorded in the audit log with the admin’s name.</p>
        </div>
        {err && <div className="rz" role="alert"><p className="sm" style={{ color: 'var(--err)' }}>{err}</p></div>}
        <div className="sb" style={{ flexWrap: 'wrap' }}>
          <div className="opts" role="group" aria-label="Conversation type">
            {TABS.map((t) => <button key={t.key} type="button" className={`opt${tab === t.key ? ' on' : ''}`} aria-pressed={tab === t.key} onClick={() => pickTab(t.key)}>{t.label}</button>)}
          </div>
          <label className="search" style={{ display: 'flex', alignItems: 'center', gap: 8, maxWidth: 300, height: 38, padding: '0 12px', border: '1px solid var(--border)', borderRadius: 10, background: 'var(--surface)' }}>
            <Search className="ic ics" aria-hidden />
            <input placeholder="Search names or words" aria-label="Search conversations" value={q} onChange={(e) => setQ(e.target.value)} style={{ border: 0, outline: 0, background: 'transparent', color: 'inherit', width: '100%' }} />
          </label>
        </div>
        {note && <p className="sm p">{note}</p>}
        <div className="g2 g2-cv">
          <div className="tblwrap">
            <table className="tbl">
              <thead><tr>{meta.cols.map((c) => <th key={c}>{c}</th>)}<th /></tr></thead>
              <tbody>
                {shown.map((r) => (
                  <tr key={r.id} className={open?.id === r.id && open.tab === tab ? 'sel' : ''}>
                    <td><button type="button" className="rowbtn" onClick={() => read(r)}>{r.cells[0]}</button></td>
                    {r.cells.slice(1).map((c, i) => <td key={i}>{c}</td>)}
                    <td style={{ textAlign: 'right' }}><button type="button" className="btn bs sm-btn" onClick={() => read(r)} disabled={pending}>Read</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!shown.length && <div className="empty"><p className="p">{pending ? 'Loading...' : rows.length ? 'Nothing matches that search.' : 'Nothing here yet.'}</p></div>}
          </div>
          <div className="card st">
            {!open ? (
              <div className="empty"><p className="h3" style={{ color: 'var(--text)' }}>Choose a conversation</p><p className="p">Read it here, export it, or send it to AI analysis.</p></div>
            ) : (
              <>
                <div className="sb">
                  <div style={{ minWidth: 0 }}><p className="eyebrow">{open.conv.kind}</p><p className="h3" style={{ overflowWrap: 'anywhere' }}>{open.name}</p></div>
                  <span className="tag warn"><i />View logged</span>
                </div>
                <div className="transcript">
                  {open.conv.msgs.map((m, i) => <div className="msg" key={i}><b>{m.who}</b>{m.text}</div>)}
                  {!open.conv.msgs.length && <p className="p sm">No messages yet.</p>}
                  {open.conv.truncated && <p className="p sm">Showing the latest 2,000 messages. Export to get more.</p>}
                </div>
                <div className="row">
                  {canExport && <button type="button" className="btn bs" onClick={exportOne}>Export</button>}
                  {canAnalyse && <Link className="btn bp" href={analyseHref(open.name, open.tab)}>Analyse with AI</Link>}
                  <button type="button" className="lk" onClick={() => setOpen(null)}>Close</button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
      {dlg && <ConversationsExport title={dlg.title} scopes={dlg.scopes} defaultRange={dlg.defaultRange} busy={busy} error={dlgErr} onCancel={() => setDlg(null)} onRun={run} />}
      {toast && <div className="toast" role="status" aria-live="polite"><Check className="gc" aria-hidden />{toast}</div>}
    </div>
  );
}
