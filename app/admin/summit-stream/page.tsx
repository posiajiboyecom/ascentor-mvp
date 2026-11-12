'use client';

// /admin/summit-stream
// Controls for The Elevation Summit livestream:
//   1. Turn the public watch page's stream on/off, and optionally point it at
//      a specific YouTube video (else it auto-shows whatever is live on the
//      Ascentor channel - only works if that stream is Public, see the notice
//      below).
//   2. Email the watch-page link to every confirmed VIRTUAL attendee (or one
//      at a time), tracked so you can see who has already been sent it.
//   3. Send the same email to any address (your own inbox, a guest, a test).
//   4. Test the morning-of-event reminder before the actual day.
// The public page is /elevation-summit/watch. It also has its own gate: even
// a confirmed attendee cannot see the video before the programme actually
// starts (a countdown shows instead), regardless of this page's settings.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw, Radio, Send, ExternalLink, Mail, CalendarClock } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { SUMMIT_DATE_LABEL, SUMMIT_DATETIME_LABEL } from '@/lib/elevationSummit';

interface Attendee {
  id: string;
  full_name: string;
  email: string;
  attendance_type: string | null;
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

  const [customEmail, setCustomEmail] = useState('');
  const [customName, setCustomName] = useState('');
  const [sendingCustom, setSendingCustom] = useState(false);
  const [myEmail, setMyEmail] = useState('');

  const [sendingEventDay, setSendingEventDay] = useState(false);

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
  useEffect(() => { supabase.auth.getUser().then(({ data }) => setMyEmail(data.user?.email ?? '')); }, [supabase]);

  const save = async (nextEnabled: boolean) => {
    setSaving(true); setNote(null);
    try {
      const res = await authed({ method: 'POST', body: JSON.stringify({ action: 'save', enabled: nextEnabled, videoId: videoIdInput }) });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Save failed');
      setEnabled(nextEnabled);
      setSavedVideoId(body.videoId ?? '');
      setVideoIdInput(body.videoId ?? '');
      setNote(nextEnabled ? 'Saved. The stream is now switched on for the public page.' : 'Saved. The public page now shows "not live yet".');
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

  const sendCustom = async () => {
    if (!customEmail.trim()) { setNote('Enter an email address first.'); return; }
    setSendingCustom(true); setNote(null);
    try {
      const res = await authed({ method: 'POST', body: JSON.stringify({ action: 'send_custom', email: customEmail.trim(), fullName: customName.trim() || undefined }) });
      const body = await res.json().catch(() => ({}));
      setNote(body.message || body.error || 'Done.');
      if (res.ok) { setCustomEmail(''); setCustomName(''); }
    } catch {
      setNote('Could not send. Please try again.');
    }
    setSendingCustom(false);
  };

  const sendEventDayNow = async () => {
    setSendingEventDay(true); setNote(null);
    try {
      const res = await authed({ method: 'POST', body: JSON.stringify({ action: 'send_event_day', force: true }) });
      const body = await res.json().catch(() => ({}));
      setNote(body.message || body.error || 'Done.');
      await load();
    } catch {
      setNote('Could not send. Please try again.');
    }
    setSendingEventDay(false);
  };

  const dirty = videoIdInput.trim() !== (savedVideoId || '');
  const virtual = attendees.filter(a => a.attendance_type === 'virtual');
  const onsiteCount = attendees.length - virtual.length;
  const sentCount = virtual.filter(a => a.stream_access_sent_at).length;

  return (
    <div className="animate-fade-up">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
        <div>
          <p className="ledger-mono" style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', margin: 0, color: '#8A6A1F' }}>The Elevation Summit &middot; {SUMMIT_DATE_LABEL}</p>
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <Radio size={18} color="var(--ledger-ink-soft)" />
          <h2 className="ledger-h1" style={{ fontSize: 16, margin: 0 }}>Before you go live: Public vs. Unlisted</h2>
        </div>
        <p style={{ fontSize: 13, color: 'var(--ledger-ink-soft)', margin: '0 0 6px', lineHeight: 1.6 }}>
          A <strong>Private</strong> YouTube video or live stream cannot be watched by anyone outside your own Google account, no matter what is set up here. It will always show &quot;video unavailable&quot; to attendees.
        </p>
        <p style={{ fontSize: 13, color: 'var(--ledger-ink-soft)', margin: '0 0 6px', lineHeight: 1.6 }}>
          Set the stream&apos;s visibility to <strong>Unlisted</strong> instead, in YouTube Studio. Unlisted keeps it off search and off your channel page (so it stays effectively private to the public), while still allowing it to be embedded and played by anyone with the link, which is what this page needs.
        </p>
        <p style={{ fontSize: 13, color: 'var(--ledger-ink-soft)', margin: 0, lineHeight: 1.6 }}>
          With an Unlisted stream, paste its link into the &quot;specific YouTube video&quot; field below. The automatic channel embed (leaving the field blank) only works for a stream set to fully Public.
        </p>
      </div>

      <div className="rounded-xl ledger-panel" style={{ padding: 20, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <Radio size={18} color={enabled ? '#177245' : 'var(--ledger-ink-soft)'} />
          <h2 className="ledger-h1" style={{ fontSize: 16, margin: 0 }}>Stream status</h2>
          <span style={{
            marginLeft: 'auto', fontSize: 11.5, fontWeight: 600, padding: '3px 10px', borderRadius: 999,
            background: enabled ? 'rgba(34,160,90,.15)' : 'rgba(200,169,110,.22)', color: enabled ? '#177245' : '#8A6A1F',
          }}>
            {enabled ? 'Switched on' : 'Not visible yet'}
          </span>
        </div>

        <p style={{ fontSize: 13, color: 'var(--ledger-ink-soft)', margin: '0 0 14px', lineHeight: 1.6 }}>
          Even when this is on, no attendee can see the video before {SUMMIT_DATETIME_LABEL}. Before that moment the public page always shows a countdown, whatever this setting says. This toggle only matters on the day itself: use it to decide the exact minute the embed appears once the countdown ends.
        </p>
        <p style={{ fontSize: 12.5, color: 'var(--ledger-bad)', background: 'var(--ledger-bad-bg)', padding: '9px 12px', borderRadius: 8, margin: '0 0 14px', lineHeight: 1.6 }}>
          <strong>Timing still matters on the day.</strong> Turning this on shows the embed, but if nothing is actually streaming yet, attendees see YouTube&apos;s own &quot;video is unavailable&quot; message. Turn this on right as you press <strong>Go Live</strong> on YouTube, not hours ahead of time.
        </p>

        <label style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ledger-ink-soft)', display: 'block', marginBottom: 6 }}>
          Specific YouTube video (optional: leave blank to play our channel's live stream)
        </label>
        <input
          value={videoIdInput}
          onChange={(e) => setVideoIdInput(e.target.value)}
          placeholder="Paste a youtube.com/watch?v=... link, or leave blank"
          style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--ledger-line-strong)', background: 'var(--ledger-bg-input)', color: 'var(--ledger-ink)', fontSize: 13, fontFamily: 'var(--ledger-font-mono, monospace)', marginBottom: 6, boxSizing: 'border-box' }}
        />
        <p style={{ fontSize: 11.5, color: 'var(--ledger-ink-soft)', margin: '0 0 14px' }}>
          Blank (recommended) plays whatever is live right now on{' '}
          <a href={CHANNEL_URL} target="_blank" rel="noopener noreferrer" style={{ color: '#8A6A1F' }}>youtube.com/@AscentorGlobal</a>. The stream must be Public, with embedding allowed, and it should be the only live or upcoming stream on the channel. Paste a link here only if you stream from another account or as Unlisted.
        </p>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {!enabled && (
            <button type="button" disabled={saving} onClick={() => save(true)} className="ledger-btn ledger-btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Radio size={14} /> {saving ? 'Saving...' : 'Switch the stream on'}
            </button>
          )}
          {enabled && (
            <button type="button" disabled={saving} onClick={() => save(false)} className="ledger-btn ledger-btn-ghost" style={{ color: 'var(--ledger-bad)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              Turn off
            </button>
          )}
          {dirty && (
            <button type="button" disabled={saving} onClick={() => save(enabled)} className="ledger-btn ledger-btn-ghost" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              {saving ? 'Saving...' : 'Save video link'}
            </button>
          )}
        </div>
      </div>

      <div className="rounded-xl ledger-panel" style={{ padding: 20, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
          <Mail size={18} color="var(--ledger-ink-soft)" />
          <h2 className="ledger-h1" style={{ fontSize: 16, margin: 0 }}>Send access links</h2>
          <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--ledger-ink-soft)' }}>
            {attendees.length} paid &middot; {virtual.length} virtual &middot; {onsiteCount} onsite &middot; {sentCount} links sent
          </span>
        </div>
        <p style={{ fontSize: 13, color: 'var(--ledger-ink-soft)', margin: '0 0 14px', lineHeight: 1.6 }}>
          Every paid attendee is listed below. The watch-page link only goes to <strong>virtual</strong> attendees; onsite attendees are shown for reference and are never sent it. Safe to send more than once.
        </p>

        <button type="button" disabled={sendingAll || virtual.length === 0} onClick={sendAll} className="ledger-btn ledger-btn-primary"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 16 }}>
          <Send size={14} /> {sendingAll ? 'Sending...' : `Send to all confirmed virtual attendees (${virtual.length})`}
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
                <tr><td colSpan={3} className="ledger-mono" style={{ padding: 24, textAlign: 'center' }}>Loading...</td></tr>
              ) : attendees.length === 0 ? (
                <tr><td colSpan={3} className="ledger-mono" style={{ padding: 24, textAlign: 'center' }}>No paid attendees yet.</td></tr>
              ) : attendees.map(a => (
                <tr key={a.id} style={{ borderTop: '1px solid var(--ledger-line)' }}>
                  <td style={{ padding: '10px 12px' }}>
                    <div style={{ color: 'var(--ledger-ink)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      {a.full_name}
                      <span style={{
                        fontSize: 10.5, fontWeight: 600, padding: '2px 8px', borderRadius: 999,
                        background: a.attendance_type === 'virtual' ? 'rgba(34,160,90,.15)' : 'rgba(200,169,110,.22)',
                        color: a.attendance_type === 'virtual' ? '#177245' : '#8A6A1F',
                      }}>
                        {a.attendance_type === 'virtual' ? 'Virtual' : 'Onsite'}
                      </span>
                    </div>
                    <div style={{ color: 'var(--ledger-ink-soft)', fontSize: 11.5 }}>{a.email}</div>
                  </td>
                  <td style={{ padding: '10px 12px', color: 'var(--ledger-ink-soft)' }}>
                    {a.attendance_type !== 'virtual'
                      ? <span>n/a (attending in person)</span>
                      : when(a.stream_access_sent_at) ?? <span style={{ color: 'var(--ledger-gold-deep, var(--ledger-gold))' }}>not sent yet</span>}
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    {a.attendance_type === 'virtual' && <button type="button" disabled={sendingId === a.id} onClick={() => sendOne(a.id)} className="ledger-btn ledger-btn-ghost" style={{ fontSize: 11.5, padding: '5px 10px' }}>
                      {sendingId === a.id ? 'Sending...' : a.stream_access_sent_at ? 'Resend' : 'Send'}
                    </button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl ledger-panel" style={{ padding: 20, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <Send size={18} color="var(--ledger-ink-soft)" />
          <h2 className="ledger-h1" style={{ fontSize: 16, margin: 0 }}>Send to any inbox</h2>
        </div>
        <p style={{ fontSize: 13, color: 'var(--ledger-ink-soft)', margin: '0 0 14px', lineHeight: 1.6 }}>
          Sends the exact same watch-page email to any address: your own inbox to preview it, or a guest who is not in the registration list. This never changes any registration record.
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
          <input
            value={customEmail} onChange={(e) => setCustomEmail(e.target.value)} type="email"
            placeholder="name@example.com"
            style={{ flex: '1 1 220px', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--ledger-line-strong)', background: 'var(--ledger-bg-input)', color: 'var(--ledger-ink)', fontSize: 13, boxSizing: 'border-box' }}
          />
          <input
            value={customName} onChange={(e) => setCustomName(e.target.value)}
            placeholder="Name (optional)"
            style={{ flex: '1 1 160px', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--ledger-line-strong)', background: 'var(--ledger-bg-input)', color: 'var(--ledger-ink)', fontSize: 13, boxSizing: 'border-box' }}
          />
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" disabled={sendingCustom} onClick={sendCustom} className="ledger-btn ledger-btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Mail size={14} /> {sendingCustom ? 'Sending...' : 'Send'}
          </button>
          {myEmail && (
            <button type="button" disabled={sendingCustom} onClick={() => setCustomEmail(myEmail)} className="ledger-btn ledger-btn-ghost">
              Fill in my own email ({myEmail})
            </button>
          )}
        </div>
      </div>

      <div className="rounded-xl ledger-panel" style={{ padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <CalendarClock size={18} color="var(--ledger-ink-soft)" />
          <h2 className="ledger-h1" style={{ fontSize: 16, margin: 0 }}>Morning-of-event reminder</h2>
        </div>
        <p style={{ fontSize: 13, color: 'var(--ledger-ink-soft)', margin: '0 0 14px', lineHeight: 1.6 }}>
          Every confirmed attendee is emailed automatically on the morning of {SUMMIT_DATE_LABEL}. Virtual attendees receive the watch-page link; physical attendees receive a reminder with no link at all. This runs on its own, but you can test it below before the day, or send it manually if it is ever needed.
        </p>
        <button type="button" disabled={sendingEventDay} onClick={sendEventDayNow} className="ledger-btn ledger-btn-ghost" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <CalendarClock size={14} /> {sendingEventDay ? 'Sending...' : 'Send the morning-of reminder now (test)'}
        </button>
      </div>
    </div>
  );
}
