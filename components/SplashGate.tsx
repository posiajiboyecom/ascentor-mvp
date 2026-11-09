'use client';
// SplashGate — instant splash on app open.
//
// Only runs on authenticated app pages (/(app)/*). Never fires on the public
// website (marketing pages, /login, /elevation-summit, etc.).
//
// Strategy:
//   • Root layout injects a small inline script + white cover div that fires
//     synchronously before first paint — but only when the URL is an app path.
//     This prevents any flash of the dashboard behind the splash.
//   • This component (rendered inside UserShell / (app) layout) handles the
//     actual animation after hydration, using the same 24h cookie.

import dynamic from 'next/dynamic';
import { useState, useEffect } from 'react';
import type { SplashTrigger } from './AscentorSplash';

const AscentorSplash = dynamic(() => import('./AscentorSplash'), { ssr: false });

const TRIGGER: SplashTrigger = 'signin';
export const SPLASH_COOKIE = 'as_splash'; // exported so root layout script can reference the same name

/** Read a client-side cookie by name */
function getCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined;
  return document.cookie.split('; ').find(r => r.startsWith(name + '='))?.split('=')[1];
}

/** Set a cookie that expires in `hours` hours */
function setCookie(name: string, value: string, hours: number) {
  const exp = new Date(Date.now() + hours * 3600 * 1000).toUTCString();
  document.cookie = `${name}=${value}; expires=${exp}; path=/; SameSite=Lax`;
}

export default function SplashGate() {
  const [showing, setShowing] = useState<boolean | null>(null);

  useEffect(() => {
    const seen = !!getCookie(SPLASH_COOKIE);
    setShowing(!seen);
  }, []);

  function handleDone() {
    setCookie(SPLASH_COOKIE, '1', 24);
    setShowing(false);
    // Remove the pre-paint cover injected by root layout
    const cover = document.getElementById('ascentor-splash-cover');
    if (cover) cover.style.display = 'none';
  }

  // Once we know the state, always remove the pre-paint cover
  useEffect(() => {
    if (showing === false) {
      const cover = document.getElementById('ascentor-splash-cover');
      if (cover) cover.style.display = 'none';
    }
  }, [showing]);

  if (showing !== true) return null;

  return <AscentorSplash trigger={TRIGGER} onDone={handleDone} />;
}
