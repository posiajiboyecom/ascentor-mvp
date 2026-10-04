// POST /api/auth/login
// ─────────────────────────────────────────────────────────────────────────────
// Server-side email + password sign-in for BOTH the member login and the staff
// login (mode: 'staff'). Doing it here (instead of in the browser) lets us:
//   * rate limit per IP, per email+IP and per email - across instances
//   * require a CAPTCHA (Turnstile, when configured)
//   * run the location-risk check where it cannot be skipped
//   * verify the staff role before a staff session is ever kept
// The Supabase session cookie is set on this response by the SSR client.
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getClientIp } from '@/lib/rate-limit';
import { LIMITS, rateLimitAll } from '@/lib/auth/rate-limit-shared';
import { verifyTurnstile } from '@/lib/auth/turnstile';
import { assessLogin } from '@/lib/auth/login-security';
import { isPlausibleEmail } from '@/lib/otp';

const STAFF_ROLES = ['admin', 'moderator'];
const GENERIC_FAIL = 'Incorrect email or password.';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const { email, password, captchaToken, mode } = (body ?? {}) as Record<string, unknown>;

  if (!isPlausibleEmail(email) || typeof password !== 'string' || !password || password.length > 256) {
    return NextResponse.json({ error: GENERIC_FAIL }, { status: 400 });
  }
  const normalizedEmail = email.toLowerCase().trim();
  const ip = getClientIp(req);

  const limit = await rateLimitAll([
    { identifier: ip, limit: LIMITS.loginIp },
    { identifier: `${normalizedEmail}|${ip}`, limit: LIMITS.loginEmailIp },
    { identifier: normalizedEmail, limit: LIMITS.loginEmail },
  ]);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Too many sign-in attempts. Please wait a few minutes and try again.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfter) } },
    );
  }

  if (!(await verifyTurnstile(captchaToken, ip))) {
    return NextResponse.json({ error: 'Please complete the security check and try again.', captcha: true }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });

  if (error || !data.user) {
    if (error && /not confirmed/i.test(error.message)) {
      return NextResponse.json({ error: 'Please confirm your email address first.', code: 'email_not_confirmed' }, { status: 403 });
    }
    return NextResponse.json({ error: GENERIC_FAIL }, { status: 401 });
  }

  // Staff sign-in: the session is only kept for admins / moderators.
  if (mode === 'staff') {
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', data.user.id).maybeSingle();
    if (!profile || !STAFF_ROLES.includes(profile.role)) {
      await supabase.auth.signOut();
      return NextResponse.json({ error: 'This account does not have staff access.' }, { status: 403 });
    }
  }

  const assessment = await assessLogin(data.user.id, req);
  if (!assessment.allowed) {
    await supabase.auth.signOut(); // this session only - other devices stay signed in
    return NextResponse.json({ error: assessment.message, code: 'login_blocked' }, { status: 403 });
  }

  // Tell the staff UI whether a second factor is needed (see ADMIN_MFA_REQUIRED).
  let mfa: { required: boolean; enrolled: boolean } | undefined;
  if (mode === 'staff') {
    const { data: factors } = await supabase.auth.mfa.listFactors();
    const enrolled = (factors?.totp ?? []).some((f) => f.status === 'verified');
    mfa = { required: process.env.ADMIN_MFA_REQUIRED === 'true', enrolled };
  }

  return NextResponse.json({ ok: true, mfa });
}
