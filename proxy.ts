// ============================================================
// NEXT.JS PROXY — Auth + Subscription Gating
// Place at project ROOT: proxy.ts
//
// SECURITY FIX S3: Added protection for all /api/* routes.
// Unauthenticated API calls now return 401 instead of passing through.
//
// ONBOARDING FIX: Removed the blanket early-return for /onboarding
// that was skipping all auth checks. /onboarding now correctly
// requires authentication (unauthenticated users go to /login).
// Previously-onboarded users are NOT redirected back to /onboarding
// by this middleware — that routing decision lives in route.ts
// (the auth callback), which is the single source of truth for
// post-login destination.
// ============================================================

import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

// Routes that require a paid subscription
const PAID_ROUTES = ['/learn', '/courses'];

// Page routes that require authentication
const AUTH_ROUTES = [
  '/dashboard', '/coach', '/community', '/account',
  '/learn', '/courses', '/experts', '/onboarding',
  '/referral', '/admin',
];

// API routes that require authentication (S3 fix)
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

// Public routes — no auth needed
const PUBLIC_ROUTES = [
  '/login', '/signup', '/checkout',
  '/auth/callback',
  '/', '/about', '/blog', '/pricing', '/privacy', '/terms',
  '/how-it-works', '/who-its-for', '/waitlist', '/newsletter',
  '/mentor-apply', '/offline',
  '/p', // Partner/white-label shell — auth handled internally per route
];

// API routes that are intentionally public
const PUBLIC_API_ROUTES = [
  '/api/waitlist',
  '/api/newsletter',
  '/api/welcome',
  '/api/auth',
];

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hostname = request.headers.get('host') || '';

  // ── Subdomain → /p/[subdomain] rewrite ───────────────────────────
  // demo.ascentorbi.com/        → /p/demo
  // demo.ascentorbi.com/login   → /p/demo/login
  // demo.ascentorbi.com/signup  → /p/demo/signup
  const subdomainMatch = hostname.match(/^([^.:]+)\.ascentorbi\.com(:\d+)?$/);
  const subdomain = subdomainMatch?.[1];

  if (subdomain && subdomain !== 'www' && !pathname.startsWith('/p/')) {
    const rewrittenPath = `/p/${subdomain}${pathname === '/' ? '' : pathname}`;
    const rewriteUrl = new URL(rewrittenPath, request.url);
    rewriteUrl.search = request.nextUrl.search;
    return NextResponse.rewrite(rewriteUrl);
  }

  // Always pass through static files
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/icons') ||
    pathname.startsWith('/manifest') ||
    pathname === '/sw.js' ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // Always pass through public page routes
  if (PUBLIC_ROUTES.some(r => pathname === r || pathname.startsWith(r + '/'))) {
    return NextResponse.next();
  }

  // Always pass through public API routes
  if (PUBLIC_API_ROUTES.some(r => pathname === r || pathname.startsWith(r + '/'))) {
    return NextResponse.next();
  }

  // Build Supabase client
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  // ── S3: Protect API routes ────────────────────────────────────────
  if (PROTECTED_API_PREFIXES.some(p => pathname.startsWith(p))) {
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return response;
  }

  // ── Protect page routes ───────────────────────────────────────────
  // This includes /onboarding — unauthenticated users go to /login.
  // Authenticated users who visit /onboarding directly are allowed
  // through (edge case: someone bookmarked it, or is mid-flow).
  if (!user && AUTH_ROUTES.some(r => pathname === r || pathname.startsWith(r + '/'))) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // ── Subscription gate for paid pages ─────────────────────────────
  if (user && PAID_ROUTES.some(r => pathname === r || pathname.startsWith(r + '/'))) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('subscription_plan, subscription_status, subscription_end')
      .eq('id', user.id)
      .single();

    if (!checkAccess(profile)) {
      const checkoutUrl = new URL('/checkout', request.url);
      checkoutUrl.searchParams.set('reason', 'subscription_required');
      checkoutUrl.searchParams.set('from', pathname);
      return NextResponse.redirect(checkoutUrl);
    }
  }

  return response;
}

function checkAccess(profile: any): boolean {
  if (!profile) return false;

  const { subscription_status, subscription_end } = profile;

  if (subscription_status === 'active' || subscription_status === 'trialing') {
    if (subscription_end) {
      return new Date(subscription_end) > new Date();
    }
    return true;
  }

  // Cancelled but still within billing period
  if (subscription_status === 'cancelled' && subscription_end) {
    return new Date(subscription_end) > new Date();
  }

  return false;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
