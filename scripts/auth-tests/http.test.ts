// Black-box tests against a running dev server. No accounts are created and no
// real credentials are used: every request is either invalid input, a fake
// identity, or unauthenticated.
//   Start the app:  npx next dev -p 3111
//   Run:            BASE_URL=http://localhost:3111 npm run test:auth:http
import { test } from 'node:test';
import assert from 'node:assert/strict';

const BASE = process.env.BASE_URL ?? 'http://localhost:3111';
const RUN = Date.now().toString(36);
// Each test uses its own fake client IP so rate-limit tests cannot bleed into others.
let ipCounter = Math.floor(Math.random() * 200);
const IP_BLOCK = 1 + Math.floor(Math.random() * 250);
const nextIp = () => `198.51.${IP_BLOCK}.${(ipCounter++ % 250) + 1}`;

async function post(path: string, body: unknown, ip = nextIp()) {
  const res = await fetch(BASE + path, {
    method: 'POST',
    redirect: 'manual',
    headers: { 'content-type': 'application/json', 'x-vercel-forwarded-for': ip },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  return { res, json: json as Record<string, any> };
}
const get = (path: string) => fetch(BASE + path, { redirect: 'manual' });

// A dev server (next dev) is always open. Set EXPECT_GATE=true when testing a production build
// without NEXT_PUBLIC_PLATFORM_OPEN to assert the gate instead.
const OPEN = process.env.EXPECT_GATE !== 'true';

test(OPEN ? 'open mode: /login and /signup render' : 'closed mode: /login and /signup redirect home with the gate flag', async () => {
  for (const p of ['/login', '/signup']) {
    const r = await get(p);
    if (OPEN) {
      assert.equal(r.status, 200, p);
    } else {
      assert.equal(r.status, 307, p);
      assert.match(r.headers.get('location') ?? '', /\/\?gate=1$/, p);
    }
  }
});

test('login: malformed input is rejected with a generic message', async () => {
  const { res, json } = await post('/api/auth/login', { email: 'nope', password: '' });
  assert.equal(res.status, 400);
  assert.equal(json.error, 'Incorrect email or password.');
});

test('login: wrong credentials return a generic 401 (no account hints)', async () => {
  const { res, json } = await post('/api/auth/login', { email: `nobody-${RUN}@example.com`, password: 'Wrong-Passw0rd-x' });
  assert.equal(res.status, 401);
  assert.equal(json.error, 'Incorrect email or password.');
  assert.equal(json.code, 'invalid_credentials');
});

test('login: staff mode never keeps a session for bad credentials', async () => {
  const { res } = await post('/api/auth/login', { email: `nobody-${RUN}@example.com`, password: 'Wrong-Passw0rd-x', mode: 'staff' });
  assert.equal(res.status, 401);
  assert.ok(!res.headers.get('set-cookie')?.includes('auth-token'));
});

test('login: rate limits repeated attempts for one email+IP (429 + Retry-After)', async () => {
  const ip = nextIp();
  const email = `ratelimit-${RUN}@example.com`;
  const statuses: number[] = [];
  let retryAfter: string | null = null;
  for (let i = 0; i < 10; i++) {
    const { res } = await post('/api/auth/login', { email, password: 'Wrong-Passw0rd-x' }, ip);
    statuses.push(res.status);
    if (res.status === 429) retryAfter = res.headers.get('retry-after');
  }
  assert.ok(statuses.includes(429), `expected a 429 in ${statuses.join(',')}`);
  assert.ok(retryAfter && Number(retryAfter) > 0, 'Retry-After header present');
  assert.equal(statuses.slice(0, 8).filter((s) => s === 429).length, 0, 'first 8 attempts are allowed');
});

test('signup: invalid email / weak passwords are rejected BEFORE any account is created', async () => {
  const bad = await post('/api/auth/signup', { email: 'not-an-email', password: 'Tr4vel-Lantern-Mist' });
  assert.equal(bad.res.status, 400);
  for (const pw of ['short', 'alllowercase123', 'NoNumbersHereAtAll', 'Password1234']) {
    const { res, json } = await post('/api/auth/signup', { email: `weak-${RUN}@example.com`, password: pw });
    assert.equal(res.status, 400, pw);
    assert.ok(typeof json.error === 'string' && json.error.length > 0, pw);
  }
});

test('forgot-password: same answer for unknown emails (no enumeration)', async () => {
  const a = await post('/api/auth/forgot-password', { email: `ghost-${RUN}@example.com` });
  const b = await post('/api/auth/forgot-password', { email: `ghost2-${RUN}@example.com` });
  assert.equal(a.res.status, 200);
  assert.equal(a.json.status, 'sent');
  assert.deepEqual(a.json, b.json);
  const bad = await post('/api/auth/forgot-password', { email: 'nope' });
  assert.equal(bad.res.status, 400);
});

test('reset-password: weak password and bad code are rejected', async () => {
  const weak = await post('/api/auth/reset-password', { email: `ghost-${RUN}@example.com`, otp_code: '123456', new_password: 'weak' });
  assert.equal(weak.res.status, 400);
  assert.match(String(weak.json.error), /Password/i);
  const badCode = await post('/api/auth/reset-password', { email: `ghost-${RUN}@example.com`, otp_code: '123456', new_password: 'Tr4vel-Lantern-Mist' });
  assert.equal(badCode.res.status, 400);
  assert.match(String(badCode.json.error), /Invalid or expired/i);
});

test('enumeration endpoints are gone', async () => {
  assert.equal((await post('/api/auth/check-email', { email: 'a@b.co' })).res.status, 404);
  assert.equal((await post('/api/check-email', { email: 'a@b.co' })).res.status, 404);
});

test('callback: hostile next= never leaves the site', async () => {
  for (const n of ['@evil.com', '.evil.com', '//evil.com', 'https://evil.com']) {
    const r = await get(`/auth/callback?code=bad&next=${encodeURIComponent(n)}`);
    const loc = r.headers.get('location') ?? '';
    assert.ok(loc.startsWith(BASE + '/'), `${n} -> ${loc}`);
    assert.ok(!/evil\.com/.test(new URL(loc).host), `${n} -> ${loc}`);
  }
});

test('continue: no session -> back to login with a readable error code', async () => {
  const r = await get('/auth/continue?next=/dashboard');
  assert.equal(r.status, 307);
  assert.match(r.headers.get('location') ?? '', /error=session_missing/);
});

test('welcome / admin APIs require a session', async () => {
  assert.equal((await post('/api/welcome', { email: 'victim@example.com', userId: 'x' })).res.status, 401);
  assert.equal((await get('/api/admin/users')).status, 401);
});

test('push: server-to-server routes answer 403 (secret check), not the proxy 401', async () => {
  for (const p of ['/api/push/send', '/api/push/commitment-reminder', '/api/push/session-reminder']) {
    const { res } = await post(p, {});
    assert.equal(res.status, 403, p);
  }
});

test('cron/reminders refuses without the bearer secret', async () => {
  const r = await get('/api/cron/reminders');
  assert.ok([401, 500].includes(r.status), `got ${r.status}`);
});

test('strict validation: unknown fields and bad input are rejected with field-level issues', async () => {
  const extra = await post('/api/contact', { name: 'A', email: 'a@example.com', subject: 'Hi', message: 'Hello', isAdmin: true });
  assert.equal(extra.res.status, 400);
  assert.match(String(extra.json.error), /Unexpected field/i);
  assert.ok(Array.isArray(extra.json.issues) && extra.json.issues.length > 0);

  const bad = await post('/api/contact', { name: '', email: 'nope', subject: '', message: '' });
  assert.equal(bad.res.status, 400);
  assert.ok(bad.json.issues.length >= 3);

  const notJson = await fetch(BASE + '/api/contact', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{oops' });
  assert.equal(notJson.status, 400);

  for (const p of ['/api/waitlist', '/api/newsletter', '/api/lead-magnet', '/api/partner-enquiry', '/api/events/register', '/api/summit/register', '/api/donate/initiate']) {
    const r = await post(p, { definitely: 'not valid' });
    assert.equal(r.res.status, 400, p);
  }
});

// The exact scenarios from manual testing: an account created with Google must get a clear answer
// instead of a generic error. Both calls are read-only (they return before creating anything).
const GOOGLE_ACCOUNT = process.env.TEST_OAUTH_EMAIL;
test('signup with an address that already uses Google says to use Google', { skip: !GOOGLE_ACCOUNT }, async () => {
  const { res, json } = await post('/api/auth/signup', { email: GOOGLE_ACCOUNT, password: 'Tr4vel-Lantern-Mist' });
  assert.equal(res.status, 409);
  assert.equal(json.code, 'use_oauth');
  assert.equal(json.provider, 'google');
  assert.match(String(json.error), /Google/);
});

test('email login against a Google-only account says to use Google', { skip: !GOOGLE_ACCOUNT }, async () => {
  const { res, json } = await post('/api/auth/login', { email: GOOGLE_ACCOUNT, password: 'Wrong-Passw0rd-x' });
  assert.equal(res.status, 401);
  assert.equal(json.code, 'use_oauth');
});

test('forgot-password for a Google-only account names the provider', { skip: !GOOGLE_ACCOUNT }, async () => {
  const { res, json } = await post('/api/auth/forgot-password', { email: GOOGLE_ACCOUNT });
  assert.equal(res.status, 200);
  assert.equal(json.status, 'oauth_only');
});

test('sign-up code: wrong or malformed codes are rejected, resend never reveals accounts', async () => {
  const bad = await post('/api/auth/verify-signup', { email: `nobody-${RUN}@example.com`, code: '123456' });
  assert.equal(bad.res.status, 400);
  assert.equal(bad.json.code, 'invalid_code');
  const malformed = await post('/api/auth/verify-signup', { email: `nobody-${RUN}@example.com`, code: '12ab' });
  assert.equal(malformed.res.status, 400);
  const a = await post('/api/auth/resend-signup', { email: `ghost-${RUN}@example.com` });
  const b = await post('/api/auth/resend-signup', { email: `ghost2-${RUN}@example.com` });
  assert.equal(a.res.status, 200);
  assert.deepEqual(a.json, b.json);
});

test('change password requires a session', async () => {
  const { res } = await post('/api/account/password', { currentPassword: 'x', newPassword: 'Tr4vel-Lantern-Mist' });
  assert.equal(res.status, 401);
});
