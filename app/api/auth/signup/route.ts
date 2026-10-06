// POST /api/auth/signup
// Email sign-up with a one-time code. Flow:
//   1. validate (strict body), rate limit, CAPTCHA, password policy (incl. breached-password check)
//   2. refuse clearly when the address already has an account:
//        - signs in with Google / LinkedIn  -> code "use_oauth"  (tell them to use that provider)
//        - already has email + password     -> code "account_exists"
//   3. create the user UNCONFIRMED (admin API, so Supabase sends nothing) and email a 6-digit code
//   4. the client submits the code to /api/auth/verify-signup, which confirms the address
// Responds { ok, needsVerification, email }.

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getClientIp } from '@/lib/rate-limit';
import { LIMITS, rateLimit } from '@/lib/auth/rate-limit-shared';
import { verifyTurnstile } from '@/lib/auth/turnstile';
import { validatePassword } from '@/lib/auth/password-policy';
import { findAccountByEmail, oauthOnlyProvider, PROVIDER_LABEL } from '@/lib/auth/account-lookup';
import { issueSignupOtp } from '@/lib/auth/signup-otp';
import { parseJson } from '@/lib/validation/http';
import * as authSchemas from '@/lib/validation/schemas/auth';

const EXISTS = (email: string) => NextResponse.json(
  { error: `An account with ${email} already exists. Sign in instead, or reset your password if you have forgotten it.`, code: 'account_exists' },
  { status: 409 },
);

export async function POST(req: NextRequest) {
  const parsed = await parseJson(req, authSchemas.signup);
  if (!parsed.ok) return parsed.response;
  const { email, password, captchaToken } = parsed.data;

  const ip = getClientIp(req);
  const limit = await rateLimit(ip, LIMITS.signupIp);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Too many sign-up attempts. Please try again later.', code: 'rate_limited' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfter) } },
    );
  }

  const policy = await validatePassword(password);
  if (!policy.ok) {
    return NextResponse.json({ error: policy.error, code: 'weak_password' }, { status: 400 });
  }

  if (!(await verifyTurnstile(captchaToken, ip))) {
    return NextResponse.json({ error: 'Please complete the security check and try again.', code: 'captcha', captcha: true }, { status: 400 });
  }

  // 2. Who already owns this address?
  const existing = await findAccountByEmail(email);
  if (existing) {
    const oauth = oauthOnlyProvider(existing);
    if (oauth) {
      const label = PROVIDER_LABEL[oauth] ?? oauth;
      return NextResponse.json(
        { error: `${email} is already registered with ${label}. Please continue with ${label} instead of using a password.`, code: 'use_oauth', provider: oauth },
        { status: 409 },
      );
    }
    if (existing.emailConfirmed) return EXISTS(email);

    // An earlier attempt never finished: let them resume with the password they just chose.
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(existing.id, { password });
    if (updateError) {
      console.error('[signup] could not refresh unconfirmed user:', updateError.message);
      return NextResponse.json({ error: 'We could not restart your sign-up. Please try again.', code: 'server_error' }, { status: 500 });
    }
  } else {
    // 3. Create the user unconfirmed. The admin API sends no email of its own.
    const { error: createError } = await supabaseAdmin.auth.admin.createUser({ email, password, email_confirm: false });
    if (createError) {
      if (/already|registered|exists/i.test(createError.message)) return EXISTS(email);
      console.error('[signup] createUser failed:', createError.message);
      return NextResponse.json({ error: 'We could not create your account. Please try again in a moment.', code: 'server_error' }, { status: 500 });
    }
  }

  const issued = await issueSignupOtp(email);
  if (!issued.ok) {
    if (issued.reason === 'too_many') {
      return NextResponse.json({ error: 'Too many codes requested for this address. Please wait an hour and try again.', code: 'rate_limited' }, { status: 429 });
    }
    return NextResponse.json(
      { error: 'Your account was created but we could not send the verification email. Use "Resend code" in a moment.', code: 'email_failed', needsVerification: true, email },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true, needsVerification: true, email });
}
