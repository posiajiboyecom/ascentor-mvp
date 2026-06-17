// hooks/useVoiceRecorder.ts
// ─────────────────────────────────────────────────────────────────────────────
// Telegram-style voice recording hook.
//
// Strategy (same as Telegram Web):
//   1. getUserMedia({ audio: true }) — minimal constraints, widest browser support
//   2. Pick best supported mime type via isTypeSupported() — iOS Safari needs
//      audio/mp4, Chrome/Firefox prefer audio/webm;codecs=opus
//   3. NO timeslice — rec.start() with no argument. One blob delivered at stop().
//      Timeslice with iOS Safari is unreliable and causes empty chunks.
//   4. Capture duration via a ref that is snapshotted BEFORE state resets.
//   5. Web Audio AnalyserNode on the SAME stream — never call getUserMedia twice.
//      iOS locks the microphone to the first requester.
//   6. Expose live waveform bar heights (0–1) for the animated visualizer.
//
// Upload is handled externally (passed in as onStop callback) so this hook
// works for both community and coach pages.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useRef, useCallback, useEffect } from 'react';

export interface VoiceRecorderResult {
  /** Whether recording is active */
  recording: boolean;
  /** Elapsed seconds (live, for display) */
  seconds: number;
  /** 12 bar heights 0–1 for live waveform visualizer */
  bars: number[];
  /** Start recording. Calls onStop(blob, mimeType, durationSec) when stopped with send=true */
  start: () => Promise<void>;
  /** Stop recording. pass send=false to discard */
  stop: (send?: boolean) => void;
  /** Permission error message if any */
  permError: string;
}

const NUM_BARS = 12;
const MAX_SECONDS = 59;

// Best mime type for this browser — checked once
function getBestMime(): string {
  const candidates = [
    'audio/webm;codecs=opus',   // Chrome, Firefox, Edge, modern Android
    'audio/webm',               // Chrome fallback
    'audio/ogg;codecs=opus',    // Firefox
    'audio/mp4',                // iOS Safari, macOS Safari
  ];
  for (const c of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(c)) {
      return c;
    }
  }
  return ''; // let browser decide
}

export function useVoiceRecorder(
  onStop: (blob: Blob, mimeType: string, durationSec: number) => Promise<void>
): VoiceRecorderResult {
  const [recording,  setRecording]  = useState(false);
  const [seconds,    setSeconds]    = useState(0);
  const [bars,       setBars]       = useState<number[]>(Array(NUM_BARS).fill(0.15));
  const [permError,  setPermError]  = useState('');

  const mediaRecRef   = useRef<MediaRecorder | null>(null);
  const streamRef     = useRef<MediaStream | null>(null);
  const chunksRef     = useRef<Blob[]>([]);
  const timerRef      = useRef<ReturnType<typeof setInterval> | null>(null);
  const rafRef        = useRef<number>(0);
  const analyserRef   = useRef<AnalyserNode | null>(null);
  const audioCtxRef   = useRef<AudioContext | null>(null);
  const secondsRef    = useRef(0);  // snapshot-safe ref
  const mimeRef       = useRef('');

  // ── Waveform animation loop ─────────────────────────────────────────────
  function startVisualizer(stream: MediaStream) {
    try {
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      analyser.smoothingTimeConstant = 0.7;
      src.connect(analyser);
      analyserRef.current = analyser;

      const buf = new Uint8Array(analyser.frequencyBinCount);

      function draw() {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(buf);
        // Map first NUM_BARS frequency bins to 0-1 heights
        const newBars = Array.from({ length: NUM_BARS }, (_, i) => {
          const val = buf[Math.floor(i * buf.length / NUM_BARS)] / 255;
          return Math.max(0.08, val); // minimum height so bars always show
        });
        setBars(newBars);
        rafRef.current = requestAnimationFrame(draw);
      }
      draw();
    } catch {
      // AudioContext might be blocked on some browsers — visualizer degrades gracefully
      setBars(Array(NUM_BARS).fill(0.5));
    }
  }

  function stopVisualizer() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (analyserRef.current) { analyserRef.current.disconnect(); analyserRef.current = null; }
    if (audioCtxRef.current) { audioCtxRef.current.close().catch(() => {}); audioCtxRef.current = null; }
    setBars(Array(NUM_BARS).fill(0.15));
  }

  // ── Core start ──────────────────────────────────────────────────────────
  const start = useCallback(async () => {
    if (recording) return;
    setPermError('');

    try {
      // Minimal constraints — maximum browser compatibility
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mime = getBestMime();
      mimeRef.current = mime;
      chunksRef.current = [];
      secondsRef.current = 0;

      const options: MediaRecorderOptions = mime ? { mimeType: mime } : {};
      const rec = new MediaRecorder(stream, options);
      mediaRecRef.current = rec;

      // Collect chunks — ondataavailable fires once at stop() since no timeslice
      rec.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };

      rec.onstop = async () => {
        // Stop microphone tracks
        stream.getTracks().forEach(t => t.stop());
        stopVisualizer();

        const duration = secondsRef.current; // captured ref, not stale state
        const actualMime = mimeRef.current || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type: actualMime });

        if (blob.size === 0) {
          console.error('[voice] Empty blob — nothing was recorded');
          return;
        }

        // Hand off to caller — they handle upload
        await onStop(blob, actualMime, duration);
      };

      // NO timeslice — one clean blob at stop()
      rec.start();

      // Start visualizer on the same stream
      startVisualizer(stream);

      setRecording(true);
      setSeconds(0);

      // Timer — updates display AND the safe ref
      timerRef.current = setInterval(() => {
        secondsRef.current += 1;
        setSeconds(secondsRef.current);
        if (secondsRef.current >= MAX_SECONDS) {
          // Auto-stop at 59s
          stop(true);
        }
      }, 1000);

    } catch (err: any) {
      const name = err?.name || '';
      const msg =
        name === 'NotAllowedError' ? 'Microphone permission denied. Please allow access in your browser settings.' :
        name === 'NotFoundError'   ? 'No microphone found on this device.' :
                                     'Could not start recording. Please try again.';
      setPermError(msg);
      console.error('[voice] getUserMedia failed:', err);
    }
  }, [recording]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Core stop ───────────────────────────────────────────────────────────
  const stop = useCallback((send = true) => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }

    const rec = mediaRecRef.current;
    if (rec && rec.state !== 'inactive') {
      if (!send) {
        // Discard — null handlers so onstop doesn't upload
        rec.ondataavailable = null;
        rec.onstop = null;
        streamRef.current?.getTracks().forEach(t => t.stop());
        stopVisualizer();
      }
      rec.stop();
    }

    mediaRecRef.current = null;
    setRecording(false);
    setSeconds(0);
    secondsRef.current = 0;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach(t => t.stop());
      audioCtxRef.current?.close().catch(() => {});
    };
  }, []);

  return { recording, seconds, bars, start, stop, permError };
}
