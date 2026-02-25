import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Get the user after session is established
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('onboarding_completed, subscription_status, plan')
          .eq('id', user.id)
          .single();

        // Already fully set up — go straight to dashboard
        if (profile?.onboarding_completed) {
          return NextResponse.redirect(`${origin}/dashboard`);
        }

        // Paid but hasn't completed onboarding yet
        const hasPaid =
          profile?.subscription_status === 'active' ||
          profile?.subscription_status === 'trialing' ||
          !!profile?.plan;

        if (hasPaid) {
          return NextResponse.redirect(`${origin}/onboarding`);
        }
      }

      // New user — no profile or no payment yet — go to checkout
      return NextResponse.redirect(`${origin}/checkout`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
