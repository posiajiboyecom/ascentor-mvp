import test from 'node:test';
import assert from 'node:assert/strict';
import {
  COOKIE_MAX_AGE_S, GoogleExchangeError, buildAuthUrl, checkState, cleanPartner, decodeFlow, encodeFlow, exchangeCode, newFlow, pkceChallenge,
  randomToken, redirectUriFor, resolveGoogleMode, sha256Hex,
} from '../../lib/auth/google-oauth';
import { LOGIN_ERRORS } from '../../lib/auth/google-login-errors';

test('PKCE S256 matches the RFC 7636 example', () => {
  assert.equal(pkceChallenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'), 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
});

test('each flow gets a fresh state, verifier and nonce', () => {
  const a = newFlow('/dashboard', null), b = newFlow('/dashboard', null);
  for (const k of ['state', 'verifier', 'nonce'] as const) assert.notEqual(a[k], b[k]);
  assert.ok(a.verifier.length >= 43 && a.verifier.length <= 128);
  assert.match(randomToken(), /^[A-Za-z0-9_-]+$/);
});

test('the authorisation URL carries the hashed nonce, the S256 challenge, state and the three scopes', () => {
  const flow = newFlow('/dashboard', null);
  const u = new URL(buildAuthUrl({ clientId: 'cid.apps.googleusercontent.com', redirectUri: 'https://joinascentor.com/api/auth/google/callback', flow }));
  assert.equal(u.origin + u.pathname, 'https://accounts.google.com/o/oauth2/v2/auth');
  const q = u.searchParams;
  assert.equal(q.get('response_type'), 'code');
  assert.equal(q.get('scope'), 'openid email profile');
  assert.equal(q.get('state'), flow.state);
  assert.equal(q.get('nonce'), sha256Hex(flow.nonce)); // the hash goes to Google, never the raw nonce
  assert.notEqual(q.get('nonce'), flow.nonce);
  assert.equal(q.get('code_challenge'), pkceChallenge(flow.verifier));
  assert.equal(q.get('code_challenge_method'), 'S256');
  assert.equal(q.get('redirect_uri'), 'https://joinascentor.com/api/auth/google/callback');
  assert.equal(u.toString().includes(flow.verifier), false); // the verifier never leaves the server and the cookie
});

test('state: missing, mismatched or expired is refused; a match inside 10 minutes passes', () => {
  const now = 1_000_000_000_000;
  const flow = newFlow('/x', null, now);
  assert.deepEqual(checkState(null, flow.state, now), { ok: false, problem: 'missing' });
  assert.deepEqual(checkState(flow, null, now), { ok: false, problem: 'missing' });
  assert.deepEqual(checkState(flow, '', now), { ok: false, problem: 'missing' });
  assert.deepEqual(checkState(flow, 'not-the-state', now), { ok: false, problem: 'mismatch' });
  assert.deepEqual(checkState(flow, flow.state.slice(0, -1) + (flow.state.endsWith('a') ? 'b' : 'a'), now), { ok: false, problem: 'mismatch' });
  assert.deepEqual(checkState(flow, flow.state, now + COOKIE_MAX_AGE_S * 1000 + 1), { ok: false, problem: 'expired' });
  const ok = checkState(flow, flow.state, now + 9 * 60_000);
  assert.equal(ok.ok, true);
});

test('the cookie round-trips and garbage decodes to nothing', () => {
  const f = newFlow('/learn?x=1', 'acme');
  assert.deepEqual(decodeFlow(encodeFlow(f)), f);
  for (const bad of [undefined, null, '', 'not base64 !!', Buffer.from('{"state":1}').toString('base64url'), Buffer.from('[]').toString('base64url')]) assert.equal(decodeFlow(bad as string), null);
});

test('the return path is same-site only: no open redirect', () => {
  const evil = ['https://evil.com', '//evil.com', '/\\evil.com', '@evil.com', '/login', '/auth/callback', 'javascript:alert(1)', '/ok\r\nSet-Cookie: x=1'];
  for (const e of evil) assert.equal(newFlow(e, null).next, '/dashboard', e);
  assert.equal(newFlow('/learn?tab=2', null).next, '/learn?tab=2');
  assert.equal(newFlow(undefined, null).next, '/dashboard');
  // a tampered cookie is re-checked on the way back in
  const f = encodeFlow({ ...newFlow('/dashboard', null), next: 'https://evil.com' });
  assert.equal(decodeFlow(f)?.next, '/dashboard');
});

test('partner subdomain must be a plain label', () => {
  assert.equal(cleanPartner('acme-co'), 'acme-co');
  for (const bad of ['', 'Acme', '-x', 'x-', 'a.b', 'a/b', '../x', 'a b', 'x'.repeat(64)]) assert.equal(cleanPartner(bad), null, bad);
});

test('GOOGLE_AUTH_MODE defaults to the Supabase flow, and custom without credentials falls back with a warning', () => {
  assert.deepEqual(resolveGoogleMode({}), { mode: 'supabase' });
  assert.deepEqual(resolveGoogleMode({ GOOGLE_AUTH_MODE: 'supabase', GOOGLE_OAUTH_CLIENT_ID: 'a', GOOGLE_OAUTH_CLIENT_SECRET: 'b' }), { mode: 'supabase' });
  assert.deepEqual(resolveGoogleMode({ GOOGLE_AUTH_MODE: 'garbage' }), { mode: 'supabase' });
  const noCreds = resolveGoogleMode({ GOOGLE_AUTH_MODE: 'custom' });
  assert.equal(noCreds.mode, 'supabase');
  assert.match(noCreds.warning ?? '', /GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET are not set/);
  const noSecret = resolveGoogleMode({ GOOGLE_AUTH_MODE: ' Custom ', GOOGLE_OAUTH_CLIENT_ID: 'id', GOOGLE_OAUTH_CLIENT_SECRET: '  ' });
  assert.equal(noSecret.mode, 'supabase');
  assert.match(noSecret.warning ?? '', /GOOGLE_OAUTH_CLIENT_SECRET is not set/);
  assert.equal(JSON.stringify(noSecret).includes('id'.repeat(3)), false);
  assert.deepEqual(resolveGoogleMode({ GOOGLE_AUTH_MODE: 'custom', GOOGLE_OAUTH_CLIENT_ID: 'id', GOOGLE_OAUTH_CLIENT_SECRET: 'sec' }), { mode: 'custom' });
});

test('redirect URI: NEXT_PUBLIC_URL in production, the local origin in development', () => {
  assert.equal(redirectUriFor('https://anything.vercel.app/api/auth/google', { NODE_ENV: 'production', NEXT_PUBLIC_URL: 'https://joinascentor.com/' }), 'https://joinascentor.com/api/auth/google/callback');
  assert.equal(redirectUriFor('https://anything.vercel.app/x', { NODE_ENV: 'production' }), 'https://joinascentor.com/api/auth/google/callback');
  assert.equal(redirectUriFor('http://localhost:3000/api/auth/google', { NODE_ENV: 'development', NEXT_PUBLIC_URL: 'https://joinascentor.com' }), 'http://localhost:3000/api/auth/google/callback');
  // a spoofed Host in production never becomes the redirect target
  assert.equal(redirectUriFor('http://localhost:3000/x', { NODE_ENV: 'production', NEXT_PUBLIC_URL: 'https://joinascentor.com' }), 'https://joinascentor.com/api/auth/google/callback');
});

test('code exchange: sends the verifier and secret to Google, returns only the id_token, and never echoes the code or secret in errors', async () => {
  let seen: { url: string; body: URLSearchParams } | null = null;
  const ok = (async (url: string, init: RequestInit) => { seen = { url, body: new URLSearchParams(String(init.body)) }; return new Response(JSON.stringify({ id_token: 'IDTOKEN', access_token: 'AT' }), { status: 200 }); }) as unknown as typeof fetch;
  const t = await exchangeCode({ code: 'CODE123', verifier: 'VER', clientId: 'CID', clientSecret: 'SECRET-XYZ', redirectUri: 'https://x/cb', fetchImpl: ok });
  assert.equal(t, 'IDTOKEN');
  assert.equal(seen!.url, 'https://oauth2.googleapis.com/token');
  assert.equal(seen!.body.get('code_verifier'), 'VER');
  assert.equal(seen!.body.get('grant_type'), 'authorization_code');
  for (const [res, kind] of [[new Response('{"error":"invalid_grant"}', { status: 400 }), 'rejected'], [new Response('{}', { status: 200 }), 'no_token'], [new Response('not json', { status: 200 }), 'no_token']] as const) {
    await assert.rejects(exchangeCode({ code: 'CODE123', verifier: 'VER', clientId: 'CID', clientSecret: 'SECRET-XYZ', redirectUri: 'https://x/cb', fetchImpl: (async () => res) as unknown as typeof fetch }),
      (e: unknown) => e instanceof GoogleExchangeError && e.kind === kind && !e.message.includes('CODE123') && !e.message.includes('SECRET-XYZ'));
  }
  await assert.rejects(exchangeCode({ code: 'c', verifier: 'v', clientId: 'i', clientSecret: 's', redirectUri: 'r', fetchImpl: (async () => { throw new Error('boom CODE'); }) as unknown as typeof fetch }), (e: unknown) => e instanceof GoogleExchangeError && e.kind === 'network' && !e.message.includes('CODE'));
});

test('every error the flow can end on has a friendly message for /login', () => {
  for (const k of ['google_cancelled', 'google_state', 'google_failed', 'google_rate'] as const) assert.ok(LOGIN_ERRORS[k].length > 20);
  assert.equal(Object.values(LOGIN_ERRORS).some((m) => /token|secret|code|supabase/i.test(m)), false);
});
