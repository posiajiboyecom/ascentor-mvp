// GET /api/auth/google  - starts our own Google sign-in (see lib/auth/google-oauth.ts).
// Only used when GOOGLE_AUTH_MODE=custom and both Google credentials are set; otherwise it sends people back to /login so the
// normal (Supabase) button flow is used. ?next= and ?partner_subdomain= are optional and validated.
import { NextRequest, NextResponse } from 'next/server';
import { getClientIp } from '@/lib/rate-limit';
import { rateLimit } from '@/lib/auth/rate-limit-shared';
import { platformOpen } from '@/lib/launch';
import { COOKIE_MAX_AGE_S, COOKIE_NAME, COOKIE_PATH, authPagePath, buildAuthUrl, cleanFrom, encodeFlow, newFlow, redirectUriFor, resolveGoogleMode } from '@/lib/auth/google-oauth';

export const dynamic = 'force-dynamic';

const LIMIT = { scope: 'google-oauth:start', max: 20, windowSeconds: 300 };
// Failures go back to the page the person started from (?from=login|signup, else the Referer), never to the other auth page.
function startedFrom(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('from');
  if (q) return cleanFrom(q);
  try { return cleanFrom(new URL(req.headers.get('referer') ?? '').pathname === '/signup' ? 'signup' : 'login'); } catch { return cleanFrom(null); }
}
const toLogin = (req: NextRequest, error?: string) => NextResponse.redirect(new URL(`${authPagePath(startedFrom(req))}${error ? `?error=${error}` : ''}`, req.url));

export async function GET(req: NextRequest) {
  // Same community gate as /login and /signup: while the platform is closed there is nothing to sign in to.
  if (!platformOpen()) return NextResponse.redirect(new URL('/?gate=1', req.url));

  const { mode, warning } = resolveGoogleMode();
  if (warning) console.warn('[google-oauth]', warning);
  if (mode !== 'custom') return toLogin(req);

  const limit = await rateLimit(getClientIp(req), LIMIT);
  if (!limit.allowed) return toLogin(req, 'google_rate');

  const redirectUri = redirectUriFor(req.url);
  // The state cookie belongs to one host. If the person arrived on another host (www or a preview), restart on the host Google will
  // send them back to, otherwise the callback would never see the cookie and every sign-in would end in "google_state".
  const home = new URL(redirectUri).origin;
  if (home !== req.nextUrl.origin) return NextResponse.redirect(`${home}${req.nextUrl.pathname}${req.nextUrl.search}`);

  const sp = req.nextUrl.searchParams;
  const flow = newFlow(sp.get('next'), sp.get('partner_subdomain'), startedFrom(req));
  const url = buildAuthUrl({ clientId: process.env.GOOGLE_OAUTH_CLIENT_ID!.trim(), redirectUri, flow });

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
