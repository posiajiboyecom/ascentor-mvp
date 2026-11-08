'use client';

// Write one email and send it to the Summit registrants. The browser drives the sending a few people at a time, so the mailbox
// limit is respected, progress is visible, and Stop works. Use {name} in the message for their first name.
import { useRef, useState } from 'react';
import Link from 'next/link';
import { countAction, sendChunkAction, sendTestAction } from '@/app/admin/c/registrations/email/actions';

const AUD = [{ id: 'all', label: 'Everyone confirmed' }, { id: 'physical', label: 'Physical attendees' }, { id: 'virtual', label: 'Virtual attendees' }];
const box = { width: '100%', maxWidth: '100%', border: '1px solid #cfcac2', borderRadius: 10, padding: '10px 12px', fontSize: 16, background: '#fff', font: 'inherit' } as const;

export default function EmailRegistrants({ canSend }: { canSend: boolean }) {
  const [audience, setAudience] = useState('all');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('Hi {name},\n\n');
  const [status, setStatus] = useState('');
  const [running, setRunning] = useState(false);
  const stop = useRef(false);

  async function test() {
    setStatus('Sending a test to you…');
    const r = await sendTestAction(subject, message);
    setStatus(r.ok ? `Test sent to ${r.to}. Check it, then send to everyone.` : r.error);
  }

  async function send() {
    const c = await countAction(audience);
    if (!c.ok) { setStatus(c.error); return; }
    if (!window.confirm(`Send this email to ${c.count} ${c.count === 1 ? 'person' : 'people'}? This cannot be undone.`)) return;
    stop.current = false; setRunning(true);
    let cursor = 0, sent = 0, failed = 0;
    try {
      while (!stop.current) {
        const r = await sendChunkAction(audience, subject, message, cursor);
        if (!r.ok) { setStatus(`Stopped after ${sent} sent. ${r.error}`); return; }
        sent += r.sent; failed += r.failed; cursor = r.next;
        setStatus(`Sent ${sent} of ${r.total}${failed ? `, ${failed} failed` : ''}…`);
        if (r.done) { setStatus(`Finished. Sent ${sent}${failed ? `, ${failed} could not be sent` : ''}.`); return; }
      }
      setStatus(`Stopped. Sent ${sent}${failed ? `, ${failed} failed` : ''}.`);
    } finally { setRunning(false); }
  }

  const ready = canSend && !!subject.trim() && !!message.trim() && !running;
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '24px 16px 64px' }}>
      <Link href="/admin/c/registrations" style={{ fontSize: 14 }}>← Registrations</Link>
      <h1 style={{ fontSize: 26, fontWeight: 800, margin: '12px 0 4px' }}>Email registrants</h1>
      <p style={{ opacity: 0.75, margin: '0 0 20px' }}>Sent from the Summit address. Use {'{name}'} to put in their first name.</p>
      <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Send to</label>
      <select value={audience} onChange={(e) => setAudience(e.target.value)} style={{ ...box, marginBottom: 16 }}>{AUD.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}</select>
      <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Subject</label>
      <input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={200} style={{ ...box, marginBottom: 16 }} />
      <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Message</label>
      <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={10} maxLength={5000} style={{ ...box, marginBottom: 16 }} />
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button type="button" disabled={!ready} onClick={test} style={{ ...box, width: 'auto', cursor: 'pointer' }}>Send me a test</button>
        <button type="button" disabled={!ready} onClick={send} style={{ ...box, width: 'auto', cursor: 'pointer', background: '#111', color: '#fff' }}>Send to registrants</button>
        {running && <button type="button" onClick={() => { stop.current = true; }} style={{ ...box, width: 'auto', cursor: 'pointer' }}>Stop</button>}
      </div>
      {!canSend && <p role="alert" style={{ marginTop: 12 }}>Your role can view this page but not send email.</p>}
      {status && <p role="status" style={{ marginTop: 16, fontWeight: 600 }}>{status}</p>}
    </div>
  );
}
