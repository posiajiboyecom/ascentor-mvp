import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { strictLimiter, getClientIp } from '@/lib/rate-limit';
import { otpMatches, isPlausibleEmail, OTP_MAX_ATTEMPTS } from '@/lib/otp';

const invalid = () =>
  NextResponse.json({ error: 'Invalid or expired reset code' }, { status: 400 });

export async function POST(req: NextRequest) {
  try {
    const limit = strictLimiter.check(getClientIp(req));
    if (!limit.allowed) {
      return NextResponse.json(
        { error: 'Too many attempts. Please wait a minute and try again.' },
        { status: 429, headers: { 'Retry-After': String(limit.retryAfter) } }
      );
    }

    const body = await req.json().catch(() => null);
    const { email, otp_code, new_password } = body ?? {};

    if (!isPlausibleEmail(email) || typeof otp_code !== 'string' || typeof new_password !== 'string') {
      return NextResponse.json({ error: 'Email, OTP code, and new password are required' }, { status: 400 });
    }
    if (new_password.length < 8 || new_password.length > 128) {
      return NextResponse.json({ error: 'Password must be between 8 and 128 characters' }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const code = otp_code.trim();
    if (!/^\d{6}$/.test(code)) return invalid();

    // Newest live code for this email.
    const { data: otp } = await supabaseAdmin
      .from('password_reset_otps')
      .select('id, otp_code, attempts')
      .eq('email', normalizedEmail)
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
      .select('id')
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

    return NextResponse.json({ success: true, message: 'Password updated successfully' });
  } catch (err) {
    console.error('[reset-password] unexpected error:', err);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
