'use client';

import { useState, useTransition } from 'react';
import { addFreeYearEmails, removeFreeYearEmail } from './actions';

export function AddEmails() {
  const [text, setText] = useState('');
  const [note, setNote] = useState('');
  const [msg, setMsg] = useState('');
  const [pending, start] = useTransition();
  return (
    <div style={{ border: '1px solid #e8e6e1', borderRadius: 12, padding: 16, margin: '0 0 24px' }}>
      <p style={{ fontWeight: 700, margin: '0 0 6px' }}>Add emails</p>
      <p style={{ fontSize: 13, opacity: 0.75, margin: '0 0 8px' }}>Paste one or more addresses, one per line or separated by commas. Only listed emails can claim at joinascentor.com/summit-access.</p>
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} style={{ width: '100%', padding: 10, borderRadius: 8, font: 'inherit' }} placeholder="name@example.com" />
      <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional), e.g. emailed with a photo" style={{ width: '100%', padding: 10, borderRadius: 8, margin: '8px 0', font: 'inherit' }} />
      <button type="button" className="rx-btn primary" disabled={pending || !text.trim()}
        onClick={() => start(async () => { const r = await addFreeYearEmails(text, note); setMsg(r.ok ? r.message ?? 'Added.' : r.error ?? 'That did not work.'); if (r.ok) { setText(''); setNote(''); } })}>
        {pending ? 'Adding...' : 'Add to the list'}
      </button>
      {msg && <p role="status" style={{ fontSize: 14, margin: '8px 0 0' }}>{msg}</p>}
    </div>
  );
}

export function RemoveEmail({ email }: { email: string }) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState('');
  return (
    <>
      <button type="button" style={{ background: 'none', border: 0, color: '#B6502A', cursor: 'pointer', font: 'inherit', fontSize: 13, padding: 0 }} disabled={pending}
        onClick={() => { if (confirm(`Remove ${email} from the free year list?`)) start(async () => { const r = await removeFreeYearEmail(email); if (!r.ok) setErr(r.error ?? 'Failed'); }); }}>
        {pending ? 'Removing...' : 'Remove'}
      </button>
      {err && <span style={{ fontSize: 12, color: '#B6502A' }}> {err}</span>}
    </>
  );
}
