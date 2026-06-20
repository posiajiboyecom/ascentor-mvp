'use client';

// hooks/useVoiceRecorder.ts
// ─────────────────────────────────────────────────────────────────────────
// Voice message recording for The Circle. Telegram-style strategy, chosen
// after iOS Safari issues with the original approach:
//   - getUserMedia({ audio: true }) — minimal constraints, no fancy
//     echoCancellation/noiseSuppression options that some browsers choke on
//   - isTypeSupported() mime detection in cross-browser priority order —
//     iOS Safari ONLY supports audio/mp4, not webm/opus
//   - rec.start() with NO timeslice — one clean blob delivered onstop,
//     instead of rec.start(200) which delivered unreliable chunks on mobile
//   - secondsRef snapshotted before state resets — fixes a stale closure
//     bug where onstop read recSeconds as 0 because React batched the
//     state reset before the closure captured the real elapsed time
//   - a shared AnalyserNode on the same MediaStream for live waveform bars
//
// Upload goes through a server route (not directly from the client) to
// bypass storage RLS using the service role key — see
// app/api/community/voice-upload/route.ts.

import { useRef, useState, useCallback } from 'react';

const MIME_CANDIDATES = [
  'audio/mp4',                 // iOS Safari — must be checked first or it silently fails
  'audio/webm;codecs=opus',
  'audio/ogg;codecs=opus',
  'audio/webm',
];

function pickMimeType(): string {
  for (const mime of MIME_CANDIDATES) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(mime)) {
      return mime;
    }
  }
  return ''; // let the browser pick a default
}

export interface UseVoiceRecorderResult {
  isRecording: boolean;
  seconds: number;
  /** 0–1 amplitude levels, updated ~30x/sec while recording, for a live waveform. */
  levels: number[];
  start: () => Promise<void>;
  /** Stops recording. Pass false to discard instead of finalizing the blob. */
  stop: (finalize?: boolean) => void;
  error: string | null;
}

const MAX_SECONDS = 120;
const LEVEL_SAMPLE_COUNT = 24;

export function useVoiceRecorder(
  onRecordingComplete: (blob: Blob, durationSeconds: number) => void
): UseVoiceRecorderResult {
  const [isRecording, setIsRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [levels, setLevels] = useState<number[]>(Array(LEVEL_SAMPLE_COUNT).fill(0));
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const secondsRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);

  const cleanupAudioAnalysis = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    analyserRef.current = null;
  }, []);

  const tickLevels = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser) return;
    const data = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(data);

    const step = Math.floor(data.length / LEVEL_SAMPLE_COUNT) || 1;
    const next: number[] = [];
    for (let i = 0; i < LEVEL_SAMPLE_COUNT; i++) {
      next.push((data[i * step] ?? 0) / 255);
    }
    setLevels(next);
    rafRef.current = requestAnimationFrame(tickLevels);
  }, []);

  const stop = useCallback(
    (finalize = true) => {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;

      const recorder = mediaRecorderRef.current;
      if (recorder && recorder.state !== 'inactive') {
        if (!finalize) {
          // Discard: detach handlers so onstop doesn't fire the completion callback.
          recorder.ondataavailable = null;
          recorder.onstop = null;
        }
        recorder.stop();
      }

      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      cleanupAudioAnalysis();
      setIsRecording(false);
      setSeconds(0);
      setLevels(Array(LEVEL_SAMPLE_COUNT).fill(0));
    },
    [cleanupAudioAnalysis]
  );

  const start = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = pickMimeType();
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      chunksRef.current = [];
      secondsRef.current = 0;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        // secondsRef is read here, not the `seconds` state — avoids the
        // stale-closure bug where React had already reset `seconds` to 0
        // by the time this fires.
        const finalSeconds = secondsRef.current;
        const blob = new Blob(chunksRef.current, {
          type: mimeType || 'audio/webm',
        });
        if (blob.size > 0) {
          onRecordingComplete(blob, finalSeconds);
        }
      };

      // No timeslice argument — one clean blob delivered at stop(),
      // instead of unreliable periodic chunks on mobile browsers.
      recorder.start();
      mediaRecorderRef.current = recorder;

      setIsRecording(true);
      timerRef.current = setInterval(() => {
        secondsRef.current += 1;
        setSeconds(secondsRef.current);
        if (secondsRef.current >= MAX_SECONDS) {
          stop(true);
        }
      }, 1000);

      // Shared AnalyserNode on the same stream for live waveform bars.
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        const audioCtx = new AudioCtx();
        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        audioCtxRef.current = audioCtx;
        analyserRef.current = analyser;
        rafRef.current = requestAnimationFrame(tickLevels);
      } catch {
        // Waveform is cosmetic — recording still works without it.
      }
    } catch {
      setError('Please allow microphone access to send voice messages.');
    }
  }, [onRecordingComplete, stop, tickLevels]);

  return { isRecording, seconds, levels, start, stop, error };
}

export function formatRecordingTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}
