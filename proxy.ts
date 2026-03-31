// ============================================================
// FILE LOCATION: proxy.ts  (project root — this IS the Next.js middleware)
//
// BUGS FIXED:
//   BUG-10 — Custom domain requests (/p/custom/* rewrite) returned
//             NextResponse.rewrite() immediately, bypassing ALL
//             auth/subscription checks in steps 4–8. Any visitor
//             on coaching.johnadeyemi.com could access protected
//             pages without being logged in.
//
//             Fix: custom domain rewrites now fall through to the
//             auth checks below instead of early-returning. The
//             rewritten URL is stored and attached as a header so
//             server components can still read the custom host.
//             Auth and plan-gate logic then runs normally.
//
//   BUG-11 — The partner checkout client called:
//               fetch('/api/partner/payment/verify', ...)
//             On custom domains (coaching.johnadeyemi.com) this
//             resolves to coaching.johnadeyemi.com/api/... which
//             doesn't exist — the API lives on ascentorbi.com.
//             The middleware fixes this by injecting an
//             x-ascentor-api-base header so the checkout client
//             can always construct the correct absolute URL.
//             The header value is always https://ascentorbi.com
//             (or NEXT_PUBLIC_URL on non-prod). The checkout
//             client reads this header via a <meta> tag inserted
//             server-side — see PartnerCheckoutClient notes.
//
//             Note: BUG-11's full fix also requires a one-line
//             change in PartnerCheckoutClient.tsx (FILE_10).
// ============================================================

import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

// ── Locale detection ──────────────────────────────────────────────────────
// Detects visitor country and maps it to a pricing currency.
// Sets x-country and x-currency headers on every response so that
// app/pricing/page.tsx (server component) can read them via headers().
//
// Detection priority:
//   1. Vercel geo (free, no API call — populated automatically on Vercel)
//   2. Cloudflare CF-IPCountry header (if behind CF)
//   3. x-vercel-ip-country (set by some proxy providers)
//   4. ipapi.co free lookup via client IP (1,000 req/day free tier)
//      — disable in local dev by setting DISABLE_IP_GEOLOCATION=true
//   5. Default: 'NG' → NGN (safe fallback — Nigeria is primary market)

async function detectCountry(req: NextRequest): Promise<string> {
  // 1. Vercel built-in geo
  const vercelGeo = (req as NextRequest & { geo?: { country?: string } }).geo?.country;
  if (vercelGeo) return vercelGeo;

  // 2. Cloudflare
  const cf = req.headers.get('cf-ipcountry');
  if (cf && cf !== 'XX') return cf;

  // 3. Forwarded Vercel country header
  const fwd = req.headers.get('x-vercel-ip-country');
  if (fwd) return fwd;

  // 4. ipapi.co fallback (skipped in local dev)
  if (process.env.DISABLE_IP_GEOLOCATION !== 'true') {
    try {
      const ip =
        req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
        req.headers.get('x-real-ip') ??
        null;

      if (ip && ip !== '127.0.0.1' && ip !== '::1') {
        const res = await fetch(`https://ipapi.co/${ip}/country/`, {
          headers: { 'User-Agent': 'ascentorbi.com/1.0' },
          signal: AbortSignal.timeout(800), // never block page load
        });
        if (res.ok) {
          const country = (await res.text()).trim();
          if (country.length === 2) return country.toUpperCase();
        }
      }
    } catch {
      // silently fall through — never let geo kill a page load
    }
  }

  // 5. Default → Nigeria
  return 'NG';
}

function currencyFromCountry(country: string): 'ngn' | 'usd' {
  return country.toUpperCase() === 'NG' ? 'ngn' : 'usd';
}

const MAIN_DOMAIN  = 'ascentorbi.com';
const MAIN_APP_URL = process.env.NEXT_PUBLIC_URL || 'https://ascentorbi.com';

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
  '/partner',
];

const PROTECTED_API_PREFIXES = [
  '/api/coach', '/api/coaching', '/api/payment',
  '/api/referral', '/api/subscription', '/api/usage',
  '/api/push', '/api/admin', '/api/partner',
];

const PUBLIC_ROUTES = [
  '/login', '/signup', '/checkout',
  '/auth/callback',
  '/', '/about', '/blog', '/pricing', '/privacy', '/terms',
  '/how-it-works', '/who-its-for', '/waitlist', '/newsletter',
  '/mentor-apply', '/offline',
  // Partner public pages
  '/join', '/access-denied',
  // Public surveys
  '/survey',
];

const PUBLIC_API_ROUTES = [
  '/api/waitlist', '/api/newsletter', '/api/welcome', '/api/auth',
  '/api/subscription/webhook',
  '/api/payment/webhook',      // Paystack charge-level events (C-1 fix)
  '/api/payments/webhook',     // New payments dir webhook (C-1 fix)
  '/api/partner/webhook',
  '/api/survey',
];

const PLAN_RANK: Record<string, number> = {
  free: 0, explorer: 1, builder: 2, climber: 3,
  standard: 2, tester: 2, pro: 3,
};

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hostname = request.headers.get('host') || '';
  const host = hostname.split(':')[0];

  // ── 1. Static files ───────────────────────────────────────
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

  // ── 1b. Locale detection ──────────────────────────────────
  // Runs once per non-static request. Headers are injected into
  // every response branch below (public, subdomain, custom domain,
  // authenticated). app/pricing/page.tsx reads x-currency server-side.
  const country  = await detectCountry(request);
  const currency = currencyFromCountry(country);

  /** Attaches locale headers to any NextResponse before returning it. */
  function withLocale(res: NextResponse): NextResponse {
    res.headers.set('x-country', country);
    res.headers.set('x-currency', currency);
    return res;
  }

  // ── 2. White-label subdomain routing ─────────────────────
  // Store rewrite intent; fall through to auth/subscription checks.
  // The previous early-return meant unauthenticated visitors on
  // demo.ascentorbi.com/dashboard were rewritten directly to the
  // protected server component — auth ran inside the component, not
  // at the middleware layer where it belongs (same fix as BUG-10).
  let subdomainRewrite: URL | null = null;
  let partnerSubdomain: string | null = null;

  if (host.endsWith(`.${MAIN_DOMAIN}`)) {
    const subdomain = host.replace(`.${MAIN_DOMAIN}`, '');

    if (subdomain && !RESERVED_SUBDOMAINS.includes(subdomain)) {
      subdomainRewrite = request.nextUrl.clone();
      subdomainRewrite.pathname = `/p/${subdomain}${pathname}`;
      partnerSubdomain = subdomain;
      // Do NOT return — fall through to steps 4-8
    }
  }

  // ── 3. Custom domain routing — FIX BUG-10 ────────────────
  // Previously returned NextResponse.rewrite() here, skipping auth.
  // Now we store the rewrite intent in a local variable and continue
  // to auth/subscription checks below. The rewrite is applied at
  // the end of the function instead of short-circuiting.
  let customDomainRewrite: URL | null = null;

  if (
    !host.endsWith(MAIN_DOMAIN) &&
    host !== MAIN_DOMAIN &&
    !host.includes('localhost') &&
    !host.includes('vercel.app')
  ) {
    customDomainRewrite = request.nextUrl.clone();
    customDomainRewrite.pathname = `/p/custom${pathname}`;
    // Do NOT return here — fall through to auth checks
  }

  // ── 4. Public routes ──────────────────────────────────────
  if (PUBLIC_ROUTES.some(r => pathname === r || pathname.startsWith(r + '/'))) {
    if (subdomainRewrite) {
      const res = NextResponse.rewrite(subdomainRewrite);
      res.headers.set('x-partner-subdomain', partnerSubdomain!);
      res.headers.set('x-partner-pathname', pathname);
      res.headers.set('x-ascentor-api-base', MAIN_APP_URL);
      return withLocale(res);
    }
    if (customDomainRewrite) {
      const res = NextResponse.rewrite(customDomainRewrite);
      res.headers.set('x-partner-custom-domain', host);
      res.headers.set('x-partner-pathname', pathname);
      res.headers.set('x-ascentor-api-base', MAIN_APP_URL);
      return withLocale(res);
    }
    return withLocale(NextResponse.next());
  }

  if (PUBLIC_API_ROUTES.some(r => pathname === r || pathname.startsWith(r + '/'))) {
    return withLocale(NextResponse.next());
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
    return withLocale(response);
  }

  // ── 7. Protect page routes ────────────────────────────────
  if (!user && AUTH_ROUTES.some(r => pathname === r || pathname.startsWith(r + '/'))) {
    // Subdomain partners: redirect to /login (proxy rewrites it to partner login)
    if (subdomainRewrite) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return withLocale(NextResponse.redirect(loginUrl));
    }
    // Custom domains: redirect to the partner's login page on its own domain
    if (customDomainRewrite) {
      const loginUrl = new URL(`https://${host}/login`);
      loginUrl.searchParams.set('redirect', pathname);
      return withLocale(NextResponse.redirect(loginUrl));
    }
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return withLocale(NextResponse.redirect(loginUrl));
  }

  // ── 7b. Onboarding gate ──────────────────────────────────
  // If an authenticated user tries to access the main app directly
  // (e.g. bookmarked /dashboard) without completing onboarding,
  // redirect them back to the right onboarding step.
  // Skip this check for: /onboarding itself, /checkout, /auth, partner routes.
  const ONBOARDING_EXEMPT = ['/onboarding', '/checkout', '/auth', '/account', '/api'];
  const isMainAppRoute = !subdomainRewrite && !customDomainRewrite;
  const needsOnboardingCheck =
    isMainAppRoute &&
    user &&
    pathname.startsWith('/dashboard') &&
    !ONBOARDING_EXEMPT.some(e => pathname.startsWith(e));

  if (needsOnboardingCheck) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('onboarding_completed, subscription_status, full_name, current_role, goal_role, industry')
      .eq('id', user.id)
      .single();

    if (profile && !profile.onboarding_completed) {
      const hasPaid =
        profile.subscription_status === 'active' ||
        profile.subscription_status === 'trialing';

      const completedStep2 = !!(profile.full_name && profile.current_role && profile.goal_role && profile.industry);
      const completedStep1 = !!(profile.full_name && profile.current_role);

      if (!completedStep2 && !hasPaid) {
        // Not done with onboarding steps yet
        const step = completedStep1 ? '?step=2' : '';
        return withLocale(NextResponse.redirect(new URL(`/onboarding${step}`, request.url)));
      }
    }
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
        const checkoutUrl = new URL(
          customDomainRewrite ? `https://${host}/checkout` : '/checkout',
          request.url
        );
        // subdomainRewrite: /checkout stays root-relative (proxy rewrites it)
        checkoutUrl.searchParams.set('reason', 'subscription_required');
        checkoutUrl.searchParams.set('from', pathname);
        checkoutUrl.searchParams.set('required', matchedTier.minPlan);
        return withLocale(NextResponse.redirect(checkoutUrl));
      }
    }
  }

  // ── 9. Apply rewrites (auth passed) ──────────────────────
  if (subdomainRewrite) {
    const rewriteRes = NextResponse.rewrite(subdomainRewrite);
    rewriteRes.headers.set('x-partner-subdomain', partnerSubdomain!);
    rewriteRes.headers.set('x-partner-pathname', pathname);
    rewriteRes.headers.set('x-ascentor-api-base', MAIN_APP_URL);
    response.cookies.getAll().forEach(({ name, value, ...opts }) => {
      rewriteRes.cookies.set(name, value, opts);
    });
    return withLocale(rewriteRes);
  }

  if (customDomainRewrite) {
    // Clone response cookies into new rewrite response
    const rewriteRes = NextResponse.rewrite(customDomainRewrite);
    rewriteRes.headers.set('x-partner-pathname', pathname);
    rewriteRes.headers.set('x-partner-custom-domain', host);
    rewriteRes.headers.set('x-ascentor-api-base', MAIN_APP_URL); // BUG-11
    // Propagate any session cookies set during auth check
    response.cookies.getAll().forEach(({ name, value, ...opts }) => {
      rewriteRes.cookies.set(name, value, opts);
    });
    return withLocale(rewriteRes);
  }

  return withLocale(response);
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
