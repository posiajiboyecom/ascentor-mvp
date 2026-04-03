// ============================================================
// NEXT.JS PROXY — Auth + Subscription + White-Label Routing
// Place at project ROOT: proxy.ts
//
// NEW in this version:
// - Subdomain detection: john.ascentorbi.com → /[subdomain] route
// - Custom domain passthrough for partner domains
// - Partner context header injected for server components
// - All previous auth/subscription logic preserved
// ============================================================

import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const MAIN_DOMAIN  = 'ascentorbi.com';
const MAIN_APP_URL = process.env.NEXT_PUBLIC_URL || 'https://ascentorbi.com';

// Subdomains that are NOT partner white-labels
const RESERVED_SUBDOMAINS = ['www', 'app', 'api', 'admin', 'mail', 'cdn', 'static'];

const TIERED_ROUTES: { prefix: string; minPlan: 'explorer' | 'builder' | 'climber' }[] = [
  { prefix: '/learn',          minPlan: 'explorer' },
  { prefix: '/courses',        minPlan: 'explorer' },
  { prefix: '/experts',        minPlan: 'explorer' },
  { prefix: '/analytics',      minPlan: 'builder'  },
  { prefix: '/group-coaching', minPlan: 'climber'  },
];

const AUTH_ROUTES = [
  '/dashboard', '/coach', '/community', '/account',
  '/learn', '/courses', '/experts', '/onboarding',
  '/referral', '/admin', '/analytics', '/group-coaching',
  '/partner',  // partner admin portal
];

const PROTECTED_API_PREFIXES = [
  '/api/pay',           // ← ADDED: payment init + confirm (webhook excluded below)
  '/api/coach',
  '/api/coaching',
  '/api/referral',
  '/api/subscription',
  '/api/usage',
  '/api/push',
  '/api/admin',
  '/api/partner',
  '/api/guardsmann',    // ← ADDED: Guardsmann job search + alerts
  '/api/intel',         // ← ADDED: BI command center
];

const PUBLIC_ROUTES = [
  '/login', '/signup', '/checkout',
  '/auth/callback',
  '/', '/about', '/blog', '/pricing', '/privacy', '/terms',
  '/how-it-works', '/who-its-for', '/waitlist', '/newsletter',
  '/mentor-apply', '/offline',
];

const PUBLIC_API_ROUTES = [
  '/api/waitlist', '/api/newsletter', '/api/welcome', '/api/auth',
  '/api/subscription/webhook',
  '/api/partner/webhook',    // partner-specific Paystack webhook
  '/api/pay/webhook',        // v3 main Paystack webhook — Paystack has no session cookie
];

const PLAN_RANK: Record<string, number> = {
  // Current plan IDs (new v3 naming convention stored in profiles.subscription_plan)
  free:     0,
  explorer: 1,
  builder:  2,
  climber:  3,
  // Legacy Supabase IDs (stored in profiles.subscription_plan for old signups via data.ts)
  //   data.ts tier.id 'builder' = Explorer display tier → rank 1
  //   data.ts tier.id 'pro'     = Builder display tier  → rank 2
  //   data.ts tier.id 'elite'   = Climber display tier  → rank 3
  // IMPORTANT: 'builder' key above (rank 2) is the NEW builder. Old 'builder' (Explorer)
  // users will over-rank until migrated. Run a one-time DB migration to fix:
  //   UPDATE profiles SET subscription_plan = 'explorer' WHERE subscription_plan = 'builder' AND created_at < '[v3 launch date]';
  //   UPDATE profiles SET subscription_plan = 'builder'  WHERE subscription_plan = 'pro';
  //   UPDATE profiles SET subscription_plan = 'climber'  WHERE subscription_plan = 'elite';
  elite:    3,
  pro:      2,
  standard: 2,
  tester:   2,
};

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hostname = request.headers.get('host') || '';
  const host = hostname.split(':')[0];

  // ── 1. Static files — always pass through ────────────────
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

  // ── 2. White-label subdomain routing ─────────────────────
  // Detect: john.ascentorbi.com → rewrite to /p/john/...
  if (host.endsWith(`.${MAIN_DOMAIN}`)) {
    const subdomain = host.replace(`.${MAIN_DOMAIN}`, '');

    if (subdomain && !RESERVED_SUBDOMAINS.includes(subdomain)) {
      // Rewrite internally to /p/[subdomain]/[...path]
      // This keeps the URL in the browser as john.ascentorbi.com
      const rewrittenUrl = request.nextUrl.clone();
      rewrittenUrl.pathname = `/p/${subdomain}${pathname}`;

      const response = NextResponse.rewrite(rewrittenUrl);
      // Pass subdomain to server components via header
      response.headers.set('x-partner-subdomain', subdomain);
      return response;
    }
  }

  // ── 3. Custom domain routing ──────────────────────────────
  // coaching.johnadeyemi.com → rewrite to /p/custom/...
  if (
    !host.endsWith(MAIN_DOMAIN) &&
    host !== MAIN_DOMAIN &&
    !host.includes('localhost') &&
    !host.includes('vercel.app')
  ) {
    const rewrittenUrl = request.nextUrl.clone();
    rewrittenUrl.pathname = `/p/custom${pathname}`;

    const response = NextResponse.rewrite(rewrittenUrl);
    response.headers.set('x-partner-custom-domain', host);
    return response;
  }

  // ── 4. Public routes ──────────────────────────────────────
  if (PUBLIC_ROUTES.some(r => pathname === r || pathname.startsWith(r + '/'))) {
    return NextResponse.next();
  }

  if (PUBLIC_API_ROUTES.some(r => pathname === r || pathname.startsWith(r + '/'))) {
    return NextResponse.next();
  }

  // ── 5. Build Supabase client ──────────────────────────────
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
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

  // ── 6. Protect API routes ─────────────────────────────────
  if (PROTECTED_API_PREFIXES.some(p => pathname.startsWith(p))) {
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return response;
  }

  // ── 7. Protect page routes ────────────────────────────────
  if (!user && AUTH_ROUTES.some(r => pathname === r || pathname.startsWith(r + '/'))) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // ── 8. Subscription tier gate ─────────────────────────────
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

function checkAccess(profile: any, minPlan: string): boolean {
  if (!profile) return false;
  const { subscription_plan, subscription_status, subscription_end } = profile;
  const isTemporallyActive =
    subscription_status === 'active' ||
    subscription_status === 'trialing' ||
    (subscription_status === 'cancelled' && subscription_end && new Date(subscription_end) > new Date());
  if (!isTemporallyActive) return false;
  return (PLAN_RANK[subscription_plan] ?? 0) >= (PLAN_RANK[minPlan] ?? 1);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
