'use client';

// Sage: the floating AI coach, docked to the edge of the screen.
//
// An ink capsule tab with the gold Sage mark, on the right edge (the left edge is also allowed on phones), in the upper-middle of the screen. It can be
// dragged up and down, and on phones snaps to the nearest edge. It is clamped so it can never sit on the top bar, the mobile menu
// button or the bottom tab bar, it hides while a menu, sheet or modal is open and while the on-screen keyboard is up, and its
// position is remembered per device. Arrow keys move it for people who cannot drag. Hold it down, or use the small x, to hide it
// for the rest of the session.
//
// Greeting: once per login session Sage "wakes up": a chime plays, a typing indicator appears, and Sage types out a short
// personalised message (time-of-day aware) with a shortcut into a coaching session. Pressing the tab reopens Sage.
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

import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRight, EyeOff, Volume2, VolumeX, X } from 'lucide-react';
import { openSage } from '@/components/rx/sage-bus';

const GREETED_KEY = 'sage:greeted';
const MUTED_KEY = 'sage:muted';
const POS_KEY = 'sage:tab:v1';
const HIDDEN_KEY = 'sage:tab-hidden';
const TAB_H = 64;
const GAP = 12;

type Side = 'left' | 'right';

/** The vertical range the tab may occupy: below the top bar, above the bottom tab bar. Measured, so it follows the real layout. */
function tabBounds(): { min: number; max: number } {
  const vh = window.innerHeight;
  const header = document.querySelector('.sh-header');
  const nav = document.querySelector('nav[aria-label="Main"]');
  const navTop = nav && getComputedStyle(nav).display !== 'none' ? nav.getBoundingClientRect().top : vh;
  const min = Math.max(0, header ? header.getBoundingClientRect().bottom : 0) + GAP;
  const max = Math.max(min, navTop - GAP - TAB_H);
  return { min, max };
}

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

const STATIC_MESSAGE = "I'm Sage. Bring me a challenge, a conversation to prepare for, or your weekly reflection.";

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

  // ── edge tab: position, drag, hide rules ───────────────────────────────────
  const [side, setSide] = useState<Side>('right');
  const [ratio, setRatio] = useState(0.3); // 0 = highest allowed spot, 1 = lowest
  const [top, setTop] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const [tabHidden, setTabHidden] = useState(false);
  const drag = useRef<{ y: number; top: number; moved: boolean } | null>(null);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressed = useRef(false);
  const suppressClick = useRef(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(POS_KEY);
      if (raw) {
        const p = JSON.parse(raw);
        if (p && (p.side === 'left' || p.side === 'right') && typeof p.ratio === 'number') { setSide(p.side); setRatio(Math.min(1, Math.max(0, p.ratio))); }
      }
    } catch { /* storage unavailable or damaged: keep the default */ }
    try { if (sessionStorage.getItem(HIDDEN_KEY) === '1') setTabHidden(true); } catch { /* ignore */ }
  }, []);

  const place = useCallback(() => {
    const { min, max } = tabBounds();
    setTop(Math.round(min + ratio * (max - min)));
  }, [ratio]);

  useEffect(() => {
    place();
    const on = () => place();
    window.addEventListener('resize', on);
    window.addEventListener('orientationchange', on);
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(on) : null;
    const header = document.querySelector('.sh-header');
    const nav = document.querySelector('nav[aria-label="Main"]');
    if (ro && header) ro.observe(header);
    if (ro && nav) ro.observe(nav);
    return () => { window.removeEventListener('resize', on); window.removeEventListener('orientationchange', on); ro?.disconnect(); };
  }, [place, pathname]);

  // On-screen keyboard: the visual viewport shrinks a lot. Step aside until it is gone.
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const check = () => {
      if (vv.height < window.innerHeight * 0.75) document.documentElement.setAttribute('data-sage-kb', '');
      else document.documentElement.removeAttribute('data-sage-kb');
    };
    vv.addEventListener('resize', check);
    return () => { vv.removeEventListener('resize', check); document.documentElement.removeAttribute('data-sage-kb'); };
  }, []);

  const savePos = (sd: Side, r: number) => { try { localStorage.setItem(POS_KEY, JSON.stringify({ side: sd, ratio: Number(r.toFixed(4)) })); } catch { /* ignore */ } };
  const hideForSession = () => { setTabHidden(true); setPhase('closed'); try { sessionStorage.setItem(HIDDEN_KEY, '1'); } catch { /* ignore */ } };

  const onPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.button !== undefined && e.button !== 0) return;
    drag.current = { y: e.clientY, top: top ?? 0, moved: false };
    longPressed.current = false;
    if (pressTimer.current) clearTimeout(pressTimer.current);
    pressTimer.current = setTimeout(() => { if (drag.current && !drag.current.moved) { longPressed.current = true; hideForSession(); } }, 900);
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* ignore */ }
  };
  const onPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const d = drag.current; if (!d) return;
    const dy = e.clientY - d.y;
    if (!d.moved && Math.abs(dy) < 6) return;
    d.moved = true; setDragging(true);
    if (pressTimer.current) { clearTimeout(pressTimer.current); pressTimer.current = null; }
    const { min, max } = tabBounds();
    setTop(Math.min(max, Math.max(min, d.top + dy)));
    // phones only: dragging across the middle switches edge (on desktop the left edge is the sidebar)
    if (window.innerWidth < 1024) { const next: Side = e.clientX < window.innerWidth / 2 ? 'left' : 'right'; if (next !== side) setSide(next); }
  };
  const onPointerUp = () => {
    if (pressTimer.current) { clearTimeout(pressTimer.current); pressTimer.current = null; }
    const d = drag.current; drag.current = null;
    if (d?.moved) {
      const { min, max } = tabBounds();
      const r = max > min ? Math.min(1, Math.max(0, ((top ?? min) - min) / (max - min))) : 0;
      setRatio(r); savePos(side, r);
      suppressClick.current = true; setTimeout(() => { suppressClick.current = false; }, 0); // swallow the click that follows a drag
    }
    setDragging(false);
  };
  const onTabKey = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    e.preventDefault();
    const { min, max } = tabBounds();
    const nxt = Math.min(max, Math.max(min, (top ?? min) + (e.key === 'ArrowUp' ? -24 : 24)));
    const r = max > min ? (nxt - min) / (max - min) : 0;
    setTop(nxt); setRatio(r); savePos(side, r);
  };

  const onCoach = pathname === '/coach' || pathname?.startsWith('/coach/');

  // On desktop the page leaves a gutter on the right while the tab is shown, so the tab never sits on page content.
  useEffect(() => {
    const html = document.documentElement;
    if (onCoach || tabHidden || side !== 'right') html.removeAttribute('data-sage-tab'); else html.setAttribute('data-sage-tab', '');
    return () => html.removeAttribute('data-sage-tab');
  }, [onCoach, tabHidden, side]);

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

  // ── typewriter ───────────────────────────────────────────────────────────
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

  if (onCoach || tabHidden) return null;

  const open = phase !== 'closed';
  const text = phase === 'static' ? STATIC_MESSAGE : message.slice(0, shown);

  const onTabClick = () => {
    if (suppressClick.current || longPressed.current) { longPressed.current = false; return; }
    if (open) { close(); return; }
    openSage({ topic: 'plan' });
  };

  // On phones the tab lives on Today and Learn only; on desktop Sage is also in the top bar.
  const mobileAllowed = pathname === '/dashboard' || !!pathname?.startsWith('/learn');
  // Screens with a message box at the bottom: stay out of the way of the conversation.
  const hasComposer = !!pathname && (pathname.startsWith('/circle/chat') || pathname.startsWith('/messages') || pathname.startsWith('/community/groups/') || pathname.startsWith('/call'));
  return (
    <div
      className={`sage-root sage-edge-${side}${mobileAllowed ? '' : ' sage-mobile-hide'}${hasComposer ? ' sage-hide' : ''}${ratio > 0.5 ? ' sage-low' : ''}${dragging ? ' sage-dragging' : ''}${open ? ' sage-open' : ''}`}
      style={top === null ? { visibility: 'hidden' } : { top }}
    >
      {open && (
        <div
          className="sage-bubble"
          role="dialog"
          aria-label="Sage"
          onMouseEnter={() => { hovering.current = true; clearDismiss(); }}
          onMouseLeave={() => { hovering.current = false; if (phase === 'done') armDismiss(); }}
          onFocus={() => { hovering.current = true; clearDismiss(); }}
          onBlur={() => { hovering.current = false; if (phase === 'done') armDismiss(); }}
        >
          <div className="sage-head">
            <span className="sage-head-dot" aria-hidden="true" />
            Sage
            <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: 2 }}>
              <button type="button" className="sage-icon-btn" onClick={hideForSession} aria-label="Hide the Sage tab for this session">
                <EyeOff />
              </button>
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
        className="sage-tab"
        data-sage-float=""
        onClick={onTabClick}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={onTabKey}
        aria-label={open ? 'Close Sage' : 'Open Sage. Drag, or use the up and down arrow keys, to move this tab.'}
        aria-expanded={open}
      >
        <span className="sage-tab-orb" aria-hidden="true">
          <span className="sage-tab-ring" />
          <span className="sage-tab-core"><b>S</b></span>
          <svg className="sage-tab-spark" viewBox="0 0 24 24"><path d="M12 1.5c.7 5.6 4.9 9.8 10.5 10.5-5.6.7-9.8 4.9-10.5 10.5C11.3 16.9 7.1 12.7 1.5 12 7.1 11.3 11.3 7.1 12 1.5Z" /></svg>
        </span>
        <span className="sage-tab-label" aria-hidden="true">Ask Sage</span>
        <span className="sage-tab-live" aria-hidden="true" />
      </button>
      <button type="button" className="sage-tab-x" onClick={hideForSession} aria-label="Hide the Sage tab for this session">
        <X aria-hidden="true" />
      </button>
    </div>
  );
}
