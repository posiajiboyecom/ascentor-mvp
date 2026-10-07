'use client';

import Link from 'next/link';
import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Check, Minus, Plus, Trash2 } from 'lucide-react';
import { MENTOR_FORMAT, MENTOR_FREQUENCY, MENTOR_TIMES } from '@/lib/rx/constants';
import {
  addGoal, addSlot, addTask, cancelRequest, confirmAgreement, endMentorship, pollMentorMessages, removeGoal, removeSlot, removeTask,
  requestTaster, rescheduleSession, respondToRequest, saveIntake, sendMentorMessage, setCapacity, toggleTask, updateRequest,
} from '@/app/(app)/sessions/actions';
import type { Agreement } from '@/lib/rx/mentors';
import type { ChatMsg } from '@/lib/rx/chat-types';
import ChatThread from '@/components/rx/ChatThread';
import { useToast } from '@/components/rx/Toast';

const err = (m: string) => <p className="rx-sm" role="alert" style={{ color: 'var(--rx-danger)' }}>{m}</p>;

// ── intake ──────────────────────────────────────────────────────────────────
export function IntakeForm({ initial, interests }: { initial: { goal: string; interests: string[]; frequency: string; format: string; times: string[] }; interests: string[] }) {
  const router = useRouter();
  const [goal, setGoal] = useState(initial.goal);
  const [picked, setPicked] = useState<string[]>(initial.interests);
  const [frequency, setFrequency] = useState(initial.frequency);
  const [format, setFormat] = useState(initial.format);
  const [times, setTimes] = useState<string[]>(initial.times);
  const [error, setError] = useState('');
  const [pending, start] = useTransition();
  const tog = (arr: string[], v: string) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  return (
    <div className="rx-card rx-stack">
      <div className="rx-fld"><label htmlFor="ig">Your goal</label><input id="ig" className="rx-in" value={goal} maxLength={300} onChange={(e) => setGoal(e.target.value)} /><span className="rx-sm">From onboarding. Edit if it has changed.</span></div>
      <div className="rx-fld"><span className="rx-fld-label">Interests</span>
        <div className="rx-row" style={{ gap: 8 }}>{interests.map((i) => <button key={i} type="button" className="rx-chip" aria-pressed={picked.includes(i)} onClick={() => setPicked((c) => tog(c, i))}>{picked.includes(i) && <Check aria-hidden />}{i}</button>)}</div></div>
      <div className="rx-fld"><span className="rx-fld-label">How often</span><div className="rx-opts">{MENTOR_FREQUENCY.map((f) => <button key={f} type="button" className="rx-opt" aria-pressed={frequency === f} onClick={() => setFrequency(f)}>{f}</button>)}</div></div>
      <div className="rx-fld"><span className="rx-fld-label">Format</span><div className="rx-opts">{MENTOR_FORMAT.map((f) => <button key={f} type="button" className="rx-opt" aria-pressed={format === f} onClick={() => setFormat(f)}>{f}</button>)}</div></div>
      <div className="rx-fld"><span className="rx-fld-label">Times (your time zone)</span><div className="rx-opts">{MENTOR_TIMES.map((t) => <button key={t} type="button" className="rx-opt" aria-pressed={times.includes(t)} onClick={() => setTimes((c) => tog(c, t))}>{t}</button>)}</div></div>
      {error && err(error)}
      <div><button type="button" className="rx-btn primary" disabled={pending} onClick={() => start(async () => {
        const r = await saveIntake({ goal, interests: picked, frequency, format, times });
        if (!r.ok) { setError(r.error); return; }
        router.push('/sessions/suggestions');
      })}>See suggestions</button></div>
    </div>
  );
}

// ── requesting ──────────────────────────────────────────────────────────────
export function RequestTasterButton({ mentorId, slotId, primary = false, label = 'Request a taster' }: { mentorId: string; slotId?: string | null; primary?: boolean; label?: string }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [error, setError] = useState('');
  return (
    <>
      <button type="button" className={`rx-btn ${primary ? 'primary' : 'secondary'}`} disabled={pending} onClick={() => start(async () => {
        const r = await requestTaster(mentorId, slotId ?? null);
        if (!r.ok) { setError(r.error); return; }
        toast('Taster requested.');
        router.push('/sessions');
        router.refresh();
      })}>{pending ? 'Sending…' : label}</button>
      {error && err(error)}
    </>
  );
}

export function PendingCard({ matchId, mentorFirst, initialAsk }: { matchId: string; mentorFirst: string; initialAsk: string }) {
  const router = useRouter();
  const toast = useToast();
  const [ask, setAsk] = useState(initialAsk);
  const [error, setError] = useState('');
  const [pending, start] = useTransition();
  return (
    <>
      <div className="rx-fld"><label htmlFor="one">The one thing you want from this first meeting</label>
        <textarea id="one" className="rx-in" placeholder="For example: a realistic path to a SOC analyst role" value={ask} maxLength={400} onChange={(e) => setAsk(e.target.value)} /></div>
      <div className="rx-row">
        <button type="button" className="rx-btn primary" disabled={pending} onClick={() => start(async () => {
          const r = await updateRequest(matchId, { firstAsk: ask });
          if (!r.ok) { setError(r.error); return; }
          toast(`Sent to ${mentorFirst}.`);
        })}>Send to {mentorFirst}</button>
        <Link href="/sessions/suggestions" className="rx-link">Choose someone else<ArrowRight aria-hidden /></Link>
        <button type="button" className="rx-link muted" disabled={pending} onClick={() => start(async () => { const r = await cancelRequest(matchId); toast(r.ok ? 'Request cancelled.' : r.error); router.refresh(); })}>Cancel request</button>
      </div>
      {error && err(error)}
    </>
  );
}

// ── picking a time ──────────────────────────────────────────────────────────
export interface BookSlot { id: string; iso: string; day: string; time: string }

export function BookGrid({ slots, mentorId, matchId, mode, current }: { slots: BookSlot[]; mentorId: string; matchId?: string; mode: 'request' | 'reschedule'; current?: string | null }) {
  const router = useRouter();
  const toast = useToast();
  const [chosen, setChosen] = useState<string>(current ?? '');
  const [error, setError] = useState('');
  const [pending, start] = useTransition();
  const days = useMemo(() => { const m = new Map<string, BookSlot[]>(); for (const s of slots) { m.set(s.day, [...(m.get(s.day) ?? []), s]); } return [...m.entries()]; }, [slots]);
  const sel = slots.find((s) => s.id === chosen);

  if (!slots.length) return <p className="rx-p">This mentor has no open times right now. You can still send a request and they’ll propose one.</p>;
  return (
    <>
      <div className="rx-stack">
        {days.map(([day, list]) => (
          <div key={day} className="rx-stack-sm"><p className="rx-sm rx-strong">{day}</p>
            <div className="rx-opts">{list.map((s) => <button key={s.id} type="button" className="rx-slot free" style={chosen === s.id ? { background: '#0F0F0E', color: '#FAFAF8', borderColor: '#0F0F0E', padding: '0 16px' } : { padding: '0 16px' }} aria-pressed={chosen === s.id} aria-label={`${day} ${s.time}`} onClick={() => setChosen(s.id)}>{s.time}</button>)}</div></div>
        ))}
      </div>
      <div className="rx-between"><span className="rx-sm">{sel ? `${sel.day}, ${sel.time}` : 'Choose a free slot'}</span>
        <button type="button" className="rx-btn primary" disabled={!chosen || pending} onClick={() => start(async () => {
          const r = mode === 'reschedule' && matchId ? await rescheduleSession(matchId, chosen) : matchId ? await updateRequest(matchId, { slotId: chosen }) : await requestTaster(mentorId, chosen);
          if (!r.ok) { setError(r.error); return; }
          toast(mode === 'reschedule' ? 'Session moved.' : 'Time requested.');
          router.push('/sessions'); router.refresh();
        })}>{mode === 'reschedule' ? 'Move session' : 'Request time'}</button></div>
      {error && err(error)}
    </>
  );
}

// ── the agreement workspace (both sides) ────────────────────────────────────
export function Workspace({ matchId, role, agreement, meId, initialMessages, otherName }: { matchId: string; role: 'member' | 'mentor'; agreement: Agreement; meId: string; initialMessages: ChatMsg[]; otherName: string }) {
  const router = useRouter();
  const toast = useToast();
  const [goal, setGoal] = useState('');
  const [task, setTask] = useState('');
  const [owner, setOwner] = useState<'member' | 'mentor'>(role);
  const [due, setDue] = useState('');
  const [error, setError] = useState('');
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, ok?: string) => start(async () => {
    setError('');
    const r = await fn();
    if (!r.ok) { setError(r.error ?? 'Something went wrong.'); return; }
    if (ok) toast(ok);
    router.refresh();
  });
  const mine = role === 'member' ? agreement.memberConfirmed : agreement.mentorConfirmed;
  const theirs = role === 'member' ? agreement.mentorConfirmed : agreement.memberConfirmed;

  return (
    <div className="rx-stack-lg">
      <div className="rx-card rx-stack">
        <div className="rx-between"><p className="rx-label">Agreement</p><span className="rx-sm">Both confirm</span></div>
        <div className="rx-stack-sm">
          {agreement.goals.map((g, i) => (
            <div key={g.id} className="rx-between"><p className="rx-p">{i + 1}. {g.text}</p>
              <button type="button" className="rx-ib" style={{ width: 36, height: 36 }} aria-label="Remove goal" onClick={() => run(() => removeGoal(matchId, g.id))}><Trash2 aria-hidden style={{ width: 16, height: 16 }} /></button></div>
          ))}
          {agreement.goals.length === 0 && <p className="rx-sm">No goals yet. Add the one or two you’ll work on together.</p>}
          <div className="rx-row rx-nw"><input className="rx-in" aria-label="New goal" placeholder="Add a goal" value={goal} maxLength={200} onChange={(e) => setGoal(e.target.value)} />
            <button type="button" className="rx-btn secondary" disabled={pending || !goal.trim()} onClick={() => run(async () => { const r = await addGoal(matchId, goal); if (r.ok) setGoal(''); return r; })}>Add</button></div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="rx-tbl"><thead><tr><th>Task</th><th>Owner</th><th>Due</th><th>Done</th><th /></tr></thead><tbody>
            {agreement.tasks.map((t) => (
              <tr key={t.id}><td>{t.task}</td><td>{t.owner === role ? 'You' : otherName}</td><td style={{ whiteSpace: 'nowrap' }}>{t.due ? new Date(t.due + 'T00:00:00Z').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }) : '—'}</td>
                <td><button type="button" className="rx-box" aria-label="Mark done" aria-pressed={t.done} onClick={() => run(() => toggleTask(matchId, t.id, !t.done))}>{t.done && <Check aria-hidden />}</button></td>
                <td><button type="button" className="rx-ib" style={{ width: 32, height: 32 }} aria-label="Remove task" onClick={() => run(() => removeTask(matchId, t.id))}><Trash2 aria-hidden style={{ width: 14, height: 14 }} /></button></td></tr>
            ))}
            {agreement.tasks.length === 0 && <tr><td colSpan={5} className="rx-sm">No tasks yet.</td></tr>}
          </tbody></table>
        </div>
        <div className="rx-row" style={{ gap: 8 }}>
          <input className="rx-in" style={{ flex: '1 1 200px' }} aria-label="New task" placeholder="Add a task" value={task} maxLength={200} onChange={(e) => setTask(e.target.value)} />
          <select className="rx-in" style={{ width: 'auto' }} aria-label="Owner" value={owner} onChange={(e) => setOwner(e.target.value as 'member' | 'mentor')}><option value={role}>Me</option><option value={role === 'member' ? 'mentor' : 'member'}>{otherName}</option></select>
          <input className="rx-in" style={{ width: 'auto' }} type="date" aria-label="Due date" value={due} onChange={(e) => setDue(e.target.value)} />
          <button type="button" className="rx-btn secondary" disabled={pending || !task.trim()} onClick={() => run(async () => { const r = await addTask(matchId, task, owner, due || null); if (r.ok) { setTask(''); setDue(''); } return r; })}>Add task</button>
        </div>

        <div className="rx-row" style={{ gap: 16 }}>
          <span className="rx-row rx-nw rx-sm" style={{ gap: 6 }}>{theirs && <Check aria-hidden style={{ width: 16, height: 16, color: 'var(--rx-gold)' }} />}{theirs ? `${otherName} confirmed` : `${otherName} hasn’t confirmed`}</span>
          {mine
            ? <span className="rx-row rx-nw rx-sm rx-rise" style={{ gap: 6 }}><Check aria-hidden style={{ width: 16, height: 16, color: 'var(--rx-gold)' }} />You confirmed</span>
            : <button type="button" className="rx-btn secondary" disabled={pending} onClick={() => run(() => confirmAgreement(matchId), 'Agreement confirmed.')}>Confirm</button>}
        </div>
        {error && err(error)}
      </div>

      <div className="rx-card" style={{ padding: 0, height: 420, overflow: 'hidden' }}>
        <ChatThread initial={initialMessages} meId={meId}
          send={(b) => sendMentorMessage(matchId, b)} poll={(a) => pollMentorMessages(matchId, a)}
          realtime={{ table: 'mentor_messages', column: 'match_id', value: matchId }}
          placeholder={`Message ${otherName}`} />
      </div>
    </div>
  );
}

// ── mentor side ─────────────────────────────────────────────────────────────
export function RequestActions({ matchId }: { matchId: string }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [error, setError] = useState('');
  const go = (a: boolean) => start(async () => { const r = await respondToRequest(matchId, a); if (!r.ok) { setError(r.error); return; } toast(a ? 'Accepted. The session is booked.' : 'Declined.'); router.refresh(); });
  return (<><button type="button" className="rx-btn primary" disabled={pending} onClick={() => go(true)}>Accept</button><button type="button" className="rx-btn secondary" disabled={pending} onClick={() => go(false)}>Decline</button>{error && err(error)}</>);
}

export function CapacityStepper({ value }: { value: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [v, setV] = useState(value);
  const change = (n: number) => { const next = Math.max(0, Math.min(8, v + n)); setV(next); start(async () => { await setCapacity(next); router.refresh(); }); };
  return (
    <div className="rx-row rx-nw">
      <button type="button" className="rx-btn secondary" style={{ minWidth: 48, padding: 0 }} aria-label="Fewer" disabled={pending} onClick={() => change(-1)}><Minus aria-hidden style={{ width: 18, height: 18 }} /></button>
      <span className="rx-h2" style={{ minWidth: 48, textAlign: 'center' }}>{v}</span>
      <button type="button" className="rx-btn secondary" style={{ minWidth: 48, padding: 0 }} aria-label="More" disabled={pending} onClick={() => change(1)}><Plus aria-hidden style={{ width: 18, height: 18 }} /></button>
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
      {slots.length === 0 && <p className="rx-sm">No open times. Add one so members can book you.</p>}
      <div className="rx-row rx-nw" style={{ gap: 8 }}>
        <input type="datetime-local" className="rx-in" aria-label="New open time" value={local} onChange={(e) => setLocal(e.target.value)} />
        <button type="button" className="rx-btn secondary" disabled={pending || !local} onClick={() => start(async () => { const r = await addSlot(local); if (!r.ok) { setError(r.error); return; } setLocal(''); setError(''); router.refresh(); })}>Add</button>
      </div>
      {error && err(error)}
    </div>
  );
}

export function EndMentorshipButton({ matchId }: { matchId: string }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  return <button type="button" className="rx-link muted" disabled={pending} onClick={() => { if (!window.confirm('End this mentorship? You can find a different mentor afterwards.')) return; start(async () => { const r = await endMentorship(matchId); toast(r.ok ? 'Mentorship ended.' : r.error); router.refresh(); }); }}>Request a different mentor<ArrowRight aria-hidden /></button>;
}
