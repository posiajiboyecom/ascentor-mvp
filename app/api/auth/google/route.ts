// GET /api/auth/google  - starts our own Google sign-in (see lib/auth/google-oauth.ts).
// Only used when GOOGLE_AUTH_MODE=custom and both Google credentials are set; otherwise it sends people back to /login so the
// normal (Supabase) button flow is used. ?next= and ?partner_subdomain= are optional and validated.
import { NextRequest, NextResponse } from 'next/server';
import { getClientIp } from '@/lib/rate-limit';
import { rateLimit } from '@/lib/auth/rate-limit-shared';
import { platformOpen } from '@/lib/launch';
import { COOKIE_MAX_AGE_S, COOKIE_NAME, COOKIE_PATH, buildAuthUrl, encodeFlow, newFlow, redirectUriFor, resolveGoogleMode } from '@/lib/auth/google-oauth';

export const dynamic = 'force-dynamic';

const LIMIT = { scope: 'google-oauth:start', max: 20, windowSeconds: 300 };
const toLogin = (req: NextRequest, error?: string) => NextResponse.redirect(new URL(error ? `/login?error=${error}` : '/login', req.url));

export async function GET(req: NextRequest) {
  // Same community gate as /login and /signup: while the platform is closed there is nothing to sign in to.
  if (!platformOpen()) return NextResponse.redirect(new URL('/?gate=1', req.url));

  const { mode, warning } = resolveGoogleMode();
  if (warning) console.warn('[google-oauth]', warning);
  if (mode !== 'custom') return toLogin(req);

  const limit = await rateLimit(getClientIp(req), LIMIT);
  if (!limit.allowed) return toLogin(req, 'google_rate');

  const sp = req.nextUrl.searchParams;
  const flow = newFlow(sp.get('next'), sp.get('partner_subdomain'));
  const url = buildAuthUrl({ clientId: process.env.GOOGLE_OAUTH_CLIENT_ID!.trim(), redirectUri: redirectUriFor(req.url), flow });

  const res = NextResponse.redirect(url);
  res.cookies.set(COOKIE_NAME, encodeFlow(flow), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax', // Google sends the browser back with a top-level GET, which Lax cookies allow
    path: COOKIE_PATH,
    maxAge: COOKIE_MAX_AGE_S,
  });
  res.headers.set('Cache-Control', 'no-store');
  return res;
}
