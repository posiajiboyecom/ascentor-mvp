// ============================================================
// NEXT.JS PROXY — Auth + Subscription Gating  [UPDATED]
// Place at project ROOT: proxy.ts
//
// CHANGES FROM PREVIOUS VERSION:
// - Extended PAID_ROUTES to cover all plan-gated pages
// - Added per-route minimum plan enforcement (explorer/builder/climber)
// - Webhook route explicitly whitelisted in PUBLIC_API_ROUTES
// - checkAccess() now takes minPlan parameter for tiered enforcement
// ============================================================

import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

// ── Route → minimum plan required ──────────────────────────
// 'explorer' = any paid plan | 'builder' = builder+ | 'climber' = climber only
const TIERED_ROUTES: { prefix: string; minPlan: 'explorer' | 'builder' | 'climber' }[] = [
  { prefix: '/learn',            minPlan: 'explorer' },
  { prefix: '/courses',          minPlan: 'explorer' },
  { prefix: '/experts',          minPlan: 'explorer' },  // add if gated
  { prefix: '/analytics',        minPlan: 'builder'  },
  { prefix: '/group-coaching',   minPlan: 'climber'  },
];

// Page routes that require authentication
const AUTH_ROUTES = [
  '/dashboard', '/coach', '/community', '/account',
  '/learn', '/courses', '/experts', '/onboarding',
  '/referral', '/admin', '/analytics', '/group-coaching',
];

// API routes that require authentication
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
];

// API routes that are intentionally public
const PUBLIC_API_ROUTES = [
  '/api/waitlist',
  '/api/newsletter',
  '/api/welcome',
  '/api/auth',
  '/api/subscription/webhook',  // ← Paystack webhook must stay public
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

  // ── Protect API routes ────────────────────────────────────
  if (PROTECTED_API_PREFIXES.some(p => pathname.startsWith(p))) {
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return response;
  }

  // ── Protect page routes ───────────────────────────────────
  if (!user && AUTH_ROUTES.some(r => pathname === r || pathname.startsWith(r + '/'))) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // ── Tiered subscription gate ──────────────────────────────
  if (user) {
    const matchedTier = TIERED_ROUTES.find(r =>
      pathname === r.prefix || pathname.startsWith(r.prefix + '/')
    );

    if (matchedTier) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('subscription_plan, subscription_status, subscription_end')
        .eq('id', user.id)
        .single();

      if (!checkAccess(profile, matchedTier.minPlan)) {
        const checkoutUrl = new URL('/checkout', request.url);
        checkoutUrl.searchParams.set('reason', 'subscription_required');
        checkoutUrl.searchParams.set('from', pathname);
        checkoutUrl.searchParams.set('required', matchedTier.minPlan);
        return NextResponse.redirect(checkoutUrl);
      }
    }
  }

  return response;
}

// ── Plan rank for comparison ──────────────────────────────
const PLAN_RANK: Record<string, number> = {
  free: 0,
  explorer: 1,
  builder: 2,
  climber: 3,
  // Legacy aliases from AccountClient
  standard: 2,
  tester: 2,
  pro: 3,
};

function checkAccess(profile: any, minPlan: 'explorer' | 'builder' | 'climber'): boolean {
  if (!profile) return false;

  const { subscription_plan, subscription_status, subscription_end } = profile;

  // Determine if subscription is temporally active
  const isTemporallyActive =
    subscription_status === 'active' ||
    subscription_status === 'trialing' ||
    (subscription_status === 'cancelled' && subscription_end && new Date(subscription_end) > new Date());

  if (!isTemporallyActive) return false;

  // Check plan rank meets minimum
  const userRank = PLAN_RANK[subscription_plan] ?? 0;
  const minRank  = PLAN_RANK[minPlan] ?? 1;
  return userRank >= minRank;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
