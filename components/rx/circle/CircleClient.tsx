'use client';

// Interactive pieces of the Circle area: the pledge, the group chat, the weekly report and the cycle review.

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, Check, Sparkles } from 'lucide-react';
import ChatThread from '@/components/rx/ChatThread';
import type { ChatMsg } from '@/lib/rx/chat-types';
import { pledge, pollCircleMessages, placeMeInCircle, saveReport, saveReview, sendCircleMessage, shareWin } from '@/app/(app)/circle/actions';
import { useToast } from '@/components/rx/Toast';
import { openSage } from '@/components/rx/sage-bus';

export function PledgeButtons() {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [error, setError] = useState('');
  return (
    <>
      <div className="rx-row">
        <button type="button" className="rx-btn primary" disabled={pending} onClick={() => start(async () => {
          const r = await pledge();
          if (!r.ok) { setError(r.error); return; }
          toast('Welcome to your Circle.');
          router.refresh();
        })}>I agree</button>
        <Link href="/dashboard" className="rx-link">Not yet<ArrowRight aria-hidden /></Link>
      </div>
      {error && <p className="rx-sm" role="alert" style={{ color: 'var(--rx-danger)' }}>{error}</p>}
    </>
  );
}

export function PlaceMeButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState('');
  return (
    <>
      <button type="button" className="rx-btn primary" disabled={pending} onClick={() => start(async () => {
        const r = await placeMeInCircle();
        if (!r.ok) { setError(r.error); return; }
        router.refresh();
      })}>{pending ? 'Placing you…' : 'Find my Circle'}</button>
      {error && <p className="rx-sm" role="alert" style={{ color: 'var(--rx-danger)' }}>{error}</p>}
    </>
  );
}

export function CircleChat({ circleId, meId, initial }: { circleId: string; meId: string; initial: ChatMsg[] }) {
  const toast = useToast();
  return (
    <ChatThread
      initial={initial}
      meId={meId}
      send={(body) => sendCircleMessage(circleId, body)}
      poll={(after) => pollCircleMessages(circleId, after)}
      realtime={{ table: 'circle_messages', column: 'circle_id', value: circleId }}
      placeholder="Message your Circle"
      extra={(m, mine) => mine && !m.isWin && m.body.length > 20 && !m.body.startsWith('[') ? (
        <div><button type="button" className="rx-link" style={{ minHeight: 36, fontSize: 14 }} onClick={async () => {
          const r = await shareWin(m.id);
          toast(r.ok ? 'Shared to the Wins board.' : r.error);
        }}>Share this win<ArrowRight aria-hidden /></button></div>
      ) : null}
    />
  );
}

export function ReportForm({ week, initial, shared }: { week: number; initial: { kept: string; obstacle: string; next: string }; shared: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [kept, setKept] = useState(initial.kept);
  const [obstacle, setObstacle] = useState(initial.obstacle);
  const [next, setNext] = useState(initial.next);
  const [done, setDone] = useState(shared);
  const [error, setError] = useState('');
  const [pending, start] = useTransition();

  // Sage can hand a drafted report back to this form.
  useEffect(() => {
    const onDraft = (e: Event) => {
      const d = (e as CustomEvent<{ kept: string; obstacle: string; next: string }>).detail;
      if (d) { setKept(d.kept); setObstacle(d.obstacle); setNext(d.next); }
    };
    window.addEventListener('rx:report-draft', onDraft);
    return () => window.removeEventListener('rx:report-draft', onDraft);
  }, []);

  return (
    <div className="rx-card rx-stack">
      <div className="rx-between"><p className="rx-label">My report · week {week}</p>{done && <span className="rx-row rx-nw rx-sm rx-rise" style={{ gap: 6 }}><Check aria-hidden style={{ width: 16, height: 16, color: 'var(--rx-gold)' }} />Shared</span>}</div>
      <div className="rx-fld"><span className="rx-fld-label">This week’s practice</span>
        <div className="rx-opts">{['Kept', 'Partly kept', 'Not kept'].map((o) => <button key={o} type="button" className="rx-opt" aria-pressed={kept === o} onClick={() => setKept(o)}>{o}</button>)}</div></div>
      <div className="rx-fld"><label htmlFor="rob">What got in the way</label><input id="rob" className="rx-in" value={obstacle} maxLength={300} onChange={(e) => setObstacle(e.target.value)} placeholder="One line is enough" /></div>
      <div className="rx-fld"><label htmlFor="rnx">Next if-then</label><textarea id="rnx" className="rx-in" value={next} maxLength={500} onChange={(e) => setNext(e.target.value)} placeholder="After I ___, I will ___. If ___, then I will ___." /></div>
      {error && <p className="rx-sm" role="alert" style={{ color: 'var(--rx-danger)' }}>{error}</p>}
      <div className="rx-row">
        <button type="button" className="rx-btn primary" disabled={pending} onClick={() => start(async () => {
          setError('');
          const r = await saveReport(week, kept, obstacle, next);
          if (!r.ok) { setError(r.error); return; }
          setDone(true); toast('Report shared with your Circle.'); router.refresh();
        })}>{done ? 'Update report' : 'Share with Circle'}</button>
        <button type="button" className="rx-btn secondary" onClick={() => openSage({ topic: 'report' })}><Sparkles aria-hidden style={{ width: 16, height: 16 }} />Draft with Sage</button>
      </div>
    </div>
  );
}

export function ReviewForm({ initialCarry, initialChoice, open }: { initialCarry: string; initialChoice: 'join' | 'break' | null; open: boolean }) {
  const toast = useToast();
  const [carry, setCarry] = useState(initialCarry);
  const [choice, setChoice] = useState<'join' | 'break' | null>(initialChoice);
  const [error, setError] = useState('');
  const [pending, start] = useTransition();
  const save = (c: 'join' | 'break') => start(async () => {
    setError('');
    const r = await saveReview(carry, c);
    if (!r.ok) { setError(r.error); return; }
    setChoice(c);
    toast(c === 'join' ? 'You’re in the next Circle. We’ll place you before Monday.' : 'Enjoy the break. Your seat is waiting when you’re ready.');
  });
  return (
    <>
      <div className="rx-card rx-stack">
        <p className="rx-label">You’re invited to a new Circle</p>
        <p className="rx-p">A new 90-day cycle starts Monday. Join a new group, or take a short break first.</p>
        <div className="rx-row">
          <button type="button" className="rx-btn primary" disabled={pending || !open} onClick={() => save('join')} aria-pressed={choice === 'join'}>{choice === 'join' ? 'Joined a new Circle' : 'Join a new Circle'}</button>
          <button type="button" className="rx-btn secondary" disabled={pending || !open} onClick={() => save('break')} aria-pressed={choice === 'break'}>{choice === 'break' ? 'Taking a break' : 'Take a break'}</button>
        </div>
        {!open && <p className="rx-sm">This opens in week 12.</p>}
        {error && <p className="rx-sm" role="alert" style={{ color: 'var(--rx-danger)' }}>{error}</p>}
      </div>
      <div className="rx-card rx-stack-sm">
        <label htmlFor="carry" className="rx-label">One thing to carry forward</label>
        <textarea id="carry" className="rx-in" placeholder="What will you keep doing?" value={carry} maxLength={600} onChange={(e) => setCarry(e.target.value)} onBlur={() => { if (choice) save(choice); }} />
        <p className="rx-sm">Figures fill in from your own check-ins.</p>
      </div>
    </>
  );
}
