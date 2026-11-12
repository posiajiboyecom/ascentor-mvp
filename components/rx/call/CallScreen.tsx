'use client';

// Call (Daily). Weekly Circle call: 15 minutes. Mentor session: 20 minutes. Audio by default, with an optional camera that
// stays off until a member turns it on. One person can share their screen at a time (not on iOS, where browsers can't).
// No recording. States: waiting, microphone check, joining, in call (the Signal interface), reconnecting, poor
// connection, ended, unsupported in-app browser, call unavailable, Circle not started.
//
// In the call, Circle members see the agenda they prepared before it (circle_agendas / agenda_items). The facilitator
// picks the current item; the choice is saved (for anyone joining late) and broadcast with sendAppMessage so every
// screen moves to the same item at once.

import '@/styles/signal.css';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Daily, { type DailyCall, type DailyParticipant } from '@daily-co/daily-js';
import { Mic, TriangleAlert } from 'lucide-react';
import { useToast } from '@/components/rx/Toast';
import { createClient } from '@/lib/supabase/client';
import { clock, loadAgenda } from '@/lib/rx/agenda';
import {
  AgendaList, Bars, Bars3, IcAgenda, IcCam, IcCamOff, IcClock, IcLeave, IcMic, IcMicOff, IcPeople, IcScreen,
  IcSmallMic, IcSmallMicOff, RemoteAudio, Silhouette, TrackVideo, cameraOn, feedFor, itemLeft, sharesScreen, type LiveAgenda,
} from './signal-parts';
import { CHAT_MAX, ChatPanel, cleanText, historyBatches, mergeChat, type ChatMsg, type ChatWire } from './call-chat';

type Phase = 'loading' | 'waiting' | 'notstarted' | 'unavailable' | 'inapp' | 'elsewhere' | 'prejoin' | 'joining' | 'incall' | 'moved' | 'error';

interface TokenOpen { state: 'open'; url: string; token: string; isOwner: boolean; title: string; circleName?: string; circleNumber?: number; endsAt: string; startsAt: string; opensAt: string }
interface TokenWait { state: 'waiting' | 'ended'; title: string; circleName?: string; circleNumber?: number; endsAt: string; startsAt: string; opensAt: string }
interface TokenElsewhere { state: 'elsewhere'; title: string; circleName?: string; circleNumber?: number; endsAt: string; startsAt: string; opensAt: string }
type TokenResponse = TokenOpen | TokenWait | TokenElsewhere | { state: 'unavailable' | 'notstarted' } | { state: 'error'; error: string };
type AgendaMsg = { type: 'agenda'; index: number; startedAt: string };

/** "2 days", "3 hours", "12 minutes": the way a person says how long is left, rounded to the unit that matters. */
const away = (ms: number) => {
  const m = Math.max(0, Math.ceil(ms / 60000));
  if (m < 1) return 'less than a minute';
  if (m < 60) return `${m} ${m === 1 ? 'minute' : 'minutes'}`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} ${h === 1 ? 'hour' : 'hours'}`;
  const d = Math.round(h / 24);
  return `${d} ${d === 1 ? 'day' : 'days'}`;
};
/** "Thursdays at 7:00 PM WAT" for a weekly Circle call, "Thu 15 Oct at 7:00 PM WAT" for a one-off session, in the member's own time zone. */
const scheduled = (startsAt: string, weekly: boolean) => {
  const d = new Date(startsAt);
  const time = d.toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true, timeZoneName: 'short' }).replace(/(am|pm)/, (x) => x.toUpperCase());
  return weekly ? `${d.toLocaleDateString('en-GB', { weekday: 'long' })}s at ${time}` : `${d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })} at ${time}`;
};
// Inter for the interface, DM Mono for timers. Loaded from Google Fonts (allowed by the CSP) so builds never depend on fetching them.
const SIGNAL_FONTS = 'https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;500&family=Inter:wght@400;600;700&display=swap';
const BLUR_KEY = 'ascentor:call-blur';
const CAM_SETTINGS = { width: { ideal: 1280 }, height: { ideal: 720 }, aspectRatio: { ideal: 16 / 9 }, frameRate: { ideal: 30, max: 30 } };
const IN_APP = /(FBAN|FBAV|Instagram|Line\/|MicroMessenger|; wv\))/i;
const SHARE_BUSY = 'Someone is already sharing — wait for them to stop.';
const IOS_NOTE = 'Screen sharing isn’t available on iOS browsers yet. To share your screen, join this call from a laptop or an Android device.';

/** When a participant joined, in ms (Daily gives a Date; 0 if unknown). */
const joinedMs = (p: DailyParticipant) => { const d = p.joined_at as unknown; return d ? new Date(d as string | number | Date).getTime() || 0 : 0; };

/** Every browser on iPhone and iPad runs on WebKit, which has no getDisplayMedia(). iPadOS reports itself as a Mac with touch. */
function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

// ── small call sound effects (synthesised, no audio files to ship or fetch) ────────────────────────────────────────
let soundCtx: AudioContext | null = null;
function soundContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return null;
  if (!soundCtx) soundCtx = new Ctx();
  if (soundCtx.state === 'suspended') void soundCtx.resume();
  return soundCtx;
}
/** Plays a short, quiet chime: each note is [frequency Hz, start offset s, duration s]. */
function playChime(notes: Array<[number, number, number]>) {
  const ctx = soundContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  for (const [freq, at, dur] of notes) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, now + at);
    gain.gain.linearRampToValueAtTime(0.1, now + at + 0.015);
    gain.gain.linearRampToValueAtTime(0, now + at + dur);
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(now + at); osc.stop(now + at + dur + 0.02);
  }
}
/** A soft two-note descending chime, like a call hanging up. */
const playCallEndSound = () => playChime([[660, 0, 0.16], [440, 0.14, 0.22]]);
/** A soft two-note rising chime, like a camera switching on. */
const playCameraOnSound = () => playChime([[520, 0, 0.09], [780, 0.08, 0.14]]);

export default function CallScreen({ circleId, kind, sessionId, backHref, firstName }: { circleId: string; kind: 'circle' | 'mentor' | 'private'; sessionId?: string; backHref: string; firstName: string }) {
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
  const [camOn, setCamOn] = useState(false);
  const [camBusy, setCamBusy] = useState(false);
  // Background blur (desktop browsers only, done by Daily). Remembered on this device; applied whenever the camera is on.
  const [blurOn, setBlurOn] = useState(false);
  const [canBlur, setCanBlur] = useState(false);
  const camMode = useRef<'own' | 'daily' | null>(null);
  const [hands, setHands] = useState<string[]>([]);
  const [handUp, setHandUp] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [poor, setPoor] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [shareBusy, setShareBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [sheet, setSheet] = useState<null | 'agenda' | 'ios' | 'chat' | 'people'>(null);
  // Desktop side panel: the people on the call (with the agenda), the chat, or hidden.
  const [panel, setPanel] = useState<null | 'people' | 'chat'>('people');
  const [chat, setChat] = useState<ChatMsg[]>([]);
  const [unread, setUnread] = useState(0);
  const chatRef = useRef<ChatMsg[]>([]);
  const chatOpenRef = useRef(false);
  const [modFor, setModFor] = useState<string | null>(null);
  const [agenda, setAgenda] = useState<LiveAgenda | null>(null);
  const [agendaLoaded, setAgendaLoaded] = useState(false);
  const [ios, setIos] = useState(false);
  const callRef = useRef<DailyCall | null>(null);
  const attendanceRef = useRef<string | null>(null);
  const warnedRef = useRef(false);
  const meterStop = useRef<() => void>(() => undefined);
  // The microphone track the "Allow microphone" check already has permission for. We hand this straight to Daily when
  // joining instead of asking the browser for a second, separate microphone grant.
  const micTrack = useRef<MediaStreamTrack | null>(null);
  const camTrack = useRef<MediaStreamTrack | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Whose camera is on, as of the last check — lets us tell "just switched on" from "was already on" so the camera
  // chime plays once per switch-on, for whoever did it, and never for people already on camera when we join.
  const camOnIds = useRef<Set<string> | null>(null);
  const endSoundPlayed = useRef(false);
  const agendaRef = useRef<LiveAgenda | null>(null);
  agendaRef.current = agenda;
  chatRef.current = chat;
  chatOpenRef.current = panel === 'chat' || sheet === 'chat';

  useEffect(() => { setIos(isIOS()); }, []);
  useEffect(() => {
    try { setCanBlur(!!Daily.supportedBrowser().supportsVideoProcessing && !isIOS() && !window.matchMedia('(pointer: coarse)').matches); } catch { setCanBlur(false); }
    try { setBlurOn(localStorage.getItem(BLUR_KEY) === 'on'); } catch { /* storage unavailable */ }
  }, []);

  // If the browser already has standing microphone permission for this site, skip straight past the "Allow
  // microphone" button — there is nothing left to ask for. (Not supported in every browser; where it isn't, the
  // member still sees the button, same as before.)
  useEffect(() => {
    const perms = (navigator as Navigator & { permissions?: { query: (o: { name: 'microphone' }) => Promise<{ state: string }> } }).permissions;
    if (!perms?.query) return;
    let cancelled = false;
    perms.query({ name: 'microphone' }).then((status) => {
      if (cancelled) return;
      if (status.state === 'granted') void checkMic();
      else if (status.state === 'denied') setMicOk('blocked');
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  const fetchToken = useCallback(async (takeover = false) => {
    try {
      const res = await fetch('/api/rx/call/token', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ circleId, kind, sessionId, takeover }) });
      const j = (await res.json()) as TokenResponse;
      if (j.state === 'open') { setInfo(j); setPhase((p) => (p === 'incall' || p === 'joining' ? p : 'prejoin')); }
      else if (j.state === 'waiting') { setInfo(j); setPhase('waiting'); }
      // The call window has already closed. No "call ended" page to sit on — go straight back.
      else if (j.state === 'ended') { router.replace(backHref); }
      else if (j.state === 'elsewhere') setPhase('elsewhere');
      else if (j.state === 'notstarted') setPhase('notstarted');
      else if (j.state === 'unavailable') setPhase('unavailable');
      else if (j.state === 'error') { setError(j.error); setPhase('error'); }
      else setPhase('unavailable');
    } catch { setPhase('unavailable'); }
  }, [circleId, kind, sessionId, router, backHref]);

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

  function flash(msg: string) {
    setNotice(msg);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(''), 5000);
  }

  async function checkMic() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setMicOk('granted');
      micTrack.current = stream.getAudioTracks()[0] ?? null;
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new Ctx(); const src = ctx.createMediaStreamSource(stream); const an = ctx.createAnalyser(); an.fftSize = 256; src.connect(an);
      const buf = new Uint8Array(an.frequencyBinCount); let raf = 0;
      const tick = () => { an.getByteTimeDomainData(buf); let peak = 0; for (const v of buf) peak = Math.max(peak, Math.abs(v - 128)); setLevel(Math.min(1, peak / 60)); raf = requestAnimationFrame(tick); };
      tick();
      // Only stop the level-meter's audio graph here, not the microphone track — the track itself carries over to
      // Daily when the member joins, so the browser only has to grant the microphone once per visit, not twice.
      meterStop.current = () => { cancelAnimationFrame(raf); void ctx.close(); };
    } catch { setMicOk('blocked'); }
  }
  // If the member checked the microphone but never joined, release it when they navigate away.
  useEffect(() => () => { meterStop.current(); micTrack.current?.stop(); micTrack.current = null; }, []);

  const refreshParts = useCallback(() => {
    const c = callRef.current; if (!c) return;
    const list = Object.values(c.participants());
    const onNow = new Set(list.filter(cameraOn).map((p) => p.session_id));
    // Skip the very first reading (joining a call already in progress) — only a fresh switch-on plays the chime.
    if (camOnIds.current) {
      for (const id of onNow) { if (!camOnIds.current.has(id)) { playCameraOnSound(); break; } }
    }
    camOnIds.current = onNow;
    setParts(list);
  }, []);

  // One device per account in a call: if this account joins again somewhere else, the newer device keeps the call
  // and this one leaves. (The server also removes the older device when the member chooses to move the call.)
  useEffect(() => {
    if (phase !== 'incall') return;
    const mine = parts.find((p) => p.local);
    if (!mine?.user_id) return;
    const newer = parts.find((p) => !p.local && p.user_id === mine.user_id && joinedMs(p) > joinedMs(mine));
    if (!newer) return;
    void (async () => {
      try { if (sharing) callRef.current?.stopScreenShare(); await callRef.current?.leave(); } catch { /* already gone */ }
      camTrack.current?.stop(); camTrack.current = null; camMode.current = null; setCamOn(false); setSharing(false);
      endAttendance(); setPhase('moved');
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parts, phase]);

  // ── agenda ────────────────────────────────────────────────────────────────
  const sb = useMemo(() => createClient(), []);
  const reloadAgenda = useCallback(async () => {
    if (kind !== 'circle') { setAgendaLoaded(true); return; }
    try {
      const r = await loadAgenda(sb, circleId);
      setAgenda(r.agenda ? { id: r.agenda.id, items: r.items, index: Math.min(r.agenda.current_item_index, Math.max(0, r.items.length - 1)), startedAt: r.agenda.current_item_started_at } : null);
    } catch { /* the call works without an agenda */ }
    setAgendaLoaded(true);
  }, [sb, circleId, kind]);

  // Saved changes (item edits, or the facilitator moving on) reach everyone, including anyone who missed the broadcast.
  const agendaId = agenda?.id;
  useEffect(() => {
    if (phase !== 'incall' || kind !== 'circle') return;
    let ch = sb.channel(`call-agenda:${circleId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'circle_agendas', filter: `circle_id=eq.${circleId}` }, () => { void reloadAgenda(); });
    if (agendaId) ch = ch.on('postgres_changes', { event: '*', schema: 'public', table: 'agenda_items', filter: `agenda_id=eq.${agendaId}` }, () => { void reloadAgenda(); });
    ch.subscribe();
    return () => { void sb.removeChannel(ch); };
  }, [phase, kind, sb, circleId, agendaId, reloadAgenda]);

  async function pickItem(index: number) {
    const ag = agendaRef.current; const c = callRef.current;
    if (!ag || !isOwner || index === ag.index) return;
    const prev = { index: ag.index, startedAt: ag.startedAt };
    setAgenda({ ...ag, index, startedAt: new Date().toISOString() });
    try {
      const r = await fetch('/api/rx/call/agenda', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ circleId, agendaId: ag.id, index }) });
      const j = (await r.json()) as { index?: number; startedAt?: string; error?: string };
      if (!r.ok || j.startedAt == null) throw new Error(j.error ?? 'failed');
      setAgenda((a) => (a ? { ...a, index, startedAt: j.startedAt! } : a));
      c?.sendAppMessage({ type: 'agenda', index, startedAt: j.startedAt } satisfies AgendaMsg, '*');
    } catch {
      setAgenda((a) => (a ? { ...a, ...prev } : a));
      toast('We couldn’t move the agenda. Try again.');
    }
  }

  // ── joining and call events ───────────────────────────────────────────────
  async function join() {
    if (!info || info.state !== 'open') return;
    meterStop.current();
    setPhase('joining'); setError('');
    camOnIds.current = null; endSoundPlayed.current = false;
    try {
      // Hand Daily the already-granted microphone track when we have one, so it never has to request its own and
      // trigger a second browser permission prompt.
      const call = Daily.createCallObject({ audioSource: micTrack.current ?? true, videoSource: false, subscribeToTracksAutomatically: true, dailyConfig: { avoidEval: true } });
      micTrack.current = null; // Daily owns it now
      callRef.current = call;
      call.on('joined-meeting', async () => {
        refreshParts(); setPhase('incall');
        void reloadAgenda();
        // Higher camera quality. Three simulcast layers, so members on a weak connection still receive the low one.
        call.updateSendSettings({
          video: {
            maxQuality: 'high',
            encodings: {
              low: { maxBitrate: 150000, maxFramerate: 15, scaleResolutionDownBy: 4 },
              medium: { maxBitrate: 450000, maxFramerate: 30, scaleResolutionDownBy: 2 },
              high: { maxBitrate: 1200000, maxFramerate: 30, scaleResolutionDownBy: 1 },
            },
          },
        }).catch((e) => console.warn('[call] send settings not applied', e));
        try { const r = await fetch('/api/rx/call/attendance', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ event: 'join', circleId, kind }) }); const j = await r.json(); attendanceRef.current = j.id ?? null; } catch { /* usage only */ }
      });
      call.on('participant-joined', (e) => {
        refreshParts();
        // Whoever has been in the call longest hands the chat so far to the newcomer.
        const newId = e?.participant?.session_id;
        const all = Object.values(call.participants());
        const others = all.filter((p) => p.session_id !== newId);
        const host = others.sort((a, b) => joinedMs(a) - joinedMs(b))[0];
        if (newId && host?.local && chatRef.current.length) {
          for (const batch of historyBatches(chatRef.current)) call.sendAppMessage(batch, newId);
        }
      });
      call.on('participant-updated', refreshParts).on('participant-left', (e) => { refreshParts(); setHands((h) => h.filter((x) => x !== e?.participant?.session_id)); });
      call.on('active-speaker-change', (e) => { const id = e?.activeSpeaker?.peerId; if (id) setSpeaker(id); });
      call.on('app-message', (e) => {
        const d = e?.data as { type?: string; up?: boolean; index?: number; startedAt?: string } | undefined;
        if ((d?.type === 'chat' || d?.type === 'chat-history') && e?.fromId) {
          const w = e.data as ChatWire;
          const from = callRef.current?.participants()?.[e.fromId];
          const incoming: ChatMsg[] = w.type === 'chat'
            ? (() => { const text = cleanText(w.text); return text && typeof w.id === 'string' ? [{ id: w.id.slice(0, 64), fromId: e.fromId, name: from?.user_name || 'Member', text, at: Number(w.at) || Date.now(), mine: false }] : []; })()
            : (Array.isArray(w.items) ? w.items : []).flatMap((it) => {
                const text = cleanText(it?.text);
                return text && typeof it?.id === 'string' ? [{ id: it.id.slice(0, 64), fromId: `h:${String(it.name ?? '')}`, name: String(it.name || 'Member').slice(0, 40), text, at: Number(it.at) || 0, mine: false }] : [];
              });
          if (incoming.length) {
            setChat((c) => mergeChat(c, incoming));
            if (w.type === 'chat' && !chatOpenRef.current) setUnread((n) => n + 1);
          }
          return;
        }
        if (d?.type === 'hand' && e?.fromId) setHands((h) => (d.up ? (h.includes(e.fromId) ? h : [...h, e.fromId]) : h.filter((x) => x !== e.fromId)));
        if (d?.type === 'agenda' && e?.fromId && typeof d.index === 'number' && typeof d.startedAt === 'string') {
          // Only the facilitator moves the agenda.
          const from = callRef.current?.participants()?.[e.fromId];
          if (from?.owner) setAgenda((a) => (a ? { ...a, index: Math.min(d.index!, Math.max(0, a.items.length - 1)), startedAt: d.startedAt! } : a));
        }
      });
      call.on('local-screen-share-started', () => { setSharing(true); setShareBusy(false); refreshParts(); });
      call.on('local-screen-share-stopped', () => { setSharing(false); setShareBusy(false); refreshParts(); });
      call.on('local-screen-share-canceled', () => { setSharing(false); setShareBusy(false); });
      call.on('network-connection', (e) => setReconnecting(e?.event === 'interrupted'));
      call.on('network-quality-change', (e) => setPoor(e?.threshold === 'low' || e?.threshold === 'very-low'));
      // No "call ended" page to land on — once we've left, go straight back to the Circle (or Sessions).
      call.on('left-meeting', () => { playEndSoundOnce(); endAttendance(); router.replace(backHref); });
      call.on('nonfatal-error', (e) => {
        if (String(e?.type ?? '').includes('screen-share')) { setSharing(false); setShareBusy(false); toast('Your screen couldn’t be shared. Check that your browser can share your screen.'); }
      });
      call.on('error', (e) => {
        console.error('[call] daily error', e?.errorMsg ?? e);
        // Removed from the room: the member moved the call to another device, or the facilitator removed them.
        if (e?.error?.type === 'ejected' || /eject/i.test(String(e?.errorMsg ?? ''))) { playEndSoundOnce(); endAttendance(); setPhase('moved'); return; }
        setError('The call dropped. You can rejoin while it is still open.'); setPhase('error');
      });
      await call.join({ url: info.url, token: info.token, startVideoOff: true });
    } catch (e) {
      console.error('[call] join failed', e);
      setError('We could not connect to the call.'); setPhase('error');
    }
  }

  /** The hang-up chime, once per call — manual leave and the 'left-meeting' event it triggers both reach for this. */
  function playEndSoundOnce() {
    if (endSoundPlayed.current) return;
    endSoundPlayed.current = true;
    playCallEndSound();
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
    if (auto) toast('The call has ended.');
    playEndSoundOnce();
    try { if (sharing) callRef.current?.stopScreenShare(); } catch { /* already stopped */ }
    try { await callRef.current?.leave(); } catch { /* already gone */ }
    camTrack.current?.stop(); camTrack.current = null; camMode.current = null; setCamOn(false); setSharing(false);
    // 'left-meeting' (above) usually fires too and would try this again — playEndSoundOnce and endAttendance both
    // no-op the second time, so this is harmless whichever gets there first.
    endAttendance(); router.replace(backHref);
  }

  function toggleMute() { const c = callRef.current; if (!c) return; const next = !muted; c.setLocalAudio(!next); setMuted(next); }
  /** Turns the camera off and releases it, whichever way it was opened. */
  async function stopCamera(c: DailyCall) {
    c.setLocalVideo(false);
    if (camMode.current === 'daily') {
      await c.updateInputSettings({ video: { processor: { type: 'none' } } }).catch(() => undefined);
      await c.setInputDevicesAsync({ videoDeviceId: false }).catch(() => undefined);
    } else {
      await c.setInputDevicesAsync({ videoSource: false }).catch(() => undefined);
    }
    camTrack.current?.stop(); camTrack.current = null; camMode.current = null;
  }

  /**
   * Opens the camera only now, when the member asks, so joining never prompts for it. 720p, 16:9, 30fps.
   * Without blur we hand Daily our own track (the path proven on every browser). With blur, Daily has to own the camera
   * to run its background processor, so we pass it the device instead; if that fails we fall back to our own track.
   */
  async function startCamera(c: DailyCall, blur: boolean): Promise<boolean> {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', ...CAM_SETTINGS } });
    const track = stream.getVideoTracks()[0];
    if (blur && canBlur) {
      const deviceId = track.getSettings().deviceId;
      track.stop();
      try {
        await c.setInputDevicesAsync({ videoDeviceId: deviceId ?? null });
        await c.updateInputSettings({ video: { settings: { facingMode: 'user', ...CAM_SETTINGS }, processor: { type: 'background-blur', config: { strength: 0.6 } } } });
        c.setLocalVideo(true);
        camMode.current = 'daily';
        return true;
      } catch (e) {
        console.warn('[call] background blur failed, using the plain camera', e);
        await c.setInputDevicesAsync({ videoDeviceId: false }).catch(() => undefined);
        toast('Background blur isn’t working in this browser, so your camera is on without it.');
        return startCamera(c, false);
      }
    }
    camTrack.current = track;
    await c.setInputDevicesAsync({ videoSource: track });
    c.setLocalVideo(true);
    camMode.current = 'own';
    return true;
  }

  async function toggleCamera() {
    const c = callRef.current; if (!c || camBusy) return;
    setCamBusy(true);
    try {
      if (camOn) { await stopCamera(c); setCamOn(false); }
      else { await startCamera(c, blurOn); setCamOn(true); }
    } catch { toast('We couldn’t turn on your camera. Check that your browser can use it.'); setCamOn(false); }
    finally { setCamBusy(false); }
  }

  async function toggleBlur() {
    const c = callRef.current; if (!c || camBusy || !canBlur) return;
    const next = !blurOn;
    setBlurOn(next);
    try { localStorage.setItem(BLUR_KEY, next ? 'on' : 'off'); } catch { /* storage unavailable */ }
    if (!camOn) { toast(next ? 'Background blur is on. It applies when you turn your camera on.' : 'Background blur is off.'); return; }
    setCamBusy(true);
    try {
      if (camMode.current === 'daily' && !next) {
        // Already Daily's camera: just drop the processor.
        await c.updateInputSettings({ video: { processor: { type: 'none' } } });
      } else {
        await stopCamera(c);
        await startCamera(c, next);
      }
    } catch { toast('We couldn’t change the background. Try turning your camera off and on.'); }
    finally { setCamBusy(false); }
  }
  function sendChat(text: string) {
    const c = callRef.current; if (!c) return;
    const msg = { type: 'chat' as const, id: crypto.randomUUID(), text: text.slice(0, CHAT_MAX), at: Date.now() };
    c.sendAppMessage(msg satisfies ChatWire, '*');
    setChat((m) => mergeChat(m, [{ id: msg.id, fromId: me?.session_id ?? 'me', name: firstName, text: msg.text, at: msg.at, mine: true }]));
    // Save it with the member's other chats. Retried once; never blocks the call.
    const save = () => fetch('/api/rx/call/chat', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', keepalive: true,
      body: JSON.stringify({ id: msg.id, kind, circleId, sessionId: sessionId ?? null, text: msg.text, name: firstName }),
    });
    void save().then((r) => (r.ok || r.status < 500 ? r : save())).catch(() => setTimeout(() => { void save().catch(() => {}); }, 3000));
  }
  function openPeople() {
    if (window.matchMedia('(max-width: 767px)').matches) setSheet('people');
    else setPanel((p) => (p === 'people' ? null : 'people'));
  }
  function openChat() {
    setUnread(0);
    if (window.matchMedia('(max-width: 767px)').matches) setSheet('chat');
    else setPanel((p) => (p === 'chat' ? 'people' : 'chat'));
  }

  function toggleHand() { const c = callRef.current; if (!c) return; const up = !handUp; setHandUp(up); c.sendAppMessage({ type: 'hand', up }, '*'); }

  // ── screen sharing ────────────────────────────────────────────────────────
  const me = parts.find((p) => p.local);
  const sharer = parts.find((p) => !p.local && sharesScreen(p)) ?? (me && (sharing || sharesScreen(me)) ? me : undefined);

  function toggleShare() {
    const c = callRef.current; if (!c) return;
    if (ios) { setSheet('ios'); return; }
    if (sharing) { c.stopScreenShare(); return; }
    if (shareBusy) return;
    if (parts.some((p) => !p.local && sharesScreen(p))) { flash(SHARE_BUSY); return; }
    if (!Daily.supportedBrowser().supportsScreenShare || !navigator.mediaDevices?.getDisplayMedia) { toast('This browser can’t share a screen. Try Chrome, Edge, Firefox or Safari on a computer, or Chrome on Android.'); return; }
    setShareBusy(true);
    try { c.startScreenShare(); } catch { setShareBusy(false); toast('Your screen couldn’t be shared.'); }
  }

  // Two people pressed Share at the same moment: the earlier session keeps sharing, the other stops and is told why.
  useEffect(() => {
    if (!sharing || !me) return;
    const other = parts.find((p) => !p.local && sharesScreen(p));
    if (other && other.session_id < me.session_id) { callRef.current?.stopScreenShare(); flash(SHARE_BUSY); }
  }, [parts, sharing, me]);

  async function copyLink() {
    const url = window.location.href;
    try { await navigator.clipboard.writeText(url); toast('Call link copied.'); }
    catch { window.prompt('Copy this call link:', url); }
  }

  async function endForAll() {
    if (!window.confirm('End the call for everyone?')) return;
    await fetch('/api/rx/call/end', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ circleId, kind }) }).catch(() => undefined);
    await leave();
  }

  const isOwner = info?.state === 'open' ? info.isOwner : false;
  const left = info ? new Date(info.endsAt).getTime() - now : 0;
  const title = info?.title ?? (kind === 'circle' ? 'Weekly Circle call' : kind === 'private' ? 'Private mentor session' : 'Mentor session');

  // ── the Signal interface ──────────────────────────────────────────────────
  if (phase === 'incall' && info) {
    const nameOf = (p: DailyParticipant) => (p.local ? firstName : p.user_name || 'Member');
    const ownerLabel = kind === 'circle' ? 'Facilitator' : 'Mentor';
    // You first, then the facilitator or mentor, then everyone else in the order they arrived.
    const roster = [...parts].sort((a, b) => Number(b.local) - Number(a.local) || Number(b.owner) - Number(a.owner) || joinedMs(a) - joinedMs(b));
    const known = speaker && parts.some((p) => p.session_id === speaker) ? speaker : null;
    const stage = sharer ?? parts.find((p) => p.session_id === known) ?? parts.find((p) => !p.local) ?? me;
    const isTalking = (p: DailyParticipant) => known === p.session_id && !!p.audio;
    const handIdx = (p: DailyParticipant) => (p.local ? (handUp ? 0 : -1) : hands.indexOf(p.session_id));
    const cams = parts.filter(cameraOn).length;
    const camsLabel = cams === 0 ? 'Audio only' : cams === parts.length ? 'All cameras on' : `${cams} ${cams === 1 ? 'camera' : 'cameras'} on`;
    const elapsed = Math.max(0, now - new Date(info.startsAt).getTime());
    const badge = kind === 'circle' ? (info.circleNumber ? `Circle ${info.circleNumber}` : 'Circle') : kind === 'private' ? 'Private' : 'Mentor';
    const sessionName = info.circleName ?? title;

    const cur = agenda && agenda.items.length ? agenda.items[agenda.index] : null;
    const curLeft = agenda && cur ? itemLeft(agenda, agenda.index, info.startsAt, now) : null;
    const itemOf = agenda ? `Item ${agenda.index + 1} of ${agenda.items.length}` : '';

    const roleText = (p: DailyParticipant): { text: string; gold: boolean } => {
      if (sharer?.session_id === p.session_id) return { text: p.local ? 'Presenting · You' : 'Presenting', gold: true };
      if (p.local && isTalking(p)) return { text: 'Speaking · You', gold: true };
      if (handIdx(p) >= 0) return { text: '✋ Hand raised', gold: true };
      const base = p.owner ? ownerLabel : 'Member';
      if (!p.audio) return { text: `${base} · Muted`, gold: false };
      return { text: p.local ? `${base} · You` : base, gold: false };
    };

    const thumb = (p: DailyParticipant, cls: string) => (
      <span className={cls} style={{ background: feedFor(p.user_id || p.session_id) }}>
        {cameraOn(p) ? <TrackVideo track={p.tracks?.video?.persistentTrack} mirror={p.local} label={`${nameOf(p)}'s camera`} /> : <Silhouette />}
        {sharer?.session_id === p.session_id && <span className="sg-pres">Presenting</span>}
      </span>
    );

    const agendaBlock = kind === 'circle' && (
      <div className="sg-agenda">
        <div className="sg-ag-k">Current agenda item</div>
        {!agendaLoaded ? <p className="sg-ag-empty">Loading the agenda…</p>
          : !cur ? <p className="sg-ag-empty">No agenda was prepared for this call. Members can add one on the Circle page.</p>
          : (<>
              <div className="sg-ag-n">{itemOf}</div>
              <div className="sg-ag-t">{cur.title || 'Untitled item'}</div>
              {curLeft != null && <div className="sg-ag-time"><IcClock /><span className="mono">{clock(curLeft)}</span> remaining</div>}
              {agenda!.items.length > 1 && <AgendaList ag={agenda!} callStart={info.startsAt} now={now} canPick={isOwner} onPick={(i) => void pickItem(i)} />}
              {isOwner && <p className="sg-ag-hint">Tap an item to make it the current one for everyone.</p>}
            </>)}
      </div>
    );

    const stageFeed = sharer
      ? <div className="sg-feed screen"><TrackVideo track={sharer.tracks?.screenVideo?.persistentTrack} label={`${nameOf(sharer)}'s shared screen`} /></div>
      : stage && cameraOn(stage)
        ? <div className="sg-feed" style={{ background: feedFor(stage.user_id || stage.session_id) }}><TrackVideo track={stage.tracks?.video?.persistentTrack} mirror={stage.local} label={`${nameOf(stage)}'s camera`} /></div>
        : <div className="sg-feed" style={{ background: stage ? feedFor(stage.user_id || stage.session_id) : undefined }}><Silhouette /></div>;

    // Mobile: the speaker has the stage and the strip holds everyone else (everyone, while a screen is on the stage).
    const strip = sharer ? roster : roster.filter((p) => p.session_id !== stage?.session_id);

    const peopleList = (
            <ul className="sg-list">
              {roster.map((p) => {
                const talk = isTalking(p);
                const role = roleText(p);
                const canMod = isOwner && !p.local;
                const row = (
                  <>
                    {thumb(p, 'sg-thumb')}
                    <span className="sg-info"><b>{nameOf(p)}</b><span className={role.gold ? 'gold' : ''}>{role.text}</span></span>
                    <span className="sg-st">
                      {talk ? <span className="sg-ic talk"><Bars3 /></span>
                        : !p.audio ? <span className="sg-ic muted"><IcSmallMicOff /></span>
                        : <span className="sg-ic"><IcSmallMic /></span>}
                      {handIdx(p) >= 0 && <span className="sg-hand">✋ Hand raised</span>}
                    </span>
                  </>
                );
                const cls = `sg-row${p.local ? ' me' : ''}${talk ? ' speaking' : ''}`;
                return (
                  <li key={p.session_id}>
                    {canMod
                      ? <button type="button" className={cls} aria-expanded={modFor === p.session_id} aria-label={`${nameOf(p)}, ${role.text}. Options`} onClick={() => setModFor((m) => (m === p.session_id ? null : p.session_id))}>{row}</button>
                      : <div className={cls}>{row}</div>}
                    {canMod && modFor === p.session_id && (
                      <div className="sg-mod">
                        <button type="button" onClick={() => { callRef.current?.updateParticipant(p.session_id, { setAudio: false }); setModFor(null); }}>Mute</button>
                        {cameraOn(p) && <button type="button" onClick={() => { callRef.current?.updateParticipant(p.session_id, { setVideo: false }); setModFor(null); }}>Camera off</button>}
                        {sharesScreen(p) && <button type="button" onClick={() => { callRef.current?.updateParticipant(p.session_id, { setScreenShare: false }); setModFor(null); }}>Stop share</button>}
                        <button type="button" className="danger" onClick={() => { if (window.confirm(`Remove ${nameOf(p)} from the call?`)) callRef.current?.updateParticipant(p.session_id, { eject: true }); setModFor(null); }}>Remove</button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
    );

    return (
      <div className="sg" role="main" aria-label={title}>
        <link rel="stylesheet" href={SIGNAL_FONTS} precedence="default" />
        {/* 1. top bar */}
        <header className="sg-top">
          <div className="sg-top-l">
            <span className="sg-badge">{badge}</span>
            <div className="sg-session"><b>{sessionName}</b><span>{parts.length} on this call · {camsLabel}</span></div>
          </div>
          <div className="sg-top-r">
            <span className="sg-live" title="This call is not recorded"><i aria-hidden />LIVE</span>
            <div className={`sg-elapsed${left <= 120000 ? ' warn' : ''}`} title={`${clock(left)} left`}>
              <span className="mono">{clock(elapsed)}</span><small>elapsed</small>
            </div>
          </div>
        </header>

        {/* 2. body */}
        <div className="sg-body">
          <section className="sg-pane" aria-label={sharer ? `${nameOf(sharer)} is presenting` : 'Speaker'}>
            {stageFeed}
            <div className="sg-vig" aria-hidden />
            <div className="sg-vig-top" aria-hidden />
            {reconnecting && <div className="sg-banner" role="status"><TriangleAlert aria-hidden />Reconnecting. We’ll keep trying.</div>}
            {poor && !reconnecting && <div className="sg-banner" role="status"><TriangleAlert aria-hidden />Your connection is weak. Close other apps to help.</div>}
            <div className="sg-over">
              <div className="sg-over-l">
                {stage && (<>
                  <p className="sg-name">{nameOf(stage)}{stage.local && <span className="sg-you">You</span>}</p>
                  {sharer
                    ? <div className="sg-presenting-tag"><IcScreenSmall />{sharer.local ? 'You are presenting your screen' : 'Presenting their screen'}</div>
                    : isTalking(stage)
                      ? <div className="sg-speaking"><Bars />Speaking now</div>
                      : <div className="sg-speaking"><Bars idle />{stage.audio ? (stage.owner ? ownerLabel : 'On the call') : 'Muted'}</div>}
                </>)}
              </div>
              {cur && (
                <div className="sg-over-r">
                  <span className="sg-pill">{itemOf}{curLeft != null ? ` · ${clock(curLeft)} left` : ''}</span>
                  <div className="sg-pill-sub">{cur.title}</div>
                </div>
              )}
            </div>
          </section>

          {/* Everyone's voice (and screen sound) plays from here, whichever panel is showing. */}
          <div hidden>{parts.filter((p) => !p.local).map((p) => <RemoteAudio key={p.session_id} p={p} />)}</div>

          <aside className="sg-roster" hidden={panel === null} aria-label={panel === 'chat' ? 'Chat' : 'On this call'}>
            {panel === 'chat' ? (<>
              <div className="sg-rh"><span>Chat</span><button type="button" className="sg-rh-link" onClick={() => setPanel('people')}>People · {parts.length}</button></div>
              <ChatPanel messages={chat} onSend={sendChat} autoFocus />
            </>) : (<>
            <div className="sg-rh"><span>On this call</span><span>{parts.length}</span></div>
            {peopleList}
            {agendaBlock}
            {isOwner && <div className="sg-roster-foot"><button type="button" className="sg-endall" onClick={() => void endForAll()}>End call for everyone</button></div>}
            </>)}
          </aside>

          {/* mobile: participant strip and agenda bar */}
          <div className="sg-strip-w">
            <ul className="sg-strip" aria-label="On this call">
              {strip.map((p) => {
                const h = handIdx(p) >= 0;
                return (
                  <li key={p.session_id} className={`sg-tile${isTalking(p) ? ' speaking' : ''}`}>
                    {thumb(p, 'sg-feed')}
                    {!p.audio && <span className="sg-tile-m" aria-label="Muted"><IcSmallMicOff /></span>}
                    <span className={`sg-tile-n${h ? ' gold' : ''}`}>{h ? '✋ ' : ''}{nameOf(p)}{p.local ? ' (you)' : ''}</span>
                  </li>
                );
              })}
              {strip.length === 0 && <li className="sg-tile sg-tile-wait"><span>Waiting for others to join</span></li>}
            </ul>
          </div>
          {kind === 'circle' && (
            <button type="button" className="sg-agbar" onClick={() => setSheet('agenda')} aria-label="Open the agenda">
              <span className="sg-agbar-l">
                <span className="sg-agbar-k" style={{ display: 'block' }}>{cur ? itemOf : 'Agenda'}</span>
                <span className="sg-agbar-t" style={{ display: 'block' }}>{cur ? cur.title || 'Untitled item' : agendaLoaded ? 'No agenda prepared' : 'Loading…'}</span>
              </span>
              {curLeft != null && <span className="mono">{clock(curLeft)}</span>}
            </button>
          )}
        </div>

        {notice && <div className="sg-notice" role="status" aria-live="polite">{notice}</div>}
        {me && !me.audio && !muted && <div className="sg-notice warn" role="status">Your microphone isn’t sending sound. Check that your browser has permission.</div>}

        {/* 3. controls */}
        <div className="sg-ctls" role="toolbar" aria-label="Call controls">
          <button type="button" className={`sg-ctl${muted ? ' off' : ''}`} aria-pressed={!muted} aria-label={muted ? 'Unmute' : 'Mute'} onClick={toggleMute}>
            <span className="b">{muted ? <IcMicOff /> : <IcMic />}</span><span>{muted ? 'Unmute' : 'Mute'}</span>
          </button>
          <button type="button" className="sg-ctl" aria-pressed={camOn} aria-label={camOn ? 'Turn camera off' : 'Turn camera on'} disabled={camBusy} onClick={() => void toggleCamera()}>
            <span className="b">{camOn ? <IcCam /> : <IcCamOff />}</span><span>Camera</span>
          </button>
          {canBlur && (
            <button type="button" className="sg-ctl" aria-pressed={blurOn} aria-label={blurOn ? 'Turn background blur off' : 'Blur my background'} disabled={camBusy} onClick={() => void toggleBlur()}>
              <span className="b"><IcBlur /></span><span>{blurOn ? 'Blur on' : 'Blur'}</span>
            </button>
          )}
          <button type="button" className="sg-ctl" aria-pressed={sharing} aria-disabled={ios || undefined}
            aria-label={ios ? 'Screen sharing isn’t available on iOS' : sharing ? 'Stop sharing your screen' : 'Share your screen'} onClick={toggleShare}>
            <span className="b"><IcScreen /></span><span>{sharing ? 'Stop' : 'Screen'}</span>
          </button>
          <button type="button" className={`sg-ctl${kind === 'circle' ? ' desk' : ''}`} aria-pressed={sheet === 'agenda'} aria-label="Agenda" onClick={() => setSheet('agenda')}>
            <span className="b"><IcAgenda /></span><span>Agenda</span>
          </button>
          <button type="button" className="sg-ctl" aria-pressed={panel === 'chat' || sheet === 'chat'} aria-label={unread ? `Chat, ${unread} unread` : 'Chat'} onClick={openChat}>
            <span className="b"><IcChat />{unread > 0 && <span className="sg-unread" aria-hidden>{unread > 9 ? '9+' : unread}</span>}</span><span>Chat</span>
          </button>
          <button type="button" className="sg-ctl" aria-expanded={panel === 'people' || sheet === 'people'} aria-label={`People on this call, ${parts.length}`} onClick={openPeople}>
            <span className="b"><IcPeople /></span><span>People</span>
          </button>
          <button type="button" className="sg-ctl" aria-pressed={handUp} aria-label={handUp ? 'Lower hand' : 'Raise hand'} onClick={toggleHand}>
            <span className="b" aria-hidden>✋</span><span>{handUp ? 'Lower' : 'Raise'}</span>
          </button>
          <button type="button" className="sg-ctl leave" aria-label="Leave the call" onClick={() => void leave()}>
            <span className="b"><IcLeave /></span><span>Leave</span>
          </button>
        </div>

        {/* sheets */}
        {sheet && <div className="sg-scrim" onClick={() => setSheet(null)} aria-hidden />}
        {sheet === 'ios' && (
          <div className="sg-sheet" role="dialog" aria-modal="true" aria-labelledby="sg-ios-h">
            <div className="grab" aria-hidden />
            <h2 id="sg-ios-h">Screen sharing</h2>
            <p>{IOS_NOTE}</p>
            <div className="sg-sheet-acts">
              <button type="button" className="sg-btn primary" onClick={() => void copyLink()}>Copy call link</button>
              <button type="button" className="sg-btn" onClick={() => setSheet(null)}>Close</button>
            </div>
          </div>
        )}
        {sheet === 'people' && (
          <div className="sg-sheet sg-people-sheet" role="dialog" aria-modal="true" aria-labelledby="sg-people-h">
            <div className="grab" aria-hidden />
            <div className="sg-sheet-head"><h2 id="sg-people-h">On this call · {parts.length}</h2><button type="button" className="sg-btn" onClick={() => setSheet(null)}>Close</button></div>
            {peopleList}
            {isOwner && <div className="sg-sheet-acts"><button type="button" className="sg-btn" style={{ color: 'var(--sg-wine-t)' }} onClick={() => { setSheet(null); void endForAll(); }}>End call for everyone</button></div>}
          </div>
        )}
        {sheet === 'chat' && (
          <div className="sg-sheet sg-chat-sheet" role="dialog" aria-modal="true" aria-labelledby="sg-chat-h">
            <div className="grab" aria-hidden />
            <div className="sg-sheet-head"><h2 id="sg-chat-h">Chat</h2><button type="button" className="sg-btn" onClick={() => setSheet(null)}>Close</button></div>
            <ChatPanel messages={chat} onSend={sendChat} autoFocus />
          </div>
        )}
        {sheet === 'agenda' && (
          <div className="sg-sheet" role="dialog" aria-modal="true" aria-labelledby="sg-ag-h">
            <div className="grab" aria-hidden />
            <h2 id="sg-ag-h">Agenda</h2>
            {kind !== 'circle'
              ? <p>Your mentor session agenda is on the Sessions page.</p>
              : !agendaLoaded ? <p>Loading the agenda…</p>
              : !agenda || agenda.items.length === 0
                ? <p>No agenda was prepared for this call. Members can add one on the Circle page before the next call.</p>
                : (<>
                    <p style={{ marginBottom: 10 }}>{itemOf}{isOwner ? ' · Tap an item to make it the current one for everyone.' : ''}</p>
                    <AgendaList ag={agenda} callStart={info.startsAt} now={now} canPick={isOwner} onPick={(i) => void pickItem(i)} />
                  </>)}
            <div className="sg-sheet-acts">
              <button type="button" className="sg-btn" onClick={() => setSheet(null)}>Close</button>
              {isOwner && <button type="button" className="sg-btn" style={{ color: '#EF4444' }} onClick={() => { setSheet(null); void endForAll(); }}>End call for everyone</button>}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── before and after the call ─────────────────────────────────────────────
  return (
    <div className="rx rx-call" role="main">
      <div className="rx-call-panel">
        <header className="rx-call-head">
          <p className="rx-h3">{title}</p>
        </header>

        {phase === 'loading' && <p className="rx-sm">Checking the call…</p>}

        {phase === 'inapp' && (
          <div className="rx-stack"><div className="rx-banner" role="note"><TriangleAlert aria-hidden style={{ width: 20, height: 20, flex: 'none' }} /><div><b>Open this in your browser.</b> Calls do not work inside WhatsApp or Instagram. Tap the menu and choose “Open in browser”.</div></div><Link href={backHref} className="rx-btn secondary">Back</Link></div>
        )}

        {phase === 'notstarted' && (
          <div className="rx-stack"><p className="rx-p">Your Circle’s weekly calls begin when 4 members have joined. Say hello in the chat meanwhile.</p><Link href={backHref} className="rx-btn secondary">Back to Circle</Link></div>
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
            <p className="rx-big">Opens in {away(new Date(info.opensAt).getTime() - now)}</p>
            <p className="rx-sm">Scheduled: {scheduled(info.startsAt, kind === 'circle')}</p>
            <p className="rx-sm">The room opens 5 minutes before the start, and the call lasts {kind === 'circle' ? 15 : 20} minutes. Audio by default, camera optional.</p>
            <Link href={backHref} className="rx-btn secondary">Back</Link>
          </div>
        )}

        {phase === 'prejoin' && info && (
          <div className="rx-stack">
            <p className="rx-p">Audio by default. Your camera stays off unless you turn it on. You can share your screen from a computer or an Android phone. Nothing is recorded. The call ends automatically at {new Date(info.endsAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}.</p>
            {micOk === 'unknown' && <div><button type="button" className="rx-btn secondary" onClick={() => void checkMic()}><Mic aria-hidden style={{ width: 18, height: 18 }} />Allow microphone</button><p className="rx-sm" style={{ marginTop: 8 }}>Your browser will ask for permission next, so others can hear you.</p></div>}
            {micOk === 'granted' && (<div className="rx-stack-sm"><p className="rx-sm">Say something. The bar moves when your microphone hears you.</p><div className="rx-bar" role="img" aria-label="Microphone level"><span style={{ width: `${Math.round(level * 100)}%`, transition: 'width .08s linear' }} /></div></div>)}
            {micOk === 'blocked' && <div className="rx-banner" role="alert"><TriangleAlert aria-hidden style={{ width: 20, height: 20, flex: 'none' }} /><div><b>The microphone is blocked.</b> Open your browser’s site settings, allow the microphone for this site, then reload this page. You can still listen without it.</div></div>}
            <div className="rx-row"><button type="button" className="rx-btn primary" onClick={() => void join()}>Join now</button><Link href={backHref} className="rx-link muted">Not now</Link></div>
          </div>
        )}

        {phase === 'elsewhere' && (
          <div className="rx-stack">
            <div className="rx-banner" role="note"><TriangleAlert aria-hidden style={{ width: 20, height: 20, flex: 'none' }} /><div><b>You’re already in this call on another device.</b> An account can be in a call on one device at a time.</div></div>
            <div className="rx-row"><button type="button" className="rx-btn primary" onClick={() => { setPhase('loading'); void fetchToken(true); }}>Move the call to this device</button><Link href={backHref} className="rx-link muted">Not now</Link></div>
          </div>
        )}

        {phase === 'moved' && (
          <div className="rx-stack">
            <p className="rx-big">You’ve left the call on this device.</p>
            <p className="rx-p">The call continues on your other device. An account can be in a call on one device at a time. If you didn’t join from another device, the facilitator may have removed you, or someone else may be using your account: change your password in Settings.</p>
            <div className="rx-row"><button type="button" className="rx-btn secondary" onClick={() => { setPhase('loading'); void fetchToken(true); }}>Move the call back here</button><Link href={backHref} className="rx-link muted">Back</Link></div>
          </div>
        )}

        {phase === 'joining' && <p className="rx-sm">Joining…</p>}
      </div>
    </div>
  );
}

const IcBlur = () => <svg viewBox="0 0 24 24" aria-hidden><circle cx="12" cy="9" r="3.2" /><path d="M6 20a6 6 0 0 1 12 0" /><path d="M3 4.5h.01M3 9h.01M3 13.5h.01M21 4.5h.01M21 9h.01M21 13.5h.01M5.5 2.5h.01M18.5 2.5h.01" strokeWidth="2.6" /></svg>;
const IcChat = () => <svg viewBox="0 0 24 24" aria-hidden><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.6A8 8 0 1 1 21 12z" /></svg>;
const IcScreenSmall = () => <svg viewBox="0 0 24 24" aria-hidden width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M8 20h8M12 16v4" /></svg>;
