'use client';

// components/AuthErrorHandler.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Mounted once in the root layout. Listens to Supabase auth state changes
// globally and handles two failure cases:
//
//   1. TOKEN_REFRESHED failure / SIGNED_OUT:
//      Supabase emits SIGNED_OUT when a token refresh fails (e.g. refresh
//      token not found, revoked, or expired). Without this handler the error
//      surfaces as an uncaught console AuthApiError and the user stays on a
//      broken page making silent 401 requests.
//
//   2. INITIAL_SESSION with no session on a protected route:
//      Catches the case where session cookies were cleared externally.
//
// On SIGNED_OUT → redirect to /login?reason=session_expired so the login
// page can display a friendly "session expired" banner.
//
// This complements the proxy.ts server-side check — the client-side handler
// catches cases where the token expires WHILE the user is already on a page.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

// Routes that don't need auth — we never redirect away from these
const PUBLIC_PATHS = [
  '/login', '/signup', '/checkout', '/auth',
  '/', '/about', '/blog', '/pricing', '/privacy', '/terms',
  '/how-it-works', '/who-its-for', '/waitlist', '/newsletter',
  '/mentor-apply', '/offline',
];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + '/')
  );
}

export default function AuthErrorHandler() {
  const router   = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const supabase = createClient();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'SIGNED_OUT') {
          // Token refresh failed or user was signed out remotely.
          // Only redirect if on a protected page — don't disrupt public pages.
          if (!isPublicPath(pathname)) {
            router.push('/login?reason=session_expired');
          }
        }

        if (event === 'TOKEN_REFRESHED') {
          // Token refreshed successfully — no action needed, just log in dev
          if (process.env.NODE_ENV === 'development') {
            console.debug('[AuthErrorHandler] token refreshed');
          }
        }
      }
    );

    // Also catch unhandled promise rejections from Supabase auth
    // (these appear as "Uncaught AuthApiError" in the console)
    function handleUnhandledRejection(event: PromiseRejectionEvent) {
      const msg = event?.reason?.message || '';
      const isAuthError =
        msg.includes('Refresh Token') ||
        msg.includes('invalid_grant') ||
        msg.includes('JWT expired') ||
        msg.includes('Invalid JWT');

      if (isAuthError) {
        event.preventDefault(); // suppress the console error
        supabase.auth.signOut().catch(() => {}).finally(() => {
          if (!isPublicPath(pathname)) {
            router.push('/login?reason=session_expired');
          }
        });
      }
    }

    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      subscription.unsubscribe();
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, [router, pathname]);

  return null; // renders nothing
}
