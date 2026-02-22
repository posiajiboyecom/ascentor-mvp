// ============================================================
// NEXT.JS MIDDLEWARE — Subscription Gating
// Place this at the ROOT of your project: middleware.ts
//
// This intercepts requests to protected routes and redirects
// free users to /checkout with a reason parameter.
// ============================================================

import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

// Routes that require ANY subscription (basic, standard, premium)
const PAID_ROUTES = ['/learn', '/courses'];

// Routes that require authentication (but not necessarily paid)
const AUTH_ROUTES = [
  '/dashboard', '/coach', '/community', '/account',
  '/learn', '/courses', '/experts',
];

// Public routes (no auth needed)
const PUBLIC_ROUTES = [
  '/login', '/signup', '/checkout', '/onboarding',
  '/auth/callback', '/api',
  '/', '/about', '/blog', '/privacy', '/terms',
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip public routes, static files, and API routes
  if (
    PUBLIC_ROUTES.some(r => pathname === r || pathname.startsWith(r + '/')) ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // Create Supabase client for middleware
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

  // Check auth
  const { data: { user } } = await supabase.auth.getUser();

  // Redirect unauthenticated users from protected routes
  if (!user && AUTH_ROUTES.some(r => pathname === r || pathname.startsWith(r + '/'))) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Check subscription for paid routes
  if (user && PAID_ROUTES.some(r => pathname === r || pathname.startsWith(r + '/'))) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('subscription_plan, subscription_status, subscription_end')
      .eq('id', user.id)
      .single();

    const hasAccess = checkAccess(profile);

    if (!hasAccess) {
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

  // Active or trialing subscriptions have access
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
    /*
     * Match all request paths except for:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (images, etc.)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
