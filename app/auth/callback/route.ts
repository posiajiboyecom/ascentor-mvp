// ============================================================
// AUTH CALLBACK — app/auth/callback/route.ts — v2
//
// FIX: Respects ?next param explicitly when set to /onboarding
//      (free plan email confirmation — skip checkout entirely)
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
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { NextResponse }        from 'next/server';
import { safeNext }            from '@/lib/auth/safe-next';
import { assessLogin }         from '@/lib/auth/login-security';
import { resolvePostLoginPath, syncMailerLite } from '@/lib/auth/post-login';

const supabaseService = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code             = searchParams.get('code');
  const rawNext          = searchParams.get('next');
  // Same-site paths only. Raw interpolation of an unchecked value allowed
  // open redirects (e.g. next=@evil.com -> https://site@evil.com).
  const next             = safeNext(rawNext, '/dashboard');
  const partnerSubdomain = searchParams.get('partner_subdomain');

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=auth_failed`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error('[auth/callback] Session exchange failed:', error.message);
    return NextResponse.redirect(`${origin}/login?error=auth_failed`);
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(`${origin}/login?error=auth_failed`);
  }

  // Location-risk check for OAuth / link sign-ins (password sign-ins run it in
  // /api/auth/login). Blocks this session only; fails open on lookup errors.
  const assessment = await assessLogin(user.id, request);
  if (!assessment.allowed) {
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/login?error=login_blocked`);
  }

  // ── PARTNER FLOW ──────────────────────────────────────────
  if (partnerSubdomain) {
    return handlePartnerCallback(origin, user, partnerSubdomain, next);
  }

  // ── MAIN ASCENTOR FLOW ────────────────────────────────────
  // One shared router decides the destination for every sign-in method.
  const { data: profile } = await supabase
    .from("profiles")
    .select("subscription_status, subscription_plan, full_name, email")
    .eq("id", user.id)
    .maybeSingle();

  await syncMailerLite(user, profile);

  const destination = await resolvePostLoginPath(supabase, user, next);
  return NextResponse.redirect(`${origin}${destination}`);
}

// ── Partner callback handler ──────────────────────────────
async function handlePartnerCallback(
  origin: string,
  user: { id: string; email?: string },
  subdomain: string,
  next: string,
) {
  const email = user.email;

  if (!email) {
    return NextResponse.redirect(
      `${origin}/p/${subdomain}/access-denied?reason=no_email`
    );
  }

  const { data: partner } = await supabaseService
    .from('partners')
    .select('id, name')
    .eq('subdomain', subdomain)
    .eq('status', 'active')
    .single();

  if (!partner) {
    return NextResponse.redirect(`${origin}/dashboard`);
  }

  const { data: membership } = await supabaseService
    .from('partner_members')
    .select('id, status')
    .eq('partner_id', partner.id)
    .eq('email', email.toLowerCase())
    .maybeSingle();

  if (!membership) {
    return NextResponse.redirect(
      `${origin}/p/${subdomain}/access-denied?reason=not_invited`
    );
  }

  if (membership.status === 'suspended') {
    return NextResponse.redirect(
      `${origin}/p/${subdomain}/access-denied?reason=suspended`
    );
  }

  if (membership.status === 'removed') {
    return NextResponse.redirect(
      `${origin}/p/${subdomain}/access-denied?reason=removed`
    );
  }

  if (membership.status === 'invited') {
    await supabaseService
      .from('partner_members')
      .update({
        status:    'active',
        user_id:   user.id,
        joined_at: new Date().toISOString(),
      })
      .eq('id', membership.id);
  }

  const destination = next.startsWith(`/p/${subdomain}`)
    ? next
    : `/p/${subdomain}/dashboard`;

  return NextResponse.redirect(`${origin}${destination}`);
}
