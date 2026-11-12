'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import CheckInScreen, { type CheckInApi } from '@/components/admin/console/CheckInScreen';
import type { CheckInStats } from '@/lib/summitCheckin';
import { doorCheckInByIdAction, doorScanAction, doorSearchAction, doorStatsAction, doorUndoAction, enterDoorAction, leaveDoorAction } from './actions';

const API: CheckInApi = { scan: doorScanAction, checkInById: doorCheckInByIdAction, undo: doorUndoAction, search: doorSearchAction, stats: doorStatsAction };

type Props = { mode: 'login'; accessOn: boolean } | { mode: 'scan'; name: string; stats: CheckInStats };

export default function DoorClient(props: Props) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, start] = useTransition();

  if (props.mode === 'scan') {
    return (
      <div style={{ minHeight: '100dvh', background: '#f6f5f2', padding: '16px 16px 40px' }}>
        <CheckInScreen
          initialStats={props.stats}
          canAdmit
          api={API}
          volunteer={{ name: props.name, onLeave: () => start(async () => { await leaveDoorAction(); router.refresh(); }) }}
        />
      </div>
    );
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    start(async () => {
      const r = await enterDoorAction(name, code);
      if (!r.ok) { setError(r.error ?? 'That did not work.'); return; }
      router.refresh();
    });
  };

  return (
    <div className="admc" style={{ minHeight: '100dvh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <form onSubmit={submit} className="card st8" style={{ width: '100%', maxWidth: 420 }}>
        <p className="eyebrow">Elevation Summit</p>
        <h1 className="pt" style={{ margin: 0 }}>Door check-in</h1>
        <span className="ul" />
        {!props.accessOn ? (
          <p className="p">Volunteer access is switched off right now. Ask the Summit team to turn it on, then reload this page.</p>
        ) : (
          <>
            <p className="sm p">For Summit volunteers. Enter your name and the door code the team gave you.</p>
            <label className="sm" htmlFor="door-name">Your name</label>
            <input id="door-name" className="in" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" maxLength={60} required />
            <label className="sm" htmlFor="door-code">Door code</label>
            <input id="door-code" className="in" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} autoCapitalize="characters" autoComplete="off" spellCheck={false} maxLength={12} required style={{ letterSpacing: '.18em', fontWeight: 700 }} />
            {error && <p className="sm" role="alert" style={{ color: 'var(--err)', margin: 0 }}>{error}</p>}
            <button type="submit" className="btn bp" disabled={busy || name.trim().length < 2 || code.trim().length < 4}>{busy ? 'Checking…' : 'Start'}</button>
          </>
        )}
      </form>
    </div>
  );
}
