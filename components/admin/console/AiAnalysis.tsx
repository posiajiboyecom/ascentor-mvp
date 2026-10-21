'use client';

// AI analysis, built to the admin prototype. Everything real happens on the server (app/admin/c/analysis/actions.ts):
// it reads the chosen sources, calls the model and checks the answer. This only draws the form and the result.
import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { exportAnalysis, runAnalysis } from '@/app/admin/c/analysis/actions';
import type { AnalysisResult, PlatformSummary, Source } from '@/lib/admin/analysis';

const SRC: [Source, string][] = [
  ['sage', 'Sage chats'], ['dm', 'Direct messages'], ['circle', 'Circle chats'], ['group', 'Group chats'],
  ['posts', 'Posts and replies'], ['agenda', 'Session agendas'], ['surveys', 'Surveys'], ['support', 'Support inbox'],
];
const RANGES = ['Last 7 days', 'Last 30 days', 'Last 90 days', 'All time'];
const PRESETS = [
  'What are members struggling with this month?', 'What new Circles or groups should we create?', 'Who might be about to leave, and why?',
  'What do members want to learn next?', 'What confuses members about the app?',
];

export default function AiAnalysis({ configured, canExport, canSeeRecs, initialQuestion, initialNarrow, initialSource, summaries }: {
  configured: boolean; canExport: boolean; canSeeRecs: boolean; initialQuestion: string; initialNarrow: string; initialSource: Source | null; summaries: PlatformSummary[];
}) {
  const router = useRouter();
  const [src, setSrc] = useState<Record<Source, boolean>>(() => {
    const base: Record<Source, boolean> = { sage: true, dm: true, circle: true, group: true, posts: true, agenda: true, surveys: false, support: false };
    if (initialSource) for (const k of Object.keys(base) as Source[]) base[k] = k === initialSource;
    return base;
  });
  const [range, setRange] = useState('Last 30 days');
  const [narrow, setNarrow] = useState(initialNarrow);
  const [q, setQ] = useState(initialQuestion || (initialNarrow ? 'Summarise this and tell me what these members need.' : 'What are members struggling with this month?'));
  const [anon, setAnon] = useState(true);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [busy, startBusy] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flash = useCallback((t: string) => {
    setToast(t);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(''), 4500);
  }, []);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const run = () => startBusy(async () => {
    setError('');
    const res = await runAnalysis({ sources: SRC.filter(([k]) => src[k]).map(([k]) => k), range, narrow, question: q, anonymise: anon });
    if (!res.ok || !res.result) { setResult(null); setError(res.error ?? 'That did not work.'); return; }
    setResult(res.result);
  });

  const doExport = () => result && startBusy(async () => {
    const res = await exportAnalysis(result);
    if (!res.ok || !res.download) { flash(res.error ?? 'That did not work.'); return; }
    const url = URL.createObjectURL(new Blob([res.download.content], { type: res.download.mime }));
    const a = document.createElement('a');
    a.href = url; a.download = res.download.filename; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    flash('Export ready to download.');
  });

  const whoOf = (w: string | null) => (w ? (anon ? w : w) : null);

  return (
    <div className="admc"><div className="pg screen">
      <div><p className="eyebrow">Insights</p><h1 className="pt">AI analysis</h1><span className="ul" /></div>
      {!configured && <div className="rz"><p className="sm p">The AI key is not set up on this server (ANTHROPIC_API_KEY), so analyses cannot run yet.</p></div>}
      <div className="g2" style={{ gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.25fr)', alignItems: 'start' }}>
        <div className="card st">
          <div className="fld"><label>What to read</label>
            <div className="opts">{SRC.map(([k, label]) => (
              <button key={k} type="button" className={`opt${src[k] ? ' on' : ''}`} aria-pressed={src[k]} onClick={() => setSrc((s) => ({ ...s, [k]: !s[k] }))}>{label}</button>
            ))}</div></div>
          <div className="fld"><label>Time</label>
            <div className="opts">{RANGES.map((r) => (
              <button key={r} type="button" className={`opt${range === r ? ' on' : ''}`} aria-pressed={range === r} onClick={() => setRange(r)}>{r}</button>
            ))}</div></div>
          <div className="fld"><label htmlFor="annar">Narrow to (optional)</label>
            <input id="annar" className="in" placeholder="A Circle, a city, a group or one member" value={narrow} onChange={(e) => setNarrow(e.target.value)} /></div>
          <div className="fld"><label htmlFor="anq">Your question</label>
            <textarea id="anq" className="in" value={q} onChange={(e) => setQ(e.target.value)} />
            <div className="opts">{PRESETS.map((p) => <button key={p} type="button" className="opt" onClick={() => setQ(p)}>{p}</button>)}</div></div>
          <div className="setrow"><span>Hide member names in results</span>
            <button type="button" className={`toggle${anon ? ' on' : ''}`} aria-pressed={anon} aria-label="Hide member names in results" onClick={() => setAnon((v) => !v)} /></div>
          <div><button type="button" className="btn bp" disabled={busy || !configured} onClick={run}>{busy ? 'Reading...' : 'Run analysis'}</button></div>
        </div>

        <div className="card st">
          {error && <div className="empty"><p className="h3" style={{ color: 'var(--text)' }}>Could not run the analysis</p><p className="p">{error}</p></div>}
          {!error && !result && <div className="empty"><p className="h3" style={{ color: 'var(--text)' }}>{busy ? 'Reading the conversations' : 'No analysis yet'}</p><p className="p">{busy ? 'This can take up to a minute.' : 'Choose what to read, ask a question, and run it.'}</p></div>}
          {result && (
            <>
              <div className="sb">
                <div><p className="eyebrow">Answer</p><p className="h3">{result.question}</p></div>
                {canExport && <button type="button" className="btn bs sm-btn" disabled={busy} onClick={doExport}>Export</button>}
              </div>
              <p className="sm p">{result.basis}</p>
              <p className="p">{result.summary}</p>
              {result.themes.length > 0 && <p className="sl">Themes, by estimated share of conversations</p>}
              {result.themes.map((h) => (
                <div className="st8" key={h.label} style={{ paddingBottom: 10, borderBottom: '1px solid var(--border)' }}>
                  <div className="hbar" style={{ gridTemplateColumns: '200px minmax(0,1fr) 48px' }}>
                    <span className="num">{h.label}</span>
                    <span className="tr" role="img" aria-label={`${h.label}: about ${h.share}% of conversations`}><span style={{ width: `${Math.min(100, h.share)}%` }} /></span>
                    <span className="num" style={{ textAlign: 'right' }}>{h.share}%</span>
                  </div>
                  {h.quote && <div className="msg" style={{ maxWidth: '100%' }}><b>{whoOf(h.who)}</b>“{h.quote}”</div>}
                </div>
              ))}
              {result.recs.length > 0 && <p className="sl">What to do about it</p>}
              {result.recs.map((r, i) => (
                <div className="sb" key={i} style={{ minHeight: 44 }}>
                  <span><span className="tag" style={{ marginRight: 8 }}><i />{r.type}</span>{r.title}</span>
                  {canSeeRecs && <button type="button" className="lk" onClick={() => router.push(`/admin/c/recs?type=${encodeURIComponent(r.type)}`)}>Review</button>}
                </div>
              ))}
              {result.notes.map((n, i) => <p className="sm p" key={i}>{n}</p>)}
              {canSeeRecs && <div className="row"><button type="button" className="btn bp" onClick={() => router.push('/admin/c/recs')}>See all recommendations</button></div>}
            </>
          )}
        </div>
      </div>

      <div className="st">
        <p className="sl">Platform summaries</p>
        {summaries.length === 0 && <div className="card empty"><p className="p">None yet. Run an analysis on Platform intel and its summary appears here.</p></div>}
        <div className="g2">
          {summaries.map((s) => (
            <div className="card st8" key={s.id}>
              <div className="sb"><p className="h3">{s.label}</p><span className="sm">{new Date(s.generatedAt).toLocaleDateString('en-GB', { timeZone: 'Africa/Lagos', day: 'numeric', month: 'short' })}</span></div>
              <p className="p">{s.summary}</p>
              {s.highlights.length > 0 && <ul className="sm p" style={{ margin: 0, paddingLeft: 18 }}>{s.highlights.map((x, i) => <li key={i}>{x}</li>)}</ul>}
              {s.watch.length > 0 && <><p className="sl">Watch</p><ul className="sm p" style={{ margin: 0, paddingLeft: 18 }}>{s.watch.map((x, i) => <li key={i}>{x}</li>)}</ul></>}
              {s.next.length > 0 && <><p className="sl">Next</p><ul className="sm p" style={{ margin: 0, paddingLeft: 18 }}>{s.next.map((x, i) => <li key={i}>{x}</li>)}</ul></>}
            </div>
          ))}
        </div>
      </div>
      {toast && <div className="toast" role="status" aria-live="polite">{toast}</div>}
    </div></div>
  );
}
