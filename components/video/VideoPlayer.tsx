'use client';

// components/video/VideoPlayer.tsx
// Ascentor's own video player. Streams HLS from Cloudflare R2 with
// hls.js (or native HLS on Safari/iOS), with every control drawn by us:
// no third-party branding, no "more videos", no pausing we can't control.
//
// Props:
//   src              master.m3u8 URL
//   poster           thumbnail URL
//   startAt          resume position in seconds (ignored if near start/end)
//   onProgress       (position, duration) — fired every ~10s while playing,
//                    on pause, on seek, and when the page is hidden
//   onEnded          fired once when playback reaches the end
//
// Keyboard (when the player has focus): Space/K play-pause, J/L ±10s,
// ←/→ ±5s, ↑/↓ volume, M mute, F fullscreen, 0–9 jump to 0–90%.

import { useCallback, useEffect, useRef, useState } from 'react';
import type Hls from 'hls.js';
import type { Level } from 'hls.js';

const GOLD = '#C8A96E';
const SPEEDS = [0.75, 1, 1.25, 1.5, 1.75, 2];
const REPORT_EVERY_MS = 10_000;
const HIDE_CONTROLS_MS = 2500;

export interface VideoPlayerProps {
  src: string;
  poster?: string | null;
  title?: string;
  startAt?: number;
  onProgress?: (position: number, duration: number) => void;
  onEnded?: () => void;
  className?: string;
}

function fmt(t: number) {
  if (!Number.isFinite(t) || t < 0) t = 0;
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = Math.floor(t % 60);
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
}

export function VideoPlayer({ src, poster, title, startAt = 0, onProgress, onEnded, className }: VideoPlayerProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastReport = useRef(0);
  const resumedRef = useRef(false);
  const progressCb = useRef(onProgress);
  const endedCb = useRef(onEnded);
  progressCb.current = onProgress;
  endedCb.current = onEnded;

  const [playing, setPlaying] = useState(false);
  const [started, setStarted] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [rate, setRate] = useState(1);
  const [levels, setLevels] = useState<Level[]>([]);
  const [level, setLevel] = useState(-1); // -1 = auto
  const [activeHeight, setActiveHeight] = useState<number | null>(null);
  const [menu, setMenu] = useState<null | 'settings'>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [hoverTime, setHoverTime] = useState<{ x: number; t: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resumeToast, setResumeToast] = useState<number | null>(null);

  const report = useCallback((force = false) => {
    const v = videoRef.current;
    if (!v || !v.duration || !progressCb.current) return;
    const now = Date.now();
    if (!force && now - lastReport.current < REPORT_EVERY_MS) return;
    lastReport.current = now;
    progressCb.current(v.currentTime, v.duration);
  }, []);

  // ── Source setup ──────────────────────────────────────────────
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    let cancelled = false;
    resumedRef.current = false;
    setError(null);
    setStarted(false);
    setLevels([]);
    setLevel(-1);

    (async () => {
      const { default: HlsLib } = await import('hls.js');
      if (cancelled) return;

      if (HlsLib.isSupported()) {
        const hls = new HlsLib({ capLevelToPlayerSize: true, startLevel: -1, maxBufferLength: 30 });
        hlsRef.current = hls;
        hls.on(HlsLib.Events.MANIFEST_PARSED, (_e, data) => setLevels(data.levels));
        hls.on(HlsLib.Events.LEVEL_SWITCHED, (_e, data) => setActiveHeight(hls.levels[data.level]?.height ?? null));
        hls.on(HlsLib.Events.ERROR, (_e, data) => {
          if (!data.fatal) return;
          if (data.type === HlsLib.ErrorTypes.NETWORK_ERROR) hls.startLoad();
          else if (data.type === HlsLib.ErrorTypes.MEDIA_ERROR) hls.recoverMediaError();
          else setError('This video could not be played.');
        });
        hls.loadSource(src);
        hls.attachMedia(video);
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = src; // Safari / iOS native HLS
      } else {
        setError('Your browser cannot play this video.');
      }
    })();

    return () => {
      cancelled = true;
      hlsRef.current?.destroy();
      hlsRef.current = null;
      video.removeAttribute('src');
      video.load();
    };
  }, [src]);

  // ── Resume once metadata is known ─────────────────────────────
  const handleLoadedMetadata = () => {
    const v = videoRef.current!;
    setDuration(v.duration);
    if (!resumedRef.current) {
      resumedRef.current = true;
      if (startAt > 5 && startAt < v.duration - 10) {
        v.currentTime = startAt;
        setTime(startAt);
        setResumeToast(startAt);
      }
    }
  };

  useEffect(() => {
    if (resumeToast === null || !playing) return;
    const t = setTimeout(() => setResumeToast(null), 6000);
    return () => clearTimeout(t);
  }, [resumeToast, playing]);

  // ── Save progress when the tab is hidden or closed ────────────
  useEffect(() => {
    const onHide = () => document.visibilityState === 'hidden' && report(true);
    const onPageHide = () => report(true);
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', onPageHide);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', onPageHide);
      report(true);
    };
  }, [report]);

  // ── Fullscreen state ──────────────────────────────────────────
  useEffect(() => {
    const onFs = () => setFullscreen(document.fullscreenElement === wrapRef.current);
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  // ── Controls auto-hide ────────────────────────────────────────
  const poke = useCallback(() => {
    setShowControls(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      if (videoRef.current && !videoRef.current.paused) {
        setShowControls(false);
        setMenu(null);
      }
    }, HIDE_CONTROLS_MS);
  }, []);

  useEffect(() => {
    if (!playing) setShowControls(true);
    else poke();
  }, [playing, poke]);

  // ── Actions ───────────────────────────────────────────────────
  const toggle = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused || v.ended) v.play().catch(() => {});
    else v.pause();
  }, []);

  const seekTo = useCallback((t: number) => {
    const v = videoRef.current;
    if (!v || !v.duration) return;
    v.currentTime = Math.max(0, Math.min(v.duration - 0.1, t));
    setTime(v.currentTime);
  }, []);

  const changeVolume = useCallback((val: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.volume = Math.max(0, Math.min(1, val));
    v.muted = v.volume === 0;
  }, []);

  const toggleMute = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    if (!v.muted && v.volume === 0) v.volume = 0.5;
  }, []);

  const toggleFullscreen = useCallback(() => {
    const wrap = wrapRef.current;
    const v = videoRef.current as (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null;
    if (!wrap || !v) return;
    if (document.fullscreenElement) document.exitFullscreen();
    else if (wrap.requestFullscreen) wrap.requestFullscreen().catch(() => v.webkitEnterFullscreen?.());
    else v.webkitEnterFullscreen?.(); // iPhone
  }, []);

  const pickLevel = (i: number) => {
    if (hlsRef.current) hlsRef.current.currentLevel = i;
    setLevel(i);
    setMenu(null);
    wrapRef.current?.focus(); // keep keyboard shortcuts working after the menu closes
  };

  const pickRate = (r: number) => {
    if (videoRef.current) videoRef.current.playbackRate = r;
    setRate(r);
    setMenu(null);
    wrapRef.current?.focus();
  };

  const onKey = (e: React.KeyboardEvent) => {
    const v = videoRef.current;
    if (!v || e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key.toLowerCase();
    if (k === ' ' || k === 'k') toggle();
    else if (k === 'j') seekTo(v.currentTime - 10);
    else if (k === 'l') seekTo(v.currentTime + 10);
    else if (k === 'arrowleft') seekTo(v.currentTime - 5);
    else if (k === 'arrowright') seekTo(v.currentTime + 5);
    else if (k === 'arrowup') changeVolume(v.volume + 0.1);
    else if (k === 'arrowdown') changeVolume(v.volume - 0.1);
    else if (k === 'm') toggleMute();
    else if (k === 'f') toggleFullscreen();
    else if (/^[0-9]$/.test(k)) seekTo((Number(k) / 10) * v.duration);
    else return;
    e.preventDefault();
    poke();
  };

  // ── Scrubbing ─────────────────────────────────────────────────
  const barRef = useRef<HTMLDivElement>(null);
  const scrubbing = useRef(false);
  const timeAt = (clientX: number) => {
    const rect = barRef.current!.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return { pct, t: pct * (duration || 0), x: clientX - rect.left };
  };
  const onBarDown = (e: React.PointerEvent) => {
    scrubbing.current = true;
    setResumeToast(null);
    (e.target as Element).setPointerCapture(e.pointerId);
    seekTo(timeAt(e.clientX).t);
  };
  const onBarMove = (e: React.PointerEvent) => {
    const { t, x } = timeAt(e.clientX);
    setHoverTime({ x, t });
    if (scrubbing.current) seekTo(t);
  };
  const onBarUp = () => {
    scrubbing.current = false;
    report(true);
  };

  const pct = duration ? (time / duration) * 100 : 0;
  const bufPct = duration ? (buffered / duration) * 100 : 0;
  const controlsVisible = showControls || !playing || menu !== null;
  const qualityLabel = level === -1 ? `Auto${activeHeight ? ` (${activeHeight}p)` : ''}` : `${levels[level]?.height}p`;

  return (
    <div
      ref={wrapRef}
      tabIndex={0}
      role="region"
      aria-label={title ? `Video: ${title}` : 'Video player'}
      onKeyDown={onKey}
      onPointerMove={poke}
      onPointerLeave={() => playing && setShowControls(false)}
      className={`group ${className ?? 'relative w-full h-full'} bg-[#0F0F0E] select-none outline-none overflow-hidden ${controlsVisible ? '' : 'cursor-none'}`}
    >
      <video
        ref={videoRef}
        poster={poster ?? undefined}
        playsInline
        preload="metadata"
        className="absolute inset-0 w-full h-full object-contain"
        onClick={toggle}
        onDoubleClick={toggleFullscreen}
        onPlay={() => { setPlaying(true); setStarted(true); }}
        onPause={() => { setPlaying(false); report(true); }}
        onWaiting={() => setWaiting(true)}
        onPlaying={() => setWaiting(false)}
        onCanPlay={() => setWaiting(false)}
        onLoadedMetadata={handleLoadedMetadata}
        onDurationChange={(e) => setDuration(e.currentTarget.duration)}
        onTimeUpdate={(e) => {
          setTime(e.currentTarget.currentTime);
          report();
        }}
        onProgress={(e) => {
          const b = e.currentTarget.buffered;
          if (b.length) setBuffered(b.end(b.length - 1));
        }}
        onVolumeChange={(e) => {
          setVolume(e.currentTarget.volume);
          setMuted(e.currentTarget.muted);
        }}
        onSeeked={() => report(true)}
        onEnded={() => {
          setPlaying(false);
          setResumeToast(null);
          report(true);
          endedCb.current?.();
        }}
      />

      {/* Loading spinner */}
      {waiting && playing && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="h-12 w-12 rounded-full border-[3px] border-white/20 border-t-[#C8A96E] animate-spin" />
        </div>
      )}

      {/* Big play button (before first play / when paused) */}
      {!playing && !error && (
        <button
          type="button"
          onClick={toggle}
          aria-label={started ? 'Play' : 'Play video'}
          className="absolute inset-0 m-auto flex h-16 w-16 lg:h-20 lg:w-20 items-center justify-center rounded-full shadow-lg transition-transform hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
          style={{ background: GOLD }}
        >
          <svg viewBox="0 0 24 24" className="ml-1 h-7 w-7 lg:h-8 lg:w-8" fill="#0F0F0E"><path d="M8 5.14v13.72a1 1 0 0 0 1.5.86l11-6.86a1 1 0 0 0 0-1.72l-11-6.86A1 1 0 0 0 8 5.14z" /></svg>
        </button>
      )}

      {error && (
        <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-white/70">{error}</div>
      )}

      {/* Resume notice */}
      {resumeToast !== null && (
        <div className="absolute left-3 top-3 lg:left-4 lg:top-4 z-20 flex items-center gap-3 rounded-lg bg-black/60 backdrop-blur-sm px-3 py-2 text-xs text-white">
          <span>Resumed from {fmt(resumeToast)}</span>
          <button
            type="button"
            className="font-semibold underline-offset-2 hover:underline"
            style={{ color: GOLD }}
            onClick={() => { seekTo(0); setResumeToast(null); }}
          >
            Start over
          </button>
        </div>
      )}

      {/* Control bar */}
      <div
        className={`absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/80 via-black/40 to-transparent px-3 lg:px-4 pb-2 pt-10 transition-opacity duration-200 ${controlsVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
      >
        {/* Seek bar */}
        <div
          ref={barRef}
          role="slider"
          aria-label="Seek"
          aria-valuemin={0}
          aria-valuemax={Math.round(duration)}
          aria-valuenow={Math.round(time)}
          aria-valuetext={`${fmt(time)} of ${fmt(duration)}`}
          className="relative h-4 cursor-pointer touch-none flex items-center"
          onPointerDown={onBarDown}
          onPointerMove={onBarMove}
          onPointerUp={onBarUp}
          onPointerLeave={() => setHoverTime(null)}
        >
          <div className="relative h-1 w-full rounded-full bg-white/25 transition-[height] group-hover:h-1.5">
            <div className="absolute inset-y-0 left-0 rounded-full bg-white/40" style={{ width: `${bufPct}%` }} />
            <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${pct}%`, background: GOLD }} />
          </div>
          <span
            className="absolute h-3 w-3 -translate-x-1/2 rounded-full opacity-0 group-hover:opacity-100"
            style={{ left: `${pct}%`, background: GOLD }}
          />
          {hoverTime && (
            <span
              className="pointer-events-none absolute -top-7 -translate-x-1/2 rounded bg-black/80 px-1.5 py-0.5 text-[11px] font-semibold text-white"
              style={{ left: hoverTime.x }}
            >
              {fmt(hoverTime.t)}
            </span>
          )}
        </div>

        <div className="mt-1 flex items-center gap-1 lg:gap-2 text-white">
          <IconBtn label={playing ? 'Pause' : 'Play'} onClick={toggle}>
            {playing ? (
              <path d="M7 5h3v14H7zM14 5h3v14h-3z" />
            ) : (
              <path d="M8 5.14v13.72a1 1 0 0 0 1.5.86l11-6.86a1 1 0 0 0 0-1.72l-11-6.86A1 1 0 0 0 8 5.14z" />
            )}
          </IconBtn>
          <IconBtn label="Back 10 seconds" onClick={() => seekTo(time - 10)}>
            <path d="M12 5V2L7 6l5 4V7a6 6 0 1 1-6 6H4a8 8 0 1 0 8-8z" /><text x="12" y="16.5" fontSize="7" textAnchor="middle" fontWeight="700">10</text>
          </IconBtn>
          <IconBtn label="Forward 10 seconds" onClick={() => seekTo(time + 10)}>
            <path d="M12 5V2l5 4-5 4V7a6 6 0 1 0 6 6h2a8 8 0 1 1-8-8z" /><text x="12" y="16.5" fontSize="7" textAnchor="middle" fontWeight="700">10</text>
          </IconBtn>

          {/* Volume */}
          <div className="group/vol flex items-center">
            <IconBtn label={muted ? 'Unmute' : 'Mute'} onClick={toggleMute}>
              <path d="M4 9v6h4l5 5V4L8 9H4z" />
              {muted || volume === 0 ? (
                <path d="M16 9l5 6M21 9l-5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
              ) : (
                <path d="M16 8.5a4.5 4.5 0 0 1 0 7M18.5 6a8 8 0 0 1 0 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
              )}
            </IconBtn>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={muted ? 0 : volume}
              onChange={(e) => changeVolume(Number(e.target.value))}
              aria-label="Volume"
              className="hidden lg:block w-0 group-hover/vol:w-20 focus:w-20 transition-[width] duration-200 accent-[#C8A96E]"
            />
          </div>

          <span className="ml-1 text-[12px] font-semibold tabular-nums text-white/90">
            {fmt(time)} <span className="text-white/50">/ {fmt(duration)}</span>
          </span>

          <div className="ml-auto flex items-center gap-1 lg:gap-2">
            {/* Settings: speed + quality */}
            <div className="relative">
              <IconBtn label="Settings" onClick={() => setMenu(menu ? null : 'settings')}>
                <path d="M19.4 13a7.5 7.5 0 0 0 0-2l2-1.6-2-3.4-2.4 1a7.4 7.4 0 0 0-1.7-1L15 3.5h-4l-.4 2.5a7.4 7.4 0 0 0-1.7 1l-2.4-1-2 3.4L6.6 11a7.5 7.5 0 0 0 0 2l-2 1.6 2 3.4 2.4-1a7.4 7.4 0 0 0 1.7 1l.4 2.5h4l.4-2.5a7.4 7.4 0 0 0 1.7-1l2.4 1 2-3.4-2.1-1.6zM13 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7z" transform="translate(-1 0)" />
              </IconBtn>
              {menu === 'settings' && (
                <div className="absolute bottom-11 right-0 z-30 w-52 rounded-xl bg-[#1A1917]/95 backdrop-blur p-2 text-[13px] shadow-xl">
                  <p className="px-2 pb-1 pt-1 text-[10px] font-bold uppercase tracking-wider text-white/50">Speed</p>
                  <div className="grid grid-cols-3 gap-1 px-1 pb-2">
                    {SPEEDS.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => pickRate(s)}
                        className={`rounded-md py-1 font-semibold ${rate === s ? 'text-[#0F0F0E]' : 'text-white hover:bg-white/10'}`}
                        style={rate === s ? { background: GOLD } : undefined}
                      >
                        {s === 1 ? '1×' : `${s}×`}
                      </button>
                    ))}
                  </div>
                  {levels.length > 1 && (
                    <>
                      <p className="px-2 pb-1 pt-1 text-[10px] font-bold uppercase tracking-wider text-white/50">Quality · {qualityLabel}</p>
                      <div className="flex flex-col">
                        {[-1, ...levels.map((_, i) => i).reverse()].map((i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => pickLevel(i)}
                            className="flex items-center justify-between rounded-md px-2 py-1.5 text-left text-white hover:bg-white/10"
                          >
                            {i === -1 ? 'Auto' : `${levels[i].height}p`}
                            {level === i && <span style={{ color: GOLD }}>✓</span>}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            <IconBtn label={fullscreen ? 'Exit full screen' : 'Full screen'} onClick={toggleFullscreen}>
              {fullscreen ? (
                <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
              ) : (
                <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
              )}
            </IconBtn>
          </div>
        </div>
      </div>
    </div>
  );
}

function IconBtn({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="flex h-9 w-9 items-center justify-center rounded-full text-white/90 hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#C8A96E]"
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
        {children}
      </svg>
    </button>
  );
}
