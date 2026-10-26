'use client';

// The lesson video player. Plays Vimeo, YouTube or a direct file, reports how far the member got (so they can resume
// and be reminded to finish), and never needs a player library: Vimeo and YouTube are driven over postMessage.

import { useCallback, useEffect, useRef, useState } from 'react';
import { saveWatchProgress } from '@/app/(app)/learn/lesson/actions';
import type { VideoSource } from '@/lib/rx/video';
import VideoPlayer from './VideoPlayer';

interface Props {
  lessonId: string;
  title: string;
  source: VideoSource;
  startSec: number;
  startPercent: number;
}

const SAVE_EVERY_MS = 15_000;

export default function LessonVideo({ lessonId, title, source, startSec, startPercent }: Props) {
  const frame = useRef<HTMLIFrameElement>(null);
  const fileRef = useRef<HTMLVideoElement>(null);
  const latest = useRef({ pos: startSec, dur: 0, pct: startPercent });
  const lastSent = useRef({ at: 0, pct: startPercent });
  const [pct, setPct] = useState(startPercent);
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
        else if (m.event === 'pause' || m.event === 'ended') flush(true);
      } else if (m.event === 'infoDelivery' && m.info) {
        if (typeof m.info.currentTime === 'number' && typeof m.info.duration === 'number') report(m.info.currentTime, m.info.duration);
        if (m.info.playerState === 2 || m.info.playerState === 0) flush(true);
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
      for (const ev of ['timeupdate', 'pause', 'ended']) w.postMessage(JSON.stringify({ method: 'addEventListener', value: ev }), 'https://player.vimeo.com');
    } else if (source.provider === 'youtube') {
      w.postMessage(JSON.stringify({ event: 'listening', id: 1, channel: 'widget' }), 'https://www.youtube-nocookie.com');
    }
  };

  return (
    <div className="rx-stack-sm">
      {source.provider === 'file' ? (
        <video
          ref={fileRef} className="rx-video rx-rise" src={source.url} title={title} controls preload="metadata" style={{ width: '100%' }}
          onLoadedMetadata={(e) => { if (startSec > 5 && startPercent < 95) e.currentTarget.currentTime = startSec; }}
          onTimeUpdate={(e) => report(e.currentTarget.currentTime, e.currentTarget.duration)}
          onPause={() => flush(true)} onEnded={() => flush(true)}
        />
      ) : (
        <VideoPlayer
          {...source} title={title} className="rx-rise" frameRef={frame} onFrameLoad={onFrameLoad}
          startSec={startPercent < 95 ? startSec : 0}
        />
      )}
      {pct > 0 && (
        <div className="rx-row rx-nw" style={{ gap: 10 }} aria-live="polite">
          <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'var(--rx-border)', overflow: 'hidden' }} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="Video progress">
            <div style={{ width: `${pct}%`, height: '100%', background: 'var(--rx-gold)' }} />
          </div>
          <span className="rx-sm">{pct >= 95 ? 'Watched' : `${pct}% watched`}</span>
        </div>
      )}
    </div>
  );
}
