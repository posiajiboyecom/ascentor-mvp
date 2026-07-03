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
// FIX: PROTECTED_API_PREFIXES now includes /api/pay (was /api/payment,
// which never matched), /api/partner, and /api/community.
// Webhook endpoints (/api/pay/webhook, /api/partner/webhook) are
// explicitly public — Paystack/partner platforms call them without
// a user session and they verify their own signatures internally.
// ============================================================

import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

// ── CHECKOUT / FREE MODE SWITCH ───────────────────────────────
// Source of truth: `platform_settings` table in Supabase.
//   Row: { key: 'checkout_enabled', value: 'true' | 'false' }
// Toggle from Admin Overview → flips the DB row instantly.
// No redeploy needed.
//
// The env var FREE_MODE=true acts as a hard override (useful for
// local dev or emergencies) and takes precedence over the DB value.
// ──────────────────────────────────────────────────────────────

async function isCheckoutEnabled(supabase: ReturnType<typeof createServerClient>): Promise<boolean> {
  // Hard override via env var
  if (process.env.FREE_MODE === 'true') return false;

  try {
    const { data } = await supabase
      .from('platform_settings')
      .select('value')
      .eq('key', 'checkout_enabled')
      .single();
    // If row missing, default to enabled (paid mode)
    return data ? data.value === 'true' : true;
  } catch {
    // If table doesn't exist yet, default to enabled
    return true;
  }
}

// Routes that require a paid subscription
const PAID_ROUTES = ['/learn', '/courses'];

// Page routes that require authentication
const AUTH_ROUTES = [
  '/dashboard', '/coach', '/community', '/account',
  '/learn', '/courses', '/experts', '/onboarding',
  '/referral', '/admin',
];

// API routes that are explicitly public — checked BEFORE the protected
// prefix list so webhooks and public endpoints are never blocked.
//
// ORDER MATTERS: this list is checked before PROTECTED_API_PREFIXES.
// Any path that matches here is passed through immediately.
const PUBLIC_API_ROUTES = [
  '/api/waitlist',
  '/api/newsletter',
  '/api/welcome',
  '/api/auth',
  // Paystack webhook — verified internally via HMAC signature
  '/api/pay/webhook',
  // Partner platform webhook — verified internally
  '/api/partner/webhook',
  // Public promo code GET (used on checkout page before auth)
  '/api/pay/promo',
  // Checkout pending — non-destructive marketing hook, called pre-auth
  '/api/checkout-pending',
];

// API route prefixes that require authentication.
// Unauthenticated requests return 401 at the edge, before the route
// handler runs. Each route still does its own auth check (defence in depth).
const PROTECTED_API_PREFIXES = [
  '/api/coach',
  '/api/coaching',
  '/api/pay',        // was /api/payment — that prefix never matched anything
  '/api/partner',    // 16 routes — all require auth except /webhook (exempted above)
  '/api/community',  // checkin, circle, read, voice-upload
  '/api/referral',
  '/api/subscription',
  '/api/usage',
  '/api/push',
  '/api/admin',
  '/api/account',
  '/api/goals',
  '/api/intel-analyse',
  '/api/lead-magnet',
];

// Public routes — no auth needed
const PUBLIC_ROUTES = [
  '/login', '/signup', '/checkout',
  '/auth/callback',
  '/', '/about', '/blog', '/pricing', '/privacy', '/terms',
  '/how-it-works', '/who-its-for', '/waitlist', '/newsletter',
  '/mentor-apply', '/offline',
];

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

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

  // Always pass through public API routes (checked before protected prefixes)
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
  if (!user && AUTH_ROUTES.some(r => pathname === r || pathname.startsWith(r + '/'))) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // ── Subscription gate for paid pages ─────────────────────────────
  if (user && PAID_ROUTES.some(r => pathname === r || pathname.startsWith(r + '/'))) {
    const checkoutOn = await isCheckoutEnabled(supabase);
    if (checkoutOn) {
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
