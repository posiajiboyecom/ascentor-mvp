import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// ============================================================
// AUTH CALLBACK — /auth/callback
//
// After Google (or any OAuth) login, exchange the code for a
// session then route the user to the right place:
//
//   1. No profile / onboarding incomplete  →  /onboarding
//   2. Profile complete, no subscription   →  /checkout
//   3. Profile complete + active sub       →  /dashboard
//
// This prevents existing users from being forced through
// onboarding every time they log in.
// ============================================================

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');

  // Optional: honour a ?redirect= param so deep links survive login
  const redirectTo = searchParams.get('redirect');

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=auth_failed`);
  }

  const supabase = await createClient();
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError) {
    return NextResponse.redirect(`${origin}/login?error=auth_failed`);
  }

  // ── Get the freshly authenticated user ───────────────────────────
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.redirect(`${origin}/login?error=auth_failed`);
  }

  // ── Fetch their profile to check onboarding + subscription ───────
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, current_role, industry, subscription_status, subscription_end')
    .eq('id', user.id)
    .single();

  // ── Routing logic ─────────────────────────────────────────────────

  // If a specific deep-link redirect was requested and the user is
  // fully set up, honour it (skip onboarding / checkout checks).
  // We only honour redirects to internal, safe paths.
  const safeRedirect =
    redirectTo &&
    redirectTo.startsWith('/') &&
    !redirectTo.startsWith('//') // prevent open redirect
      ? redirectTo
      : null;

  // 1. Onboarding incomplete — missing the core profile fields set
  //    during onboarding (full_name, current_role, industry).
  const onboardingComplete =
    profile?.full_name &&
    profile?.current_role &&
    profile?.industry;

  if (!onboardingComplete) {
    return NextResponse.redirect(`${origin}/onboarding`);
  }

  // 2. Onboarding done — check subscription
  const hasActiveSub = checkActiveSub(profile);

  if (!hasActiveSub) {
    // Honour deep-link if subscription isn't required for that route.
    // For now we always send unpaid users to /checkout.
    return NextResponse.redirect(`${origin}/checkout`);
  }

  // 3. Fully set up — send to dashboard (or honoured deep-link)
  return NextResponse.redirect(`${origin}${safeRedirect ?? '/dashboard'}`);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function checkActiveSub(profile: any): boolean {
  if (!profile) return false;
  const { subscription_status, subscription_end } = profile;

  if (subscription_status === 'active' || subscription_status === 'trialing') {
    if (subscription_end) return new Date(subscription_end) > new Date();
    return true;
  }

  // Cancelled but still within the billing period
  if (subscription_status === 'cancelled' && subscription_end) {
    return new Date(subscription_end) > new Date();
  }

  return false;
}
