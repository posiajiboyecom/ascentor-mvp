// ============================================================
// AUTH CALLBACK — app/auth/callback/route.ts — v2
//
// FIX: Respects ?next param explicitly when set to /onboarding
//      (free plan email confirmation — skip checkout entirely)
// FIX: Respects ?next=/checkout?plan=X... so paid plan email
//      confirmations land at checkout with plan pre-selected
//
// Main Ascentor flow routing priority:
//   1. onboarding_completed=true             → next (usually /dashboard)
//   2. hasPaid but not onboarded             → /dashboard
//   3. next=/onboarding explicitly set       → /onboarding  (free plan)
//   4. next=/checkout?plan=X explicitly set  → /checkout?plan=X (paid intent)
//   5. completedStep2 (both onboarding steps done, unpaid) → /checkout
//   6. completedStep1 (partially onboarded)  → /onboarding?step=2
//   7. Fresh user                            → /onboarding
//
// PARTNER WHITELIST CHECK:
// If the callback includes a `partner_subdomain` param, the user's
// email is checked against partner_members before entering the
// partner dashboard.
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
        resubscribe: false,
      });
    }
  } catch (mlErr: any) {
    console.error('[auth/callback] MailerLite sync error (non-fatal):', mlErr.message);
  }

  // ── ROUTING PRIORITY ──────────────────────────────────────

  // 1. Fully set up user (onboarding_completed includes free users who
  //    completed onboarding — set by /api/onboarding/complete)
  if (profile?.onboarding_completed === true) {
    return NextResponse.redirect(`${origin}${next.startsWith('/checkout') || next === '/onboarding' ? '/dashboard' : next}`);
  }

  // 2. Paid but onboarding flag not set — send to dashboard
  const hasPaid =
    profile?.subscription_status === 'active' ||
    profile?.subscription_status === 'trialing';

  if (hasPaid && !profile?.onboarding_completed) {
    return NextResponse.redirect(`${origin}/dashboard`);
  }

  // 3. Free plan explicit intent — next=/onboarding was set by signup page.
  //    Route directly to onboarding, bypassing checkout entirely.
  if (next === '/onboarding') {
    return NextResponse.redirect(`${origin}/onboarding`);
  }

  // 4. Paid plan explicit intent — next=/checkout?plan=X was set by signup.
  //    Route to checkout with plan pre-selected so user doesn't have to
  //    re-pick the plan they already chose on the pricing page.
  if (next.startsWith('/checkout')) {
    return NextResponse.redirect(`${origin}${next}`);
  }

  // 5–7. Standard onboarding routing for users who came through
  //      other paths (direct /signup, OAuth, etc.)

  const completedStep1 = !!(profile?.full_name && profile?.current_role);
  const completedStep2 = !!(profile?.full_name && profile?.current_role && profile?.goal_role && profile?.industry);

  if (completedStep2) {
    // Both steps done, not paid — send to checkout
    return NextResponse.redirect(`${origin}/checkout`);
  }

  if (completedStep1) {
    // Partially through onboarding — resume at step 2
    return NextResponse.redirect(`${origin}/onboarding?step=2`);
  }

  // Fresh user — start onboarding from beginning
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
