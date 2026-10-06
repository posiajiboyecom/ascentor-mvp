// POST /api/auth/resend-signup
// Emails a fresh sign-up code to an address whose account is still unconfirmed. Always answers
// { ok: true } so it cannot be used to probe for accounts; the code only goes out when one applies.

import { NextRequest, NextResponse } from 'next/server';
import { getClientIp } from '@/lib/rate-limit';
import { LIMITS, rateLimit } from '@/lib/auth/rate-limit-shared';
import { verifyTurnstile } from '@/lib/auth/turnstile';
import { findAccountByEmail } from '@/lib/auth/account-lookup';
import { issueSignupOtp } from '@/lib/auth/signup-otp';
import { parseJson } from '@/lib/validation/http';
import * as authSchemas from '@/lib/validation/schemas/auth';

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const limit = await rateLimit(ip, LIMITS.resendSignupIp);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please wait a few minutes and try again.', code: 'rate_limited' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfter) } },
    );
  }

  const parsed = await parseJson(req, authSchemas.resendSignup);
  if (!parsed.ok) return parsed.response;
  const { email, captchaToken } = parsed.data;

  if (!(await verifyTurnstile(captchaToken, ip))) {
    return NextResponse.json({ error: 'Please complete the security check and try again.', code: 'captcha', captcha: true }, { status: 400 });
  }

  const account = await findAccountByEmail(email);
  if (account && account.hasPassword && !account.emailConfirmed) {
    const issued = await issueSignupOtp(email);
    if (!issued.ok && issued.reason === 'too_many') {
      return NextResponse.json({ error: 'Too many codes requested for this address. Please wait an hour and try again.', code: 'rate_limited' }, { status: 429 });
    }
    if (!issued.ok) {
      return NextResponse.json({ error: 'We could not send the email just now. Please try again in a moment.', code: 'email_failed' }, { status: 502 });
    }
  }
  return NextResponse.json({ ok: true });
}
