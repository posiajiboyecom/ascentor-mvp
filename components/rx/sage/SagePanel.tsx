'use client';

// Sage, the AI coach, as a side panel (a bottom sheet on phones). Seven starting points, a short conversation,
// drafts the member can send to Today or their Circle report, and a plain safety card for hard topics.

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { ArrowRight, Mic, Send, Sparkles, X } from 'lucide-react';
import { SAGE_TOPICS } from '@/lib/rx/constants';
import type { SageOpenDetail, SageTopic } from '@/components/rx/sage-bus';
import { buildReportDraft, openFacilitatorThread } from '@/app/(app)/sage/actions';

type Role = 'user' | 'sage';
interface Msg { role: Role; text: string }
interface PlanDraft { cue: string; action: string; trigger: string; fallback: string }
interface ReportDraft { kept: string; obstacle: string; next: string; summary: string }

const OPENERS: Record<SageTopic, Msg[]> = {
  plan: [{ role: 'sage', text: 'Let’s plan your week. What matters most to you this week?' }],
  lesson: [{ role: 'sage', text: 'Tell me what stood out from the lesson, and I’ll suggest one small practice you can repeat.' }],
  missed: [{ role: 'sage', text: 'You didn’t check in yesterday. A missed day doesn’t reset anything.' }, { role: 'sage', text: 'What got in the way?' }],
  reframe: [{ role: 'sage', text: 'Hard days happen. What feels hardest right now?' }],
  report: [{ role: 'sage', text: 'Here’s a draft from your check-ins this week. Edit anything before you share it.' }],
  silent: [{ role: 'sage', text: 'It’s been a few days since your last check-in.' }, { role: 'sage', text: 'I’ll let your facilitator know you’ve been quiet so they can check on you. They’ll never see what you’ve told me.' }],
  crisis: [{ role: 'sage', text: 'Thank you for telling me. I’m an AI, and you deserve a real person right now.' }, { role: 'sage', text: 'You don’t have to explain everything. Please reach out below.' }],
};

type SpeechRec = { start: () => void; stop: () => void; lang: string; interimResults: boolean; onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onend: (() => void) | null; onerror: (() => void) | null };

export default function SagePanel() {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [topic, setTopic] = useState<SageTopic>('plan');
  const [msgs, setMsgs] = useState<Msg[]>(OPENERS.plan);
  const [draft, setDraft] = useState<PlanDraft | null>(null);
  const [report, setReport] = useState<ReportDraft | null>(null);
  const [crisis, setCrisis] = useState(false);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [facilName, setFacilName] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [canSpeak, setCanSpeak] = useState(false);
  const [, start] = useTransition();
  const bodyRef = useRef<HTMLDivElement>(null);
  const recRef = useRef<SpeechRec | null>(null);

  const begin = useCallback((t: SageTopic) => {
    setTopic(t); setMsgs(OPENERS[t]); setDraft(null); setReport(null); setError(''); setCrisis(t === 'crisis');
    if (t === 'report') start(async () => { const r = await buildReportDraft(); if (r.ok) setReport(r.draft); });
  }, []);

  useEffect(() => {
    const onOpen = (e: Event) => {
      const d = ((e as CustomEvent<SageOpenDetail>).detail ?? {}) as SageOpenDetail;
      setOpen(true);
      begin(d.topic ?? 'plan');
    };
    window.addEventListener('rx:sage', onOpen);
    return () => window.removeEventListener('rx:sage', onOpen);
  }, [begin]);

  useEffect(() => { setOpen(false); }, [pathname]);
  useEffect(() => { bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight }); }, [msgs.length, draft, report, busy]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);
  useEffect(() => { setCanSpeak(typeof window !== 'undefined' && !!((window as unknown as Record<string, unknown>).SpeechRecognition || (window as unknown as Record<string, unknown>).webkitSpeechRecognition)); }, []);
  useEffect(() => { if (open && (topic === 'silent' || topic === 'crisis' || crisis)) start(async () => { const r = await openFacilitatorThread(false); if (r.ok) setFacilName(r.name); }); }, [open, topic, crisis]);

  async function send(text: string) {
    const t = text.trim();
    if (!t || busy) return;
    const next: Msg[] = [...msgs, { role: 'user', text: t }];
    setMsgs(next); setInput(''); setBusy(true); setError('');
    try {
      const res = await fetch('/api/rx/sage', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ topic, messages: next }) });
      const j = (await res.json().catch(() => ({}))) as { reply?: string; draft?: PlanDraft; note?: string; crisis?: boolean; error?: string };
      if (!res.ok || !j.reply) { setError(j.error ?? 'Sage is having trouble right now. Please try again.'); return; }
      setMsgs((m) => [...m, { role: 'sage', text: j.reply as string }]);
      if (j.crisis) setCrisis(true);
      if (j.draft) setDraft(j.draft);
    } catch { setError('Sage couldn’t be reached. Check your connection and try again.'); }
    finally { setBusy(false); }
  }

  function usePlan() {
    if (!draft) return;
    const payload = { ...draft, source: 'planned with Sage' };
    const here = pathname === '/dashboard' || !!pathname?.startsWith('/learn/lesson');
    setOpen(false);
    if (here) { window.dispatchEvent(new CustomEvent('rx:plan-draft', { detail: payload })); return; }
    // Not on a screen that can take it: hand it over through storage and go to Today.
    try { sessionStorage.setItem('rx:plan-draft', JSON.stringify(payload)); } catch { /* storage unavailable */ }
    router.push('/dashboard');
  }

  function useReport() {
    if (!report) return;
    setOpen(false);
    if (pathname === '/circle/reports') { window.dispatchEvent(new CustomEvent('rx:report-draft', { detail: report })); return; }
    try { sessionStorage.setItem('rx:report-draft', JSON.stringify(report)); } catch { /* ignore */ }
    router.push('/circle/reports');
  }

  function listen() {
    const W = window as unknown as Record<string, new () => SpeechRec>;
    const Rec = W.SpeechRecognition || W.webkitSpeechRecognition;
    if (!Rec) return;
    if (listening) { recRef.current?.stop(); return; }
    const r = new Rec();
    r.lang = 'en-NG'; r.interimResults = false;
    r.onresult = (e) => { setInput((cur) => `${cur} ${e.results[0][0].transcript}`.trim()); };
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    recRef.current = r; setListening(true); r.start();
  }

  if (!open) return null;

  return (
    <>
      <div className="rx-scrim rx-sage-scrim" onClick={() => setOpen(false)} />
      <aside className="rx rx-sage" aria-label="Sage, AI coach" role="dialog">
        <div className="rx-sage-head">
          <span className="rx-dimdot"><Sparkles aria-hidden /></span>
          <div style={{ flex: 1, minWidth: 0 }}><p className="rx-p rx-strong">Sage · AI coach</p><p className="rx-sm rx-dsk" style={{ display: undefined }}>Looking at {pathname === '/dashboard' ? 'Today' : pathname?.split('/')[1] || 'Ascentor'}</p></div>
          <button type="button" className="rx-ib" aria-label="Close Sage" onClick={() => setOpen(false)}><X aria-hidden /></button>
        </div>

        <div className="rx-sage-topics" role="group" aria-label="What would you like help with">
          {SAGE_TOPICS.map((t) => <button key={t.key} type="button" className="rx-chip" style={{ minHeight: 34, fontSize: 13, flex: 'none' }} aria-pressed={topic === t.key} onClick={() => begin(t.key as SageTopic)}>{t.label}</button>)}
        </div>

        <div className="rx-sage-body" ref={bodyRef} aria-live="polite">
          {msgs.map((m, i) => (
            <div key={i} className={`rx-bub ${m.role === 'sage' ? 'sage' : 'me'}`}>
              {m.role === 'sage' && <div className="rx-who"><Sparkles aria-hidden style={{ width: 14, height: 14 }} />Sage · AI coach</div>}
              {m.text}
            </div>
          ))}
          {busy && <div className="rx-bub sage" aria-label="Sage is thinking"><span className="rx-dots-typing"><i /><i /><i /></span></div>}

          {draft && (
            <div className="rx-soft rx-stack-sm rx-rise">
              <p className="rx-label">Draft plan</p>
              <p className="rx-ifline" style={{ fontSize: 15 }}>After I <b>{draft.cue}</b>, I will <b>{draft.action}</b>.{draft.trigger && draft.fallback ? <> If <b>{draft.trigger}</b>, then I will <b>{draft.fallback}</b>.</> : null}</p>
              <div className="rx-row"><button type="button" className="rx-btn secondary" onClick={usePlan}>Use this plan</button><button type="button" className="rx-link" onClick={() => void send('Make it smaller.')}>Make it smaller<ArrowRight aria-hidden /></button></div>
            </div>
          )}

          {topic === 'report' && report && (
            <div className="rx-soft rx-stack-sm rx-rise">
              <p className="rx-label">Draft report</p>
              <p className="rx-p" style={{ fontSize: 15 }}>Kept: {report.summary}</p>
              <p className="rx-p" style={{ fontSize: 15 }}>Obstacle: {report.obstacle || 'None this week.'}</p>
              {report.next && <p className="rx-p" style={{ fontSize: 15 }}>Next: {report.next}</p>}
              <div><button type="button" className="rx-btn secondary" onClick={useReport}>Use this draft</button></div>
            </div>
          )}

          {topic === 'silent' && (
            <div className="rx-row rx-rise"><button type="button" className="rx-btn secondary" onClick={() => setOpen(false)}>Okay</button>{facilName && <FacilButton name={facilName} onDone={() => setOpen(false)} />}</div>
          )}

          {(topic === 'crisis' || crisis) && (
            <div className="rx-card rx-stack-sm rx-rise">
              <p className="rx-label">Talk to a person now</p>
              <p className="rx-p" style={{ fontSize: 15 }}>If you’re in danger or might hurt yourself, call <b>112</b>, Nigeria’s emergency number, or your local emergency number.</p>
              <p className="rx-p" style={{ fontSize: 15 }}>Or reach someone you trust: a friend, family, or your facilitator.</p>
              {facilName && <div><FacilButton name={facilName} onDone={() => setOpen(false)} primary /></div>}
            </div>
          )}
          {error && <p className="rx-sm" role="alert" style={{ color: 'var(--rx-danger)' }}>{error}</p>}
        </div>

        <div className="rx-sage-foot">
          {topic !== 'crisis' && topic !== 'silent' && !crisis && (
            <div className="rx-row rx-nw" style={{ gap: 6 }}>
              <input className="rx-in" style={{ borderRadius: 999, minHeight: 44 }} placeholder="Message Sage" aria-label="Message Sage" value={input} maxLength={1200}
                onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void send(input); } }} />
              {canSpeak && <button type="button" className="rx-ib" aria-label={listening ? 'Stop listening' : 'Speak to Sage'} aria-pressed={listening} onClick={listen} style={listening ? { background: 'var(--rx-soft)' } : undefined}><Mic aria-hidden /></button>}
              <button type="button" className="rx-ib" aria-label="Send" disabled={busy || !input.trim()} onClick={() => void send(input)}><Send aria-hidden /></button>
            </div>
          )}
          <div className="rx-row" style={{ gap: 16 }}>
            <Link href="/sage/memory" className="rx-link" style={{ minHeight: 32, fontSize: 13 }} onClick={() => setOpen(false)}>What Sage knows<ArrowRight aria-hidden /></Link>
            <Link href="/sage/reminders" className="rx-link" style={{ minHeight: 32, fontSize: 13 }} onClick={() => setOpen(false)}>Reminders<ArrowRight aria-hidden /></Link>
          </div>
        </div>
      </aside>
    </>
  );
}

function FacilButton({ name, onDone, primary }: { name: string; onDone: () => void; primary?: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button type="button" className={`rx-btn ${primary ? 'secondary' : 'secondary'}`} disabled={pending} onClick={() => start(async () => {
      const r = await openFacilitatorThread(true);
      if (r.ok && r.threadId) { onDone(); router.push(`/messages?t=${r.threadId}`); }
    })}>Message {name.split(' ')[0]}</button>
  );
}
