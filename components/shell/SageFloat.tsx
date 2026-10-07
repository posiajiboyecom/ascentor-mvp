'use client';

// Sage: the floating AI coach.
//
// A small animated orb pinned to the corner of the member app. Once per login
// session it "wakes up": a chime plays, a typing indicator appears, and Sage
// types out a short personalised message (time-of-day aware) with a shortcut
// into a coaching session. Clicking the orb any time reopens the panel.
//
// Behaviour notes
// - "Once per login" = once per browser session; signing out clears the flag
//   (see clearSageGreeting) so the next login greets again.
// - Sound is a short synthesised chime (Web Audio, no asset) at low volume.
//   Browsers block audio until the user has interacted with the site; if that
//   is the case the chime is armed for the first click/keypress in the next
//   10 seconds instead of being lost or throwing.
// - The greeting can be muted from the panel (remembered in localStorage).
// - Respects prefers-reduced-motion (no typewriter, no pulse).
// - Hidden on /coach, where the full conversation already lives.

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRight, Volume2, VolumeX, X } from 'lucide-react';
import { openSage } from '@/components/rx/sage-bus';

const GREETED_KEY = 'sage:greeted';
const MUTED_KEY = 'sage:muted';

/** Call on sign-out so the next login gets a fresh greeting. */
export function clearSageGreeting(): void {
  try { sessionStorage.removeItem(GREETED_KEY); } catch { /* storage unavailable */ }
}

function greetingFor(firstName: string): string {
  const h = new Date().getHours();
  if (h < 12) return `Good morning, ${firstName}. I'm Sage. Want to set your focus for today?`;
  if (h < 17) return `Good afternoon, ${firstName}. Got a decision or a tough conversation coming up? I can help you prepare.`;
  return `Good evening, ${firstName}. Let's take two minutes to reflect on your day.`;
}

const STATIC_MESSAGE = "I'm Sage, your AI coach. Bring me a challenge, a conversation to prepare for, or your weekly reflection.";

/** Plays a soft three-note chime. Returns false if the browser blocked audio. */
async function playChime(): Promise<boolean> {
  try {
    const ua = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation;
    if (ua && !ua.hasBeenActive) return false; // would be blocked; caller arms a fallback

    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return false;
    const ctx = new AC();
    if (ctx.state === 'suspended') await ctx.resume().catch(() => undefined);
    if (ctx.state !== 'running') { void ctx.close(); return false; }

    const start = ctx.currentTime + 0.02;
    const notes: [number, number][] = [[659.25, 0], [880, 0.13], [1318.5, 0.28]]; // E5, A5, E6
    for (const [freq, offset] of notes) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const t = start + offset;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.055, t + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.65);
    }
    setTimeout(() => { void ctx.close(); }, 1600);
    return true;
  } catch {
    return false;
  }
}

type Phase = 'closed' | 'thinking' | 'typing' | 'done' | 'static';

export default function SageFloat({ userName }: { userName: string }) {
  const pathname = usePathname();
  const firstName = userName.trim().split(/\s+/)[0] || 'there';

  const [phase, setPhase] = useState<Phase>('closed');
  const [message, setMessage] = useState('');
  const [shown, setShown] = useState(0);
  const [muted, setMuted] = useState(false);
  const mutedRef = useRef(false);
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hovering = useRef(false);

  const onCoach = pathname === '/coach' || pathname?.startsWith('/coach/');

  const clearDismiss = () => {
    if (dismissTimer.current) { clearTimeout(dismissTimer.current); dismissTimer.current = null; }
  };

  const close = useCallback(() => {
    clearDismiss();
    setPhase('closed');
  }, []);

  // Restore mute preference.
  useEffect(() => {
    try {
      const m = localStorage.getItem(MUTED_KEY) === '1';
      setMuted(m);
      mutedRef.current = m;
    } catch { /* ignore */ }
  }, []);

  const toggleMute = () => {
    setMuted(prev => {
      const next = !prev;
      mutedRef.current = next;
      try { localStorage.setItem(MUTED_KEY, next ? '1' : '0'); } catch { /* ignore */ }
      return next;
    });
  };

  // Chime with a one-shot fallback for browsers that need a user gesture first.
  const chime = useCallback(async () => {
    if (mutedRef.current) return;
    if (await playChime()) return;
    const arm = async () => {
      window.removeEventListener('pointerdown', arm);
      window.removeEventListener('keydown', arm);
      if (!mutedRef.current) await playChime();
    };
    window.addEventListener('pointerdown', arm, { once: true });
    window.addEventListener('keydown', arm, { once: true });
    setTimeout(() => {
      window.removeEventListener('pointerdown', arm);
      window.removeEventListener('keydown', arm);
    }, 10_000);
  }, []);

  // ── the login greeting (once per session) ─────────────────────────────────
  useEffect(() => {
    if (onCoach) return;
    let already = false;
    try { already = sessionStorage.getItem(GREETED_KEY) === '1'; } catch { /* ignore */ }
    if (already) return;

    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const text = greetingFor(firstName);

    timers.push(setTimeout(() => {
      try { sessionStorage.setItem(GREETED_KEY, '1'); } catch { /* ignore */ }
      setMessage(text);
      setShown(0);
      setPhase('thinking');
      void chime();
      timers.push(setTimeout(() => {
        if (reduce) { setShown(text.length); setPhase('done'); } else { setPhase('typing'); }
      }, 950));
    }, 1500));

    return () => timers.forEach(clearTimeout);
  }, [firstName, onCoach, chime]);

  // ── typewriter ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'typing') return;
    const id = setInterval(() => {
      setShown(n => {
        if (n + 1 >= message.length) { clearInterval(id); setPhase('done'); return message.length; }
        return n + 1;
      });
    }, 22);
    return () => clearInterval(id);
  }, [phase, message]);

  // ── auto-dismiss (paused while hovered / focused) ─────────────────────────
  const armDismiss = useCallback(() => {
    clearDismiss();
    dismissTimer.current = setTimeout(() => { if (!hovering.current) setPhase('closed'); }, 14_000);
  }, []);

  useEffect(() => {
    if (phase === 'done') armDismiss();
    return clearDismiss;
  }, [phase, armDismiss]);

  // Leaving for the coach page (or pressing Escape) closes the panel.
  useEffect(() => { if (onCoach) setPhase('closed'); }, [onCoach]);
  useEffect(() => {
    if (phase === 'closed') return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, close]);

  if (onCoach) return null;

  const open = phase !== 'closed';
  const text = phase === 'static' ? STATIC_MESSAGE : message.slice(0, shown);

  const onOrbClick = () => {
    if (open) { close(); return; }
    openSage({ topic: 'plan' });
  };

  return (
    <div className="sage-root">
      {open && (
        <div
          className="sage-bubble"
          role="dialog"
          aria-label="Sage, your AI coach"
          onMouseEnter={() => { hovering.current = true; clearDismiss(); }}
          onMouseLeave={() => { hovering.current = false; if (phase === 'done') armDismiss(); }}
          onFocus={() => { hovering.current = true; clearDismiss(); }}
          onBlur={() => { hovering.current = false; if (phase === 'done') armDismiss(); }}
        >
          <div className="sage-head">
            <span className="sage-head-dot" aria-hidden="true" />
            Sage
            <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: 2 }}>
              <button
                type="button" className="sage-icon-btn" onClick={toggleMute}
                aria-label={muted ? 'Turn Sage sound on' : 'Mute Sage sound'} aria-pressed={muted}
              >
                {muted ? <VolumeX /> : <Volume2 />}
              </button>
              <button type="button" className="sage-icon-btn" onClick={close} aria-label="Close Sage">
                <X />
              </button>
            </span>
          </div>

          <div className="sage-text" role="status" aria-live="polite">
            {phase === 'thinking' ? (
              <span className="sage-typing" aria-label="Sage is typing"><i /><i /><i /></span>
            ) : (
              <>
                {text}
                {phase === 'typing' && <span className="sage-caret" aria-hidden="true" />}
              </>
            )}
          </div>

          {(phase === 'done' || phase === 'static') && (
            <div className="sage-actions">
              <button type="button" className="sage-cta" onClick={() => { close(); openSage({ topic: 'plan' }); }}>
                Talk to Sage <ArrowRight aria-hidden="true" />
              </button>
              <button type="button" className="sage-ghost" onClick={close}>Later</button>
            </div>
          )}
        </div>
      )}

      <button
        type="button"
        className="sage-orb"
        onClick={onOrbClick}
        aria-label={open ? 'Close Sage' : 'Open Sage, your AI coach'}
        aria-expanded={open}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="sage-orb-mark" src="/ascentor-LM-gold.svg" alt="" />
        <span className="sage-status" aria-hidden="true" />
      </button>
    </div>
  );
}
