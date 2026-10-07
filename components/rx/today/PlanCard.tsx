'use client';

// This week's plan: goal, obstacle, the if-then practice, and the builder sheet.

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Check, X } from 'lucide-react';
import SageMark from '@/components/rx/SageMark';
import { savePractice } from '@/app/(app)/dashboard/practice-actions';
import { useToast } from '@/components/rx/Toast';
import { openSage } from '@/components/rx/sage-bus';

export interface PlanData {
  cue: string; action: string; trigger: string; fallback: string; obstacle: string; source: string;
}

export function IfThen({ p }: { p: Pick<PlanData, 'cue' | 'action' | 'trigger' | 'fallback'> }) {
  return (
    <p className="rx-ifline">
      After I <b>{p.cue}</b>, I will <b>{p.action}</b>.{p.trigger && p.fallback ? <> If <b>{p.trigger}</b>, then I will <b>{p.fallback}</b>.</> : null}
    </p>
  );
}

export function IfThenFields({ value, onChange }: { value: PlanData; onChange: (v: PlanData) => void }) {
  const set = (k: keyof PlanData) => (e: React.ChangeEvent<HTMLInputElement>) => onChange({ ...value, [k]: e.target.value });
  return (
    <p className="rx-ifthen">
      After I <input className="rx-in" aria-label="After I" placeholder="get home from work" value={value.cue} onChange={set('cue')} maxLength={140} />, I will{' '}
      <input className="rx-in" aria-label="I will" placeholder="study one section for 25 minutes" value={value.action} onChange={set('action')} maxLength={140} />. If{' '}
      <input className="rx-in" aria-label="If" placeholder="work runs late" value={value.trigger} onChange={set('trigger')} maxLength={140} />, then I will{' '}
      <input className="rx-in" aria-label="then I will" placeholder="read one page before bed" value={value.fallback} onChange={set('fallback')} maxLength={140} />.
    </p>
  );
}

export const EMPTY_PLAN: PlanData = { cue: '', action: '', trigger: '', fallback: '', obstacle: '', source: '' };

export default function PlanCard({ goal, plan }: { goal: string | null; plan: PlanData | null }) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<PlanData>(plan ?? EMPTY_PLAN);
  const [error, setError] = useState('');
  const [pending, start] = useTransition();

  // Sage can hand a drafted plan back to this screen.
  useEffect(() => {
    const onDraft = (e: Event) => {
      const d = (e as CustomEvent<Partial<PlanData>>).detail;
      if (d) { setDraft((cur) => ({ ...cur, ...d })); setOpen(true); }
    };
    window.addEventListener('rx:plan-draft', onDraft);
    return () => window.removeEventListener('rx:plan-draft', onDraft);
  }, []);
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('rx:plan-draft');
      if (raw) { sessionStorage.removeItem('rx:plan-draft'); setDraft((cur) => ({ ...cur, ...(JSON.parse(raw) as Partial<PlanData>) })); setOpen(true); }
    } catch { /* storage unavailable */ }
  }, []);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  function submit() {
    setError('');
    start(async () => {
      const r = await savePractice({ ...draft, source: draft.source && draft.source.startsWith('planned') ? draft.source : 'set on Today' });
      if (!r.ok) { setError(r.error); return; }
      setOpen(false);
      toast('Plan set for this week.');
      router.refresh();
    });
  }

  return (
    <>
      <div className="rx-card rx-stack">
        <p className="rx-label">This week’s plan</p>
        <div className="rx-stack-sm"><p className="rx-sm">Goal</p><p className="rx-p rx-strong">{goal ?? 'No goal yet. Add one from your profile.'}</p></div>
        {plan?.obstacle ? (
          <div className="rx-stack-sm"><p className="rx-sm">What might get in the way</p><p className="rx-p">{plan.obstacle}</p></div>
        ) : null}
        {plan ? (
          <>
            <div className="rx-soft rx-stack-sm rx-rise">
              <div className="rx-row rx-nw" style={{ gap: 8 }}><Check aria-hidden style={{ width: 18, height: 18, color: 'var(--rx-gold)' }} /><span className="rx-sm">Practice set, {plan.source || 'set on Today'}</span></div>
              <IfThen p={plan} />
            </div>
            <div><button type="button" className="rx-link" onClick={() => { setDraft(plan); setOpen(true); }}>Edit plan<ArrowRight aria-hidden /></button></div>
          </>
        ) : (
          <>
            <p className="rx-ifline" style={{ color: 'var(--rx-muted)' }}>After I ___, I will ___. If ___, then I will ___.</p>
            <div><button type="button" className="rx-btn primary" onClick={() => setOpen(true)}>Build plan</button></div>
          </>
        )}
      </div>

      {open && (
        <>
          <div className="rx-scrim" onClick={() => setOpen(false)} />
          <div className="rx rx-sheet" role="dialog" aria-modal="true" aria-label="This week’s plan">
            <div className="grab" />
            <div className="rx-between"><h2 className="rx-h2">This week’s plan</h2><button type="button" className="rx-ib" aria-label="Close" onClick={() => setOpen(false)}><X aria-hidden /></button></div>
            <p className="rx-sageline" style={{ margin: '6px 0 14px' }}><SageMark size={22} /><span><span className="sgl">Sage</span><span className="tx">Tie it to something you already do.</span></span></p>
            <div className="rx-stack">
              <div className="rx-fld"><label htmlFor="pob">What might get in the way?</label><input id="pob" className="rx-in" value={draft.obstacle} maxLength={240} onChange={(e) => setDraft({ ...draft, obstacle: e.target.value })} /></div>
              <div className="rx-fld"><span className="rx-fld-label">Your if-then</span><IfThenFields value={draft} onChange={setDraft} /></div>
              {error && <p className="rx-sm" role="alert" style={{ color: 'var(--rx-danger)' }}>{error}</p>}
              <div className="rx-row">
                <button type="button" className="rx-btn primary" disabled={pending} onClick={submit}>{pending ? 'Saving…' : 'Set plan'}</button>
                <button type="button" className="rx-btn secondary" onClick={() => { setOpen(false); openSage({ topic: 'plan' }); }}>Plan with Sage</button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
