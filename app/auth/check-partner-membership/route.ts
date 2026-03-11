// ============================================================
// AUTH CALLBACK — app/auth/callback/route.ts
//
// Handles the OAuth/magic-link redirect after Supabase auth.
//
// PARTNER WHITELIST CHECK (new):
// If the callback includes a `partner_subdomain` param (set by
// the partner signup/login pages), the user's email is checked
// against partner_members for that partner before they are
// allowed into the partner dashboard.
//
// Partner flow:
//   - Email in partner_members + status active/invited → allowed
//     (invited rows are auto-activated here)
//   - Email NOT in partner_members → redirect to access-denied
//   - Email in partner_members but suspended/removed → redirect to access-denied
//
// Main Ascentor flow (no partner_subdomain param):
//   - Onboarding complete → /dashboard
//   - Paid but not onboarded → /onboarding
//   - No payment → /checkout
// ============================================================

import { createClient }        from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { NextResponse }        from 'next/server';

const supabaseService = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code             = searchParams.get('code');
  const next             = searchParams.get('next') ?? '/dashboard';
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

  // ── PARTNER FLOW ──────────────────────────────────────────
  if (partnerSubdomain) {
    return handlePartnerCallback(origin, user, partnerSubdomain, next);
  }

  // ── MAIN ASCENTOR FLOW ────────────────────────────────────
  const { data: profile } = await supabase
    .from('profiles')
    .select('onboarding_completed, subscription_status, subscription_plan')
    .eq('id', user.id)
    .single();

  // Case 1: Fully set up returning user
  if (profile?.onboarding_completed === true) {
    return NextResponse.redirect(`${origin}${next}`);
  }

  // Case 2: Paid but onboarding not done
  const hasPaid =
    !!profile?.subscription_plan ||
    profile?.subscription_status === 'active' ||
    profile?.subscription_status === 'trialing';

  if (hasPaid) {
    return NextResponse.redirect(`${origin}/onboarding`);
  }

  // Case 3: No payment yet
  return NextResponse.redirect(`${origin}/checkout`);
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
    // OAuth accounts with no email — shouldn't happen but guard anyway
    return NextResponse.redirect(
      `${origin}/p/${subdomain}/access-denied?reason=no_email`
    );
  }

  // Look up this partner by subdomain
  const { data: partner } = await supabaseService
    .from('partners')
    .select('id, name')
    .eq('subdomain', subdomain)
    .eq('status', 'active')
    .single();

  if (!partner) {
    // Partner doesn't exist or isn't active — send to main Ascentor
    return NextResponse.redirect(`${origin}/dashboard`);
  }

  // Check membership
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

  // Auto-activate invited members who completed OAuth
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

  // Allowed — redirect to intended destination inside partner shell
  const destination = next.startsWith(`/p/${subdomain}`)
    ? next
    : `/p/${subdomain}/dashboard`;

  return NextResponse.redirect(`${origin}${destination}`);
}
