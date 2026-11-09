'use client';
// AscentorSplash — Gold Horizon splash screen.
// Shows on:
//   • app open (Capacitor mobile — works alongside the native SplashScreen plugin)
//   • sign-in complete   → <AscentorSplash trigger="signin" />
//   • onboarding complete → <AscentorSplash trigger="onboarding" />
//
// Duration: ~3 s. The animation runs entirely from bundled JS/CSS — no network
// calls — so it plays at full speed even on a slow connection.
// A hard MAX_MS cap forces exit if the app hasn't loaded in time.

import { useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';

export type SplashTrigger = 'signin' | 'onboarding' | 'appopen';

interface Props {
  /** Which event triggered this splash — stored in sessionStorage so it shows once per session. */
  trigger: SplashTrigger;
  /** Called when the animation finishes and the splash should be removed. */
  onDone: () => void;
}

const RUST  = '#b6502a';
const GOLD  = '#caa228';
const MAX_MS = 4000; // hard safety cap

export default function AscentorSplash({ trigger, onDone }: Props) {
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const logoRef    = useRef<HTMLDivElement>(null);
  const wordRef    = useRef<HTMLDivElement>(null);
  const tagRef     = useRef<HTMLDivElement>(null);
  const wrapRef    = useRef<HTMLDivElement>(null);
  const rafRef     = useRef<number | null>(null);
  const timersRef  = useRef<ReturnType<typeof setTimeout>[]>([]);
  const doneRef    = useRef(false);

  const finish = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    timersRef.current.forEach(clearTimeout);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    // Mark as seen so it doesn't repeat this session
    try { sessionStorage.setItem(`splash_${trigger}`, '1'); } catch {}
    onDone();
  }, [trigger, onDone]);

  const after = useCallback((fn: () => void, ms: number) => {
    timersRef.current.push(setTimeout(fn, ms));
  }, []);

  useEffect(() => {
    // Safety cap — always exit after MAX_MS
    const cap = setTimeout(finish, MAX_MS);
    timersRef.current.push(cap);

    const canvas = canvasRef.current;
    const logo   = logoRef.current;
    const wm     = wordRef.current;
    const tg     = tagRef.current;
    const wrap   = wrapRef.current;
    if (!canvas || !logo || !wm || !tg || !wrap) return;

    // ── Canvas particles ──────────────────────────────────────────────────
    const W = canvas.offsetWidth  || wrap.offsetWidth;
    const H = canvas.offsetHeight || wrap.offsetHeight;
    canvas.width  = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d')!;

    const cx = W / 2;
    const cy = H * 0.44;
    const N  = Math.min(70, Math.floor(W * H / 3200));

    const particles = Array.from({ length: N }, () => {
      const angle = Math.random() * Math.PI * 2;
      const dist  = 60 + Math.random() * Math.max(W, H) * 0.55;
      return {
        x:     cx + Math.cos(angle) * dist,
        y:     cy + Math.sin(angle) * dist,
        tx:    cx + (Math.random() - 0.5) * 20,
        ty:    cy + (Math.random() - 0.5) * 20,
        r:     1.2 + Math.random() * 2.2,
        col:   Math.random() < 0.72 ? RUST : GOLD,
        prog:  0,
        spd:   0.018 + Math.random() * 0.022,
        alpha: 0.5 + Math.random() * 0.5,
      };
    });

    const GATHER = 680;
    let startTs: number | null = null;

    function drawFrame(ts: number) {
      if (!startTs) startTs = ts;
      const elapsed = ts - startTs;
      ctx.clearRect(0, 0, W, H);

      for (const p of particles) {
        p.prog = Math.min(1, p.prog + p.spd);
        const ease = 1 - Math.pow(1 - p.prog, 3);
        const px = p.x + (p.tx - p.x) * ease;
        const py = p.y + (p.ty - p.y) * ease;
        const fade = elapsed < 300
          ? elapsed / 300
          : elapsed > GATHER ? 1 - (elapsed - GATHER) / 200 : 1;
        ctx.globalAlpha = p.alpha * Math.max(0, fade);
        ctx.fillStyle = p.col;
        ctx.beginPath();
        ctx.arc(px, py, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      if (elapsed < GATHER + 220) {
        rafRef.current = requestAnimationFrame(drawFrame);
      } else {
        ctx.clearRect(0, 0, W, H);
      }
    }
    rafRef.current = requestAnimationFrame(drawFrame);

    // ── Logo settles in ───────────────────────────────────────────────────
    after(() => {
      logo.style.transition = 'opacity 320ms ease, transform 380ms cubic-bezier(.2,0,.4,1)';
      logo.style.opacity    = '1';
      logo.style.transform  = 'scale(1)';
    }, 540);

    // ── Wordmark rises ────────────────────────────────────────────────────
    after(() => {
      wm.style.transition = 'opacity 300ms ease, transform 320ms cubic-bezier(.2,0,.4,1)';
      wm.style.opacity    = '1';
      wm.style.transform  = 'translateY(0)';
    }, 1050);

    // ── Tagline breathes in ───────────────────────────────────────────────
    after(() => {
      tg.style.transition = 'opacity 350ms ease';
      tg.style.opacity    = '1';
    }, 1480);

    // ── Fade out the whole splash ─────────────────────────────────────────
    after(() => {
      wrap.style.transition = 'opacity 420ms ease';
      wrap.style.opacity    = '0';
    }, 2900);

    // ── Done — remove after fade ──────────────────────────────────────────
    after(finish, 3340);

    return () => {
      timersRef.current.forEach(clearTimeout);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      ref={wrapRef}
      style={{
        position:        'fixed',
        inset:           0,
        zIndex:          9999,
        background:      '#FAFAF8',
        display:         'flex',
        flexDirection:   'column',
        alignItems:      'center',
        justifyContent:  'center',
        overflow:        'hidden',
      }}
    >
      {/* Particle layer */}
      <canvas
        ref={canvasRef}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
      />

      {/* Logo mark — transparent PNG, rust on white */}
      <div
        ref={logoRef}
        style={{
          position:  'relative',
          zIndex:    2,
          width:     'clamp(80px, 18vw, 130px)',
          height:    'clamp(80px, 18vw, 130px)',
          opacity:   0,
          transform: 'scale(1.14)',
        }}
      >
        <Image
          src="/ascentor-mark.png"
          alt="Ascentor"
          fill
          style={{ objectFit: 'contain' }}
          priority
        />
      </div>

      {/* Wordmark */}
      <div
        ref={wordRef}
        style={{
          position:    'relative',
          zIndex:      2,
          fontFamily:  "'Poppins', system-ui, sans-serif",
          fontSize:    'clamp(22px, 5vw, 36px)',
          fontWeight:  800,
          letterSpacing: '-0.04em',
          color:       '#0F0F0E',
          marginTop:   'clamp(14px, 3vw, 22px)',
          opacity:     0,
          transform:   'translateY(10px)',
        }}
      >
        ASCENTOR
      </div>

      {/* Tagline */}
      <div
        ref={tagRef}
        style={{
          position:      'relative',
          zIndex:        2,
          fontFamily:    "'Poppins', system-ui, sans-serif",
          fontSize:      'clamp(8px, 1.8vw, 11px)',
          fontWeight:    600,
          letterSpacing: '0.22em',
          color:         '#b6502a',
          textTransform: 'uppercase',
          marginTop:     '8px',
          opacity:       0,
        }}
      >
        The Tool For Your Rising
      </div>
    </div>
  );
}
