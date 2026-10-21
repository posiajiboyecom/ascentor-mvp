'use client';

// Recommendations, built to the admin prototype. The recommendations are computed on the server from real member signals;
// this only draws them and calls the server actions, which check the access level themselves.
import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { Rec, RecState } from '@/lib/admin/recommendations';
import { actOnRec, decideRec, exportRecs } from '@/app/admin/c/recs/actions';

const TYPES = ['All', 'Circle', 'Group', 'City group', 'Lesson', 'Mentor', 'Meetup', 'Fix', 'Wellbeing', 'Shop'];

export default function Recommendations({ recs, state, stateAvailable, canEdit, canExport, canAnalyse, initialType }: {
  recs: Rec[]; state: Record<string, RecState>; stateAvailable: boolean; canEdit: boolean; canExport: boolean; canAnalyse: boolean; initialType: string;
}) {
  const router = useRouter();
  const [type, setType] = useState(initialType);
  const [local, setLocal] = useState<Record<string, RecState | 'open'>>({});
  const [showDismissed, setShowDismissed] = useState(false);
  const [toast, setToast] = useState('');
  const [busy, startBusy] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flash = useCallback((t: string) => {
    setToast(t);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(''), 4500);
  }, []);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const st = (id: string): RecState | undefined => {
    const v = local[id] ?? state[id];
    return v === 'open' ? undefined : v;
  };
  const visible = recs.filter((r) => st(r.id) !== 'dismissed');
  const count = (t: string) => (t === 'All' ? visible.length : visible.filter((r) => r.type === t).length);
  const shown = visible.filter((r) => type === 'All' || r.type === type);
  const nDismissed = recs.length - visible.length;

  const download = (d: { filename: string; mime: string; content: string }) => {
    const url = URL.createObjectURL(new Blob([d.content], { type: d.mime }));
    const a = document.createElement('a');
    a.href = url; a.download = d.filename; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const create = (r: Rec) => {
    if (r.act === 'link') { router.push(r.href); return; }
    startBusy(async () => {
      const res = await actOnRec(r.id);
      if (!res.ok) { flash(res.error ?? 'That did not work.'); return; }
      setLocal((s) => ({ ...s, [r.id]: 'created' }));
      flash(res.message ?? 'Done.');
      router.refresh();
    });
  };
  const decide = (r: Rec, to: 'dismissed' | 'open') => startBusy(async () => {
    const res = await decideRec(r.id, to);
    if (!res.ok) { flash(res.error ?? 'That did not work.'); return; }
    setLocal((s) => ({ ...s, [r.id]: to }));
    router.refresh();
  });
  const doExport = () => startBusy(async () => {
    const res = await exportRecs();
    if (!res.ok) { flash(res.error ?? 'That did not work.'); return; }
    if (res.download) download(res.download);
    flash(res.message ?? 'Export ready to download.');
  });

  return (
    <div className="admc"><div className="pg screen">
      <div className="sb" style={{ alignItems: 'flex-end' }}>
        <div><p className="eyebrow">Overview</p><h1 className="pt">Recommendations</h1><span className="ul" /></div>
        <div className="row">
          {canExport && <button type="button" className="btn bs" disabled={busy} onClick={doExport}>Export</button>}
          {canAnalyse && <button type="button" className="btn bp" onClick={() => router.push('/admin/c/analysis')}>Run a new analysis</button>}
        </div>
      </div>
      <p className="p" style={{ maxWidth: 780 }}>What members are asking for and where the platform needs attention, worked out from member sign-ups, Circles, groups, mentor calls and payments each time you open this page. Create one and it appears on its screen, ready to finish.</p>
      {!stateAvailable && <div className="rz"><p className="sm p">Create and Dismiss are switched off until the admin recommendations migration is applied. Links to other screens still work.</p></div>}
      <div className="opts" role="group" aria-label="Recommendation type">
        {TYPES.map((t) => (
          <button key={t} type="button" className={`opt${type === t ? ' on' : ''}`} aria-pressed={type === t} onClick={() => setType(t)}>{t} · {count(t)}</button>
        ))}
      </div>
      <div className="g2">
        {shown.map((r) => {
          const s = st(r.id);
          return (
            <div className="card st8" key={r.id}>
              <div className="sb"><span className="tag"><i />{r.type}</span><span className={`tag ${r.conf === 'High' ? 'good' : r.conf === 'Medium' ? 'warn' : ''}`}><i />{r.conf} confidence</span></div>
              <p className="h3">{r.title}</p>
              <p className="p">{r.why}</p>
              <p className="sm p">{r.evidence}</p>
              <p className="sm p">Serves: {r.serves}</p>
              {r.quotes.length > 0 && <div className="st8">{r.quotes.slice(0, 2).map((q, i) => <div className="msg" style={{ maxWidth: '100%' }} key={i}><b>{q.who}</b>“{q.text}”</div>)}</div>}
              {!s && canEdit && (
                <div className="row" style={{ marginTop: 4 }}>
                  <button type="button" className="btn bp" disabled={busy} onClick={() => create(r)}>{r.cta}</button>
                  {r.seeHref && <button type="button" className="btn bs" onClick={() => router.push(r.seeHref!)}>See conversations</button>}
                  <button type="button" className="lk" style={{ color: 'var(--muted)' }} disabled={busy} onClick={() => decide(r, 'dismissed')}>Dismiss</button>
                </div>
              )}
              {s === 'created' && (
                <div className="rz row nw" style={{ gap: 10 }}>
                  <svg className="gc" viewBox="0 0 24 24" aria-hidden><path d="M4 13l5 5L20 6" /></svg>
                  <span style={{ flex: 1 }}>{r.doneLine}</span>
                  <button type="button" className="lk" onClick={() => router.push(r.href)}>Open</button>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {shown.length === 0 && <div className="card empty"><p className="h3" style={{ color: 'var(--text)' }}>Nothing new here</p><p className="p">New recommendations appear as members sign up, join and talk.</p></div>}
      {nDismissed > 0 && (
        <div>
          <button type="button" className="lk" onClick={() => setShowDismissed((v) => !v)}>{showDismissed ? 'Hide dismissed' : `Show ${nDismissed} dismissed`}</button>
          {showDismissed && recs.filter((r) => st(r.id) === 'dismissed').map((r) => (
            <div className="sb" key={r.id} style={{ minHeight: 44 }}>
              <span><span className="tag" style={{ marginRight: 8 }}><i />{r.type}</span>{r.title}</span>
              {canEdit && <button type="button" className="lk" disabled={busy} onClick={() => decide(r, 'open')}>Restore</button>}
            </div>
          ))}
        </div>
      )}
      {toast && <div className="toast" role="status" aria-live="polite">{toast}</div>}
    </div></div>
  );
}
