// ============================================================
// ASCENTOR MIDDLEWARE — Security Fix S3
//
// Enforces authentication on all protected routes:
//   • /app pages (already protected by layout, this is belt+suspenders)
//   • /api/coach/*      — AI session routes
//   • /api/coaching/*   — Summary routes
//   • /api/payment/*    — Payment + promo (now also auth-checked inside)
//   • /api/referral/*   — Referral system
//   • /api/subscription/* — Subscription management
//   • /api/usage/*      — Usage limit checks
//   • /api/push/*       — Push notification management
//   • /api/admin/*      — Admin operations (role checked inside routes)
//
// Public routes (no auth required):
//   • /api/waitlist     — Pre-signup waitlist
//   • /api/newsletter   — Newsletter signup
//   • /api/welcome      — Welcome email trigger (called post-signup)
//   • /api/auth/*       — Auth callbacks
//   • /login, /signup, /waitlist, /pricing, etc.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

// Routes that require authentication
const PROTECTED_API_PREFIXES = [
  '/api/coach',
  '/api/coaching',
  '/api/payment',
  '/api/referral',
  '/api/subscription',
  '/api/usage',
  '/api/push',
  '/api/admin',
];

// App pages that require authentication
const PROTECTED_PAGE_PREFIXES = [
  '/dashboard',
  '/coach',
  '/community',
  '/experts',
  '/learn',
  '/account',
  '/referral',
  '/admin',
  '/onboarding',
];

// Routes that are always public
const PUBLIC_ROUTES = [
  '/login',
  '/signup',
  '/waitlist',
  '/pricing',
  '/blog',
  '/how-it-works',
  '/who-its-for',
  '/terms',
  '/offline',
  '/newsletter',
  '/mentor-apply',
  '/api/waitlist',
  '/api/newsletter',
  '/api/welcome',
  '/api/auth',
  '/auth/callback',
  '/_next',
  '/favicon',
  '/icons',
  '/manifest',
  '/sw.js',
];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // ── Always allow public routes ──────────────────────────────────
  if (PUBLIC_ROUTES.some(route => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // ── Allow static files and root landing page ────────────────────
  if (pathname === '/' || pathname.includes('.')) {
    return NextResponse.next();
  }

  // ── Check if this route needs auth ─────────────────────────────
  const isProtectedApi   = PROTECTED_API_PREFIXES.some(p => pathname.startsWith(p));
  const isProtectedPage  = PROTECTED_PAGE_PREFIXES.some(p => pathname.startsWith(p));

  if (!isProtectedApi && !isProtectedPage) {
    return NextResponse.next();
  }

  // ── Validate session ────────────────────────────────────────────
  let response = NextResponse.next({
    request: { headers: req.headers },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value));
          response = NextResponse.next({ request: { headers: req.headers } });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  // ── Unauthenticated — redirect or 401 ──────────────────────────
  if (!user) {
    if (isProtectedApi) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    // Redirect to login with return path
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - _next/static (static files)
     * - _next/image (image optimisation)
     * - favicon.ico
     * - public folder files
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|js|css|woff|woff2)$).*)',
  ],
};
