// Exercises the sign-up code logic against the real table with a throwaway address on the reserved
// .invalid domain. No account is created and NO EMAIL IS SENT: the code row is inserted directly
// (what issueSignupOtp stores) and then verified through verifySignupOtp. Rows are deleted afterwards.
//   NODE_OPTIONS=--conditions=react-server npm run test:auth:otp
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { config } from 'dotenv';

config({ path: '.env.local' });

const EMAIL = `otp-test-${Date.now().toString(36)}@example.invalid`;
const CODE = '654321';

async function deps() {
  const [{ supabaseAdmin }, otp, signup] = await Promise.all([
    import('../../lib/supabase/admin'),
    import('../../lib/otp'),
    import('../../lib/auth/signup-otp'),
  ]);
  return { supabaseAdmin, ...otp, ...signup };
}

async function insertCode(purpose: 'signup' | 'password_reset', code = CODE, minutes = 15) {
  const d = await deps();
  const { error } = await d.supabaseAdmin.from('password_reset_otps').insert({
    email: EMAIL, purpose, otp_code: d.hashOtp(EMAIL, code, purpose),
    expires_at: new Date(Date.now() + minutes * 60_000).toISOString(), used: false, attempts: 0,
  });
  assert.equal(error, null);
}

after(async () => {
  const { supabaseAdmin } = await deps();
  await supabaseAdmin.from('password_reset_otps').delete().eq('email', EMAIL);
});

test('a correct sign-up code verifies once and cannot be reused', async () => {
  const d = await deps();
  await insertCode('signup');
  assert.deepEqual(await d.verifySignupOtp(EMAIL, '000000'), { ok: false }, 'wrong code');
  assert.deepEqual(await d.verifySignupOtp(EMAIL, CODE), { ok: true }, 'right code');
  assert.deepEqual(await d.verifySignupOtp(EMAIL, CODE), { ok: false }, 'code is single use');
});

test('five wrong guesses burn the code even if the right one follows', async () => {
  const d = await deps();
  await d.supabaseAdmin.from('password_reset_otps').delete().eq('email', EMAIL);
  await insertCode('signup');
  for (let i = 0; i < 5; i++) await d.verifySignupOtp(EMAIL, '111111');
  assert.deepEqual(await d.verifySignupOtp(EMAIL, CODE), { ok: false });
});

test('an expired code is rejected', async () => {
  const d = await deps();
  await d.supabaseAdmin.from('password_reset_otps').delete().eq('email', EMAIL);
  await insertCode('signup', CODE, -1);
  assert.deepEqual(await d.verifySignupOtp(EMAIL, CODE), { ok: false });
});

test('a password-reset code can never confirm a sign-up (and the reverse)', async () => {
  const d = await deps();
  await d.supabaseAdmin.from('password_reset_otps').delete().eq('email', EMAIL);
  await insertCode('password_reset');
  assert.deepEqual(await d.verifySignupOtp(EMAIL, CODE), { ok: false }, 'reset code must not verify sign-up');
  assert.equal(d.otpMatches(EMAIL, CODE, d.hashOtp(EMAIL, CODE, 'signup'), 'password_reset'), false);
  assert.equal(d.otpMatches(EMAIL, CODE, d.hashOtp(EMAIL, CODE, 'signup'), 'signup'), true);
});
