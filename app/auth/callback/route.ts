// ============================================================
// AUTH CALLBACK - app/auth/callback/route.ts - v2
//
// FIX: Respects ?next param explicitly when set to /onboarding
//      (free plan email confirmation - skip checkout entirely)
// FIX: Respects ?next=/checkout?plan=X... so paid plan email
//      confirmations land at checkout with plan pre-selected
//
// Main Ascentor flow: routing lives in lib/auth/post-login.ts so OAuth,
// email-confirmation links and password sign-in all land in the same place.
//
// PARTNER WHITELIST CHECK:
// If the callback includes a `partner_subdomain` param, the user's
// email is checked against partner_members before entering the
// partner dashboard.
// ============================================================

import { createClient }        from '@/lib/supabase/server';
import { NextResponse }        from 'next/server';
import { cookies }             from 'next/headers';
import { safeNext }            from '@/lib/auth/safe-next';
import { completeSignIn }      from '@/lib/auth/complete-signin';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code             = searchParams.get('code');
  const rawNext          = searchParams.get('next');
  // Same-site paths only. Raw interpolation of an unchecked value allowed
  // open redirects (e.g. next=@evil.com -> https://site@evil.com).
  const next             = safeNext(rawNext, '/dashboard');
  const partnerSubdomain = searchParams.get('partner_subdomain');

  // The page the person started from (set by the browser just before it left for the provider). Errors return there, so Back never lands on the other auth page.
  const errorPage = (await cookies()).get('ascentor_auth_from')?.value === 'signup' ? '/signup' : '/login';

  if (!code) {
    return NextResponse.redirect(`${origin}${errorPage}?error=auth_failed`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error('[auth/callback] Session exchange failed:', error.message);
    return NextResponse.redirect(`${origin}${errorPage}?error=auth_failed`);
  }

  return completeSignIn({ supabase, request, origin, next, partnerSubdomain, errorPage });
}
