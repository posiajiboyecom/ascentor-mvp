'use client';

// The lesson video player. Plays Vimeo, YouTube or a direct file, reports how far the member got (so they can resume
// and be reminded to finish). Vimeo is driven over postMessage. YouTube is driven through Google's own IFrame Player
// API (not hand-rolled postMessage) — a raw postMessage "pauseVideo"/"playVideo" pair can leave the embed stuck
// paused with no way to resume except reloading the page; the official player object does not have that problem.
// YouTube embeds use controls=0 so we render our own overlay: play/pause centre, gold progress bar bottom, fullscreen
// small full-screen button top-right. Vimeo uses its own native controls.

import { useCallback, useEffect, useRef, useState } from 'react';
import { saveWatchProgress } from '@/app/(app)/learn/lesson/actions';
import { embedSrc, type VideoSource } from '@/lib/rx/video';
import { Play, Pause, Maximize, Minimize } from 'lucide-react';

interface Props {
  lessonId: string;
  title: string;
  source: VideoSource;
  startSec: number;
  startPercent: number;
  thumbnailUrl?: string | null;
}

const SAVE_EVERY_MS = 15_000;
const PROGRESS_POLL_MS = 1000;

// ── YouTube IFrame Player API (loaded once per page, shared by every lesson video on it) ──────────────────────────
interface YTPlayer {
  playVideo(): void;
  pauseVideo(): void;
  getCurrentTime(): number;
  getDuration(): number;
}
interface YTPlayerState { PLAYING: number; PAUSED: number; ENDED: number }
interface YTNamespace {
  Player: new (el: HTMLElement, opts: { events?: { onStateChange?: (e: { data: number }) => void } }) => YTPlayer;
  PlayerState: YTPlayerState;
}
declare global {
  interface Window { YT?: YTNamespace; onYouTubeIframeAPIReady?: () => void }
}

let ytApiPromise: Promise<YTNamespace> | null = null;
function loadYouTubeApi(): Promise<YTNamespace> {
  if (typeof window === 'undefined') return new Promise(() => undefined); // never resolves on the server; fine, this only runs client-side
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (ytApiPromise) return ytApiPromise;
  ytApiPromise = new Promise((resolve) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { prev?.(); resolve(window.YT!); };
    if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
      const s = document.createElement('script');
      s.src = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(s);
    }
  });
  return ytApiPromise;
}

export default function LessonVideo({ lessonId, title, source, startSec, startPercent, thumbnailUrl }: Props) {
  const frame = useRef<HTMLIFrameElement>(null);
  const fileRef = useRef<HTMLVideoElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const latest = useRef({ pos: startSec, dur: 0, pct: startPercent });
  const lastSent = useRef({ at: 0, pct: startPercent });
  const [pct, setPct] = useState(startPercent);
  const [origin, setOrigin] = useState('');
  const [playing, setPlaying] = useState(false);
  const [started, setStarted] = useState(false); // has the user ever pressed play?
  const [showControls, setShowControls] = useState(true);
  const [fs, setFs] = useState(false); // full screen (the browser's own, or the page-filling fallback below)
  const [fsFallback, setFsFallback] = useState(false); // true when the browser has no fullscreen API (iPhone)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ytPlayer = useRef<YTPlayer | null>(null);
  const ytPoll = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => setOrigin(window.location.origin), []);

  const flush = useCallback((force = false) => {
    const { pos, dur, pct: p } = latest.current;
    if (!dur || p <= 0) return;
    const now = Date.now();
    if (!force && (now - lastSent.current.at < SAVE_EVERY_MS || p === lastSent.current.pct)) return;
    lastSent.current = { at: now, pct: p };
    void saveWatchProgress(lessonId, p, pos, dur);
  }, [lessonId]);

  const report = useCallback((pos: number, dur: number) => {
    if (!dur || !Number.isFinite(dur)) return;
    const p = Math.max(0, Math.min(100, Math.round((pos / dur) * 100)));
    latest.current = { pos, dur, pct: Math.max(latest.current.pct, p) };
    setPct((cur) => Math.max(cur, p));
    flush(false);
  }, [flush]);

  // Auto-hide controls 2.5s after last interaction when playing
  const nudgeControls = useCallback(() => {
    setShowControls(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    if (playing) {
      hideTimer.current = setTimeout(() => setShowControls(false), 2500);
    }
  }, [playing]);

  useEffect(() => {
    return () => { if (hideTimer.current) clearTimeout(hideTimer.current); };
  }, []);

  // Show controls when paused, hide after delay when playing
  useEffect(() => {
    if (!playing) {
      setShowControls(true);
      if (hideTimer.current) clearTimeout(hideTimer.current);
    } else {
      hideTimer.current = setTimeout(() => setShowControls(false), 2500);
    }
    return () => { if (hideTimer.current) clearTimeout(hideTimer.current); };
  }, [playing]);

  // Vimeo talks to us through postMessage. (YouTube uses the official Player API instead — see onFrameLoad.)
  useEffect(() => {
    if (source.provider !== 'vimeo') return;
    const onMsg = (e: MessageEvent) => {
      if (e.source !== frame.current?.contentWindow) return;
      let d: unknown = e.data;
      if (typeof d === 'string') { try { d = JSON.parse(d); } catch { return; } }
      if (!d || typeof d !== 'object') return;
      const m = d as { event?: string; data?: { seconds?: number; duration?: number } };
      if (m.event === 'timeupdate' && m.data) report(m.data.seconds ?? 0, m.data.duration ?? 0);
      else if (m.event === 'pause') { flush(true); setPlaying(false); }
      else if (m.event === 'play') { setPlaying(true); setStarted(true); }
      else if (m.event === 'ended') { flush(true); setPlaying(false); }
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, [source, report, flush]);

  // Save on tab hide and on leaving the lesson.
  useEffect(() => {
    const hide = () => { if (document.visibilityState === 'hidden') flush(true); };
    document.addEventListener('visibilitychange', hide);
    return () => { document.removeEventListener('visibilitychange', hide); flush(true); };
  }, [flush]);

  // Stop polling for progress, whatever took the video out of 'playing'.
  const stopYtPoll = useCallback(() => { if (ytPoll.current) { clearInterval(ytPoll.current); ytPoll.current = null; } }, []);
  useEffect(() => () => stopYtPoll(), [stopYtPoll]);

  const onFrameLoad = () => {
    const w = frame.current?.contentWindow;
    if (source.provider === 'vimeo') {
      if (!w) return;
      for (const ev of ['timeupdate', 'pause', 'play', 'ended']) w.postMessage(JSON.stringify({ method: 'addEventListener', value: ev }), 'https://player.vimeo.com');
    } else if (source.provider === 'youtube') {
      // Hand control of the existing iframe to Google's own player object. Hand-rolled postMessage
      // play/pause commands could leave the embed stuck paused with no way to resume but a reload; the
      // official API doesn't have that failure mode.
      void loadYouTubeApi().then((YT) => {
        const el = frame.current;
        if (!el) return;
        ytPlayer.current = new YT.Player(el, {
          events: {
            onStateChange: (e) => {
              if (e.data === YT.PlayerState.PLAYING) {
                setPlaying(true); setStarted(true);
                stopYtPoll();
                ytPoll.current = setInterval(() => {
                  const p = ytPlayer.current;
                  if (!p) return;
                  report(p.getCurrentTime(), p.getDuration());
                }, PROGRESS_POLL_MS);
              } else if (e.data === YT.PlayerState.PAUSED || e.data === YT.PlayerState.ENDED) {
                flush(true); setPlaying(false); stopYtPoll();
              }
            },
          },
        });
      });
    }
  };

  const togglePlay = () => {
    if (source.provider === 'youtube') {
      const p = ytPlayer.current;
      if (!p) return;
      if (playing) p.pauseVideo(); else p.playVideo();
    } else if (source.provider === 'vimeo') {
      const w = frame.current?.contentWindow;
      if (!w) return;
      const method = playing ? 'pause' : 'play';
      w.postMessage(JSON.stringify({ method }), 'https://player.vimeo.com');
    }
    nudgeControls();
  };

  // iPhone browsers have no fullscreen API for ordinary elements (only for a bare <video>), so there we fill the whole
  // screen ourselves with a fixed-position player and a close button. Everywhere else we use the real fullscreen.
  type FsEl = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> | void };
  type FsDoc = Document & { webkitFullscreenElement?: Element | null; webkitExitFullscreen?: () => Promise<void> | void };
  const handleFullscreen = () => {
    const el = wrapRef.current as FsEl | null;
    const doc = document as FsDoc;
    if (!el) return;
    if (fs) {
      if (fsFallback) { setFsFallback(false); setFs(false); }
      else if (doc.fullscreenElement) void doc.exitFullscreen().catch(() => {});
      else if (doc.webkitFullscreenElement) void doc.webkitExitFullscreen?.();
      nudgeControls();
      return;
    }
    const fillScreen = () => { setFsFallback(true); setFs(true); };
    try {
      if (el.requestFullscreen) el.requestFullscreen().catch(fillScreen);
      else if (el.webkitRequestFullscreen) void el.webkitRequestFullscreen();
      else fillScreen();
    } catch { fillScreen(); }
    nudgeControls();
  };

  const fsFallbackRef = useRef(false);
  useEffect(() => { fsFallbackRef.current = fsFallback; }, [fsFallback]);

  // Keep our state in step with the browser's own fullscreen (including its Esc / swipe-down exit).
  useEffect(() => {
    const sync = () => {
      const doc = document as FsDoc;
      if (!fsFallbackRef.current) setFs(!!(doc.fullscreenElement || doc.webkitFullscreenElement));
    };
    document.addEventListener('fullscreenchange', sync);
    document.addEventListener('webkitfullscreenchange', sync);
    return () => { document.removeEventListener('fullscreenchange', sync); document.removeEventListener('webkitfullscreenchange', sync); };
  }, []);

  // While the page-filling fallback is open: stop the page scrolling behind it, and let Esc close it.
  useEffect(() => {
    if (!fs || !fsFallback) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setFsFallback(false); setFs(false); } };
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey); };
  }, [fs, fsFallback]);

  const isYouTube = source.provider === 'youtube';

  return (
    <div className="rx-stack-sm">
      {source.provider === 'file' ? (
        <video
          ref={fileRef} className="rx-video rx-rise" src={source.url} controls preload="metadata"
          poster={thumbnailUrl ?? undefined}
          style={{ width: '100%' }}
          onLoadedMetadata={(e) => { if (startSec > 5 && startPercent < 95) e.currentTarget.currentTime = startSec; }}
          onTimeUpdate={(e) => report(e.currentTarget.currentTime, e.currentTarget.duration)}
          onPause={() => flush(true)} onEnded={() => flush(true)}
        />
      ) : (
        <div
          ref={wrapRef}
          className="rx-video rx-rise"
          style={fs && fsFallback
            ? { position: 'fixed', inset: 0, zIndex: 9999, width: '100vw', height: '100dvh', aspectRatio: 'auto', borderRadius: 0, animation: 'none', cursor: isYouTube ? 'pointer' : undefined }
            : { cursor: isYouTube ? 'pointer' : undefined, position: 'relative' }}
          onMouseMove={isYouTube ? nudgeControls : undefined}
          onTouchStart={isYouTube ? nudgeControls : undefined}
        >
          {/* YouTube shows its own title bar, channel buttons and a "More videos" grid whenever the player is paused or
              finished, and we cannot turn those off. So while the video is not playing we cover the whole player with the
              lesson's own picture (or a plain dark panel), which leaves only our controls on screen. */}
          {isYouTube && !playing && (
            <div aria-hidden style={{ position: 'absolute', inset: 0, zIndex: 1, background: '#14110E', pointerEvents: 'none', overflow: 'hidden' }}>
              {thumbnailUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={thumbnailUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: started ? 0.8 : 1 }} />
              )}
            </div>
          )}
          {!isYouTube && thumbnailUrl && !started && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={thumbnailUrl}
              alt={title}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: 1, pointerEvents: 'none' }}
            />
          )}
          {origin && (
            <iframe
              ref={frame} title={title} onLoad={onFrameLoad}
              src={embedSrc(source, startPercent < 95 ? startSec : 0, origin)}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 }}
              allow="autoplay; fullscreen; picture-in-picture; encrypted-media" allowFullScreen
            />
          )}

          {/* Custom overlay for YouTube (controls=0) */}
          {isYouTube && (
            <div
              style={{ position: 'absolute', inset: 0, zIndex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              onClick={togglePlay}
            >
              {/* Play/Pause centre button */}
              <button
                onClick={(e) => { e.stopPropagation(); togglePlay(); }}
                aria-label={playing ? 'Pause' : 'Play'}
                style={{
                  opacity: showControls ? 1 : 0,
                  transition: 'opacity 0.3s',
                  background: 'rgba(0,0,0,0.55)',
                  border: 'none',
                  borderRadius: '50%',
                  width: 56,
                  height: 56,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: '#fff',
                  flexShrink: 0,
                }}
              >
                {playing ? <Pause size={26} fill="currentColor" /> : <Play size={26} fill="currentColor" />}
              </button>

              {/* Bottom bar: progress + fullscreen */}
              <div
                style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  padding: '0 10px 10px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  opacity: showControls ? 1 : 0,
                  transition: 'opacity 0.3s',
                  background: 'linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 100%)',
                }}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Gold progress bar */}
                <div
                  style={{ flex: 1, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.25)', overflow: 'hidden', cursor: 'default' }}
                  role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="Video progress"
                >
                  <div style={{ width: `${pct}%`, height: '100%', background: 'var(--rx-gold, #C8A84B)', borderRadius: 2, transition: 'width 1s linear' }} />
                </div>
              </div>
            </div>
          )}

          {/* Small full-screen button, top-right, for YouTube and Vimeo alike */}
          {origin && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); handleFullscreen(); }}
              aria-label={fs ? 'Exit full screen' : 'Full screen'}
              style={{
                position: 'absolute', top: 8, right: 8, zIndex: 3, width: 30, height: 30, padding: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'rgba(0,0,0,0.55)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer',
                opacity: showControls || !playing ? 0.9 : 0.35, transition: 'opacity 0.3s',
              }}
            >
              {fs ? <Minimize size={16} /> : <Maximize size={16} />}
            </button>
          )}

          {/* For Vimeo: show progress bar below as before */}
          {!isYouTube && pct > 0 && (
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 4, background: 'rgba(0,0,0,0.3)', zIndex: 2, pointerEvents: 'none' }}>
              <div style={{ width: `${pct}%`, height: '100%', background: 'var(--rx-gold, #C8A84B)' }} />
            </div>
          )}
        </div>
      )}

      {/* Progress label below video (shown for all types when progress > 0) */}
      {pct > 0 && (
        <div className="rx-row rx-nw" style={{ gap: 10 }} aria-live="polite">
          <div style={{ flex: 1, height: 4, borderRadius: 2, background: 'var(--rx-border)', overflow: 'hidden', display: isYouTube ? 'none' : undefined }} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="Video progress">
            <div style={{ width: `${pct}%`, height: '100%', background: 'var(--rx-gold)' }} />
          </div>
          <span className="rx-sm">{pct >= 95 ? 'Watched' : `${pct}% watched`}</span>
        </div>
      )}
    </div>
  );
}
