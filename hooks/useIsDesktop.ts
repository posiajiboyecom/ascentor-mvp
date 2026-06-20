'use client';

// hooks/useIsDesktop.ts
// ─────────────────────────────────────────────────────────────────────────
// Returns true when the viewport is >= 1024px (Tailwind's `lg` breakpoint,
// used throughout DesktopRail/AppLayout for the desktop split).
//
// Most of the app's mobile/desktop split is pure CSS (`lg:hidden` /
// `hidden lg:flex`) — both trees mount, only one is visible, which is fine
// for static content. This hook exists for the rare case where mounting
// twice has a real cost: components that open Supabase Realtime
// subscriptions, start intervals, or fetch on mount. CommunityClient uses
// this to guarantee only ONE ChannelView ever mounts at a time — without
// it, both the mobile and desktop chat panes would open their own
// Realtime subscription to the same channel simultaneously.
//
// SSR-safe: defaults to false (mobile) on first render so server-rendered
// HTML matches the client's first paint before hydration, then corrects
// itself via the matchMedia listener.

import { useEffect, useState } from 'react';

const QUERY = '(min-width: 1024px)';

export function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(QUERY);
    setIsDesktop(mql.matches);

    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  return isDesktop;
}
