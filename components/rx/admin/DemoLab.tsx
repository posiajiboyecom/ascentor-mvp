'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  addDemoMemberTo, bookBestTime, castDemoVotes, closeDemoVote, mentorSaysYes, openDemoCall, openDemoVote, resetDemoData, seedDemoData,
} from '@/app/admin/demo/actions';
import type { ActionResult } from '@/lib/rx/types';
import { useToast } from '@/components/rx/Toast';

export interface LabCircle {
  id: string; title: string; members: number; headline: string; detail: string | null;
  phase: 'forming' | 'ready' | 'voting' | 'requested' | 'scheduling' | 'active';
  callOpen: boolean;
}

function useDo() {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<ActionResult<object>>, ok: string) => start(async () => {
    const r = await fn();
    toast(r.ok ? ok : r.error);
    router.refresh();
  });
  return { run, pending };
}

export function SeedControls({ hasDemo }: { hasDemo: boolean }) {
  const { run, pending } = useDo();
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="rx-card rx-stack-sm">
      <p className="rx-label">Demo data</p>
      {!hasDemo ? (
        <>
          <p className="rx-p">Creates 5 interest Circles at different stages, demo mentors and demo members, with seats held open for you to test with. Takes about 20 seconds.</p>
          <div><button type="button" className="rx-btn primary" disabled={pending} onClick={() => run(() => seedDemoData(), 'Demo Circles created.')}>{pending ? 'Creating…' : 'Create demo Circles'}</button></div>
        </>
      ) : (
        <>
          <p className="rx-p">Demo Circles exist. Only staff can see them in Find a Circle, and demo members never receive email.</p>
          {!confirm
            ? <div><button type="button" className="rx-btn secondary" onClick={() => setConfirm(true)}>Remove all demo data</button></div>
            : <div className="rx-row" style={{ gap: 12 }}><span className="rx-sm">This removes every demo Circle, mentor and member, and your seats in them.</span>
                <button type="button" className="rx-btn secondary" disabled={pending} onClick={() => run(() => resetDemoData(), 'Demo data removed.')}>Yes, remove</button>
                <button type="button" className="rx-link muted" onClick={() => setConfirm(false)}>Keep it</button></div>}
        </>
      )}
    </div>
  );
}

export function LabCard({ c }: { c: LabCircle }) {
  const { run, pending } = useDo();
  const btn = (label: string, fn: () => Promise<ActionResult<object>>, ok: string, primary = false) => (
    <button key={label} type="button" className={`rx-btn ${primary ? 'primary' : 'secondary'}`} disabled={pending} onClick={() => run(fn, ok)}>{label}</button>
  );
  return (
    <section className="rx-card rx-stack-sm" aria-label={c.title}>
      <div className="rx-between" style={{ alignItems: 'flex-start', gap: 12 }}>
        <h2 className="rx-h3" style={{ margin: 0 }}>{c.title}</h2>
        <span className="rx-sm">{c.members} of 8</span>
      </div>
      <p className="rx-p rx-strong" style={{ margin: 0 }}>{c.headline}</p>
      {c.detail && <p className="rx-sm">{c.detail}</p>}
      <div className="rx-row" style={{ gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
        {c.phase === 'ready' && btn('Open a vote', () => openDemoVote(c.id), 'Vote opened. Members were notified.', true)}
        {c.phase === 'voting' && btn('Have demo members vote', () => castDemoVotes(c.id), 'Demo members voted.', true)}
        {c.phase === 'voting' && btn('Close the vote now', () => closeDemoVote(c.id), 'Vote closed. The winner was announced.')}
        {c.phase === 'requested' && btn('Mentor says yes', () => mentorSaysYes(c.id), 'The mentor said yes. Times are open.', true)}
        {c.phase === 'scheduling' && btn('Book the best time', () => bookBestTime(c.id), 'Sessions booked.', true)}
        {(c.phase === 'active' || c.phase === 'scheduling' || c.phase === 'voting' || c.phase === 'ready' || c.phase === 'requested') && btn(c.callOpen ? 'Extend the call window' : 'Open the call for 30 minutes', () => openDemoCall(c.id), 'The call window is open for 30 minutes.')}
        {c.members < 8 && btn('Add a demo member', () => addDemoMemberTo(c.id), 'A demo member joined.')}
        <Link href={`/circle?c=${c.id}`} className="rx-btn secondary">Open as a member</Link>
      </div>
    </section>
  );
}
