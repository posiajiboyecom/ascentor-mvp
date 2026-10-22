'use client';

import { useEffect, useState } from 'react';
import { SUMMIT_DATE_LABEL, SUMMIT_START_INSTANT } from '@/lib/elevationSummit';

const START = SUMMIT_START_INSTANT.getTime(); // 10:00 WAT (Africa/Lagos, UTC+1) on the event day
const LIVE_WINDOW = 12 * 60 * 60 * 1000; // treat the first 12 hours after the start as "live"
const VENUE = 'Aderemi Makanjuola Hall, Lagos State University, Ojo, Lagos';

type Left = { d: number; h: number; m: number; s: number } | null;
function split(ms: number): Left {
  const t = Math.floor(ms / 1000);
  return { d: Math.floor(t / 86400), h: Math.floor((t % 86400) / 3600), m: Math.floor((t % 3600) / 60), s: t % 60 };
}
const pad = (n: number) => String(n).padStart(2, '0');
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;

export default function RegisterCta() {
  // null until mounted, so server and first client render match
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const diff = now === null ? null : START - now;
  const left: Left = diff !== null && diff > 0 ? split(diff) : null;
  const live = diff !== null && diff <= 0 && -diff < LIVE_WINDOW;
  const over = diff !== null && diff <= 0 && !live;

  // Screen readers get minute-level updates only (this text does not contain seconds).
  const spoken = left
    ? `${plural(left.d, 'day')}, ${plural(left.h, 'hour')} and ${plural(left.m, 'minute')} until The Elevation Summit`
    : live ? 'The Elevation Summit is live now' : over ? 'The Elevation Summit has taken place' : 'Counting down to The Elevation Summit';
  const label = left ? `${spoken}, ${plural(left.s, 'second')}` : spoken;

  const cells: [string, string][] = left
    ? [[pad(left.d), 'Days'], [pad(left.h), 'Hours'], [pad(left.m), 'Minutes'], [pad(left.s), 'Seconds']]
    : [['--', 'Days'], ['--', 'Hours'], ['--', 'Minutes'], ['--', 'Seconds']];

  return (
    <section aria-labelledby="at-cta-h" style={{ background: '#080808', color: '#fff', padding: 'clamp(3rem, 7vw, 5rem) 1.25rem' }}>
      <style>{`
        .rc-wrap{max-width:860px;margin:0 auto;text-align:center}
        .rc-cells{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;max-width:520px;margin:28px auto 0}
        .rc-cell{border:1px solid rgba(202,162,40,.45);border-radius:12px;padding:14px 4px 10px;background:rgba(255,255,255,.04)}
        .rc-num{display:block;font-size:clamp(1.6rem,7vw,2.5rem);font-weight:800;line-height:1.1;font-variant-numeric:tabular-nums}
        .rc-lab{display:block;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#bdb6a8;margin-top:4px}
        .rc-btn{display:inline-flex;align-items:center;justify-content:center;min-height:52px;padding:0 28px;border-radius:12px;background:#B6502A;color:#fff;font-weight:700;font-size:16px;text-decoration:none}
        .rc-btn:hover{background:#c8623a}
        .rc-btn:focus-visible{outline:3px solid #CAA228;outline-offset:3px}
        .sr-only-rc{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
      `}</style>
      <div className="rc-wrap">
        <p style={{ margin: 0, fontSize: 13, fontWeight: 700, letterSpacing: '.18em', color: '#CAA228' }}>THE ELEVATION SUMMIT 2026</p>
        <h2 id="at-cta-h" style={{ fontSize: 'clamp(1.75rem, 5vw, 2.75rem)', fontWeight: 800, lineHeight: 1.1, margin: '12px 0 12px' }}>Not registered yet? Secure your seat</h2>
        <p style={{ margin: '0 auto', maxWidth: 560, color: '#d8d3ca', fontSize: 17, lineHeight: 1.6 }}>
          {SUMMIT_DATE_LABEL} at 10:00am WAT<br />{VENUE}, and online.
        </p>

        <div role="group" aria-label={label} className="rc-cells">
          {cells.map(([n, l]) => (
            <div key={l} className="rc-cell" aria-hidden="true">
              <span className="rc-num" data-testid={`rc-${l.toLowerCase()}`}>{n}</span>
              <span className="rc-lab">{l}</span>
            </div>
          ))}
        </div>
        <p role="status" aria-live="polite" className="sr-only-rc" data-testid="rc-spoken">{spoken}</p>
        {(live || over) && (
          <p style={{ margin: '20px 0 0', fontSize: 18, fontWeight: 700, color: '#CAA228' }}>
            {live ? 'The Summit is live right now.' : 'The Summit has taken place. Thank you for rising with us.'}
          </p>
        )}

        <p style={{ margin: '28px 0 0' }}>
          <a href="/elevation-summit#register" className="rc-btn">Register for the Summit</a>
        </p>
      </div>
    </section>
  );
}
