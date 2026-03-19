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
    .select('full_name, current_role, industry, subscription_status, subscription_end, created_at')
    .eq('id', user.id)
    .single();

  // ── Sync NEW users to MailerLite (non-blocking) ───────────────────
  // A user is "new" if their profile was created in the last 60 seconds
  // (i.e. this is their very first OAuth login, not a returning session).
  const isNewUser = profile?.created_at
    ? (Date.now() - new Date(profile.created_at).getTime()) < 60_000
    : !profile; // no profile yet = definitely new

  if (isNewUser) {
    const name  = profile?.full_name || user.user_metadata?.full_name || user.email?.split('@')[0] || '';
    const email = user.email!;
    // Fire-and-forget — don't await, don't block the redirect
    fetch(`${origin}/api/welcome`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email, name, userId: user.id }),
    }).catch(err => console.error('[auth/callback] welcome ping failed:', err));
  }

  // ── Routing logic ─────────────────────────────────────────────────

  const safeRedirect =
    redirectTo &&
    redirectTo.startsWith('/') &&
    !redirectTo.startsWith('//') // prevent open redirect
      ? redirectTo
      : null;

  // 1. Onboarding incomplete
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
