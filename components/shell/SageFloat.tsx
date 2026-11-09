'use client';

// Sage: the floating AI coach, docked to the edge of the screen.
//
// A cream rectangular tab with the Sage monogram, on the right edge (the left edge is also allowed on phones), in the upper-middle of the screen. It can be
// dragged up and down, and on phones snaps to the nearest edge. It is clamped so it can never sit on the top bar, the mobile menu
// button or the bottom tab bar, it hides while a menu, sheet or modal is open and while the on-screen keyboard is up, and its
// position is remembered per device. Arrow keys move it for people who cannot drag. Hold it down, or use the small x, to hide it
// for the rest of the session.
//
// Pressing the tab opens the Sage panel in "open" mode, where Sage introduces itself (see SagePanel). There is no pop-up
// greeting on the page itself: it was too much visually, so the introduction lives inside Sage.
// Hidden on /coach, where the full conversation already lives.

import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { openSage } from '@/components/rx/sage-bus';

const POS_KEY = 'sage:tab:v1';
const HIDDEN_KEY = 'sage:tab-hidden';
const TAB_H = 116; // keep in step with .sage-tab height in styles/shell.css
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

export default function SageFloat() {
  const pathname = usePathname();
  const orbRef = useRef<HTMLSpanElement>(null);

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
  const hideForSession = () => { setTabHidden(true); try { sessionStorage.setItem(HIDDEN_KEY, '1'); } catch { /* ignore */ } };

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

  if (onCoach || tabHidden) return null;

  const onTabClick = () => {
    if (suppressClick.current || longPressed.current) { longPressed.current = false; return; }
    // Ripple the monogram then open the panel after the animation peaks (~220 ms)
    if (orbRef.current) {
      orbRef.current.classList.remove('sage-tapped');
      void orbRef.current.offsetWidth; // force reflow so re-adding the class restarts the animation
      orbRef.current.classList.add('sage-tapped');
    }
    setTimeout(() => openSage({ topic: 'open' }), 220);
  };

  // On phones the tab lives on Today and Learn only; on desktop Sage is also in the top bar.
  const mobileAllowed = pathname === '/dashboard' || !!pathname?.startsWith('/learn');
  // Screens with a message box at the bottom: stay out of the way of the conversation.
  const hasComposer = !!pathname && (pathname.startsWith('/circle/chat') || pathname.startsWith('/messages') || pathname.startsWith('/community/groups/') || pathname.startsWith('/call'));
  return (
    <div
      className={`sage-root sage-edge-${side}${mobileAllowed ? '' : ' sage-mobile-hide'}${hasComposer ? ' sage-hide' : ''}${ratio > 0.5 ? ' sage-low' : ''}${dragging ? ' sage-dragging' : ''}`}
      style={top === null ? { visibility: 'hidden' } : { top }}
    >
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
        aria-label="Open Sage. Drag, or use the up and down arrow keys, to move this tab."
      >
        {/* Cream pill: rust monogram — vertical label — green dot */}
        <span className="sage-tab-orb" ref={orbRef} aria-hidden="true">
          <span className="sage-tab-core">S</span>
          {/* keep these hidden spans so CSS selectors that reference them don't error */}
          <span className="sage-tab-ring" aria-hidden="true" />
          <svg className="sage-tab-spark" aria-hidden="true" viewBox="0 0 1 1" />
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
