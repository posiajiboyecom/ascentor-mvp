// POST /api/auth/signup
// Server-side sign-up. Enforces the password policy (including the breached-
// password check), rate limits, and the CAPTCHA before Supabase sees anything,
// then creates the account. Responds { ok, needsConfirmation }.
// needsConfirmation === true means Supabase is waiting on the email link.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getClientIp } from '@/lib/rate-limit';
import { LIMITS, rateLimit } from '@/lib/auth/rate-limit-shared';
import { verifyTurnstile } from '@/lib/auth/turnstile';
import { validatePassword } from '@/lib/auth/password-policy';
import { parseJson } from '@/lib/validation/http';
import * as authSchemas from '@/lib/validation/schemas/auth';

export async function POST(req: NextRequest) {
  const parsed = await parseJson(req, authSchemas.signup);
  if (!parsed.ok) return parsed.response;
  const { email, password, captchaToken, next } = parsed.data;

  const ip = getClientIp(req);
  const limit = await rateLimit(ip, LIMITS.signupIp);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Too many sign-up attempts. Please try again later.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfter) } },
    );
  }

  const policy = await validatePassword(password);
  if (!policy.ok) {
    return NextResponse.json({ error: policy.error }, { status: 400 });
  }

  if (!(await verifyTurnstile(captchaToken, ip))) {
    return NextResponse.json({ error: 'Please complete the security check and try again.', captcha: true }, { status: 400 });
  }

  const origin = new URL(req.url).origin;
  const dest = next; // already reduced to a same-site path by the schema

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(dest)}` },
  });

  if (error) {
    // Supabase's own validation messages (weak/duplicate etc.) are safe to show.
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, needsConfirmation: !data.session });
}
