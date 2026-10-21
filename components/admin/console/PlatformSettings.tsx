'use client';

// Platform settings, built to the admin prototype. The server validates and enforces; this only draws and collects.
import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { savePlatformSettings } from '@/app/admin/c/platform/actions';

type Values = Record<string, string>;
interface Integration { name: string; use: string; connected: boolean }

const NUMBERS: Record<string, { key: string; label: string; aria: string; stored: boolean }[]> = {
  circles: [
    { key: 'circle.size_min', label: 'Circle size (smallest)', aria: 'Smallest Circle size', stored: true },
    { key: 'circle.size_max', label: 'Circle size (largest)', aria: 'Largest Circle size', stored: true },
    { key: 'circle.cycle_days', label: 'Cycle length (days)', aria: 'Cycle length in days', stored: true },
    { key: 'circle.call_start_share', label: 'Call starts when this share has joined', aria: 'Call quorum percentage', stored: true },
    { key: 'circle.call_minutes', label: 'Circle call length (minutes)', aria: 'Circle call length in minutes', stored: true },
  ],
  mentor: [
    { key: 'mentor.agenda_questions', label: 'Questions needed before an agenda is ready', aria: 'Questions needed', stored: false },
    { key: 'mentor.session_minutes', label: 'Mentor session length (minutes)', aria: 'Mentor session length', stored: true },
  ],
};
const CALL_TOGGLES = [
  { key: 'call.audio_first', label: 'Calls start as audio only', stored: true },
  { key: 'call.video_allowed', label: 'Members can turn video on', stored: true },
  { key: 'mentor.needs_agenda', label: 'Mentor calls need a ready agenda', stored: false },
];
const FEATURE_TOGGLES = [
  { key: 'feature.shop', label: 'Shop' },
  { key: 'feature.cities', label: 'City groups' },
  { key: 'feature.refer', label: 'Refer and earn' },
  { key: 'feature.dock', label: 'Docked messaging on desktop' },
  { key: 'feature.offline', label: 'Offline mode (saved pages and outbox)' },
];

export default function PlatformSettings({ values, canEdit, integrations }: { values: Values; canEdit: boolean; integrations: Integration[] }) {
  const router = useRouter();
  const [form, setForm] = useState<Values>(values);
  const [toast, setToast] = useState<{ text: string; bad: boolean } | null>(null);
  const [busy, start] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => setForm(values), [values]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const flash = (text: string, bad = false) => {
    setToast({ text, bad });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), 5000);
  };
  const setVal = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const flip = (k: string) => { if (canEdit) setVal(k, form[k] === 'true' ? 'false' : 'true'); };

  const save = () => {
    if (!canEdit || busy) return;
    start(async () => {
      const r = await savePlatformSettings(form);
      if (r.ok) { flash(r.message ?? 'Saved.'); router.refresh(); } else flash(r.error ?? 'We could not save that. Please try again.', true);
    });
  };

  const numRow = (n: { key: string; label: string; aria: string; stored: boolean }) => (
    <div key={n.key} className="setrow">
      <span>{n.label}{n.stored && <span className="sm" style={{ display: 'block' }}>Stored. Applies when the app reads it.</span>}</span>
      <input className="in" inputMode="numeric" value={n.key === 'circle.call_start_share' ? form[n.key].replace(/%$/, '') + '%' : form[n.key]} disabled={!canEdit} aria-label={n.aria}
        onChange={(e) => setVal(n.key, e.target.value.replace(/%/g, '').trim())} />
    </div>
  );
  const tog = (t: { key: string; label: string; stored?: boolean }) => (
    <div key={t.key} className="setrow">
      <span>{t.label}{t.stored && <span className="sm" style={{ display: 'block' }}>Stored. Applies when the app reads it.</span>}</span>
      <button type="button" className={`toggle${form[t.key] === 'true' ? ' on' : ''}${canEdit ? '' : ' lock'}`} aria-pressed={form[t.key] === 'true'} aria-label={t.label} disabled={!canEdit} onClick={() => flip(t.key)} />
    </div>
  );

  return (
    <div className="admc">
      <div className="pg screen">
        <div className="sb" style={{ alignItems: 'flex-end' }}>
          <div><p className="eyebrow">Settings</p><h1 className="pt">Platform settings</h1><span className="ul" /></div>
          <button type="button" className="btn bp" disabled={!canEdit || busy} onClick={save}>{busy ? 'Saving' : 'Save changes'}</button>
        </div>
        {!canEdit && <div className="rz"><p className="sm" style={{ color: 'var(--text)' }}>View only. Your role can look at this area but not change it.</p></div>}
        <div className="g2">
          <div className="card"><p className="h3" style={{ marginBottom: 6 }}>Circles</p>{NUMBERS.circles.map(numRow)}</div>
          <div className="card"><p className="h3" style={{ marginBottom: 6 }}>Calls and mentorship</p>{CALL_TOGGLES.map(tog)}{NUMBERS.mentor.map(numRow)}</div>
          <div className="card"><p className="h3" style={{ marginBottom: 6 }}>Features</p>{FEATURE_TOGGLES.map(tog)}</div>
          <div className="card"><p className="h3" style={{ marginBottom: 6 }}>Integrations</p>
            {integrations.map((i) => (
              <div key={i.name} className="setrow">
                <span><span className="num">{i.name}</span><span className="sm" style={{ display: 'block' }}>{i.use}</span></span>
                <span className={`tag ${i.connected ? 'good' : 'warn'}`}><i />{i.connected ? 'Connected' : 'Not set up'}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      {toast && <div className="toast" role={toast.bad ? 'alert' : 'status'} style={toast.bad ? { borderColor: 'var(--err)' } : undefined}>{toast.text}</div>}
    </div>
  );
}
