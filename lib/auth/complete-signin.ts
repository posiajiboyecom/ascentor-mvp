// lib/auth/complete-signin.ts
// What happens AFTER a provider sign-in has produced a Supabase session: the location-risk check, the partner whitelist, the
// MailerLite sync and the post-login routing. Shared by /auth/callback (Supabase's redirect flow) and
// /api/auth/google/callback (our own Google flow), so both land people in exactly the same place.
import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { assessLogin } from '@/lib/auth/login-security';
import { resolvePostLoginPath, syncMailerLite } from '@/lib/auth/post-login';
import { markSplashPending } from '@/lib/splash';

const supabaseService = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/** Call once the session cookies are set. Returns the redirect the caller should return. */
export async function completeSignIn(opts: {
  supabase: SupabaseClient;
  request: Request;
  origin: string;
  next: string;
  partnerSubdomain?: string | null;
  /** Where a failure sends the person: the page they started from. Defaults to /login. */
  errorPage?: '/login' | '/signup';
}): Promise<NextResponse> {
  const { supabase, request, origin, next, partnerSubdomain } = opts;
  const errorPage = opts.errorPage ?? '/login';
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(`${origin}${errorPage}?error=auth_failed`);
  }

  // Location-risk check for OAuth / link sign-ins (password sign-ins run it in
  // /api/auth/login). Blocks this session only; fails open on lookup errors.
  const assessment = await assessLogin(user.id, request);
  if (!assessment.allowed) {
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}${errorPage}?error=login_blocked`);
  }

  // ── PARTNER FLOW ──────────────────────────────────────────
  if (partnerSubdomain) {
    return handlePartnerCallback(origin, user, partnerSubdomain, next);
  }

  // ── MAIN ASCENTOR FLOW ────────────────────────────────────
  // One shared router decides the destination for every sign-in method.
  const { data: profile } = await supabase
    .from("profiles")
    .select("subscription_status, subscription_plan, full_name, email")
    .eq("id", user.id)
    .maybeSingle();

  await syncMailerLite(user, profile);

  const destination = await resolvePostLoginPath(supabase, user, next);
  // Plays the splash once on the first app page after this sign-in.
  return markSplashPending(NextResponse.redirect(`${origin}${destination}`));
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
