'use client';

// Building blocks for the Signal call interface: icons, the camera-off silhouette, video elements bound to Daily
// tracks, and the agenda list used in the roster block and in the agenda sheet.

import { useEffect, useRef } from 'react';
import type { DailyParticipant } from '@daily-co/daily-js';
import type { AgendaItem } from '@/lib/rx/agenda';
import { clock } from '@/lib/rx/agenda';

// ── icons (18×18 viewBox 24, stroke-based, styled by CSS) ───────────────────
const S = ({ children }: { children: React.ReactNode }) => <svg viewBox="0 0 24 24" aria-hidden>{children}</svg>;
export const IcMic = () => <S><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></S>;
export const IcMicOff = () => <S><path d="M3 3l18 18M9 9v2a3 3 0 0 0 5.1 2.1M15 9.3V6a3 3 0 0 0-5.7-1.3M5 11a7 7 0 0 0 11.4 5.4M19 11a7 7 0 0 1-.6 2.8M12 18v3" /></S>;
export const IcCam = () => <S><rect x="3" y="6" width="13" height="12" rx="2" /><path d="M16 10l5-3v10l-5-3z" /></S>;
export const IcCamOff = () => <S><path d="M3 3l18 18M16 16v.01A2 2 0 0 1 14 18H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h1M10 6h4a2 2 0 0 1 2 2v2l5-3v10" /></S>;
export const IcScreen = () => <S><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M8 20h8M12 16v4" /></S>;
export const IcAgenda = () => <S><path d="M9 6h11M9 12h11M9 18h11" /><path d="M4 6h.01M4 12h.01M4 18h.01" /></S>;
export const IcPeople = () => <S><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14.2a6.5 6.5 0 0 1 3.5 5.8" /></S>;
export const IcLeave = () => <S><path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4M10 17l-5-5 5-5M5 12h11" /></S>;
export const IcClock = () => <svg viewBox="0 0 24 24" aria-hidden fill="none" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>;
export const IcCheck = () => <svg viewBox="0 0 24 24" aria-hidden fill="none" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>;
export const IcSmallMic = () => <svg viewBox="0 0 24 24" aria-hidden fill="none" strokeWidth="2.4" strokeLinecap="round"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg>;
export const IcSmallMicOff = () => <svg viewBox="0 0 24 24" aria-hidden fill="none" strokeWidth="2.4" strokeLinecap="round"><path d="M3 3l18 18M9 9v2a3 3 0 0 0 5.1 2.1M15 9.3V6a3 3 0 0 0-5.7-1.3M5 11a7 7 0 0 0 11.4 5.4M12 18v3" /></svg>;

export const Bars = ({ idle = false }: { idle?: boolean }) => <span className={`sg-bars${idle ? ' idle' : ''}`} aria-hidden><i /><i /><i /><i /></span>;
export const Bars3 = () => <span className="sg-bars" aria-hidden><i /><i /><i /></span>;

/** Head and shoulders, shown when a camera is off. */
export const Silhouette = () => (
  <svg className="sg-sil" viewBox="0 0 220 240" aria-hidden preserveAspectRatio="xMidYMax meet">
    <ellipse cx="110" cy="80" rx="42" ry="50" />
    <path d="M15 240 Q42 162 78 148 Q94 141 110 141 Q126 141 142 148 Q178 162 205 240Z" />
  </svg>
);

// ── per-person backdrop (a calm, distinct hue for each member when their camera is off) ──
const FEEDS = [
  'radial-gradient(ellipse at 38% 42%, #1E3A5C 0%, #0A1828 55%, #030810 100%)',
  'radial-gradient(ellipse at 55% 38%, #163D2C 0%, #0A2018 55%, #040E09 100%)',
  'radial-gradient(ellipse at 46% 44%, #2E1A48 0%, #1A0D2E 55%, #09050F 100%)',
  'radial-gradient(ellipse at 42% 42%, #4A2A18 0%, #2E1808 55%, #120804 100%)',
  'radial-gradient(ellipse at 55% 42%, #3D2010 0%, #1E1008 55%, #0A0604 100%)',
  'radial-gradient(ellipse at 46% 42%, #1A2A4A 0%, #0A1428 55%, #040810 100%)',
];
export function feedFor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return FEEDS[h % FEEDS.length];
}

// ── Daily participant helpers ────────────────────────────────────────────────
const LIVE = new Set(['playable', 'sendable', 'loading']);
export const sharesScreen = (p: DailyParticipant) => LIVE.has(String(p.tracks?.screenVideo?.state ?? '')) && !!p.tracks?.screenVideo?.persistentTrack;
export const cameraOn = (p: DailyParticipant) => !!p.video && !!p.tracks?.video?.persistentTrack;

/** A <video> bound to a MediaStreamTrack. Muted: sound plays through RemoteAudio. */
export function TrackVideo({ track, mirror, label }: { track: MediaStreamTrack | undefined; mirror?: boolean; label: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !track) return;
    el.srcObject = new MediaStream([track]);
    void el.play().catch(() => undefined);
    return () => { el.srcObject = null; };
  }, [track]);
  // Mirroring is a class (not an inline transform) so the stage can combine it with its own scale in CSS.
  return <video ref={ref} className={mirror ? 'mirror' : undefined} autoPlay playsInline muted aria-label={label} />;
}

/** A remote member's voice, plus the sound of their shared screen if any. */
export function RemoteAudio({ p }: { p: DailyParticipant }) {
  return (<><AudioTrack track={p.tracks?.audio?.persistentTrack} /><AudioTrack track={p.tracks?.screenAudio?.persistentTrack} /></>);
}
function AudioTrack({ track }: { track: MediaStreamTrack | undefined }) {
  const ref = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !track) return;
    el.srcObject = new MediaStream([track]);
    void el.play().catch(() => undefined);
  }, [track]);
  if (!track) return null;
  return <audio ref={ref} autoPlay playsInline />;
}

// ── agenda ──────────────────────────────────────────────────────────────────
export interface LiveAgenda { id: string; items: AgendaItem[]; index: number; startedAt: string | null }

/** Milliseconds left on an item (counting down only for the current one), or null when it has no duration. */
export function itemLeft(ag: LiveAgenda, i: number, callStart: string, now: number): number | null {
  const it = ag.items[i];
  if (!it?.duration_minutes) return null;
  const full = it.duration_minutes * 60000;
  if (i !== ag.index) return i < ag.index ? 0 : full;
  const from = ag.startedAt ?? (ag.index === 0 ? callStart : null);
  return from ? Math.max(0, full - (now - new Date(from).getTime())) : full;
}

export function AgendaList({ ag, callStart, now, canPick, onPick }: { ag: LiveAgenda; callStart: string; now: number; canPick: boolean; onPick: (i: number) => void }) {
  return (
    <ol className="sg-ag-list" aria-label="Agenda">
      {ag.items.map((it, i) => {
        const state = i < ag.index ? 'done' : i === ag.index ? 'cur' : '';
        const left = itemLeft(ag, i, callStart, now);
        const inner = (
          <>
            <span className="mk" aria-hidden>{state === 'done' && <IcCheck />}</span>
            <span className="tt">{it.title || 'Untitled item'}</span>
            {left != null && state !== 'done' && <span className="dd mono">{clock(left)}</span>}
            <span className="sr">{state === 'done' ? ' (done)' : state === 'cur' ? ' (current)' : ''}</span>
          </>
        );
        return (
          <li key={it.id}>
            {canPick
              ? <button type="button" className={`sg-ag-item ${state}`} aria-current={state === 'cur' ? 'step' : undefined} onClick={() => onPick(i)}>{inner}</button>
              : <div className={`sg-ag-item ${state}`} aria-current={state === 'cur' ? 'step' : undefined}>{inner}</div>}
          </li>
        );
      })}
    </ol>
  );
}
