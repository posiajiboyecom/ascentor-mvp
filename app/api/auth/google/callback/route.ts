// GET /api/auth/google/callback  - where Google sends the browser back.
// Checks the state cookie, swaps the code for an id_token, gives the id_token to Supabase, then runs the shared post-sign-in steps.
// Every failure ends on /login with a friendly message. Nothing sensitive (code, tokens, secret) is ever logged.
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getClientIp } from '@/lib/rate-limit';
import { rateLimit } from '@/lib/auth/rate-limit-shared';
import { completeSignIn } from '@/lib/auth/complete-signin';
import { platformOpen } from '@/lib/launch';
import { COOKIE_NAME, COOKIE_PATH, GoogleExchangeError, authPagePath, checkState, decodeFlow, exchangeCode, redirectUriFor, resolveGoogleMode, type GoogleLoginError } from '@/lib/auth/google-oauth';

export const dynamic = 'force-dynamic';

const LIMIT = { scope: 'google-oauth:callback', max: 20, windowSeconds: 300 };

// Every failure returns to the page the person started from (the cookie says which; only 'login' or 'signup' are ever accepted).
function back(req: NextRequest, error: GoogleLoginError, from: 'login' | 'signup' = 'login') {
  const res = NextResponse.redirect(new URL(`${authPagePath(from)}?error=${error}`, req.url));
  res.cookies.set(COOKIE_NAME, '', { path: COOKIE_PATH, maxAge: 0 });
  res.headers.set('Cache-Control', 'no-store');
  return res;
}

export async function GET(req: NextRequest) {
  const { mode } = resolveGoogleMode();
  if (mode !== 'custom') return NextResponse.redirect(new URL('/login', req.url));
  // Same gate as the start route: while the platform is closed there is nothing to sign in to.
  if (!platformOpen()) return NextResponse.redirect(new URL('/?gate=1', req.url));

  const stored = decodeFlow(req.cookies.get(COOKIE_NAME)?.value);
  const from = stored?.from ?? 'login';

  const limit = await rateLimit(getClientIp(req), LIMIT);
  if (!limit.allowed) return back(req, 'google_rate', from);

  const sp = req.nextUrl.searchParams;
  // The person pressed Cancel (or Google refused): not an error worth logging.
  if (sp.get('error')) return back(req, sp.get('error') === 'access_denied' ? 'google_cancelled' : 'google_failed', from);

  const checked = checkState(stored, sp.get('state'));
  if (!checked.ok) {
    // Pressing Back or Refresh on the callback after a finished sign-in arrives without the (single-use) cookie. Someone who is
    // already signed in goes on to their dashboard instead of seeing a scary error.
    if (checked.problem === 'missing') {
      const { data: { user } } = await (await createClient()).auth.getUser();
      if (user) return NextResponse.redirect(new URL('/auth/continue', req.url));
    }
    console.warn('[google-oauth] state check failed:', checked.problem);
    return back(req, 'google_state', from);
  }
  const { flow } = checked;

  const code = sp.get('code');
  if (!code) return back(req, 'google_failed', from);

  let idToken: string;
  try {
    idToken = await exchangeCode({
      code, verifier: flow.verifier,
      clientId: process.env.GOOGLE_OAUTH_CLIENT_ID!.trim(),
      clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET!.trim(),
      redirectUri: redirectUriFor(req.url),
      // Test hook, development only: lets the local end-to-end test stand in for Google's token endpoint.
      endpoint: process.env.NODE_ENV === 'development' ? process.env.GOOGLE_OAUTH_TEST_TOKEN_ENDPOINT || undefined : undefined,
    });
  } catch (e) {
    const g = e instanceof GoogleExchangeError ? e : null;
    console.error('[google-oauth] token exchange failed:', g ? `${g.kind}${g.status ? ` ${g.status}` : ''}` : 'unknown');
    return back(req, 'google_failed', from);
  }

  // Supabase checks the token's signature, audience (the Client ID must be listed under Auth > Providers > Google) and nonce.
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithIdToken({ provider: 'google', token: idToken, nonce: flow.nonce });
  if (error) {
    console.error('[google-oauth] Supabase rejected the Google sign-in:', error.status ?? '', String(error.message).slice(0, 160));
    return back(req, 'google_failed', from);
  }

  const res = await completeSignIn({ supabase, request: req, origin: new URL(req.url).origin, next: flow.next, partnerSubdomain: flow.partner, errorPage: authPagePath(from) });
  res.cookies.set(COOKIE_NAME, '', { path: COOKIE_PATH, maxAge: 0 }); // single use
  res.headers.set('Cache-Control', 'no-store');
  return res;
}
