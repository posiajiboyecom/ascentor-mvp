import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { sendPasswordResetOTP } from '@/lib/email';
import { strictLimiter, getClientIp } from '@/lib/rate-limit';
import { generateOtp, hashOtp, isPlausibleEmail, OTP_TTL_MS, OTP_MAX_PER_HOUR } from '@/lib/otp';

// The response is identical whether or not the account exists, so this endpoint
// cannot be used to discover which emails are registered.
const UNIFORM = {
  success: true,
  status: 'sent',
  message: 'If an account exists, a reset code has been sent.',
} as const;

export async function POST(req: NextRequest) {
  try {
    const limit = strictLimiter.check(getClientIp(req));
    if (!limit.allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please wait a minute and try again.' },
        { status: 429, headers: { 'Retry-After': String(limit.retryAfter) } }
      );
    }

    const body = await req.json().catch(() => null);
    if (!isPlausibleEmail(body?.email)) {
      return NextResponse.json({ error: 'A valid email is required' }, { status: 400 });
    }
    const email = (body.email as string).toLowerCase().trim();

    // Per-email cap, stored in the database so it holds across serverless
    // instances (the in-memory limiter above is best-effort only).
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count } = await supabaseAdmin
      .from('password_reset_otps')
      .select('id', { count: 'exact', head: true })
      .eq('email', email)
      .gte('created_at', hourAgo);
    if ((count ?? 0) >= OTP_MAX_PER_HOUR) return NextResponse.json(UNIFORM);

    // Look up by profile (indexed) instead of listing every auth user, which
    // only returned the first page and did not scale.
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name')
      .eq('email', email)
      .maybeSingle();
    if (!profile) return NextResponse.json(UNIFORM);

    const { data: authRes } = await supabaseAdmin.auth.admin.getUserById(profile.id);
    const provider = authRes?.user?.app_metadata?.provider;
    if (provider === 'google' || provider === 'linkedin') {
      return NextResponse.json(UNIFORM); // social accounts have no password to reset
    }

    // Only the newest code is ever valid.
    await supabaseAdmin
      .from('password_reset_otps')
      .update({ used: true })
      .eq('email', email)
      .eq('used', false);

    const otp = generateOtp();
    const { error: insertError } = await supabaseAdmin
      .from('password_reset_otps')
      .insert({
        email,
        otp_code:   hashOtp(email, otp),
        expires_at: new Date(Date.now() + OTP_TTL_MS).toISOString(),
        used:       false,
        attempts:   0,
      });
    if (insertError) {
      console.error('[forgot-password] insert error:', insertError);
      return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
    }

    try {
      await sendPasswordResetOTP({
        to: email,
        otpCode: otp,
        firstName: profile.full_name || 'there',
      });
    } catch (emailError) {
      console.error('[forgot-password] email error:', emailError);
    }

    return NextResponse.json(UNIFORM);
  } catch (err) {
    console.error('[forgot-password] unexpected error:', err);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
