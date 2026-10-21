// lib/otp.ts
// One-time-code helpers for password reset.
//  - codes come from crypto.randomInt (Math.random is not cryptographically secure)
//  - only an HMAC of the code is stored, never the code itself
import 'server-only';
import crypto from 'crypto';

export const OTP_TTL_MS       = 15 * 60 * 1000;
/** Password-reset links work once, for one hour. (Sign-up codes keep the shorter OTP_TTL_MS.) */
export const RESET_TTL_MS     = 60 * 60 * 1000;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_MAX_PER_HOUR = 5;

export function generateOtp(): string {
  return String(crypto.randomInt(100000, 1000000));
}

function key(): string {
  const k = process.env.OTP_HMAC_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!k) throw new Error('OTP_HMAC_SECRET (or SUPABASE_SERVICE_ROLE_KEY) is not configured');
  return k;
}

export type OtpPurpose = 'password_reset' | 'signup';

/** Codes are bound to their purpose, so a sign-up code can never reset a password (and vice versa). */
export function hashOtp(email: string, code: string, purpose: OtpPurpose = 'password_reset'): string {
  const payload = purpose === 'password_reset' ? `${email.toLowerCase()}:${code}` : `${purpose}:${email.toLowerCase()}:${code}`;
  return crypto.createHmac('sha256', key()).update(payload).digest('hex');
}

export function otpMatches(email: string, code: string, storedHash: string, purpose: OtpPurpose = 'password_reset'): boolean {
  const a = Buffer.from(hashOtp(email, code, purpose), 'hex');
  const b = Buffer.from(storedHash, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const isPlausibleEmail = (v: unknown): v is string =>
  typeof v === 'string' && v.length <= 254 && EMAIL_RE.test(v.trim());
