'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { assignFacilitator, setFacilitator, updateCircleMeeting } from '@/app/admin/circles/actions';
import { saveHumanMentor, type MentorInput } from '@/app/admin/human-mentors/actions';
import { useToast } from '@/components/rx/Toast';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const errp = (m: string) => <p className="rx-sm" role="alert" style={{ color: 'var(--rx-danger)' }}>{m}</p>;

export interface CircleAdminRow { id: string; name: string; number: number; status: string; members: number; facilitatorId: string | null; cycleStart: string | null; dow: number; time: string; url: string }
export interface FacilitatorOpt { id: string; name: string }

export function FacilitatorManager({ facilitators }: { facilitators: FacilitatorOpt[] }) {
  const router = useRouter();
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [pending, start] = useTransition();
  return (
    <div className="rx-card rx-stack">
      <p className="rx-label">Facilitators</p>
      {facilitators.length === 0 && <p className="rx-sm">No facilitators yet. Add a member by email.</p>}
      {facilitators.map((f) => <div key={f.id} className="rx-between"><span>{f.name}</span></div>)}
      <div className="rx-row rx-nw"><input className="rx-in" type="email" aria-label="Member email" placeholder="Member’s email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <button type="button" className="rx-btn secondary" disabled={pending || !email} onClick={() => start(async () => { const r = await setFacilitator(email, true); if (!r.ok) { setError(r.error); return; } setError(''); setEmail(''); toast('Marked as a facilitator.'); router.refresh(); })}>Add</button>
        <button type="button" className="rx-link muted" disabled={pending || !email} onClick={() => start(async () => { const r = await setFacilitator(email, false); if (!r.ok) { setError(r.error); return; } setError(''); setEmail(''); toast('Facilitator flag removed.'); router.refresh(); })}>Remove</button></div>
      {error && errp(error)}
    </div>
  );
}

export function CircleRow({ c, facilitators }: { c: CircleAdminRow; facilitators: FacilitatorOpt[] }) {
  const router = useRouter();
  const toast = useToast();
  const [fac, setFac] = useState(c.facilitatorId ?? '');
  const [dow, setDow] = useState(c.dow);
  const [time, setTime] = useState(c.time);
  const [url, setUrl] = useState(c.url);
  const [error, setError] = useState('');
  const [pending, start] = useTransition();
  return (
    <div className="rx-card rx-stack">
      <div className="rx-between"><p className="rx-h3">{c.name} · Circle {c.number}</p><span className="rx-sm">{c.status} · {c.members} of 8 seats{c.cycleStart ? ` · started ${c.cycleStart}` : ''}</span></div>
      <div className="rx-grid2">
        <div className="rx-fld"><label>Facilitator</label>
          <select className="rx-in" value={fac} onChange={(e) => { setFac(e.target.value); start(async () => { const r = await assignFacilitator(c.id, e.target.value || null); if (!r.ok) { setError(r.error); return; } setError(''); toast('Facilitator updated.'); router.refresh(); }); }}>
            <option value="">None yet</option>{facilitators.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</select></div>
        <div className="rx-fld"><label>Meeting link</label><input className="rx-in" value={url} placeholder="https://…" onChange={(e) => setUrl(e.target.value)} /></div>
        <div className="rx-fld"><label>Meets on</label><select className="rx-in" value={dow} onChange={(e) => setDow(Number(e.target.value))}>{DAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}</select></div>
        <div className="rx-fld"><label>At (circle time zone)</label><input className="rx-in" type="time" value={time} onChange={(e) => setTime(e.target.value)} /></div>
      </div>
      <div className="rx-row"><button type="button" className="rx-btn secondary" disabled={pending} onClick={() => start(async () => { const r = await updateCircleMeeting(c.id, { dow, time, url }); if (!r.ok) { setError(r.error); return; } setError(''); toast('Meeting details saved.'); router.refresh(); })}>Save meeting</button></div>
      {error && errp(error)}
    </div>
  );
}

export function MentorForm({ initial, isNew }: { initial: MentorInput; isNew?: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [f, setF] = useState<MentorInput>(initial);
  const [error, setError] = useState('');
  const [pending, start] = useTransition();
  const set = <K extends keyof MentorInput>(k: K, v: MentorInput[K]) => setF((c) => ({ ...c, [k]: v }));
  return (
    <div className="rx-card rx-stack">
      <p className="rx-h3">{isNew ? 'Add a mentor' : f.name}</p>
      {isNew && <div className="rx-fld"><label>Member’s email</label><input className="rx-in" type="email" value={f.email ?? ''} onChange={(e) => set('email', e.target.value)} /><span className="rx-sm">They sign in with this account and see the mentor view under Sessions.</span></div>}
      <div className="rx-grid2">
        <div className="rx-fld"><label>Name</label><input className="rx-in" value={f.name} onChange={(e) => set('name', e.target.value)} /></div>
        <div className="rx-fld"><label>Headline</label><input className="rx-in" value={f.headline} placeholder="Security analyst, financial services" onChange={(e) => set('headline', e.target.value)} /></div>
        <div className="rx-fld"><label>Topics (commas)</label><input className="rx-in" value={f.tags} placeholder="Cybersecurity, Career switch" onChange={(e) => set('tags', e.target.value)} /></div>
        <div className="rx-fld"><label>Languages (commas)</label><input className="rx-in" value={f.langs} onChange={(e) => set('langs', e.target.value)} /></div>
        <div className="rx-fld"><label>Formats (commas)</label><input className="rx-in" value={f.formats} onChange={(e) => set('formats', e.target.value)} /></div>
        <div className="rx-fld"><label>Capacity (mentees)</label><input className="rx-in" type="number" min={0} max={8} value={f.capacity} onChange={(e) => set('capacity', Number(e.target.value))} /></div>
      </div>
      <div className="rx-fld"><label>Bio</label><textarea className="rx-in" value={f.bio} onChange={(e) => set('bio', e.target.value)} /></div>
      <div className="rx-between"><span>Taking new requests</span><button type="button" className="rx-toggle" aria-label="Taking new requests" aria-pressed={f.accepting} onClick={() => set('accepting', !f.accepting)} /></div>
      <div className="rx-between"><span>Listed to members</span><button type="button" className="rx-toggle" aria-label="Listed to members" aria-pressed={f.active} onClick={() => set('active', !f.active)} /></div>
      {error && errp(error)}
      <div><button type="button" className="rx-btn primary" disabled={pending} onClick={() => start(async () => { const r = await saveHumanMentor(f); if (!r.ok) { setError(r.error); return; } setError(''); toast('Saved.'); if (isNew) setF({ ...initial }); router.refresh(); })}>{isNew ? 'Add mentor' : 'Save'}</button></div>
    </div>
  );
}
