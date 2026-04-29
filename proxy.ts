// ============================================================
// middleware.ts  ← MUST live at the project ROOT
// Next.js only recognises this file when it is named
// "middleware.ts" (or .js) at the root of the project.
// The old file was named "proxy.ts" and never ran.
//
// Handles:
//   1. Static file passthrough
//   2. /pricing → /checkout redirect
//   3. White-label subdomain rewriting  (john.ascentorbi.com → /p/john/…)
//   4. Custom domain rewriting          (coaching.john.com → /p/custom/…)
//   5. Public route passthrough
//   6. API authentication guard
//   7. Page authentication guard
//   8. Subscription tier gate           (explorer / builder / climber)
// ============================================================

import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const MAIN_DOMAIN  = 'ascentorbi.com'
const MAIN_APP_URL = process.env.NEXT_PUBLIC_URL || 'https://ascentorbi.com'

// Subdomains that are NOT partner white-labels
const RESERVED_SUBDOMAINS = ['www', 'app', 'api', 'admin', 'mail', 'cdn', 'static']

// ── Plan hierarchy ────────────────────────────────────────────
// Single source of truth: explorer=1, builder=2, climber=3.
// Legacy IDs (builder/pro/elite from old data.ts) are no longer
// written by any payment path. The DB migration in HOW_TO_FILE.md
// removes them entirely. These aliases are kept only as a safety
// net for any rows not yet migrated.
const PLAN_RANK: Record<string, number> = {
  free:     0,
  explorer: 1,  basic:    1,   // legacy alias
  builder:  2,  standard: 2,   // legacy alias
  climber:  3,  premium:  3,   // legacy alias
}

// ── Tiered route gates ────────────────────────────────────────
const TIERED_ROUTES: { prefix: string; minPlan: 'explorer' | 'builder' | 'climber' }[] = [
  { prefix: '/learn',          minPlan: 'explorer' },
  { prefix: '/courses',        minPlan: 'explorer' },
  { prefix: '/experts',        minPlan: 'explorer' },
  { prefix: '/analytics',      minPlan: 'builder'  },
  { prefix: '/group-coaching', minPlan: 'climber'  },
]

// ── Routes that require any authenticated session ─────────────
const AUTH_ROUTES = [
  '/dashboard', '/coach', '/community', '/account',
  '/learn', '/courses', '/experts', '/onboarding',
  '/referral', '/admin', '/analytics', '/group-coaching',
  '/partner',
]

// ── API routes that require a session ────────────────────────
// Includes /api/pay/* (previously missing — added here)
const PROTECTED_API_PREFIXES = [
  '/api/coach',
  '/api/coaching',
  '/api/pay',          // was /api/payment — now covers all /api/pay/* routes
  '/api/referral',
  '/api/usage',
  '/api/push',
  '/api/admin',
  '/api/partner',
]

// ── Public pages ──────────────────────────────────────────────
const PUBLIC_ROUTES = [
  '/login', '/signup', '/checkout',
  '/auth/callback',
  '/', '/about', '/blog', '/privacy', '/terms',
  '/how-it-works', '/who-its-for', '/waitlist', '/newsletter',
  '/mentor-apply', '/offline', '/free',
]

// ── Public API routes (no session required) ───────────────────
// NOTE: /api/subscription/webhook is intentionally REMOVED.
//       That handler is retired — only /api/pay/webhook is active.
const PUBLIC_API_ROUTES = [
  '/api/waitlist',
  '/api/newsletter',
  '/api/welcome',
  '/api/auth/callback',   // only the callback, not the entire /api/auth namespace
  '/api/pay/webhook',     // Paystack server-to-server — no cookie
  '/api/partner/webhook', // partner-specific Paystack webhook
]

// ── Access check helper ───────────────────────────────────────
function checkAccess(profile: any, minPlan: string): boolean {
  if (!profile) return false
  const { subscription_plan, subscription_status, subscription_end } = profile
  const isTemporallyActive =
    subscription_status === 'active' ||
    subscription_status === 'trialing' ||
    (subscription_status === 'cancelled' &&
      subscription_end &&
      new Date(subscription_end) > new Date())
  if (!isTemporallyActive) return false
  return (PLAN_RANK[subscription_plan] ?? 0) >= (PLAN_RANK[minPlan] ?? 1)
}

// ── Main middleware ───────────────────────────────────────────
export default async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const hostname = request.headers.get('host') || ''
  const host = hostname.split(':')[0]

  // 1. Static files — always pass through
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/icons') ||
    pathname.startsWith('/manifest') ||
    pathname === '/sw.js' ||
    pathname.includes('.')
  ) {
    return NextResponse.next()
  }

  // 2. Redirect /pricing → /checkout
  // /pricing is no longer a standalone page — the checkout page
  // is the single entry point for plan selection.
  if (pathname === '/pricing' || pathname.startsWith('/pricing/')) {
    return NextResponse.redirect(new URL('/checkout', request.url))
  }

  // 3. White-label subdomain routing
  if (host.endsWith(`.${MAIN_DOMAIN}`)) {
    const subdomain = host.replace(`.${MAIN_DOMAIN}`, '')
    if (subdomain && !RESERVED_SUBDOMAINS.includes(subdomain)) {
      const rewrittenUrl = request.nextUrl.clone()
      rewrittenUrl.pathname = `/p/${subdomain}${pathname}`
      const requestHeaders = new Headers(request.headers)
      requestHeaders.set('x-partner-subdomain', subdomain)
      requestHeaders.set('x-partner-pathname', pathname)
      return NextResponse.rewrite(rewrittenUrl, { request: { headers: requestHeaders } })
    }
  }

  // 4. Custom domain routing
  if (
    !host.endsWith(MAIN_DOMAIN) &&
    host !== MAIN_DOMAIN &&
    !host.includes('localhost') &&
    !host.includes('vercel.app')
  ) {
    const rewrittenUrl = request.nextUrl.clone()
    rewrittenUrl.pathname = `/p/custom${pathname}`
    const requestHeaders = new Headers(request.headers)
    requestHeaders.set('x-partner-custom-domain', host)
    requestHeaders.set('x-partner-pathname', pathname)
    return NextResponse.rewrite(rewrittenUrl, { request: { headers: requestHeaders } })
  }

  // 5. Public routes — no auth needed
  if (PUBLIC_ROUTES.some(r => pathname === r || pathname.startsWith(r + '/'))) {
    return NextResponse.next()
  }
  if (PUBLIC_API_ROUTES.some(r => pathname === r || pathname.startsWith(r + '/'))) {
    return NextResponse.next()
  }

  // 6. Build Supabase client for session checks
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value)
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // 7. Protect API routes
  if (PROTECTED_API_PREFIXES.some(p => pathname.startsWith(p))) {
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    return response
  }

  // 8. Protect page routes
  if (!user && AUTH_ROUTES.some(r => pathname === r || pathname.startsWith(r + '/'))) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // 9. Subscription tier gate
  if (user) {
    const matchedTier = TIERED_ROUTES.find(r =>
      pathname === r.prefix || pathname.startsWith(r.prefix + '/')
    )

    if (matchedTier) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('subscription_plan, subscription_status, subscription_end')
        .eq('id', user.id)
        .single()

      if (!checkAccess(profile, matchedTier.minPlan)) {
        const checkoutUrl = new URL('/checkout', request.url)
        checkoutUrl.searchParams.set('reason', 'subscription_required')
        checkoutUrl.searchParams.set('from', pathname)
        checkoutUrl.searchParams.set('required', matchedTier.minPlan)
        return NextResponse.redirect(checkoutUrl)
      }
    }
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
