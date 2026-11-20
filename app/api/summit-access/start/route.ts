// POST /api/summit-access/start  { email, captchaToken? } -> { ok, existing }
// Step 1 of the Summit free year: the email must be on the approved list and not yet claimed; a 6-digit code is
// emailed to it. `existing` tells the page whether this email already has an Ascentor account (then no password step).
import { NextRequest, NextResponse } from 'next/server';
import { getClientIp } from '@/lib/rate-limit';
import { rateLimit } from '@/lib/auth/rate-limit-shared';
import { verifyTurnstile } from '@/lib/auth/turnstile';
import { findAccountByEmail } from '@/lib/auth/account-lookup';
import { issueSignupOtp } from '@/lib/auth/signup-otp';
import { findGrant } from '@/lib/summit-access';
import { parseJson } from '@/lib/validation/http';
import * as authSchemas from '@/lib/validation/schemas/auth';

export async function POST(req: NextRequest) {
  const parsed = await parseJson(req, authSchemas.summitAccessStart);
  if (!parsed.ok) return parsed.response;
  const email = parsed.data.email.trim().toLowerCase();
  const ip = getClientIp(req);
  const limit = await rateLimit(ip, { scope: 'summit-access:ip', max: 15, windowSeconds: 600 });
  if (!limit.allowed) return NextResponse.json({ error: 'Too many attempts. Please wait a few minutes and try again.', code: 'rate_limited' }, { status: 429 });
  if (!(await verifyTurnstile(parsed.data.captchaToken, ip))) {
    return NextResponse.json({ error: 'Please complete the security check and try again.', code: 'captcha', captcha: true }, { status: 400 });
  }

  try {
    const grant = await findGrant(email);
    if (!grant) {
      return NextResponse.json({
        error: 'This email isn’t on the Summit list yet. Use the email you registered for the Summit with, or the one you emailed us from. Still stuck? Email joinascentor@gmail.com.',
        code: 'not_listed',
      }, { status: 404 });
    }
    if (grant.claimed_user_id) {
      return NextResponse.json({ error: 'This email has already claimed its free year. Sign in to use Ascentor.', code: 'claimed' }, { status: 409 });
    }
    const account = await findAccountByEmail(email);
    const existing = !!account && account.emailConfirmed;
    const issued = await issueSignupOtp(email);
    if (!issued.ok) {
      return issued.reason === 'too_many'
        ? NextResponse.json({ error: 'Too many codes sent to this email. Please wait an hour and try again.', code: 'rate_limited' }, { status: 429 })
        : NextResponse.json({ error: 'We couldn’t send your code just now. Please try again in a minute.', code: 'email_failed' }, { status: 502 });
    }
    return NextResponse.json({ ok: true, existing });
  } catch (e) {
    console.error('[summit-access/start]', (e as Error).message);
    return NextResponse.json({ error: 'Something went wrong. Please try again.', code: 'server_error' }, { status: 500 });
  }
}
