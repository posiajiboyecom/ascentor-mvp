// app/auth/continue/route.ts
// Post-sign-in router for email + password logins (OAuth and email-confirmation
// links use /auth/callback). The browser has already set the session cookie;
// this resolves the destination server-side with the same rules as the
// callback, so every sign-in method behaves identically.

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { resolvePostLoginPath, syncMailerLite } from '@/lib/auth/post-login';
import { markSplashPending } from '@/lib/splash';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(`${origin}/login?error=session_missing`);
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('subscription_status, subscription_plan, full_name, email')
    .eq('id', user.id)
    .maybeSingle();
  await syncMailerLite(user, profile);

  const destination = await resolvePostLoginPath(supabase, user, searchParams.get('next'));
  // Plays the splash once on the first app page after this sign-in.
  return markSplashPending(NextResponse.redirect(`${origin}${destination}`));
}
