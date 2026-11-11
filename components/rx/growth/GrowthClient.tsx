'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AGREE, SURVEY_QUESTIONS } from '@/lib/rx/constants';
import { saveBeyondSelf, submitSurvey } from '@/app/(app)/growth/actions';
import { useToast } from '@/components/rx/Toast';

export function RetakeSurvey({ dueLabel, available }: { dueLabel: string; available: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState<number[]>(SURVEY_QUESTIONS.map(() => 0));
  const [error, setError] = useState('');
  const [pending, start] = useTransition();

  if (!open) {
    return (
      <div className="rx-stack-sm">
        {available
          ? <div><button type="button" className="rx-btn primary" onClick={() => setOpen(true)}>Retake survey</button></div>
          : <p className="rx-sm">{dueLabel}</p>}
      </div>
    );
  }
  return (
    <div className="rx-card rx-stack rx-rise">
      <div className="rx-between"><p className="rx-label">Question {i + 1} of {SURVEY_QUESTIONS.length}</p><span className="rx-sm">Private to you</span></div>
      <div className="rx-bar"><span style={{ width: `${Math.round(((i + 1) / SURVEY_QUESTIONS.length) * 100)}%` }} /></div>
      <h2 className="rx-big">{SURVEY_QUESTIONS[i]}</h2>
      <div className="rx-optcol">{AGREE.map((a, k) => <button key={a} type="button" className="rx-opt" aria-pressed={answers[i] === k + 1} onClick={() => setAnswers((cur) => cur.map((v, j) => (j === i ? k + 1 : v)))}>{a}</button>)}</div>
      {error && <p className="rx-sm" role="alert" style={{ color: 'var(--rx-danger)' }}>{error}</p>}
      <div className="rx-row">
        {i > 0 && <button type="button" className="rx-btn secondary" onClick={() => setI(i - 1)}>Back</button>}
        {i < SURVEY_QUESTIONS.length - 1
          ? <button type="button" className="rx-btn primary" disabled={!answers[i]} onClick={() => setI(i + 1)}>Next</button>
          : <button type="button" className="rx-btn primary" disabled={!answers[i] || pending} onClick={() => start(async () => {
              const r = await submitSurvey(answers);
              if (!r.ok) { setError(r.error); return; }
              toast('Survey saved.'); setOpen(false); router.refresh();
            })}>{pending ? 'Saving…' : 'Finish'}</button>}
        <button type="button" className="rx-link muted" onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </div>
  );
}

export function BeyondSelfEditor({ initial, since }: { initial: string; since: string | null }) {
  const router = useRouter();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(initial);
  const [pending, start] = useTransition();
  if (!editing) {
    return (
      <div className="rx-stack-sm">
        {initial ? <><p className="rx-p">{initial}</p>{since && <p className="rx-sm">Running since {new Date(since + 'T00:00:00Z').toLocaleDateString('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' })}</p>}</> : <p className="rx-sm">A project that serves others, beyond yourself.</p>}
        <div><button type="button" className="rx-link" onClick={() => setEditing(true)}>{initial ? 'Edit' : 'Add a project'}</button></div>
      </div>
    );
  }
  return (
    <div className="rx-stack-sm">
      <textarea className="rx-in" aria-label="Beyond-self project" value={text} maxLength={300} onChange={(e) => setText(e.target.value)} placeholder="For example: free weekend cyber-safety talks for teenagers in my area" />
      <div className="rx-row"><button type="button" className="rx-btn primary" disabled={pending} onClick={() => start(async () => { const r = await saveBeyondSelf(text); toast(r.ok ? 'Saved.' : r.error); if (r.ok) { setEditing(false); router.refresh(); } })}>Save</button>
        <button type="button" className="rx-link muted" onClick={() => { setText(initial); setEditing(false); }}>Cancel</button></div>
    </div>
  );
}
