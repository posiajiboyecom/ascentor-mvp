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
const KEY = `splash_${TRIGGER}`;

export default function SplashGate({ children }: { children?: React.ReactNode }) {
  const [showing, setShowing] = useState<boolean | null>(null);

  useEffect(() => {
    // Check after hydration — sessionStorage is only available client-side
    try {
      const seen = !!sessionStorage.getItem(KEY);
      setShowing(!seen);
    } catch {
      setShowing(false); // fail-safe
    }
  }, []);

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
          // Start visible; inline script below hides it immediately if already seen
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none',
        }}
      />

      {/* Inline script: synchronously hides the cover before first paint if splash already played */}
      {/* eslint-disable-next-line @next/next/no-sync-scripts */}
      <script
        dangerouslySetInnerHTML={{
          __html: `(function(){try{if(sessionStorage.getItem(${JSON.stringify(KEY)})){var el=document.getElementById('ascentor-splash-cover');if(el)el.style.display='none';}}catch(e){}})();`,
        }}
      />

      {/* After hydration: show the full animated splash or nothing */}
      {showing === true && (
        <AscentorSplash
          trigger={TRIGGER}
          onDone={() => setShowing(false)}
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
