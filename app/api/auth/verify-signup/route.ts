// POST /api/auth/verify-signup
// Confirms the six-digit code emailed at sign-up and marks the address as confirmed. It does NOT sign
// the user in: the browser then calls /api/auth/login with the password it still holds, so the normal
// sign-in protections (rate limits, location check) apply to the first sign-in too.

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getClientIp } from '@/lib/rate-limit';
import { LIMITS, rateLimit } from '@/lib/auth/rate-limit-shared';
import { findAccountByEmail } from '@/lib/auth/account-lookup';
import { verifySignupOtp } from '@/lib/auth/signup-otp';
import { alertNewMember } from '@/lib/adminAlerts';
import { parseJson } from '@/lib/validation/http';
import * as authSchemas from '@/lib/validation/schemas/auth';

const INVALID = () => NextResponse.json(
  { error: 'That code is not right or has expired. Check the latest email, or request a new code.', code: 'invalid_code' },
  { status: 400 },
);

export async function POST(req: NextRequest) {
  const limit = await rateLimit(getClientIp(req), LIMITS.verifySignupIp);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Too many attempts. Please wait a few minutes and try again.', code: 'rate_limited' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfter) } },
    );
  }

  const parsed = await parseJson(req, authSchemas.verifySignup);
  if (!parsed.ok) return parsed.response;
  const { email, code } = parsed.data;

  const account = await findAccountByEmail(email);
  if (!account || !account.hasPassword) return INVALID();

  // Already confirmed: nothing to do, let the client carry on to sign-in.
  if (account.emailConfirmed) return NextResponse.json({ ok: true, alreadyConfirmed: true });

  const result = await verifySignupOtp(email, code);
  if (!result.ok) return INVALID();

  const { error } = await supabaseAdmin.auth.admin.updateUserById(account.id, { email_confirm: true });
  if (error) {
    console.error('[verify-signup] could not confirm user:', error.message);
    return NextResponse.json({ error: 'Your code was right but we could not finish confirming your account. Please try again.', code: 'server_error' }, { status: 500 });
  }

  await alertNewMember({ email });
  return NextResponse.json({ ok: true });
}
