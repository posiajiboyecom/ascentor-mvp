// Summit free year claim token (lib/summit-access.ts): run with
//   npx tsx --conditions=react-server --test scripts/auth-tests/summit-access.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'test-secret';
process.env.NEXT_PUBLIC_SUPABASE_URL ||= 'https://example.supabase.co';

test('a fresh token gives back its email', async () => {
  const { makeClaimToken, readClaimToken } = await import('../../lib/summit-access');
  const t = makeClaimToken('  Ada@Example.com ');
  assert.equal(readClaimToken(t), 'ada@example.com');
});

test('expired, edited and junk tokens are refused', async () => {
  const { makeClaimToken, readClaimToken, CLAIM_TOKEN_MINUTES } = await import('../../lib/summit-access');
  const t = makeClaimToken('ada@example.com', Date.now() - (CLAIM_TOKEN_MINUTES + 1) * 60_000);
  assert.equal(readClaimToken(t), null);
  const good = makeClaimToken('ada@example.com');
  const [, mac] = good.split('.');
  const forged = `${Buffer.from(`eve@example.com|${Date.now() + 600_000}`).toString('base64url')}.${mac}`;
  assert.equal(readClaimToken(forged), null);
  for (const junk of ['', 'abc', 'a.b', 42, null, 'x'.repeat(700)]) assert.equal(readClaimToken(junk), null);
});
