'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, Trash2 } from 'lucide-react';
import { addMemory, deleteMemory, saveReminderPrefs, updateMemory } from '@/app/(app)/sage/actions';
import { openSage } from '@/components/rx/sage-bus';
import { useToast } from '@/components/rx/Toast';

export function MemoryList({ notes }: { notes: { id: string; text: string }[] }) {
  const router = useRouter();
  const toast = useToast();
  const [editing, setEditing] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [adding, setAdding] = useState('');
  const [error, setError] = useState('');
  const [pending, start] = useTransition();

  const act = (fn: () => Promise<{ ok: boolean; error?: string }>, ok: string) => start(async () => {
    setError('');
    const r = await fn();
    if (!r.ok) { setError(r.error ?? 'Something went wrong.'); return; }
    toast(ok); router.refresh();
  });

  return (
    <div className="rx-card rx-stack">
      <p className="rx-sm">Sage uses these notes to coach you. Edit or delete anything.</p>
      {notes.map((n) => {
        const ed = editing === n.id;
        return (
          <div key={n.id} className="rx-between" style={{ paddingBottom: 10, borderBottom: '1px solid var(--rx-border)' }}>
            {ed
              ? <input className="rx-in" style={{ flex: 1 }} aria-label="Edit note" value={drafts[n.id] ?? n.text} maxLength={160} onChange={(e) => setDrafts({ ...drafts, [n.id]: e.target.value })} />
              : <p className="rx-p" style={{ flex: 1 }}>{n.text}</p>}
            <div className="rx-row rx-nw" style={{ gap: 2 }}>
              <button type="button" className="rx-ib" aria-label={ed ? 'Done editing' : 'Edit note'} onClick={() => {
                if (ed) { act(() => updateMemory(n.id, drafts[n.id] ?? n.text), 'Saved.'); setEditing(null); } else setEditing(n.id);
              }}><Pencil aria-hidden style={{ width: 18, height: 18 }} /></button>
              <button type="button" className="rx-ib" aria-label="Delete note" disabled={pending} onClick={() => act(() => deleteMemory(n.id), 'Deleted. Sage no longer knows this.')}><Trash2 aria-hidden style={{ width: 18, height: 18 }} /></button>
            </div>
          </div>
        );
      })}
      {notes.length === 0 && (
        <div className="rx-empty"><p className="rx-p">Sage has no notes about you.</p><button type="button" className="rx-btn secondary" onClick={() => openSage({ topic: 'plan' })}>Talk to Sage</button></div>
      )}
      <div className="rx-row rx-nw">
        <input className="rx-in" aria-label="Add a note" placeholder="Add something you want Sage to remember" value={adding} maxLength={160} onChange={(e) => setAdding(e.target.value)} />
        <button type="button" className="rx-btn secondary" disabled={pending || !adding.trim()} onClick={() => act(async () => { const r = await addMemory(adding); if (r.ok) setAdding(''); return r; }, 'Added.')}>Add</button>
      </div>
      {error && <p className="rx-sm" role="alert" style={{ color: 'var(--rx-danger)' }}>{error}</p>}
    </div>
  );
}

export function ReminderSettings({ maxPerDay, quiet, paused }: { maxPerDay: number; quiet: boolean; paused: boolean }) {
  const toast = useToast();
  const [max, setMax] = useState(maxPerDay);
  const [q, setQ] = useState(quiet);
  const [p, setP] = useState(paused);
  const [, start] = useTransition();
  const save = (patch: Parameters<typeof saveReminderPrefs>[0], ok?: string) => start(async () => { const r = await saveReminderPrefs(patch); toast(r.ok ? ok ?? 'Saved.' : r.error); });

  return (
    <div className="rx-card rx-stack">
      <div className="rx-fld"><span className="rx-fld-label">Most reminders per day</span>
        <div className="rx-opts">{[1, 2].map((n) => <button key={n} type="button" className="rx-opt" aria-pressed={max === n} onClick={() => { setMax(n); save({ maxPerDay: n }); }}>{n} a day</button>)}</div></div>
      <div className="rx-between"><div><p className="rx-p">Quiet hours</p><p className="rx-sm">10:00 PM to 7:00 AM, in your time zone</p></div>
        <button type="button" className="rx-toggle" aria-label="Quiet hours" aria-pressed={q} onClick={() => { setQ(!q); save({ quietHours: !q }); }} /></div>
      <div className="rx-between"><div><p className="rx-p">Pause reminders</p><p className="rx-sm">For a week, then they resume.</p></div>
        <button type="button" className="rx-toggle" aria-label="Pause reminders" aria-pressed={p} onClick={() => { setP(!p); save({ paused: !p }, !p ? 'Reminders paused for a week.' : 'Reminders are back on.'); }} /></div>
    </div>
  );
}
