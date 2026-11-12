'use client';

// Entrance check-in for The Elevation Summit, built for a phone held at the door. Point the camera at a ticket QR (from
// the event-day email or the PDF ticket) and it admits the person once; a second scan of the same ticket shows who
// already used it. Anyone without their code can be found by name, email or phone. All rules live on the server.
import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import jsQR from 'jsqr';
import { checkInByIdAction, scanTicketAction, searchAction, statsAction, undoCheckInAction, type ScanResult } from '@/app/admin/c/checkin/actions';
import type { Attendee, CheckInStats } from '@/lib/summitCheckin';

const SCAN_EVERY_MS = 180;
const SAME_CODE_COOLDOWN_MS = 4000;
const RESULT_HOLD_MS = 3500;

const time = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Lagos' }) : '');

function beep(ok: boolean) {
  try {
    const W = window as Window & { webkitAudioContext?: typeof AudioContext };
    const Ctx = window.AudioContext || W.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const tone = (freq: number, at: number, len: number) => {
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, ctx.currentTime + at);
      g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + at + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + at + len);
      o.connect(g).connect(ctx.destination); o.start(ctx.currentTime + at); o.stop(ctx.currentTime + at + len + 0.05);
    };
    if (ok) { tone(880, 0, 0.12); tone(1320, 0.13, 0.18); } else { tone(220, 0, 0.35); }
    setTimeout(() => void ctx.close(), 800);
  } catch { /* sound is a nicety */ }
  try { navigator.vibrate?.(ok ? 80 : [120, 60, 120]); } catch { /* not supported */ }
}

const PANEL: Record<string, { bg: string; fg: string; title: string }> = {
  admitted: { bg: '#177245', fg: '#fff', title: 'Welcome in' },
  already: { bg: '#B7791F', fg: '#fff', title: 'Already checked in' },
  not_paid: { bg: '#9B1C31', fg: '#fff', title: 'Registration not confirmed' },
  not_found: { bg: '#9B1C31', fg: '#fff', title: 'Ticket not found' },
  not_ticket: { bg: '#4B5563', fg: '#fff', title: 'Not a Summit ticket' },
  error: { bg: '#4B5563', fg: '#fff', title: 'Could not check' },
};

export default function CheckInScreen({ initialStats, canAdmit }: { initialStats: CheckInStats; canAdmit: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const busyRef = useRef(false);
  const lastCode = useRef<{ text: string; at: number }>({ text: '', at: 0 });
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [camera, setCamera] = useState<'off' | 'starting' | 'on' | 'denied' | 'unsupported'>('off');
  const [result, setResult] = useState<ScanResult | null>(null);
  const [stats, setStats] = useState(initialStats);
  const [query, setQuery] = useState('');
  const [found, setFound] = useState<Attendee[]>([]);
  const [searching, startSearch] = useTransition();
  const [busy, setBusy] = useState(false);

  const refreshStats = useCallback(async () => { const s = await statsAction(); if (s) setStats(s); }, []);
  useEffect(() => { const id = setInterval(() => void refreshStats(), 30_000); return () => clearInterval(id); }, [refreshStats]);

  const clearResult = useCallback(() => {
    if (holdTimer.current) clearTimeout(holdTimer.current);
    setResult(null);
    busyRef.current = false;
  }, []);

  const show = useCallback((r: ScanResult) => {
    setResult(r);
    beep(r.status === 'admitted');
    if (r.status === 'admitted') void refreshStats();
    if (holdTimer.current) clearTimeout(holdTimer.current);
    // Green clears itself so the line keeps moving; anything else waits for the volunteer to tap "Next".
    if (r.status === 'admitted') holdTimer.current = setTimeout(clearResult, RESULT_HOLD_MS);
  }, [clearResult, refreshStats]);

  const handleCode = useCallback(async (text: string) => {
    const now = Date.now();
    if (text === lastCode.current.text && now - lastCode.current.at < SAME_CODE_COOLDOWN_MS) return;
    lastCode.current = { text, at: now };
    busyRef.current = true;
    setBusy(true);
    try { show(await scanTicketAction(text)); }
    catch { show({ status: 'error', error: 'Network problem. Check the connection and try again.' }); }
    finally { setBusy(false); }
  }, [show]);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCamera('off');
  }, []);

  const startCamera = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) { setCamera('unsupported'); return; }
    setCamera('starting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
      streamRef.current = stream;
      const v = videoRef.current;
      if (v) { v.srcObject = stream; await v.play().catch(() => {}); }
      setCamera('on');
    } catch (e) {
      setCamera((e as Error)?.name === 'NotAllowedError' ? 'denied' : 'unsupported');
    }
  }, []);

  useEffect(() => () => { streamRef.current?.getTracks().forEach((t) => t.stop()); if (holdTimer.current) clearTimeout(holdTimer.current); }, []);

  // Read frames while the camera is on and nothing is waiting on screen.
  useEffect(() => {
    if (camera !== 'on') return;
    const id = setInterval(() => {
      const v = videoRef.current;
      if (!v || busyRef.current || v.readyState < 2 || !v.videoWidth) return;
      const scale = Math.min(1, 720 / Math.max(v.videoWidth, v.videoHeight));
      const w = Math.round(v.videoWidth * scale), h = Math.round(v.videoHeight * scale);
      const c = canvasRef.current ?? (canvasRef.current = document.createElement('canvas'));
      if (c.width !== w) c.width = w;
      if (c.height !== h) c.height = h;
      const ctx = c.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;
      ctx.drawImage(v, 0, 0, w, h);
      const code = jsQR(ctx.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: 'dontInvert' });
      if (code?.data) void handleCode(code.data);
    }, SCAN_EVERY_MS);
    return () => clearInterval(id);
  }, [camera, handleCode]);

  const runSearch = (q: string) => {
    setQuery(q);
    if (q.trim().length < 2) { setFound([]); return; }
    startSearch(async () => { const r = await searchAction(q); setFound(r.rows); });
  };

  const admitFound = async (a: Attendee) => {
    busyRef.current = true;
    setBusy(true);
    try {
      const r = await checkInByIdAction(a.id);
      show(r);
      if ('attendee' in r) setFound((rows) => rows.map((x) => (x.id === a.id ? r.attendee : x)));
    } finally { setBusy(false); }
  };

  const undo = async (id: string) => {
    const r = await undoCheckInAction(id);
    if (r.ok) { setFound((rows) => rows.map((x) => (x.id === id ? { ...x, checkedInAt: null } : x))); clearResult(); void refreshStats(); }
  };

  const panel = result ? PANEL[result.status] : null;
  const attendee = result && 'attendee' in result ? result.attendee : null;

  return (
    <div className="admc">
      <div className="pg screen" style={{ maxWidth: 720 }}>
        <div><p className="eyebrow">Elevation Summit</p><h1 className="pt">Entrance check-in</h1><span className="ul" /></div>

        <div className="kpis" style={{ gridTemplateColumns: 'repeat(3, minmax(0,1fr))' }}>
          <div className="card kpi"><span className="k">Checked in</span><span className="v">{stats.checkedIn}</span></div>
          <div className="card kpi"><span className="k">Onsite registered</span><span className="v">{stats.onsiteExpected}</span></div>
          <div className="card kpi"><span className="k">Walk-ins</span><span className="v">{stats.walkIns}</span></div>
        </div>

        {!canAdmit && <div className="rz"><p className="sm">View only. Your role can look up attendees but not check them in.</p></div>}

        {/* Camera */}
        <div className="card" style={{ padding: 0, overflow: 'hidden', position: 'relative', background: '#0F0F0E', aspectRatio: '4 / 3' }}>
          <video ref={videoRef} playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover', display: camera === 'on' ? 'block' : 'none' }} />
          {camera === 'on' && !result && (
            <div aria-hidden style={{ position: 'absolute', inset: '18%', border: '3px solid rgba(255,255,255,.85)', borderRadius: 16, boxShadow: '0 0 0 9999px rgba(0,0,0,.25)' }} />
          )}
          {camera !== 'on' && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 20, textAlign: 'center', color: '#fff' }}>
              {camera === 'denied' && <p style={{ margin: 0 }}>Camera access was blocked. Allow the camera for this site in your browser settings, then try again.</p>}
              {camera === 'unsupported' && <p style={{ margin: 0 }}>This browser can&apos;t open the camera here. Use Chrome or Safari, or search by name below.</p>}
              <button type="button" className="btn bp" disabled={!canAdmit || camera === 'starting'} onClick={startCamera}>
                {camera === 'starting' ? 'Opening camera…' : 'Start scanning'}
              </button>
            </div>
          )}
          {result && panel && (
            <div role="status" aria-live="assertive" style={{ position: 'absolute', inset: 0, background: panel.bg, color: panel.fg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 20, textAlign: 'center' }}>
              <p style={{ margin: 0, fontSize: 15, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', opacity: 0.9 }}>{panel.title}</p>
              {attendee && <p style={{ margin: 0, fontSize: 28, fontWeight: 800, lineHeight: 1.15 }}>{attendee.name}</p>}
              {attendee && <p style={{ margin: 0, fontSize: 14, opacity: 0.9 }}>{attendee.ticket}{attendee.attendance === 'virtual' ? ' · registered as VIRTUAL' : ''}</p>}
              {result.status === 'already' && <p style={{ margin: 0, fontSize: 15 }}>at {time(result.attendee.checkedInAt)}{result.checkedInBy ? ` by ${result.checkedInBy}` : ''}. Check their ID before letting them in.</p>}
              {result.status === 'not_paid' && <p style={{ margin: 0, fontSize: 15 }}>This registration was never confirmed. Send them to the walk-in desk.</p>}
              {result.status === 'not_found' && <p style={{ margin: 0, fontSize: 15 }}>No registration matches this code. Try searching by name.</p>}
              {result.status === 'not_ticket' && <p style={{ margin: 0, fontSize: 15 }}>This QR code isn&apos;t a Summit ticket.</p>}
              {result.status === 'error' && <p style={{ margin: 0, fontSize: 15 }}>{result.error}</p>}
              <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                <button type="button" className="btn" style={{ background: '#fff', color: '#111', minWidth: 120 }} onClick={clearResult}>Next</button>
                {result.status === 'admitted' && <button type="button" className="btn" style={{ background: 'transparent', color: '#fff', border: '1px solid rgba(255,255,255,.7)' }} onClick={() => void undo(result.attendee.id)}>Undo</button>}
              </div>
            </div>
          )}
        </div>
        {camera === 'on' && (
          <div className="sb">
            <span className="sm">{busy ? 'Checking…' : 'Hold the QR code inside the square.'}</span>
            <button type="button" className="btn bs" onClick={stopCamera}>Stop camera</button>
          </div>
        )}

        {/* Search */}
        <div className="card st8">
          <p className="h3">No QR code? Find them</p>
          <input className="in" value={query} onChange={(e) => runSearch(e.target.value)} placeholder="Name, email or phone number" aria-label="Search attendees" autoComplete="off" />
          {searching && <p className="sm">Searching…</p>}
          {!searching && query.trim().length >= 2 && found.length === 0 && <p className="sm">No registration found. Send them to the walk-in desk.</p>}
          {found.map((a) => (
            <div key={a.id} className="sb" style={{ borderTop: '1px solid var(--border)', paddingTop: 10, gap: 10, flexWrap: 'wrap' }}>
              <div style={{ minWidth: 0 }}>
                <p style={{ margin: 0, fontWeight: 700 }}>{a.name}</p>
                <p className="sm" style={{ margin: 0, wordBreak: 'break-all' }}>{a.email}{a.whatsapp ? ` · ${a.whatsapp}` : ''}</p>
                <p className="sm" style={{ margin: 0 }}>
                  {a.attendance === 'virtual' ? 'Virtual' : 'Onsite'} · {a.ticket}{!a.paid ? ' · not confirmed' : ''}
                  {a.checkedInAt ? ` · checked in ${time(a.checkedInAt)}` : ''}
                </p>
              </div>
              {a.checkedInAt
                ? <span className="tag good"><i />In</span>
                : <button type="button" className="btn bp" disabled={!canAdmit || busy || !a.paid} onClick={() => void admitFound(a)}>Check in</button>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
