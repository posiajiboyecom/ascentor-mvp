import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('onboarding_completed')
          .eq('id', user.id)
          .single();

        // Returning user who finished everything — go to dashboard
        if (profile?.onboarding_completed) {
          return NextResponse.redirect(`${origin}/dashboard`);
        }

        // Has a profile but not fully onboarded — check if they already paid
        if (profile) {
          const { data: fullProfile } = await supabase
            .from('profiles')
            .select('subscription_status, subscription_plan')
            .eq('id', user.id)
            .single();

          const hasPaid =
            fullProfile?.subscription_status === 'active' ||
            fullProfile?.subscription_status === 'trialing' ||
            !!fullProfile?.subscription_plan;

          // Paid but skipped onboarding — send them there directly
          if (hasPaid) {
            return NextResponse.redirect(`${origin}/onboarding`);
          }
        }
      }

      // New user — needs to pay first
      return NextResponse.redirect(`${origin}/checkout`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
