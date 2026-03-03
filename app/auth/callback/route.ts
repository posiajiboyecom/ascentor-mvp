import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/nav/dashboard';

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

  const { data: profile } = await supabase
    .from('profiles')
    .select('onboarding_completed, subscription_status, subscription_plan')
    .eq('id', user.id)
    .single();

  // ── CASE 1: Fully set up returning user ──────────────────────
  if (profile?.onboarding_completed === true) {
    return NextResponse.redirect(`${origin}${next}`);  // ← was hardcoded /dashboard
  }

  // ── CASE 2: Paid but onboarding not done ─────────────────────
  const hasPaid =
    !!profile?.subscription_plan ||
    profile?.subscription_status === 'active' ||
    profile?.subscription_status === 'trialing';

  if (hasPaid) {
    return NextResponse.redirect(`${origin}/onboarding`);
  }

  // ── CASE 3: No payment yet ───────────────────────────────────
  return NextResponse.redirect(`${origin}/checkout`);
}