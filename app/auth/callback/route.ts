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
//   - Onboarding complete → /dashboard (or ?next= param if set)
//   - Paid but not onboarded → /dashboard
//   - Onboarded, not paid, ?next=/checkout → /checkout (paid plan selected on pricing)
//   - Onboarded, not paid, no next → /dashboard (free tier, gating handles the rest)
//   - Partially onboarded → /onboarding?step=2
//   - Fresh user → /onboarding
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
    .select('onboarding_completed, subscription_status, subscription_plan, full_name, email, current_role, goal_role, industry')
    .eq('id', user.id)
    .single();

  // ── MAILERLITE SYNC — fire for every user on every login ──
  // Upsert is idempotent — safe to call on every auth callback.
  // This catches OAuth users (Google/LinkedIn) who bypass /signup.
  try {
    const userEmail = user.email || profile?.email;
    if (userEmail) {
      const { addOrUpdateSubscriber, ML_GROUPS } = await import('@/lib/mailerlite');
      const isPaid =
        profile?.subscription_status === 'active' ||
        profile?.subscription_status === 'trialing';
      const firstName = (profile?.full_name || user.email?.split('@')[0] || '').split(' ')[0];
      await addOrUpdateSubscriber({
        email: userEmail,
        firstName,
        groups: [
          ML_GROUPS.APP_USERS,
          isPaid ? ML_GROUPS.PAID_USERS : ML_GROUPS.FREE_USERS,
        ].filter(Boolean),
        fields: {
          source: 'app_login',
          plan: profile?.subscription_plan || 'free',
        },
        resubscribe: false, // don't resubscribe if they unsubscribed
      });
    }
  } catch (mlErr: any) {
    // Non-fatal — never block the redirect
    console.error('[auth/callback] MailerLite sync error (non-fatal):', mlErr.message);
  }

  // Case 1: Fully set up user (onboarding_completed=true)
  if (profile?.onboarding_completed === true) {
    return NextResponse.redirect(`${origin}${next}`);
  }

  // Check payment status
  const hasPaid =
    profile?.subscription_status === 'active' ||
    profile?.subscription_status === 'trialing';

  // Edge case: paid but onboarding flag not set — send to dashboard
  if (hasPaid && !profile?.onboarding_completed) {
    return NextResponse.redirect(`${origin}/dashboard`);
  }

  // Check how far through onboarding the user is
  const completedStep1 = !!(profile?.full_name && profile?.current_role);
  const completedStep2 = !!(profile?.full_name && profile?.current_role && profile?.goal_role && profile?.industry);

  // Both onboarding steps done — user is fully onboarded
  if (completedStep2) {
    // FIX: If `next` param carries a checkout destination (e.g. from OAuth on pricing page
    // when user picked a paid plan), honour it. Otherwise go straight to dashboard.
    // Free users no longer need to pass through /checkout — the app gates features.
    if (next && next.startsWith('/checkout')) {
      return NextResponse.redirect(`${origin}${next}`);
    }
    return NextResponse.redirect(`${origin}/dashboard`);
  }

  if (completedStep1) {
    // Partially through onboarding — resume at step 2
    return NextResponse.redirect(`${origin}/onboarding?step=2`);
  }

  // Fresh user — start onboarding from the beginning
  return NextResponse.redirect(`${origin}/onboarding`);
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
