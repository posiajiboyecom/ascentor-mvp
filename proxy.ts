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
//
// BUG FIX (Bug 1): Added /api/subscription/webhook to PUBLIC_API_ROUTES.
// Paystack webhook calls arrive with no auth cookie — they were previously
// blocked by the /api/subscription PROTECTED_API_PREFIXES match, silently
// dropping all renewal/cancellation/failed-payment events. The webhook
// does its own HMAC-SHA512 signature verification.
//
// BUG FIX (Bug 3): Replaced the broad '/api/auth' whitelist entry with
// only the two endpoints that are genuinely public. The old entry exposed
// /api/auth/security-check to unauthenticated callers, allowing anyone to
// globally sign out any user by passing an arbitrary userId in the body.
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

// API routes that are intentionally public.
// ORDER MATTERS: these are checked with startsWith BEFORE the
// PROTECTED_API_PREFIXES block, so specific public sub-paths (e.g.
// /api/subscription/webhook) correctly bypass the broader protected prefix
// (/api/subscription) that would otherwise block them.
const PUBLIC_API_ROUTES = [
  '/api/waitlist',
  '/api/newsletter',
  '/api/welcome',
  // BUG FIX (Bug 3): Narrowed from '/api/auth' to only the two endpoints
  // that are genuinely public. /api/auth/security-check must NOT be public —
  // it calls supabase.auth.admin.signOut(userId) for an arbitrary userId from
  // the request body, making it a global account-logout weapon if unauthenticated.
  '/api/auth/callback',
  '/api/auth/check-email',
  '/api/auth/check-partner-membership', // called before account creation — no session yet
  // BUG FIX (Bug 1): Paystack's servers have no auth cookie. Without this
  // entry the /api/subscription prefix above blocks all webhook events (renewals,
  // cancellations, failed payments). The route verifies the Paystack HMAC
  // signature itself — no middleware auth needed.
  '/api/subscription/webhook',
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
    const rewriteResponse = NextResponse.rewrite(rewriteUrl);
    // Pass original pathname so layout can determine public vs protected pages
    rewriteResponse.headers.set('x-partner-pathname', pathname);
    return rewriteResponse;
  }

  // For direct /p/[subdomain]/* access, pass pathname through
  if (pathname.startsWith('/p/')) {
    const response = NextResponse.next();
    response.headers.set('x-partner-pathname', pathname);
    return response;
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

  // Always pass through public API routes.
  // This check runs BEFORE the PROTECTED_API_PREFIXES check so that specific
  // public sub-paths (e.g. /api/subscription/webhook) are correctly allowed
  // through even when their parent prefix is protected.
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
