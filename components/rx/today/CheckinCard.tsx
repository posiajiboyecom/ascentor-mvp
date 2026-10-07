'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Check } from 'lucide-react';
import { checkIn } from '@/app/(app)/dashboard/practice-actions';
import { useToast } from '@/components/rx/Toast';
import { openSage } from '@/components/rx/sage-bus';
import { Bar } from '@/components/rx/ui';

export default function CheckinCard({ initial, kept, total, hasPlan }: { initial: 'kept' | 'not' | null; kept: number; total: number; hasPlan: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [status, setStatus] = useState(initial);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [pending, start] = useTransition();

  function log(s: 'kept' | 'not') {
    setError('');
    start(async () => {
      const r = await checkIn(s, note);
      if (!r.ok) { setError(r.error); return; }
      setStatus(s);
      toast(s === 'kept' ? 'Kept. Logged for today.' : 'Logged.');
      router.refresh();
    });
  }

  const label = total ? `${kept} of ${total} kept` : 'Nothing set yet';
  const pct = total ? Math.round((kept / total) * 100) : 0;

  return (
    <div className="rx-card rx-stack">
      <div className="rx-between"><p className="rx-label">Today’s check-in</p><span className="rx-sm rx-strong">{label}</span></div>
      {status === null && (
        <>
          <input className="rx-in" aria-label="A short note (optional)" placeholder="A short note, if you like" maxLength={280} value={note} onChange={(e) => setNote(e.target.value)} disabled={!hasPlan} />
          <div className="rx-row rx-nw" style={{ gap: 10 }}>
            <button type="button" className="rx-btn secondary" style={{ flex: 1 }} disabled={pending || !hasPlan} onClick={() => log('kept')}>Kept it</button>
            <button type="button" className="rx-btn secondary" style={{ flex: 1 }} disabled={pending || !hasPlan} onClick={() => log('not')}>Not today</button>
          </div>
        </>
      )}
      {status === 'kept' && <p className="rx-row rx-nw rx-p rx-rise" style={{ gap: 10 }}><Check aria-hidden style={{ width: 18, height: 18, color: 'var(--rx-gold)' }} />Kept. Logged for today.</p>}
      {status === 'not' && (
        <div className="rx-stack-sm rx-rise">
          <p className="rx-p">Logged. A missed day doesn’t reset anything.</p>
          <div><button type="button" className="rx-link" onClick={() => openSage({ topic: 'missed' })}>What got in the way? Talk it through with Sage<ArrowRight aria-hidden /></button></div>
        </div>
      )}
      {status !== null && (
        <button type="button" className="rx-link muted" style={{ minHeight: 32, fontSize: 13 }} onClick={() => setStatus(null)}>Change today’s answer</button>
      )}
      {!hasPlan && <p className="rx-sm">Build this week’s plan first, then check in each day.</p>}
      {error && <p className="rx-sm" role="alert" style={{ color: 'var(--rx-danger)' }}>{error}</p>}
      <Bar pct={pct} label={label} />
    </div>
  );
}
