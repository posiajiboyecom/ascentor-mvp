import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// ============================================================
// AUTH CALLBACK — OAuth redirect handler
//
// Correct flow for every user state:
//
//  New user (no profile)                → /checkout
//  Has profile, not paid                → /checkout
//  Paid but onboarding NOT complete     → /onboarding   ← key fix
//  Paid and onboarding complete         → /dashboard
//
// Your Paystack webhook writes:
//   subscription_plan:   'basic' | 'standard' | 'premium'
//   subscription_status: 'active' | 'trialing'
// ============================================================

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=auth_failed`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error('[auth/callback] Session exchange failed:', error.message);
    return NextResponse.redirect(`${origin}/login?error=auth_failed`);
  }

  // Session is now active — fetch the user
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(`${origin}/login?error=auth_failed`);
  }

  // Fetch their profile — all columns we need in one query
  const { data: profile } = await supabase
    .from('profiles')
    .select('onboarding_completed, subscription_status, subscription_plan')
    .eq('id', user.id)
    .single();

  // ── CASE 1: Fully set up returning user ──────────────────────
  // onboarding_completed = true means they have paid AND finished
  // onboarding in a previous session. Send straight to dashboard.
  if (profile?.onboarding_completed === true) {
    return NextResponse.redirect(`${origin}/dashboard`);
  }

  // ── CASE 2: Paid but onboarding not done ─────────────────────
  // Payment webhook has run and set subscription_plan/status,
  // but they closed the window before finishing onboarding.
  // Must go to /onboarding — never skip it.
  const hasPaid =
    !!profile?.subscription_plan ||
    profile?.subscription_status === 'active' ||
    profile?.subscription_status === 'trialing';

  if (hasPaid) {
    return NextResponse.redirect(`${origin}/onboarding`);
  }

  // ── CASE 3: No payment yet ───────────────────────────────────
  // New user or returning user who never paid.
  return NextResponse.redirect(`${origin}/checkout`);
}
