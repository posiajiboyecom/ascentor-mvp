'use client';

// /admin/summit-stream
// Controls for The Elevation Summit livestream:
//   1. Turn the public watch page's stream on/off, and optionally point it at
//      a specific YouTube video (else it auto-shows whatever is live on the
//      Ascentor channel).
//   2. Email the watch-page link to every confirmed VIRTUAL attendee (or one
//      at a time), tracked so you can see who has already been sent it.
// The public page is /elevation-summit/watch.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw, Radio, Send, ExternalLink, Mail } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface Attendee {
  id: string;
  full_name: string;
  email: string;
  stream_access_sent_at: string | null;
}

const CHANNEL_URL = 'https://www.youtube.com/@AscentorGlobal';
const WATCH_URL = '/elevation-summit/watch';

const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : null;

export default function SummitStreamPage() {
  const supabase = useMemo(() => createClient(), []);
  const [enabled, setEnabled] = useState(false);
  const [videoIdInput, setVideoIdInput] = useState('');
  const [savedVideoId, setSavedVideoId] = useState('');
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [sendingAll, setSendingAll] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const authed = useCallback(async (init: RequestInit = {}) => {
    const { data: { session } } = await supabase.auth.getSession();
    return fetch('/api/admin/summit-stream', {
      ...init,
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token ?? ''}`, ...(init.headers ?? {}) },
    });
  }, [supabase]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authed();
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Could not load stream settings');
      setEnabled(!!body.enabled);
      setSavedVideoId(body.videoId || '');
      setVideoIdInput(body.videoId || '');
      setAttendees(body.attendees ?? []);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [authed]);

  useEffect(() => { load(); }, [load]);

  const save = async (nextEnabled: boolean) => {
    setSaving(true); setNote(null);
    try {
      const res = await authed({ method: 'POST', body: JSON.stringify({ action: 'save', enabled: nextEnabled, videoId: videoIdInput }) });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Save failed');
      setEnabled(nextEnabled);
      setSavedVideoId(body.videoId ?? '');
      setVideoIdInput(body.videoId ?? '');
      setNote(nextEnabled ? 'Saved. The stream is now live on the public page.' : 'Saved. The public page now shows "not live yet".');
    } catch (e) {
      setNote((e as Error).message);
    }
    setSaving(false);
  };

  const sendAll = async () => {
    setSendingAll(true); setNote(null);
    try {
      const res = await authed({ method: 'POST', body: JSON.stringify({ action: 'send_all' }) });
      const body = await res.json().catch(() => ({}));
      setNote(body.message || body.error || 'Done.');
      await load();
    } catch {
      setNote('Could not send. Please try again.');
    }
    setSendingAll(false);
  };

  const sendOne = async (id: string) => {
    setSendingId(id); setNote(null);
    try {
      const res = await authed({ method: 'POST', body: JSON.stringify({ action: 'send_one', id }) });
      const body = await res.json().catch(() => ({}));
      setNote(body.message || body.error || 'Done.');
      await load();
    } catch {
      setNote('Could not send. Please try again.');
    }
    setSendingId(null);
  };

  const dirty = videoIdInput.trim() !== (savedVideoId || '');
  const sentCount = attendees.filter(a => a.stream_access_sent_at).length;

  return (
    <div className="animate-fade-up">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
        <div>
          <p className="ledger-mono" style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', margin: 0, color: '#8A6A1F' }}>The Elevation Summit · 19 Nov 2026</p>
          <h1 className="ledger-h1" style={{ fontSize: 26, margin: '2px 0 0' }}>Livestream</h1>
          <p className="ledger-mono" style={{ fontSize: 12, margin: '4px 0 0' }}>
            Public page: <a href={WATCH_URL} target="_blank" rel="noopener noreferrer" style={{ color: '#8A6A1F' }}>{WATCH_URL} <ExternalLink size={11} style={{ display: 'inline', verticalAlign: -1 }} /></a>
          </p>
        </div>
        <button type="button" className="ledger-btn ledger-btn-ghost" onClick={load} disabled={loading} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {note && <p className="ledger-mono" style={{ fontSize: 12, padding: '9px 12px', borderRadius: 8, background: 'var(--ledger-gold-bg)', margin: '0 0 14px' }}>{note}</p>}
      {error && <div className="rounded-lg p-3 mb-4 text-xs" style={{ background: 'var(--ledger-bad-bg)', color: 'var(--ledger-bad)' }}>{error}</div>}

      <div className="rounded-xl ledger-panel" style={{ padding: 20, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <Radio size={18} color={enabled ? '#177245' : 'var(--ledger-ink-soft)'} />
          <h2 className="ledger-h1" style={{ fontSize: 16, margin: 0 }}>Stream status</h2>
          <span style={{
            marginLeft: 'auto', fontSize: 11.5, fontWeight: 600, padding: '3px 10px', borderRadius: 999,
            background: enabled ? 'rgba(34,160,90,.15)' : 'rgba(200,169,110,.22)', color: enabled ? '#177245' : '#8A6A1F',
          }}>
            {enabled ? 'LIVE on public page' : 'Not visible yet'}
          </span>
        </div>

        <p style={{ fontSize: 13, color: 'var(--ledger-ink-soft)', margin: '0 0 14px', lineHeight: 1.6 }}>
          When off, confirmed attendees who visit the watch page see a "not live yet" message.
        </p>
        <p style={{ fontSize: 12.5, color: 'var(--ledger-bad)', background: 'var(--ledger-bad-bg)', padding: '9px 12px', borderRadius: 8, margin: '0 0 14px', lineHeight: 1.6 }}>
          <strong>Timing matters.</strong> Turning this on tells the page to show the embed, but if nothing is actually live on the
          channel yet, attendees see YouTube&apos;s own &quot;video is unavailable&quot; message — not broken, just early. Turn this on right as
          you press <strong>Go Live</strong> on YouTube (or a minute or two before), not hours ahead of time.
        </p>

        <label style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ledger-ink-soft)', display: 'block', marginBottom: 6 }}>
          Specific YouTube video (optional)
        </label>
        <input
          value={videoIdInput}
          onChange={(e) => setVideoIdInput(e.target.value)}
          placeholder="Paste a youtube.com/watch?v=... link, or leave blank"
          style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--ledger-line-strong)', background: 'var(--ledger-bg-input)', color: 'var(--ledger-ink)', fontSize: 13, fontFamily: 'var(--ledger-font-mono, monospace)', marginBottom: 6, boxSizing: 'border-box' }}
        />
        <p style={{ fontSize: 11.5, color: 'var(--ledger-ink-soft)', margin: '0 0 14px' }}>
          Leave this blank to automatically show whatever is currently live on{' '}
          <a href={CHANNEL_URL} target="_blank" rel="noopener noreferrer" style={{ color: '#8A6A1F' }}>youtube.com/@AscentorGlobal</a> — nothing to update on the day, just go live there.
        </p>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {!enabled && (
            <button type="button" disabled={saving} onClick={() => save(true)} className="ledger-btn ledger-btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Radio size={14} /> {saving ? 'Saving…' : 'Go live on the public page'}
            </button>
          )}
          {enabled && (
            <button type="button" disabled={saving} onClick={() => save(false)} className="ledger-btn ledger-btn-ghost" style={{ color: 'var(--ledger-bad)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              Turn off
            </button>
          )}
          {dirty && (
            <button type="button" disabled={saving} onClick={() => save(enabled)} className="ledger-btn ledger-btn-ghost" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              {saving ? 'Saving…' : 'Save video link'}
            </button>
          )}
        </div>
      </div>

      <div className="rounded-xl ledger-panel" style={{ padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
          <Mail size={18} color="var(--ledger-ink-soft)" />
          <h2 className="ledger-h1" style={{ fontSize: 16, margin: 0 }}>Send access links</h2>
          <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--ledger-ink-soft)' }}>
            {attendees.length} confirmed virtual · {sentCount} already sent
          </span>
        </div>
        <p style={{ fontSize: 13, color: 'var(--ledger-ink-soft)', margin: '0 0 14px', lineHeight: 1.6 }}>
          Emails the watch-page link to every confirmed <strong>virtual</strong> attendee — physical attendees are never included. Safe to send more than once.
        </p>

        <button type="button" disabled={sendingAll || attendees.length === 0} onClick={sendAll} className="ledger-btn ledger-btn-primary"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 16 }}>
          <Send size={14} /> {sendingAll ? 'Sending…' : `Send to all confirmed virtual attendees (${attendees.length})`}
        </button>

        <div className="rounded-lg" style={{ border: '1px solid var(--ledger-line)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: 'left', color: 'var(--ledger-ink-soft)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                <th style={{ padding: '10px 12px', fontWeight: 600, borderBottom: '1px solid var(--ledger-line)' }}>Person</th>
                <th style={{ padding: '10px 12px', fontWeight: 600, borderBottom: '1px solid var(--ledger-line)', width: 180 }}>Sent</th>
                <th style={{ padding: '10px 12px', fontWeight: 600, borderBottom: '1px solid var(--ledger-line)', width: 100 }} />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={3} className="ledger-mono" style={{ padding: 24, textAlign: 'center' }}>Loading…</td></tr>
              ) : attendees.length === 0 ? (
                <tr><td colSpan={3} className="ledger-mono" style={{ padding: 24, textAlign: 'center' }}>No confirmed virtual attendees yet.</td></tr>
              ) : attendees.map(a => (
                <tr key={a.id} style={{ borderTop: '1px solid var(--ledger-line)' }}>
                  <td style={{ padding: '10px 12px' }}>
                    <div style={{ color: 'var(--ledger-ink)', fontWeight: 500 }}>{a.full_name}</div>
                    <div style={{ color: 'var(--ledger-ink-soft)', fontSize: 11.5 }}>{a.email}</div>
                  </td>
                  <td style={{ padding: '10px 12px', color: 'var(--ledger-ink-soft)' }}>
                    {when(a.stream_access_sent_at) ?? <span style={{ color: 'var(--ledger-gold-deep, var(--ledger-gold))' }}>not sent yet</span>}
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <button type="button" disabled={sendingId === a.id} onClick={() => sendOne(a.id)} className="ledger-btn ledger-btn-ghost" style={{ fontSize: 11.5, padding: '5px 10px' }}>
                      {sendingId === a.id ? 'Sending…' : a.stream_access_sent_at ? 'Resend' : 'Send'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
