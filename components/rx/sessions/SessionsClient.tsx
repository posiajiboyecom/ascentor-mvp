'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Check, Minus, Plus, Trash2 } from 'lucide-react';
import {
  addAgreementGoal, addAgreementTask, addSlot, askQuestion, breakTie, castVote, confirmAgreementTask, confirmSlot, markSlot,
  removeAgreementGoal, removeAgreementTask, removeSlot, requestSwap, respondCircleRequest, setCapacity, setPaused, setRsvp, startVote,
} from '@/app/(app)/sessions/actions';
import type { AgreementView, CandidateView, SlotView } from '@/lib/rx/cmentor';
import { Avatar, Tag } from '@/components/rx/ui';
import { useToast } from '@/components/rx/Toast';

const err = (m: string) => <p className="rx-sm" role="alert" style={{ color: 'var(--rx-danger)' }}>{m}</p>;

function useRun() {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [error, setError] = useState('');
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, ok?: string, after?: () => void) => start(async () => {
    setError('');
    const r = await fn();
    if (!r.ok) { setError(r.error ?? 'Something went wrong.'); return; }
    if (ok) toast(ok);
    after?.();
    router.refresh();
  });
  return { run, pending, error };
}

// ── starting and casting the vote ───────────────────────────────────────────
export function StartVoteButton({ circleId }: { circleId?: string }) {
  const { run, pending, error } = useRun();
  return (<><button type="button" className="rx-btn primary" disabled={pending} onClick={() => run(() => startVote(circleId), 'The vote is open.')}>{pending ? 'Finding mentors…' : 'Find mentors for our Circle'}</button>{error && err(error)}</>);
}

export function VoteCards({ roundId, candidates, tie, canBreak, tied, isMember, nameOfCircle }: { roundId: string; candidates: CandidateView[]; tie: boolean; canBreak: boolean; tied: string[]; isMember: boolean; nameOfCircle: string }) {
  const { run, pending, error } = useRun();
  return (
    <div className="rx-stack">
      <div className="rx-grid3">
        {candidates.map((c) => (
          <div key={c.mentor.id} className="rx-card" style={{ padding: 0, display: 'flex', flexDirection: 'column' }}>
            <div className="rx-thumb" style={{ borderRadius: '12px 12px 0 0', aspectRatio: 'auto', height: 130, alignItems: 'center', justifyContent: 'center' }}><Avatar name={c.mentor.name} url={c.mentor.avatar_url} size="lg" seed={c.mentor.id} /></div>
            <div className="rx-stack-sm" style={{ padding: '16px 18px 18px', flex: 1 }}>
              <div><p className="rx-h3">{c.mentor.name}</p><p className="rx-sm">{c.mentor.headline}</p></div>
              <div className="rx-row" style={{ gap: 6 }}>{c.mentor.tags.slice(0, 3).map((t) => <Tag key={t}>{t}</Tag>)}</div>
              <p className="rx-sm">{c.mentor.langs.join(', ')}</p>
              <p className="rx-sm">{c.why}</p>
              <p className="rx-sm rx-strong">{c.votes} {c.votes === 1 ? 'vote' : 'votes'}</p>
              <div className="rx-row" style={{ marginTop: 'auto' }}>
                {!tie && isMember && <button type="button" className={`rx-btn ${c.mine ? 'primary' : 'secondary'}`} disabled={pending} onClick={() => run(() => castVote(roundId, c.mentor.id), c.mine ? 'Your vote is saved.' : 'Voted.')}>{c.mine ? 'Voted' : 'Vote'}</button>}
                {tie && canBreak && tied.includes(c.mentor.id) && <button type="button" className="rx-btn primary" disabled={pending} onClick={() => run(() => breakTie(roundId, c.mentor.id), `${c.mentor.name.split(' ')[0]} chosen.`)}>Choose this mentor</button>}
                <Link href={`/sessions/mentors/${c.mentor.id}`} className="rx-link">Profile<ArrowRight aria-hidden /></Link>
              </div>
            </div>
          </div>
        ))}
      </div>
      {tie && !canBreak && <p className="rx-sm">It’s a tie. Your facilitator chooses between the top mentors within 2 days, for {nameOfCircle}.</p>}
      {error && err(error)}
    </div>
  );
}

// ── picking a time ──────────────────────────────────────────────────────────
export interface SlotGridItem extends SlotView { day: string; time: string }

export function ScheduleGrid({ cmId, slots, total, canConfirm, isMember, min }: { cmId: string; slots: SlotGridItem[]; total: number; canConfirm: boolean; isMember: boolean; min: number }) {
  const { run, pending, error } = useRun();
  const days = new Map<string, SlotGridItem[]>();
  for (const s of slots) days.set(s.day, [...(days.get(s.day) ?? []), s]);
  if (!slots.length) return <p className="rx-p">Your mentor hasn’t published open times yet. We’ll tell you when they do.</p>;
  return (
    <div className="rx-stack">
      <p className="rx-sm">Tap the times you can attend. Times with {min} or more are ranked first.</p>
      {[...days.entries()].map(([day, list]) => (
        <div key={day} className="rx-stack-sm"><p className="rx-sm rx-strong">{day}</p>
          <div className="rx-row" style={{ gap: 10, alignItems: 'stretch' }}>
            {list.map((s) => {
              const strong = s.marks >= min;
              return (
                <div key={s.id} className="rx-stack-sm" style={{ gap: 6, minWidth: 108 }}>
                  {isMember
                    ? <button type="button" className="rx-slot free" aria-pressed={s.mine} style={{ ...(s.mine ? { background: '#0F0F0E', color: '#FAFAF8', borderColor: '#0F0F0E' } : {}), ...(strong ? { borderBottom: '3px solid var(--rx-accent)' } : {}), padding: '0 14px' }} disabled={pending} onClick={() => run(() => markSlot(cmId, s.id, !s.mine))}>{s.mine && <Check aria-hidden style={{ width: 14, height: 14, marginRight: 4 }} />}{s.time}</button>
                    : <span className="rx-slot free" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 14px', ...(strong ? { borderBottom: '3px solid var(--rx-accent)' } : {}) }}>{s.time}</span>}
                  <span className="rx-sm" style={{ textAlign: 'center' }}>{s.marks} of {total} can attend</span>
                  {canConfirm && strong && <button type="button" className="rx-link" style={{ minHeight: 32, fontSize: 13, justifyContent: 'center' }} disabled={pending} onClick={() => { if (window.confirm(`Book ${s.day} at ${s.time}, then every two weeks at the same time?`)) run(() => confirmSlot(cmId, s.id), 'Sessions booked.'); }}>Confirm this time</button>}
                </div>
              );
            })}
          </div>
        </div>
      ))}
      {error && err(error)}
    </div>
  );
}

// ── RSVP, question ──────────────────────────────────────────────────────────
export function RsvpButtons({ sessionId, mine, going, min }: { sessionId: string; mine: 'going' | 'cannot' | null; going: number; min: number }) {
  const { run, pending, error } = useRun();
  return (
    <div className="rx-stack-sm">
      <div className="rx-row">
        <button type="button" className={`rx-btn ${mine === 'going' ? 'primary' : 'secondary'}`} disabled={pending} onClick={() => run(() => setRsvp(sessionId, 'going'))}>Going</button>
        <button type="button" className={`rx-btn ${mine === 'cannot' ? 'primary' : 'secondary'}`} disabled={pending} onClick={() => run(() => setRsvp(sessionId, 'cannot'))}>Can’t</button>
      </div>
      <p className="rx-sm">{going} of {min} needed are going. The session runs when {min} or more are going 24 hours before.</p>
      {error && err(error)}
    </div>
  );
}

export function QuestionBox({ sessionId, initial, locked }: { sessionId: string; initial: string | null; locked: boolean }) {
  const { run, pending, error } = useRun();
  const [text, setText] = useState(initial ?? '');
  return (
    <div className="rx-stack-sm">
      <label htmlFor={`q-${sessionId}`} className="rx-label">Your question for the mentor</label>
      <textarea id={`q-${sessionId}`} className="rx-in" style={{ minHeight: 72 }} value={text} maxLength={280} disabled={locked} placeholder={locked ? 'Questions have closed for this session.' : 'One question helps the 20 minutes stay focused.'} onChange={(e) => setText(e.target.value)} />
      {!locked && <div><button type="button" className="rx-btn secondary" disabled={pending || text.trim().length < 5} onClick={() => run(() => askQuestion(sessionId, text), 'Question sent to the mentor.')}>{initial ? 'Update my question' : 'Send my question'}</button></div>}
      {error && err(error)}
    </div>
  );
}

// ── the shared agreement ────────────────────────────────────────────────────
export function AgreementWorkspace({ cmId, agreement, role, members, meId, maxGoals }: { cmId: string; agreement: AgreementView; role: 'member' | 'mentor'; members: { id: string; name: string }[]; meId: string; maxGoals: number }) {
  const { run, pending, error } = useRun();
  const [goal, setGoal] = useState('');
  const [task, setTask] = useState('');
  const [owner, setOwner] = useState(meId);
  const [due, setDue] = useState('');
  return (
    <div className="rx-card rx-stack">
      <div className="rx-between"><p className="rx-label">Circle agreement</p><span className="rx-sm">Owner and mentor both confirm a task</span></div>
      <div className="rx-stack-sm">
        {agreement.goals.map((g, i) => (
          <div key={g.id} className="rx-between"><p className="rx-p">{i + 1}. {g.text}</p>
            {role === 'member' && <button type="button" className="rx-ib" style={{ width: 36, height: 36 }} aria-label="Remove goal" onClick={() => run(() => removeAgreementGoal(cmId, g.id))}><Trash2 aria-hidden style={{ width: 16, height: 16 }} /></button>}</div>
        ))}
        {agreement.goals.length === 0 && <p className="rx-sm">No goals yet. Choose one to {maxGoals} things your Circle will work on with your mentor.</p>}
        {role === 'member' && agreement.goals.length < maxGoals && (
          <div className="rx-row rx-nw"><input className="rx-in" aria-label="New Circle goal" placeholder="Add a Circle goal" value={goal} maxLength={160} onChange={(e) => setGoal(e.target.value)} />
            <button type="button" className="rx-btn secondary" disabled={pending || goal.trim().length < 3} onClick={() => run(async () => { const r = await addAgreementGoal(cmId, goal); if (r.ok) setGoal(''); return r; })}>Add</button></div>
        )}
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table className="rx-tbl"><thead><tr><th>Task</th><th>Owner</th><th>Due</th><th>Owner</th><th>Mentor</th><th /></tr></thead><tbody>
          {agreement.tasks.map((t) => {
            const done = t.ownerConfirmed && t.mentorConfirmed;
            const canOwner = t.ownerId === meId; const canMentor = role === 'mentor';
            return (
              <tr key={t.id}>
                <td style={done ? { textDecoration: 'line-through', color: 'var(--rx-muted)' } : undefined}>{t.task}</td><td>{t.ownerName}</td>
                <td style={{ whiteSpace: 'nowrap' }}>{t.due ? new Date(t.due + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }) : '—'}</td>
                <td><button type="button" className="rx-box" aria-label="Owner confirms" aria-pressed={t.ownerConfirmed} disabled={!canOwner || pending} onClick={() => run(() => confirmAgreementTask(cmId, t.id, !t.ownerConfirmed))}>{t.ownerConfirmed && <Check aria-hidden />}</button></td>
                <td><button type="button" className="rx-box" aria-label="Mentor confirms" aria-pressed={t.mentorConfirmed} disabled={!canMentor || pending} onClick={() => run(() => confirmAgreementTask(cmId, t.id, !t.mentorConfirmed))}>{t.mentorConfirmed && <Check aria-hidden />}</button></td>
                <td>{role === 'member' && <button type="button" className="rx-ib" style={{ width: 32, height: 32 }} aria-label="Remove task" onClick={() => run(() => removeAgreementTask(cmId, t.id))}><Trash2 aria-hidden style={{ width: 14, height: 14 }} /></button>}</td>
              </tr>
            );
          })}
          {agreement.tasks.length === 0 && <tr><td colSpan={6} className="rx-sm">No tasks yet.</td></tr>}
        </tbody></table>
      </div>
      {role === 'member' && (
        <div className="rx-row" style={{ gap: 8 }}>
          <input className="rx-in" style={{ flex: '1 1 200px' }} aria-label="New task" placeholder="Add a task" value={task} maxLength={160} onChange={(e) => setTask(e.target.value)} />
          <select className="rx-in" style={{ width: 'auto' }} aria-label="Owner" value={owner} onChange={(e) => setOwner(e.target.value)}>{members.map((m) => <option key={m.id} value={m.id}>{m.id === meId ? 'Me' : m.name}</option>)}</select>
          <input className="rx-in" style={{ width: 'auto' }} type="date" aria-label="Due date" value={due} onChange={(e) => setDue(e.target.value)} />
          <button type="button" className="rx-btn secondary" disabled={pending || task.trim().length < 3} onClick={() => run(async () => { const r = await addAgreementTask(cmId, task, owner, due || null); if (r.ok) { setTask(''); setDue(''); } return r; })}>Add task</button>
        </div>
      )}
      {error && err(error)}
    </div>
  );
}

// ── swap and pause ──────────────────────────────────────────────────────────
export function SwapButton({ cmId }: { cmId: string }) {
  const { run, pending, error } = useRun();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  return (
    <div className="rx-stack-sm">
      {!open ? <button type="button" className="rx-link" onClick={() => setOpen(true)}>Suggest a different mentor<ArrowRight aria-hidden /></button> : (
        <>
          <p className="rx-sm">One free swap after your first session. Your Circle votes again. Your reason is private to the Ascentor team.</p>
          <input className="rx-in" aria-label="Reason for swapping" placeholder="What would you want from the next mentor?" value={reason} maxLength={120} onChange={(e) => setReason(e.target.value)} />
          <div className="rx-row"><button type="button" className="rx-btn secondary" disabled={pending} onClick={() => run(() => requestSwap(cmId, reason), 'Your Circle will vote again.')}>Start a new vote</button><button type="button" className="rx-link muted" onClick={() => setOpen(false)}>Cancel</button></div>
        </>
      )}
      {error && err(error)}
    </div>
  );
}

export function PauseButton({ cmId, paused }: { cmId: string; paused: boolean }) {
  const { run, pending, error } = useRun();
  return (<><button type="button" className="rx-link muted" disabled={pending} onClick={() => run(() => setPaused(cmId, !paused), paused ? 'Sessions resumed.' : 'Sessions paused.')}>{paused ? 'Resume sessions' : 'Pause sessions'}</button>{error && err(error)}</>);
}

// ── mentor side ─────────────────────────────────────────────────────────────
export function CircleRequestActions({ cmId }: { cmId: string }) {
  const { run, pending, error } = useRun();
  return (<><button type="button" className="rx-btn primary" disabled={pending} onClick={() => run(() => respondCircleRequest(cmId, true), 'Accepted. The Circle will pick a time.')}>Accept</button><button type="button" className="rx-btn secondary" disabled={pending} onClick={() => run(() => respondCircleRequest(cmId, false), 'Declined.')}>Decline</button>{error && err(error)}</>);
}

export function CapacityStepper({ value }: { value: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [v, setV] = useState(value);
  const change = (n: number) => { const next = Math.max(0, Math.min(8, v + n)); setV(next); start(async () => { await setCapacity(next); router.refresh(); }); };
  return (
    <div className="rx-row rx-nw">
      <button type="button" className="rx-btn secondary" style={{ minWidth: 48, padding: 0 }} aria-label="Fewer Circles" disabled={pending} onClick={() => change(-1)}><Minus aria-hidden style={{ width: 18, height: 18 }} /></button>
      <span className="rx-h2" style={{ minWidth: 48, textAlign: 'center' }}>{v}</span>
      <button type="button" className="rx-btn secondary" style={{ minWidth: 48, padding: 0 }} aria-label="More Circles" disabled={pending} onClick={() => change(1)}><Plus aria-hidden style={{ width: 18, height: 18 }} /></button>
    </div>
  );
}

export function SlotManager({ slots }: { slots: { id: string; label: string; taken: boolean }[] }) {
  const router = useRouter();
  const [local, setLocal] = useState('');
  const [error, setError] = useState('');
  const [pending, start] = useTransition();
  return (
    <div className="rx-stack-sm">
      {slots.map((s) => (
        <div key={s.id} className="rx-between"><span className="rx-sm">{s.label}{s.taken ? ' · booked' : ''}</span>
          {!s.taken && <button type="button" className="rx-link muted" style={{ minHeight: 32, fontSize: 13 }} onClick={() => start(async () => { await removeSlot(s.id); router.refresh(); })}>Remove</button>}</div>
      ))}
      {slots.length === 0 && <p className="rx-sm">No open times. Add some so Circles can book you. Each is a 30-minute window for a 20-minute session.</p>}
      <div className="rx-row rx-nw" style={{ gap: 8 }}>
        <input type="datetime-local" className="rx-in" aria-label="New open time" value={local} onChange={(e) => setLocal(e.target.value)} />
        <button type="button" className="rx-btn secondary" disabled={pending || !local} onClick={() => start(async () => { const r = await addSlot(local); if (!r.ok) { setError(r.error); return; } setLocal(''); setError(''); router.refresh(); })}>Add</button>
      </div>
      {error && err(error)}
    </div>
  );
}
