import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getClientIp } from '@/lib/rate-limit';
import { LIMITS, rateLimit } from '@/lib/auth/rate-limit-shared';
import { validatePassword } from '@/lib/auth/password-policy';
import { otpMatches, OTP_MAX_ATTEMPTS } from '@/lib/otp';
import { parseJson } from '@/lib/validation/http';
import * as authSchemas from '@/lib/validation/schemas/auth';
import { revokeAllSessions } from '@/lib/auth/revoke-sessions';
import { sendPasswordChangedEmail } from '@/lib/email';

const invalid = () =>
  NextResponse.json({ error: 'Invalid or expired reset code', code: 'invalid_code' }, { status: 400 });

export async function POST(req: NextRequest) {
  try {
    const limit = await rateLimit(getClientIp(req), LIMITS.resetIp);
    if (!limit.allowed) {
      return NextResponse.json(
        { error: 'Too many attempts. Please wait a minute and try again.' },
        { status: 429, headers: { 'Retry-After': String(limit.retryAfter) } }
      );
    }

    const parsed = await parseJson(req, authSchemas.resetPassword);
    if (!parsed.ok) return parsed.response;
    const { email, otp_code, new_password } = parsed.data;
    const policy = await validatePassword(new_password);
    if (!policy.ok) {
      return NextResponse.json({ error: policy.error }, { status: 400 });
    }

    const normalizedEmail = email;
    const code = otp_code;

    // Newest live code for this email.
    const { data: otp } = await supabaseAdmin
      .from('password_reset_otps')
      .select('id, otp_code, attempts')
      .eq('email', normalizedEmail)
      .eq('purpose', 'password_reset')
      .eq('used', false)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!otp) return invalid();

    // Burn the code once it has been guessed at too many times.
    if (otp.attempts >= OTP_MAX_ATTEMPTS) {
      await supabaseAdmin.from('password_reset_otps').update({ used: true }).eq('id', otp.id);
      return invalid();
    }

    // Count the attempt BEFORE comparing, with an optimistic lock: of N
    // concurrent guesses only one wins the increment and gets compared, so
    // parallel requests cannot multiply the attempt budget.
    const { data: bumped } = await supabaseAdmin
      .from('password_reset_otps')
      .update({ attempts: otp.attempts + 1 })
      .eq('id', otp.id)
      .eq('attempts', otp.attempts)
      .select('id');
    if (!bumped?.length) return invalid();

    if (!otpMatches(normalizedEmail, code, otp.otp_code)) return invalid();

    // One-time use: claim the code before touching the password.
    const { data: claimed } = await supabaseAdmin
      .from('password_reset_otps')
      .update({ used: true })
      .eq('id', otp.id)
      .eq('used', false)
      .select('id');
    if (!claimed?.length) return invalid();

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name')
      .eq('email', normalizedEmail)
      .maybeSingle();
    if (!profile) return invalid();

    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(profile.id, {
      password: new_password,
    });
    if (updateError) {
      console.error('[reset-password] update error:', updateError);
      return NextResponse.json({ error: 'Failed to update password' }, { status: 500 });
    }

    // A reset means the old credential may be compromised: sign the account out
    // everywhere, then tell the owner. Both are best-effort - the password has
    // already changed, so neither may fail the request.
    const revoked = await revokeAllSessions(normalizedEmail, new_password);
    if (!revoked) console.warn('[reset-password] could not revoke existing sessions for', profile.id);
    try {
      await sendPasswordChangedEmail({ to: normalizedEmail, firstName: profile.full_name || 'there' });
    } catch (mailErr) {
      console.error('[reset-password] notice email failed:', mailErr);
    }

    return NextResponse.json({ success: true, message: 'Password updated successfully' });
  } catch (err) {
    console.error('[reset-password] unexpected error:', err);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
