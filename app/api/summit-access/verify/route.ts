// POST /api/summit-access/verify  { email, code } -> { ok, done, until } | { ok, token }
// Step 2: checks the 6-digit code. An email that already has an account gets the free year straight away (done)
// and signs in as usual. A new email gets a short-lived token for step 3 (choose a password).
import { NextRequest, NextResponse } from 'next/server';
import { getClientIp } from '@/lib/rate-limit';
import { LIMITS, rateLimit } from '@/lib/auth/rate-limit-shared';
import { findAccountByEmail, oauthOnlyProvider, PROVIDER_LABEL } from '@/lib/auth/account-lookup';
import { verifySignupOtp } from '@/lib/auth/signup-otp';
import { claimGrant, findGrant, makeClaimToken } from '@/lib/summit-access';
import { parseJson } from '@/lib/validation/http';
import * as authSchemas from '@/lib/validation/schemas/auth';

export async function POST(req: NextRequest) {
  const parsed = await parseJson(req, authSchemas.summitAccessVerify);
  if (!parsed.ok) return parsed.response;
  const email = parsed.data.email.trim().toLowerCase();
  const limit = await rateLimit(getClientIp(req), LIMITS.verifySignupIp);
  if (!limit.allowed) return NextResponse.json({ error: 'Too many attempts. Please wait a few minutes and try again.', code: 'rate_limited' }, { status: 429 });

  try {
    const grant = await findGrant(email);
    if (!grant) return NextResponse.json({ error: 'This email isn’t on the Summit list.', code: 'not_listed' }, { status: 404 });
    if (grant.claimed_user_id) return NextResponse.json({ error: 'This email has already claimed its free year. Sign in to use Ascentor.', code: 'claimed' }, { status: 409 });

    const v = await verifySignupOtp(email, parsed.data.code);
    if (!v.ok) return NextResponse.json({ error: 'That code is wrong or has expired. Check the latest email, or send a new code.', code: 'invalid_code' }, { status: 400 });

    const account = await findAccountByEmail(email);
    if (account && account.emailConfirmed) {
      const r = await claimGrant(email, account.id);
      if (!r.ok) return NextResponse.json({ error: 'This email has already claimed its free year.', code: 'claimed' }, { status: 409 });
      const oauth = oauthOnlyProvider(account);
      return NextResponse.json({ ok: true, done: true, until: r.until, signInWith: oauth ? (PROVIDER_LABEL[oauth] ?? oauth) : null });
    }
    return NextResponse.json({ ok: true, token: makeClaimToken(email) });
  } catch (e) {
    console.error('[summit-access/verify]', (e as Error).message);
    return NextResponse.json({ error: 'Something went wrong. Please try again.', code: 'server_error' }, { status: 500 });
  }
}
