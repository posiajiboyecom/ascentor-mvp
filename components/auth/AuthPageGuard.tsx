'use client';

// Pressing Back can restore /login or /signup from the browser's back-forward cache, with the form still showing. Reload it in that
// case, so the server (proxy.ts) can send a signed-in person to their dashboard instead of showing the form.
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

export default function AuthPageGuard() {
  const path = usePathname();
  useEffect(() => {
    if (path !== '/login' && path !== '/signup') return;
    const onShow = (e: PageTransitionEvent) => { if (e.persisted) window.location.reload(); };
    window.addEventListener('pageshow', onShow);
    return () => window.removeEventListener('pageshow', onShow);
  }, [path]);
  return null;
}
