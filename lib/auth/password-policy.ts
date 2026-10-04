// lib/auth/password-policy.ts
// Server-side password policy. The browser forms show the same rules, but
// the browser is not a security boundary: sign-up and reset go through our
// API routes, which call validatePassword() before Supabase ever sees the
// password. No `server-only` import so it can be unit-tested directly.
import crypto from 'crypto';

export const PASSWORD_MIN = 10;
export const PASSWORD_MAX = 128;

export const PASSWORD_RULES_TEXT =
  `At least ${PASSWORD_MIN} characters, with an uppercase letter, a lowercase letter and a number.`;

// A small deny-list of the passwords people actually pick. The breached-password
// check below is the real defence; this keeps working if that service is down.
const COMMON = new Set([
  'password1', 'password12', 'password123', 'password1234', 'passw0rd123', 'qwerty12345', 'qwertyuiop1',
  '1234567890', '12345678910', 'iloveyou123', 'welcome123', 'welcome1234', 'letmein1234', 'admin12345',
  'abc1234567', 'ascentor123', 'ascentor1234', 'changeme123', 'football123', 'monkey12345',
]);

export type PasswordCheck = { ok: true } | { ok: false; error: string };

export function checkPasswordShape(pw: unknown): PasswordCheck {
  if (typeof pw !== 'string') return { ok: false, error: 'A password is required.' };
  if (pw.length < PASSWORD_MIN) return { ok: false, error: `Password must be at least ${PASSWORD_MIN} characters.` };
  if (pw.length > PASSWORD_MAX) return { ok: false, error: `Password must be at most ${PASSWORD_MAX} characters.` };
  if (!/[A-Z]/.test(pw)) return { ok: false, error: 'Password must contain an uppercase letter.' };
  if (!/[a-z]/.test(pw)) return { ok: false, error: 'Password must contain a lowercase letter.' };
  if (!/[0-9]/.test(pw)) return { ok: false, error: 'Password must contain a number.' };
  if (COMMON.has(pw.toLowerCase())) return { ok: false, error: 'That password is too common. Choose something harder to guess.' };
  return { ok: true };
}

/**
 * Have I Been Pwned range lookup (k-anonymity: only the first 5 hex chars of the
 * SHA-1 leave the server). Fails OPEN - an outage must never block sign-ups.
 */
export async function isBreachedPassword(pw: string, timeoutMs = 2500): Promise<boolean> {
  try {
    const sha1 = crypto.createHash('sha1').update(pw).digest('hex').toUpperCase();
    const prefix = sha1.slice(0, 5);
    const suffix = sha1.slice(5);
    const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { 'Add-Padding': 'true' },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return false;
    const body = await res.text();
    return body.split('\n').some((line) => {
      const [hash, count] = line.trim().split(':');
      return hash === suffix && Number(count) > 0;
    });
  } catch {
    return false;
  }
}

/** Shape rules + breached-password check. */
export async function validatePassword(pw: unknown): Promise<PasswordCheck> {
  const shape = checkPasswordShape(pw);
  if (!shape.ok) return shape;
  if (await isBreachedPassword(pw as string)) {
    return {
      ok: false,
      error: 'That password has appeared in a known data breach. Please choose a different one.',
    };
  }
  return { ok: true };
}
