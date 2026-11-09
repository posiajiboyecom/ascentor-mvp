'use client';

// The lesson video player. Plays Vimeo, YouTube or a direct file, reports how far the member got (so they can resume
// and be reminded to finish), and never needs a player library: Vimeo and YouTube are driven over postMessage.
// YouTube embeds use controls=0 so we render our own overlay: play/pause centre, gold progress bar bottom, fullscreen
// button bottom-right. Vimeo uses its own native controls.

import { useCallback, useEffect, useRef, useState } from 'react';
import { saveWatchProgress } from '@/app/(app)/learn/lesson/actions';
import { embedSrc, type VideoSource } from '@/lib/rx/video';
import { Play, Pause, Maximize } from 'lucide-react';

interface Props {
  lessonId: string;
  title: string;
  source: VideoSource;
  startSec: number;
  startPercent: number;
  thumbnailUrl?: string | null;
}

const SAVE_EVERY_MS = 15_000;

function postToYT(w: Window | null | undefined, event: string, data?: Record<string, unknown>) {
  if (!w) return;
  w.postMessage(JSON.stringify({ event, id: 1, channel: 'widget', ...data }), 'https://www.youtube-nocookie.com');
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
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // Vimeo and YouTube talk to us through postMessage.
  useEffect(() => {
    if (source.provider === 'file') return;
    const onMsg = (e: MessageEvent) => {
      if (e.source !== frame.current?.contentWindow) return;
      let d: unknown = e.data;
      if (typeof d === 'string') { try { d = JSON.parse(d); } catch { return; } }
      if (!d || typeof d !== 'object') return;
      const m = d as { event?: string; data?: { seconds?: number; duration?: number }; info?: { currentTime?: number; duration?: number; playerState?: number } };
      if (source.provider === 'vimeo') {
        if (m.event === 'timeupdate' && m.data) report(m.data.seconds ?? 0, m.data.duration ?? 0);
        else if (m.event === 'pause') { flush(true); setPlaying(false); }
        else if (m.event === 'play') { setPlaying(true); setStarted(true); }
        else if (m.event === 'ended') { flush(true); setPlaying(false); }
      } else if (m.event === 'infoDelivery' && m.info) {
        if (typeof m.info.currentTime === 'number' && typeof m.info.duration === 'number') report(m.info.currentTime, m.info.duration);
        if (m.info.playerState === 1) { setPlaying(true); setStarted(true); } // playing
        if (m.info.playerState === 2 || m.info.playerState === 0) { flush(true); setPlaying(false); } // paused or ended
      }
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

  const onFrameLoad = () => {
    const w = frame.current?.contentWindow;
    if (!w) return;
    if (source.provider === 'vimeo') {
      for (const ev of ['timeupdate', 'pause', 'play', 'ended']) w.postMessage(JSON.stringify({ method: 'addEventListener', value: ev }), 'https://player.vimeo.com');
    } else if (source.provider === 'youtube') {
      postToYT(w, 'listening');
    }
  };

  const togglePlay = () => {
    const w = frame.current?.contentWindow;
    if (!w) return;
    if (source.provider === 'youtube') {
      // YT player command via postMessage
      const command = playing ? 'pauseVideo' : 'playVideo';
      w.postMessage(JSON.stringify({ event: 'command', func: command, args: [] }), 'https://www.youtube-nocookie.com');
    } else if (source.provider === 'vimeo') {
      const method = playing ? 'pause' : 'play';
      w.postMessage(JSON.stringify({ method }), 'https://player.vimeo.com');
    }
    nudgeControls();
  };

  const handleFullscreen = () => {
    const el = wrapRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
    nudgeControls();
  };

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
          style={{ cursor: isYouTube ? 'none' : undefined, position: 'relative' }}
          onMouseMove={isYouTube ? nudgeControls : undefined}
          onTouchStart={isYouTube ? nudgeControls : undefined}
        >
          {/* Show thumbnail until video starts */}
          {thumbnailUrl && !started && (
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

                {/* Fullscreen button */}
                <button
                  onClick={handleFullscreen}
                  aria-label="Fullscreen"
                  style={{
                    background: 'none', border: 'none', padding: 2, cursor: 'pointer',
                    color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}
                >
                  <Maximize size={18} />
                </button>
              </div>
            </div>
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
