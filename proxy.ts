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
import crypto from 'crypto';

// ── Nonce-based CSP (M-06 fix) ────────────────────────────────────────────────
// A fresh cryptographic nonce is generated on every request.
// It is:
//   1. Set as x-nonce response header so layouts can read it via next/headers
//   2. Injected into the Content-Security-Policy header, replacing 'unsafe-inline'
//      in script-src. Only scripts carrying this nonce attribute will execute.
//
// Why here (middleware) and not next.config.ts?
//   next.config.ts headers() runs at build time → static string, no nonce possible.
//   Middleware runs per-request → can generate a unique nonce each time.
//
// style-src keeps 'unsafe-inline' because Next.js injects inline <style> tags
// for CSS-in-JS. Removing it breaks rendering. This is an accepted trade-off —
// style injection does not execute code and is much lower risk than script injection.
function buildNoncedCSP(nonce: string): string {
  return [
    // nonce replaces 'unsafe-inline' — only scripts with this nonce attribute run
    `script-src 'self' 'nonce-${nonce}' https://js.paystack.co https://plausible.io https://cdnjs.cloudflare.com https://www.youtube.com https://s.ytimg.com`,
    // style-src keeps unsafe-inline (Next.js CSS-in-JS requirement — low risk)
    `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`,
    `font-src 'self' data: https://fonts.gstatic.com`,
    `img-src 'self' data: blob: https://*.supabase.co https://www.gravatar.com https://i.ytimg.com https:`,
    `frame-src https://js.paystack.co https://www.youtube.com https://youtube.com https://www.youtube-nocookie.com`,
    `connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.anthropic.com https://api.paystack.co https://plausible.io https://api.bufferapp.com https://www.youtube.com`,
    `worker-src 'self' blob:`,
    `default-src 'self'`,
    `object-src 'none'`,
    `upgrade-insecure-requests`,
  ].join('; ');
}

function withNonce(res: NextResponse, nonce: string): NextResponse {
  res.headers.set('x-nonce', nonce);
  res.headers.set('Content-Security-Policy', buildNoncedCSP(nonce));
  return res;
}

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

  // Generate a fresh nonce for every request (M-06)
  const nonce = crypto.randomBytes(16).toString('base64');

  // Always pass through static files (no CSP needed on binary assets)
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

  // Always pass through public page routes — still attach nonce for theme scripts
  if (PUBLIC_ROUTES.some(r => pathname === r || pathname.startsWith(r + '/'))) {
    return withNonce(NextResponse.next({ request }), nonce);
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

  // ── 24-hour inactivity guard ──────────────────────────────────────
  // If the user is authenticated but has been inactive for 24+ hours,
  // sign them out at the edge and redirect to login.
  if (user) {
    const lastActive = request.cookies.get('last_active')?.value;
    const INACTIVITY_LIMIT = 24 * 60 * 60 * 1000; // 24 hours in ms

    if (lastActive) {
      const elapsed = Date.now() - parseInt(lastActive, 10);
      if (elapsed > INACTIVITY_LIMIT) {
        // Sign out server-side
        await supabase.auth.signOut();
        // Clear cookies and redirect to login
        const loginUrl = new URL('/login', request.url);
        loginUrl.searchParams.set('reason', 'session_expired');
        const redirectResponse = NextResponse.redirect(loginUrl);
        redirectResponse.cookies.delete('last_active');
        return redirectResponse;
      }
    }

    // Refresh the last_active timestamp on every protected request
    response.cookies.set('last_active', String(Date.now()), {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 24 * 60 * 60, // 24 hours
      path: '/',
    });
  }

  // ── S3: Protect API routes ────────────────────────────────────────
  if (PROTECTED_API_PREFIXES.some(p => pathname.startsWith(p))) {
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return withNonce(response, nonce);
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

  return withNonce(response, nonce);
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
