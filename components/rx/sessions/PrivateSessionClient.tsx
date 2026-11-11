'use client';

// Pinnacle private mentor sessions: booking (member), agenda edits and cancelling (member or mentor).

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { bookPrivateSession, cancelPrivateSession, updatePrivateAgenda } from '@/app/(app)/sessions/private/actions';
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

export interface MentorChoice {
  id: string; name: string; headline: string | null; tags: string[]; avatarUrl: string | null;
  slots: { id: string; label: string; month: string }[];
}

export function PrivateBooking({ mentors, blockedMonths, agendaMax }: { mentors: MentorChoice[]; blockedMonths: string[]; agendaMax: number }) {
  const { run, pending, error } = useRun();
  const [slotId, setSlotId] = useState('');
  const [agenda, setAgenda] = useState('');
  const chosen = mentors.flatMap((m) => m.slots.map((s) => ({ ...s, mentor: m.name }))).find((s) => s.id === slotId);
  return (
    <div className="rx-stack">
      {mentors.map((m) => (
        <div key={m.id} className="rx-card rx-stack-sm">
          <div className="rx-row rx-nw" style={{ gap: 12, alignItems: 'center' }}>
            <Avatar name={m.name} url={m.avatarUrl} seed={m.id} />
            <div style={{ minWidth: 0 }}>
              <p className="rx-p rx-strong" style={{ margin: 0 }}>{m.name}</p>
              {m.headline && <p className="rx-sm" style={{ margin: 0 }}>{m.headline}</p>}
            </div>
          </div>
          {m.tags.length > 0 && <div className="rx-row" style={{ gap: 6 }}>{m.tags.slice(0, 5).map((t) => <Tag key={t}>{t}</Tag>)}</div>}
          <div className="rx-row" style={{ gap: 8 }} role="group" aria-label={`Open times with ${m.name}`}>
            {m.slots.map((s) => {
              const blocked = blockedMonths.includes(s.month);
              return (
                <button key={s.id} type="button" className={`rx-btn ${slotId === s.id ? 'primary' : 'secondary'}`} style={{ minHeight: 40, padding: '0 12px', fontSize: 14 }}
                  aria-pressed={slotId === s.id} disabled={blocked || pending} title={blocked ? 'You already have your session for this month' : undefined}
                  onClick={() => setSlotId(s.id)}>{s.label}</button>
              );
            })}
          </div>
        </div>
      ))}

      <div className="rx-card rx-stack-sm">
        <label htmlFor="pv-agenda" className="rx-label">Your agenda</label>
        <p className="rx-sm">What do you want from these 20 minutes? Your mentor gets this with the booking, so they can come prepared.</p>
        <textarea id="pv-agenda" className="rx-in" value={agenda} maxLength={agendaMax} onChange={(e) => setAgenda(e.target.value)}
          placeholder="For example: I’m choosing between two job offers and want help weighing them. My questions are…" />
        <p className="rx-sm">{agenda.trim().length}/{agendaMax}</p>
        <div>
          <button type="button" className="rx-btn primary" disabled={pending || !slotId || agenda.trim().length < 10}
            onClick={() => run(() => bookPrivateSession(slotId, agenda), 'Booked. Your mentor has your agenda.', () => { setSlotId(''); setAgenda(''); })}>
            {pending ? 'Booking…' : chosen ? `Book ${chosen.label} with ${chosen.mentor}` : 'Choose a time above'}
          </button>
        </div>
        {error && err(error)}
      </div>
    </div>
  );
}

export function PrivateAgendaEditor({ sessionId, agenda, agendaMax }: { sessionId: string; agenda: string; agendaMax: number }) {
  const { run, pending, error } = useRun();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(agenda);
  if (!open) return <button type="button" className="rx-link" onClick={() => setOpen(true)}>Edit agenda</button>;
  return (
    <div className="rx-stack-sm">
      <textarea className="rx-in" aria-label="Agenda" value={text} maxLength={agendaMax} onChange={(e) => setText(e.target.value)} />
      <div className="rx-row">
        <button type="button" className="rx-btn primary" disabled={pending} onClick={() => run(() => updatePrivateAgenda(sessionId, text), 'Agenda saved.', () => setOpen(false))}>Save</button>
        <button type="button" className="rx-btn secondary" disabled={pending} onClick={() => { setText(agenda); setOpen(false); }}>Keep as it was</button>
      </div>
      {error && err(error)}
    </div>
  );
}

export function PrivateCancel({ sessionId, role }: { sessionId: string; role: 'member' | 'mentor' }) {
  const { run, pending, error } = useRun();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  if (!open) return <button type="button" className="rx-link muted" onClick={() => setOpen(true)}>Cancel session</button>;
  return (
    <div className="rx-stack-sm">
      <input className="rx-in" aria-label="Reason (optional)" placeholder="Reason (optional)" value={reason} maxLength={200} onChange={(e) => setReason(e.target.value)} />
      <p className="rx-sm">{role === 'member' ? 'Your month is freed, so you can book another time.' : 'The member is told and can book another time.'}</p>
      <div className="rx-row">
        <button type="button" className="rx-btn secondary" disabled={pending} onClick={() => run(() => cancelPrivateSession(sessionId, reason), 'Session cancelled.')}>{pending ? 'Cancelling…' : 'Cancel the session'}</button>
        <button type="button" className="rx-link" disabled={pending} onClick={() => setOpen(false)}>Keep it</button>
      </div>
      {error && err(error)}
    </div>
  );
}
