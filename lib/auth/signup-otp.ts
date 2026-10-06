// lib/auth/signup-otp.ts
// Issue and check the one-time code that proves ownership of an email address at sign-up.
// Storage and hardening mirror the password-reset flow (hashed code, 15 minute expiry, five guesses,
// optimistic attempt counter, one live code per address) but are bound to purpose = 'signup'.
// This is a sign-up step only: existing members signing in are never asked for a code.
import 'server-only';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { generateOtp, hashOtp, otpMatches, OTP_TTL_MS, OTP_MAX_ATTEMPTS, OTP_MAX_PER_HOUR } from '@/lib/otp';
import { sendSignupOTP } from '@/lib/email';

const PURPOSE = 'signup' as const;

export type IssueResult = { ok: true } | { ok: false; reason: 'too_many' | 'store_failed' | 'email_failed' };

/** Creates a fresh code (invalidating older ones) and emails it. */
export async function issueSignupOtp(email: string): Promise<IssueResult> {
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await supabaseAdmin
    .from('password_reset_otps')
    .select('id', { count: 'exact', head: true })
    .eq('email', email)
    .eq('purpose', PURPOSE)
    .gte('created_at', hourAgo);
  if ((count ?? 0) >= OTP_MAX_PER_HOUR) return { ok: false, reason: 'too_many' };

  await supabaseAdmin.from('password_reset_otps').update({ used: true }).eq('email', email).eq('purpose', PURPOSE).eq('used', false);

  const code = generateOtp();
  const { error } = await supabaseAdmin.from('password_reset_otps').insert({
    email,
    purpose: PURPOSE,
    otp_code: hashOtp(email, code, PURPOSE),
    expires_at: new Date(Date.now() + OTP_TTL_MS).toISOString(),
    used: false,
    attempts: 0,
  });
  if (error) {
    console.error('[signup-otp] insert failed:', error.message);
    return { ok: false, reason: 'store_failed' };
  }

  try {
    await sendSignupOTP({ to: email, otpCode: code });
  } catch (err) {
    console.error('[signup-otp] email failed:', err);
    return { ok: false, reason: 'email_failed' };
  }
  return { ok: true };
}

export type VerifyResult = { ok: true } | { ok: false };

/** Checks a submitted code. Counts the attempt before comparing, consumes the code on success. */
export async function verifySignupOtp(email: string, code: string): Promise<VerifyResult> {
  const { data: row } = await supabaseAdmin
    .from('password_reset_otps')
    .select('id, otp_code, attempts')
    .eq('email', email)
    .eq('purpose', PURPOSE)
    .eq('used', false)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!row) return { ok: false };

  if (row.attempts >= OTP_MAX_ATTEMPTS) {
    await supabaseAdmin.from('password_reset_otps').update({ used: true }).eq('id', row.id);
    return { ok: false };
  }

  const { data: bumped } = await supabaseAdmin
    .from('password_reset_otps')
    .update({ attempts: row.attempts + 1 })
    .eq('id', row.id)
    .eq('attempts', row.attempts)
    .select('id');
  if (!bumped?.length) return { ok: false };

  if (!otpMatches(email, code, row.otp_code, PURPOSE)) return { ok: false };

  const { data: claimed } = await supabaseAdmin
    .from('password_reset_otps')
    .update({ used: true })
    .eq('id', row.id)
    .eq('used', false)
    .select('id');
  return claimed?.length ? { ok: true } : { ok: false };
}
