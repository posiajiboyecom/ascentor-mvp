// Pure-logic tests (no server, no database). Run: npm run test:auth:unit
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { safeNext } from '../../lib/auth/safe-next';
import { checkPasswordShape, isBreachedPassword, PASSWORD_MIN } from '../../lib/auth/password-policy';
import { RateLimiter } from '../../lib/rate-limit';

test('safeNext keeps same-site paths', () => {
  assert.equal(safeNext('/dashboard'), '/dashboard');
  assert.equal(safeNext('/coach?x=1#a'), '/coach?x=1#a');
  assert.equal(safeNext('/checkout?plan=builder&billing=monthly'), '/checkout?plan=builder&billing=monthly');
  assert.equal(safeNext('/p/acme/dashboard'), '/p/acme/dashboard');
});

test('safeNext rejects every open-redirect shape', () => {
  const hostile = [
    '@evil.com', '.evil.com', '//evil.com', 'https://evil.com', 'http://evil.com/x',
    String.raw`/\evil.com`, '/\t/evil.com', 'javascript:alert(1)', '', '   ', null, undefined,
  ];
  for (const h of hostile) assert.equal(safeNext(h as string | null), '/dashboard', `should reject ${JSON.stringify(h)}`);
});

test('safeNext never bounces back into auth screens', () => {
  for (const p of ['/login', '/signup', '/admin-login', '/auth/callback', '/login?x=1']) {
    assert.equal(safeNext(p), '/dashboard', p);
  }
});

test('password shape rules', () => {
  assert.equal(checkPasswordShape('Short1a').ok, false);
  assert.equal(checkPasswordShape('alllowercase123').ok, false);
  assert.equal(checkPasswordShape('ALLUPPERCASE123').ok, false);
  assert.equal(checkPasswordShape('NoNumbersHereAtAll').ok, false);
  assert.equal(checkPasswordShape('x'.repeat(129) + 'A1').ok, false);
  assert.equal(checkPasswordShape('Password1234').ok, false, 'deny-listed');
  assert.equal(checkPasswordShape(undefined).ok, false);
  assert.equal(checkPasswordShape('Tr4vel-Lantern-Mist').ok, true);
  assert.ok(PASSWORD_MIN >= 10);
});

test('breached-password lookup (needs network; skipped if offline)', async (t) => {
  const pwned = await isBreachedPassword('password');
  const fresh = await isBreachedPassword('zq' + Math.random().toString(36).slice(2) + 'Xv9-' + Date.now());
  if (!pwned) { t.skip('HIBP unreachable - fail-open path exercised'); return; }
  assert.equal(pwned, true);
  assert.equal(fresh, false);
});

test('breached-password lookup fails OPEN on timeout', async () => {
  assert.equal(await isBreachedPassword('password', 1), false);
});

test('RateLimiter blocks after the limit and reports retryAfter', () => {
  const rl = new RateLimiter({ limit: 3, windowMs: 60_000 });
  for (let i = 0; i < 3; i++) assert.equal(rl.check('k').allowed, true);
  const blocked = rl.check('k');
  assert.equal(blocked.allowed, false);
  assert.ok(blocked.retryAfter > 0);
  assert.equal(rl.check('other').allowed, true, 'keys are independent');
});
