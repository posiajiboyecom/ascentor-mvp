'use client';

// Audio-only call (Daily). Weekly Circle call: 15 minutes. Mentor session: 20 minutes. No camera, no screen sharing,
// no recording. States: waiting, microphone check, joining, in call, reconnecting, poor connection, ended, unsupported
// in-app browser, call unavailable, Circle not started.

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Daily, { type DailyCall, type DailyParticipant } from '@daily-co/daily-js';
import { Hand, LogOut, Mic, MicOff, TriangleAlert, UserX, VolumeX } from 'lucide-react';
import { Avatar } from '@/components/rx/ui';
import { useToast } from '@/components/rx/Toast';

type Phase = 'loading' | 'waiting' | 'notstarted' | 'unavailable' | 'inapp' | 'prejoin' | 'joining' | 'incall' | 'ended' | 'error';

interface TokenOpen { state: 'open'; url: string; token: string; isOwner: boolean; title: string; endsAt: string; startsAt: string; opensAt: string }
interface TokenWait { state: 'waiting' | 'ended'; title: string; endsAt: string; startsAt: string; opensAt: string }
type TokenResponse = TokenOpen | TokenWait | { state: 'unavailable' | 'notstarted' } | { state: 'error'; error: string };

const mmss = (ms: number) => { const s = Math.max(0, Math.round(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const IN_APP = /(FBAN|FBAV|Instagram|Line\/|MicroMessenger|; wv\))/i;

function RemoteAudio({ p }: { p: DailyParticipant }) {
  const ref = useRef<HTMLAudioElement>(null);
  const track = p.tracks?.audio?.persistentTrack;
  useEffect(() => {
    const el = ref.current;
    if (!el || !track) return;
    el.srcObject = new MediaStream([track]);
    void el.play().catch(() => undefined);
  }, [track]);
  return <audio ref={ref} autoPlay playsInline />;
}

export default function CallScreen({ circleId, kind, sessionId, backHref, firstName }: { circleId: string; kind: 'circle' | 'mentor'; sessionId?: string; backHref: string; firstName: string }) {
  const router = useRouter();
  const toast = useToast();
  const [phase, setPhase] = useState<Phase>('loading');
  const [info, setInfo] = useState<(TokenOpen | TokenWait) | null>(null);
  const [error, setError] = useState('');
  const [now, setNow] = useState(() => Date.now());
  const [micOk, setMicOk] = useState<'unknown' | 'granted' | 'blocked'>('unknown');
  const [level, setLevel] = useState(0);
  const [parts, setParts] = useState<DailyParticipant[]>([]);
  const [speaker, setSpeaker] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [hands, setHands] = useState<string[]>([]);
  const [handUp, setHandUp] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [poor, setPoor] = useState(false);
  const callRef = useRef<DailyCall | null>(null);
  const attendanceRef = useRef<string | null>(null);
  const warnedRef = useRef(false);
  const meterStop = useRef<() => void>(() => undefined);

  const fetchToken = useCallback(async () => {
    try {
      const res = await fetch('/api/rx/call/token', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ circleId, kind, sessionId }) });
      const j = (await res.json()) as TokenResponse;
      if (j.state === 'open') { setInfo(j); setPhase((p) => (p === 'incall' || p === 'joining' ? p : 'prejoin')); }
      else if (j.state === 'waiting' || j.state === 'ended') { setInfo(j); setPhase(j.state === 'waiting' ? 'waiting' : 'ended'); }
      else if (j.state === 'notstarted') setPhase('notstarted');
      else if (j.state === 'unavailable') setPhase('unavailable');
      else if (j.state === 'error') { setError(j.error); setPhase('error'); }
      else setPhase('unavailable');
    } catch { setPhase('unavailable'); }
  }, [circleId, kind, sessionId]);

  useEffect(() => {
    if (typeof navigator !== 'undefined' && IN_APP.test(navigator.userAgent)) { setPhase('inapp'); return; }
    void fetchToken();
  }, [fetchToken]);

  // one-second clock for the countdowns
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);

  // when the room opens, ask again
  useEffect(() => {
    if (phase !== 'waiting' || !info) return;
    if (now >= new Date(info.opensAt).getTime()) void fetchToken();
  }, [now, phase, info, fetchToken]);

  // time left warning and automatic end
  useEffect(() => {
    if (phase !== 'incall' || !info) return;
    const left = new Date(info.endsAt).getTime() - now;
    if (left <= 120000 && left > 0 && !warnedRef.current) { warnedRef.current = true; toast('2 minutes left.'); }
    if (left <= 0) void leave(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now, phase, info]);

  async function checkMic() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setMicOk('granted');
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new Ctx(); const src = ctx.createMediaStreamSource(stream); const an = ctx.createAnalyser(); an.fftSize = 256; src.connect(an);
      const buf = new Uint8Array(an.frequencyBinCount); let raf = 0;
      const tick = () => { an.getByteTimeDomainData(buf); let peak = 0; for (const v of buf) peak = Math.max(peak, Math.abs(v - 128)); setLevel(Math.min(1, peak / 60)); raf = requestAnimationFrame(tick); };
      tick();
      meterStop.current = () => { cancelAnimationFrame(raf); stream.getTracks().forEach((t) => t.stop()); void ctx.close(); };
    } catch { setMicOk('blocked'); }
  }
  useEffect(() => () => meterStop.current(), []);

  const refreshParts = useCallback(() => { const c = callRef.current; if (c) setParts(Object.values(c.participants())); }, []);

  async function join() {
    if (!info || info.state !== 'open') return;
    meterStop.current();
    setPhase('joining'); setError('');
    try {
      const call = Daily.createCallObject({ audioSource: true, videoSource: false, subscribeToTracksAutomatically: true });
      callRef.current = call;
      call.on('joined-meeting', async () => {
        refreshParts(); setPhase('incall');
        try { const r = await fetch('/api/rx/call/attendance', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ event: 'join', circleId, kind }) }); const j = await r.json(); attendanceRef.current = j.id ?? null; } catch { /* usage only */ }
      });
      call.on('participant-joined', refreshParts).on('participant-updated', refreshParts).on('participant-left', (e) => { refreshParts(); setHands((h) => h.filter((x) => x !== e?.participant?.session_id)); });
      call.on('active-speaker-change', (e) => setSpeaker(e?.activeSpeaker?.peerId ?? null));
      call.on('app-message', (e) => { const d = e?.data as { type?: string; up?: boolean } | undefined; if (d?.type === 'hand' && e?.fromId) setHands((h) => (d.up ? (h.includes(e.fromId) ? h : [...h, e.fromId]) : h.filter((x) => x !== e.fromId))); });
      call.on('network-connection', (e) => setReconnecting(e?.event === 'interrupted'));
      call.on('network-quality-change', (e) => setPoor(e?.threshold === 'low' || e?.threshold === 'very-low'));
      call.on('left-meeting', () => { setPhase('ended'); void endAttendance(); });
      call.on('error', () => { setError('The call dropped. You can rejoin while it is still open.'); setPhase('error'); });
      await call.join({ url: info.url, token: info.token, startVideoOff: true });
    } catch {
      setError('We could not connect to the call.'); setPhase('error');
    }
  }

  function endAttendance() {
    const id = attendanceRef.current; attendanceRef.current = null;
    if (!id) return;
    const body = JSON.stringify({ event: 'leave', id });
    if (navigator.sendBeacon) navigator.sendBeacon('/api/rx/call/attendance', new Blob([body], { type: 'application/json' }));
    else void fetch('/api/rx/call/attendance', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true });
  }
  useEffect(() => { const onUnload = () => endAttendance(); window.addEventListener('pagehide', onUnload); return () => { window.removeEventListener('pagehide', onUnload); callRef.current?.destroy(); }; }, []);

  async function leave(auto = false) {
    try { await callRef.current?.leave(); } catch { /* already gone */ }
    endAttendance(); setPhase('ended');
    if (auto) toast('The call has ended.');
  }

  function toggleMute() { const c = callRef.current; if (!c) return; const next = !muted; c.setLocalAudio(!next); setMuted(next); }
  function toggleHand() { const c = callRef.current; if (!c) return; const up = !handUp; setHandUp(up); c.sendAppMessage({ type: 'hand', up }, '*'); }
  async function endForAll() {
    if (!window.confirm('End the call for everyone?')) return;
    await fetch('/api/rx/call/end', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ circleId, kind }) }).catch(() => undefined);
    await leave();
  }

  const isOwner = info?.state === 'open' ? info.isOwner : false;
  const left = info ? new Date(info.endsAt).getTime() - now : 0;
  const title = info?.title ?? (kind === 'circle' ? 'Weekly Circle call' : 'Mentor session');
  const handOrder = (id: string) => hands.indexOf(id) + 1;
  const me = parts.find((p) => p.local);

  return (
    <div className="rx rx-call" role="main">
      <div className="rx-call-panel">
        <header className="rx-call-head">
          <p className="rx-h3">{title}</p>
          {phase === 'incall' && <span className={`rx-strong${left <= 120000 ? ' rx-call-warn' : ''}`} aria-live="off">{mmss(left)} left</span>}
        </header>

        {phase === 'loading' && <p className="rx-sm">Checking the call…</p>}

        {phase === 'inapp' && (
          <div className="rx-stack"><div className="rx-banner" role="note"><TriangleAlert aria-hidden style={{ width: 20, height: 20, flex: 'none' }} /><div><b>Open this in your browser.</b> Calls do not work inside WhatsApp or Instagram. Tap the menu and choose “Open in browser”.</div></div><Link href={backHref} className="rx-btn secondary">Back</Link></div>
        )}

        {phase === 'notstarted' && (
          <div className="rx-stack"><p className="rx-p">Your Circle’s weekly calls begin when 6 members have joined. Say hello in the chat meanwhile.</p><Link href={backHref} className="rx-btn secondary">Back to Circle</Link></div>
        )}

        {phase === 'unavailable' && (
          <div className="rx-stack"><div className="rx-banner err" role="alert"><TriangleAlert aria-hidden style={{ width: 20, height: 20, flex: 'none' }} /><div><b>The call isn’t working right now.</b> Continue in the Circle chat.</div></div><Link href={backHref} className="rx-btn secondary">Back</Link></div>
        )}

        {phase === 'error' && (
          <div className="rx-stack"><div className="rx-banner err" role="alert"><TriangleAlert aria-hidden style={{ width: 20, height: 20, flex: 'none' }} /><div>{error || 'Something went wrong.'}</div></div>
            <div className="rx-row"><button type="button" className="rx-btn secondary" onClick={() => { setError(''); setPhase('loading'); void fetchToken(); }}>Try again</button><Link href={backHref} className="rx-link">Back</Link></div></div>
        )}

        {phase === 'waiting' && info && (
          <div className="rx-stack">
            <p className="rx-big">Opens in {mmss(new Date(info.opensAt).getTime() - now)}</p>
            <p className="rx-sm">The room opens 5 minutes before the start, and the call lasts {kind === 'circle' ? 15 : 20} minutes. Audio only.</p>
            <Link href={backHref} className="rx-btn secondary">Back</Link>
          </div>
        )}

        {phase === 'prejoin' && info && (
          <div className="rx-stack">
            <p className="rx-p">Audio only. No camera, no screen sharing and no recording. The call ends automatically at {new Date(info.endsAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}.</p>
            {micOk === 'unknown' && <div><button type="button" className="rx-btn secondary" onClick={() => void checkMic()}><Mic aria-hidden style={{ width: 18, height: 18 }} />Allow microphone</button><p className="rx-sm" style={{ marginTop: 8 }}>Your browser will ask for permission next, so others can hear you.</p></div>}
            {micOk === 'granted' && (<div className="rx-stack-sm"><p className="rx-sm">Say something. The bar moves when your microphone hears you.</p><div className="rx-bar" role="img" aria-label="Microphone level"><span style={{ width: `${Math.round(level * 100)}%`, transition: 'width .08s linear' }} /></div></div>)}
            {micOk === 'blocked' && <div className="rx-banner" role="alert"><TriangleAlert aria-hidden style={{ width: 20, height: 20, flex: 'none' }} /><div><b>The microphone is blocked.</b> Open your browser’s site settings, allow the microphone for this site, then reload this page. You can still listen without it.</div></div>}
            <div className="rx-row"><button type="button" className="rx-btn primary" onClick={() => void join()}>Join now</button><Link href={backHref} className="rx-link muted">Not now</Link></div>
          </div>
        )}

        {phase === 'joining' && <p className="rx-sm">Joining…</p>}

        {phase === 'incall' && (
          <div className="rx-stack-lg">
            {reconnecting && <div className="rx-banner" role="status"><TriangleAlert aria-hidden style={{ width: 20, height: 20, flex: 'none' }} /><div>Reconnecting. We’ll keep trying.</div></div>}
            {poor && !reconnecting && <div className="rx-banner" role="status"><TriangleAlert aria-hidden style={{ width: 20, height: 20, flex: 'none' }} /><div>Your connection is weak. Close other apps to help.</div></div>}
            <ul className="rx-call-grid" aria-label="Participants">
              {parts.map((p) => {
                const speaking = speaker === p.session_id && !!p.audio;
                const name = p.user_name || 'Member';
                return (
                  <li key={p.session_id} className="rx-call-person">
                    <span className={`rx-call-ring${speaking ? ' on' : ''}`}><Avatar name={name} size="lg" seed={p.user_id} /></span>
                    <span className="rx-sm" style={{ color: 'var(--rx-ink)', fontWeight: 600 }}>{p.local ? `${firstName} (you)` : name}</span>
                    <span className="rx-sm">{p.owner ? (kind === 'circle' ? 'Facilitator' : 'Mentor') : ''}{!p.audio ? ' · muted' : ''}{hands.includes(p.session_id) ? ` · hand ${handOrder(p.session_id)}` : ''}</span>
                    {speaking && <span className="sr-only" style={{ position: 'absolute', left: -9999 }}>Speaking</span>}
                    {!p.local && <RemoteAudio p={p} />}
                    {isOwner && !p.local && (
                      <span className="rx-row rx-nw" style={{ gap: 2 }}>
                        <button type="button" className="rx-ib" style={{ width: 36, height: 36 }} aria-label={`Mute ${name}`} onClick={() => callRef.current?.updateParticipant(p.session_id, { setAudio: false })}><VolumeX aria-hidden style={{ width: 18, height: 18 }} /></button>
                        <button type="button" className="rx-ib" style={{ width: 36, height: 36 }} aria-label={`Remove ${name}`} onClick={() => { if (window.confirm(`Remove ${name} from the call?`)) callRef.current?.updateParticipant(p.session_id, { eject: true }); }}><UserX aria-hidden style={{ width: 18, height: 18 }} /></button>
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
            <div className="rx-call-controls">
              <button type="button" className="rx-call-btn" aria-pressed={muted} aria-label={muted ? 'Unmute' : 'Mute'} onClick={toggleMute}>{muted ? <MicOff aria-hidden /> : <Mic aria-hidden />}<span>{muted ? 'Unmute' : 'Mute'}</span></button>
              <button type="button" className="rx-call-btn" aria-pressed={handUp} aria-label={handUp ? 'Lower hand' : 'Raise hand'} onClick={toggleHand}><Hand aria-hidden /><span>{handUp ? 'Lower' : 'Raise hand'}</span></button>
              <button type="button" className="rx-call-btn leave" aria-label="Leave the call" onClick={() => void leave()}><LogOut aria-hidden /><span>Leave</span></button>
            </div>
            {isOwner && <div><button type="button" className="rx-link" onClick={() => void endForAll()}>End call for everyone</button></div>}
            {me && !me.audio && !muted && <p className="rx-sm">Your microphone isn’t sending sound. Check that your browser has permission.</p>}
          </div>
        )}

        {phase === 'ended' && (
          <div className="rx-stack">
            <p className="rx-big">Call ended.</p>
            <p className="rx-p">{kind === 'circle' ? 'Post your commitment in the Circle chat.' : 'Check the agreement for your next tasks.'}</p>
            <div className="rx-row"><Link href={kind === 'circle' ? '/circle/chat' : '/sessions'} className="rx-btn primary">{kind === 'circle' ? 'Open the Circle chat' : 'Back to Sessions'}</Link><button type="button" className="rx-link muted" onClick={() => router.push(backHref)}>Back</button></div>
          </div>
        )}
      </div>
    </div>
  );
}
