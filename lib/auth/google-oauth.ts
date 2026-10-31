// lib/auth/google-oauth.ts
// Our own Google sign-in, so Google's "Choose an account" screen says joinascentor.com instead of the Supabase project URL.
//
//   /api/auth/google            -> builds state + PKCE verifier + nonce, keeps them in a short-lived cookie, sends the browser to Google
//   /api/auth/google/callback   -> checks state, swaps the code for an id_token at Google, hands the id_token to Supabase
//                                  (signInWithIdToken), then runs the same post-sign-in steps as the old flow
//
// Pure functions only (Node crypto, no server-only import) so the rules can be unit-tested. Nothing here logs a code, a token or
// the client secret.
import crypto from 'node:crypto';
import { safeNext } from './safe-next';

export const GOOGLE_AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
export const GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
export const COOKIE_NAME = 'ascentor_google_oauth';
export const COOKIE_PATH = '/api/auth/google';
export const COOKIE_MAX_AGE_S = 10 * 60;

export type GoogleMode = 'custom' | 'supabase';

/**
 * Which flow the "Continue with Google" buttons use. Defaults to 'supabase' (the old flow), so nothing changes until
 * GOOGLE_AUTH_MODE=custom is set. 'custom' without both credentials falls back to 'supabase' and says why.
 */
export function resolveGoogleMode(env: Record<string, string | undefined> = process.env): { mode: GoogleMode; warning?: string } {
  const wanted = String(env.GOOGLE_AUTH_MODE ?? '').trim().toLowerCase();
  if (wanted !== 'custom') return { mode: 'supabase' };
  const missing = [!env.GOOGLE_OAUTH_CLIENT_ID?.trim() && 'GOOGLE_OAUTH_CLIENT_ID', !env.GOOGLE_OAUTH_CLIENT_SECRET?.trim() && 'GOOGLE_OAUTH_CLIENT_SECRET'].filter(Boolean);
  if (missing.length) return { mode: 'supabase', warning: `GOOGLE_AUTH_MODE is "custom" but ${missing.join(' and ')} ${missing.length > 1 ? 'are' : 'is'} not set. Using the Supabase Google flow instead.` };
  return { mode: 'custom' };
}

const b64url = (b: Buffer) => b.toString('base64url');
export const randomToken = (bytes = 32) => b64url(crypto.randomBytes(bytes));
export const sha256Hex = (s: string) => crypto.createHash('sha256').update(s).digest('hex');
/** PKCE S256: base64url(sha256(verifier)). */
export const pkceChallenge = (verifier: string) => b64url(crypto.createHash('sha256').update(verifier).digest());

export type AuthPage = 'login' | 'signup';
/** Which sign-in page the person started from. Only these two values are ever accepted, from the browser or from the cookie. */
export const cleanFrom = (raw: unknown): AuthPage => (raw === 'signup' ? 'signup' : 'login');
export const authPagePath = (from: AuthPage) => (from === 'signup' ? '/signup' : '/login');

export interface FlowCookie { state: string; verifier: string; nonce: string; next: string; partner: string | null; from: AuthPage; at: number }

/** A partner subdomain is lowercase letters, digits and hyphens only. Anything else is dropped. */
export const cleanPartner = (raw: string | null | undefined): string | null => (raw && /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(raw) ? raw : null);

export function newFlow(rawNext: string | null | undefined, rawPartner: string | null | undefined, rawFrom?: string | null, now = Date.now()): FlowCookie {
  return {
    state: randomToken(24),
    verifier: randomToken(48), // 64 chars, within PKCE's 43 to 128
    nonce: randomToken(24),
    next: safeNext(rawNext, '/dashboard'), // same-site paths only: no open redirect
    partner: cleanPartner(rawPartner),
    from: cleanFrom(rawFrom),
    at: now,
  };
}

export const encodeFlow = (f: FlowCookie) => Buffer.from(JSON.stringify(f), 'utf8').toString('base64url');
export function decodeFlow(raw: string | null | undefined): FlowCookie | null {
  if (!raw) return null;
  try {
    const f = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'));
    if (!f || typeof f.state !== 'string' || typeof f.verifier !== 'string' || typeof f.nonce !== 'string' || typeof f.at !== 'number') return null;
    return { state: f.state, verifier: f.verifier, nonce: f.nonce, next: safeNext(f.next, '/dashboard'), partner: cleanPartner(f.partner), from: cleanFrom(f.from), at: f.at };
  } catch { return null; }
}

export type StateProblem = 'missing' | 'expired' | 'mismatch';

/** The cookie must exist, be under 10 minutes old, and its state must equal the one Google sent back (compared in constant time). */
export function checkState(cookie: FlowCookie | null, queryState: string | null | undefined, now = Date.now()): { ok: true; flow: FlowCookie } | { ok: false; problem: StateProblem } {
  if (!cookie || !queryState) return { ok: false, problem: 'missing' };
  if (now - cookie.at > COOKIE_MAX_AGE_S * 1000 || cookie.at > now + 60_000) return { ok: false, problem: 'expired' };
  const a = Buffer.from(cookie.state), b = Buffer.from(queryState);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return { ok: false, problem: 'mismatch' };
  return { ok: true, flow: cookie };
}

/** Where Google sends the browser back to: NEXT_PUBLIC_URL in production, the request's own localhost origin in development. */
export function redirectUriFor(requestUrl: string, env: Record<string, string | undefined> = process.env): string {
  const u = new URL(requestUrl);
  const local = u.hostname === 'localhost' || u.hostname === '127.0.0.1';
  const origin = env.NODE_ENV === 'development' && local ? u.origin : (env.NEXT_PUBLIC_URL || 'https://joinascentor.com').replace(/\/+$/, '');
  return `${origin}/api/auth/google/callback`;
}

export function buildAuthUrl(p: { clientId: string; redirectUri: string; flow: FlowCookie }): string {
  const q = new URLSearchParams({
    client_id: p.clientId,
    redirect_uri: p.redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state: p.flow.state,
    nonce: sha256Hex(p.flow.nonce), // Google puts this in the id_token; Supabase is given the raw value and compares
    code_challenge: pkceChallenge(p.flow.verifier),
    code_challenge_method: 'S256',
    prompt: 'select_account',
  });
  return `${GOOGLE_AUTH_ENDPOINT}?${q.toString()}`;
}

export class GoogleExchangeError extends Error {
  constructor(public kind: 'network' | 'rejected' | 'no_token', public status?: number) { super(`google ${kind}${status ? ` ${status}` : ''}`); }
}

/** Swaps the one-time code for tokens at Google. Returns only the id_token. The message never contains the code or the secret. */
export async function exchangeCode(p: { code: string; verifier: string; clientId: string; clientSecret: string; redirectUri: string; endpoint?: string; fetchImpl?: typeof fetch }): Promise<string> {
  const f = p.fetchImpl ?? fetch;
  let res: Response;
  try {
    res = await f(p.endpoint ?? GOOGLE_TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ code: p.code, client_id: p.clientId, client_secret: p.clientSecret, redirect_uri: p.redirectUri, grant_type: 'authorization_code', code_verifier: p.verifier }).toString(),
      signal: AbortSignal.timeout(10_000),
    });
  } catch { throw new GoogleExchangeError('network'); }
  if (!res.ok) throw new GoogleExchangeError('rejected', res.status);
  let json: { id_token?: unknown };
  try { json = await res.json(); } catch { throw new GoogleExchangeError('no_token', res.status); }
  if (typeof json.id_token !== 'string' || !json.id_token) throw new GoogleExchangeError('no_token', res.status);
  return json.id_token;
}

export { LOGIN_ERRORS, type GoogleLoginError } from './google-login-errors';
