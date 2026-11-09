'use client';
// SplashGate — controls when the splash shows.
// Rules:
//   • Shows once per browser session per trigger key (sessionStorage)
//   • Never shows if the trigger already fired this session
//   • On Capacitor (native app open), defers to native SplashScreen for the
//     very first paint; this component handles sign-in & onboarding triggers
//
// Usage:
//   <SplashGate trigger="signin">   ← wrap the authenticated shell
//   <SplashGate trigger="onboarding"> ← wrap at onboarding completion

import dynamic from 'next/dynamic';
import { useState, useEffect } from 'react';
import type { SplashTrigger } from './AscentorSplash';

// Dynamically import so the canvas code is never SSR'd
const AscentorSplash = dynamic(() => import('./AscentorSplash'), { ssr: false });

interface Props {
  trigger: SplashTrigger;
  children: React.ReactNode;
}

function hasSeenSplash(trigger: SplashTrigger): boolean {
  try {
    return !!sessionStorage.getItem(`splash_${trigger}`);
  } catch {
    return true; // fail-safe: skip if storage unavailable
  }
}

export default function SplashGate({ trigger, children }: Props) {
  // Start as null so we don't flash anything on SSR
  const [showing, setShowing] = useState<boolean | null>(null);

  useEffect(() => {
    setShowing(!hasSeenSplash(trigger));
  }, [trigger]);

  // SSR / hydration: render children invisibly until we know
  if (showing === null) {
    return <>{children}</>;
  }

  return (
    <>
      {showing && (
        <AscentorSplash
          trigger={trigger}
          onDone={() => setShowing(false)}
        />
      )}
      {children}
    </>
  );
}
