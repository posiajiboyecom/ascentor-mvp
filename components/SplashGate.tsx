'use client';
// SplashGate — plays the Ascentor splash. Rendered once, in the root layout,
// so it covers every app page including /onboarding. The rules live in
// lib/splash.ts; in short: installed PWA on open and on return after 5+ min,
// and once after sign-up / sign-in in any browser. Never on the website.

import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { SplashTrigger } from './AscentorSplash';
import {
  SPLASH_AWAY_KEY, SPLASH_COVER_ID, SPLASH_COVER_MAX_MS, SPLASH_RETURN_MS,
  clearPendingSplash, hasPendingSplash, isAppPath, isStandalone,
} from '@/lib/splash';

const AscentorSplash = dynamic(() => import('./AscentorSplash'), { ssr: false });

declare global {
  interface Window { __asSplash?: string }
}

function setCover(visible: boolean) {
  const cover = document.getElementById(SPLASH_COVER_ID);
  if (cover) cover.style.display = visible ? '' : 'none';
}

export default function SplashGate() {
  const pathname = usePathname();
  const [trigger, setTrigger] = useState<SplashTrigger | null>(null);
  const [run, setRun] = useState(0);
  const playingRef = useRef(false);
  const safetyRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const done = useCallback(() => {
    if (safetyRef.current) clearTimeout(safetyRef.current);
    playingRef.current = false;
    setTrigger(null);
    setCover(false);
  }, []);

  const start = useCallback((kind: SplashTrigger) => {
    if (playingRef.current) return;
    playingRef.current = true;
    clearPendingSplash(); // a refresh mid-animation must not replay it
    setCover(true);
    setTrigger(kind);
    setRun((n) => n + 1);
    // Never let the cover outlive a splash that failed to load (e.g. offline).
    safetyRef.current = setTimeout(done, SPLASH_COVER_MAX_MS);
  }, [done]);

  // First load: follow the decision the pre-paint script already made.
  useEffect(() => {
    const decided = window.__asSplash;
    if (decided === 'signin' || decided === 'appopen') start(decided);
    else setCover(false);
    // The app is in the foreground now, so any earlier "went away" mark is stale.
    try { localStorage.removeItem(SPLASH_AWAY_KEY); } catch {}
  }, [start]);

  // Client-side navigation into the app straight after signing in.
  useEffect(() => {
    if (pathname && isAppPath(pathname) && hasPendingSplash()) start('signin');
  }, [pathname, start]);

  // Installed app: replay when it returns to the foreground after 5+ minutes.
  useEffect(() => {
    function onVisibility() {
      if (document.visibilityState === 'hidden') {
        try { localStorage.setItem(SPLASH_AWAY_KEY, String(Date.now())); } catch {}
        return;
      }
      let away = 0;
      try {
        away = Number(localStorage.getItem(SPLASH_AWAY_KEY)) || 0;
        localStorage.removeItem(SPLASH_AWAY_KEY);
      } catch {}
      if (away && Date.now() - away >= SPLASH_RETURN_MS && isStandalone() && isAppPath(window.location.pathname)) {
        start('appopen');
      }
    }
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [start]);

  if (!trigger) return null;
  return <AscentorSplash key={run} trigger={trigger} onDone={done} />;
}
