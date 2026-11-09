'use client';
// SplashGate — instant splash on app open.
//
// Strategy: render the splash container immediately in the DOM (white bg, z-9999)
// and check sessionStorage synchronously via an inline script tag. If the splash
// has already played this session the container is hidden via CSS before paint —
// zero flash. If it hasn't played yet, the animation runs, then the container
// fades out and is removed.
//
// Placed in the ROOT layout (app/layout.tsx) so it renders before any server
// data fetching — the user sees the splash immediately on app open.

import dynamic from 'next/dynamic';
import { useState, useEffect } from 'react';
import type { SplashTrigger } from './AscentorSplash';

const AscentorSplash = dynamic(() => import('./AscentorSplash'), { ssr: false });

const TRIGGER: SplashTrigger = 'signin';
const COOKIE = 'as_splash'; // 24h cookie — survives new tabs unlike sessionStorage

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

export default function SplashGate({ children }: { children?: React.ReactNode }) {
  const [showing, setShowing] = useState<boolean | null>(null);

  useEffect(() => {
    // Cookie check after hydration (document only available client-side)
    const seen = !!getCookie(COOKIE);
    setShowing(!seen);
  }, []);

  function handleDone() {
    // Mark as seen for 24 hours — works across all tabs in the same browser
    setCookie(COOKIE, '1', 24);
    setShowing(false);
  }

  return (
    <>
      {/* Instant white cover — visible before JS runs, hidden by inline script if already seen */}
      <div
        id="ascentor-splash-cover"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          background: '#FAFAF8',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none',
        }}
      />

      {/* Inline script: synchronously checks the cookie before first paint */}
      {/* eslint-disable-next-line @next/next/no-sync-scripts */}
      <script
        dangerouslySetInnerHTML={{
          __html: `(function(){try{if(document.cookie.indexOf(${JSON.stringify(COOKIE + '=')})>-1){var el=document.getElementById('ascentor-splash-cover');if(el)el.style.display='none';}}catch(e){}})();`,
        }}
      />

      {/* After hydration: show the full animated splash or nothing */}
      {showing === true && (
        <AscentorSplash
          trigger={TRIGGER}
          onDone={handleDone}
        />
      )}

      {/* Hide the plain white cover once we know the state */}
      {showing === false && (
        <style>{`#ascentor-splash-cover { display: none !important; }`}</style>
      )}

      {children}
    </>
  );
}
