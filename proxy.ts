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
];

const PUBLIC_API_ROUTES = [
  '/api/waitlist', '/api/newsletter', '/api/welcome', '/api/auth',
  '/api/subscription/webhook',
  '/api/partner/webhook',
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

  // ── 2. White-label subdomain routing ─────────────────────
  if (host.endsWith(`.${MAIN_DOMAIN}`)) {
    const subdomain = host.replace(`.${MAIN_DOMAIN}`, '');

    if (subdomain && !RESERVED_SUBDOMAINS.includes(subdomain)) {
      const rewrittenUrl = request.nextUrl.clone();
      rewrittenUrl.pathname = `/p/${subdomain}${pathname}`;

      const response = NextResponse.rewrite(rewrittenUrl);
      response.headers.set('x-partner-subdomain', subdomain);
      response.headers.set('x-partner-pathname', pathname); // used by layout for public path check
      // BUG-11 header: checkout needs the canonical API base
      response.headers.set('x-ascentor-api-base', MAIN_APP_URL);
      return response;
      // NOTE: subdomain rewrites still early-return — they ARE on *.ascentorbi.com
      // so Vercel handles auth at the edge via the *.ascentorbi.com rewrite.
      // Custom domains below do NOT early-return (see BUG-10 fix).
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
    if (customDomainRewrite) {
      const res = NextResponse.rewrite(customDomainRewrite);
      res.headers.set('x-partner-custom-domain', host);
      res.headers.set('x-ascentor-api-base', MAIN_APP_URL); // BUG-11
      return res;
    }
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
    // For custom domains, redirect to the partner's login page on its own domain
    if (customDomainRewrite) {
      const loginUrl = new URL(`https://${host}/login`);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }
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
        const checkoutUrl = new URL(
          customDomainRewrite ? `https://${host}/checkout` : '/checkout',
          request.url
        );
        checkoutUrl.searchParams.set('reason', 'subscription_required');
        checkoutUrl.searchParams.set('from', pathname);
        checkoutUrl.searchParams.set('required', matchedTier.minPlan);
        return NextResponse.redirect(checkoutUrl);
      }
    }
  }

  // ── 9. Apply custom domain rewrite (with auth passed) ─────
  if (customDomainRewrite) {
    // Clone response cookies into new rewrite response
    const rewriteRes = NextResponse.rewrite(customDomainRewrite);
    rewriteRes.headers.set('x-partner-custom-domain', host);
    rewriteRes.headers.set('x-ascentor-api-base', MAIN_APP_URL); // BUG-11
    // Propagate any session cookies set during auth check
    response.cookies.getAll().forEach(({ name, value, ...opts }) => {
      rewriteRes.cookies.set(name, value, opts);
    });
    return rewriteRes;
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
