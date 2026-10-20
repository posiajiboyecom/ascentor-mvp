'use client';

import { useState, useTransition } from 'react';
import { saveNextChoice, type NextChoice } from '@/app/(app)/circle/actions';
import { useToast } from '@/components/rx/Toast';

const OPTS: [NextChoice, string, string][] = [
  ['stay', 'Stay with this Circle', 'Keep the same people for cycle 2.'],
  ['new', 'Join a new Circle', 'Meet new people at your stage, matched by goal and weekly times.'],
  ['lead', 'Lead a Circle', 'You showed up for 12 weeks. Ask to facilitate a Circle of your own.'],
  ['break', 'Take a break', 'Keep Today and Sage. Join a Circle again when you’re ready.'],
];

export function NextCycleForm({ circleId, start, initial }: { circleId: string; start: string; initial: NextChoice | null }) {
  const toast = useToast();
  const [choice, setChoice] = useState<NextChoice | ''>(initial ?? '');
  const [pending, run] = useTransition();
  const msg: Record<NextChoice, string> = {
    stay: `Saved. Cycle 2 starts ${start}.`,
    new: `Saved. We’ll match you before ${start}.`,
    lead: 'Request sent. The Ascentor team will be in touch.',
    break: 'Saved. Join a Circle again any time from Circle.',
  };
  const confirm = () => {
    if (!choice) { toast('Choose an option first.'); return; }
    run(async () => {
      const r = await saveNextChoice(choice, circleId);
      toast(r.ok ? msg[choice] : r.error);
    });
  };
  return (
    <>
      <div className="rx-optcol">
        {OPTS.map(([k, t, d]) => (
          <button key={k} type="button" className={`rx-opt tall${choice === k ? ' on' : ''}`} aria-pressed={choice === k} onClick={() => setChoice(k)}>
            <span className="rx-strong">{t}</span><span className="rx-sm">{d}</span>
          </button>
        ))}
      </div>
      <div><button type="button" className="rx-btn primary" disabled={pending} onClick={confirm}>Confirm my choice</button></div>
    </>
  );
}
