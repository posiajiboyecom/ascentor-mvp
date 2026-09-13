'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import Preloader from './Preloader';

/**
 * Shows the Preloader on the initial page load AND on every client-side
 * route change. The root layout persists across navigations, so without
 * this wrapper the preloader would only ever run once per full reload.
 *
 * Route changes get a faster fill (900ms) — the full 2.2s fill on every
 * click would make the site feel sluggish.
 */
export default function RoutePreloader() {
  const pathname = usePathname();
  const prevPath = useRef(pathname);
  const [navCount, setNavCount] = useState(0);

  useEffect(() => {
    if (pathname !== prevPath.current) {
      prevPath.current = pathname;
      setNavCount((n) => n + 1);
    }
  }, [pathname]);

  // key={navCount} forces a fresh mount on each navigation so the
  // animation restarts from 0. First mount (navCount 0) is the
  // initial page load — full-speed fill.
  return (
    <Preloader
      key={navCount}
      fillMs={navCount === 0 ? 2200 : 900}
      minimumVisibleMs={navCount === 0 ? 1200 : 300}
    />
  );
}
