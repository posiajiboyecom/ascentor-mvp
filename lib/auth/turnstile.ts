// lib/auth/turnstile.ts
// Cloudflare Turnstile verification. Enforced only when TURNSTILE_SECRET_KEY is
// set, so local development and unconfigured environments keep working; set
// NEXT_PUBLIC_TURNSTILE_SITE_KEY + TURNSTILE_SECRET_KEY to switch it on.
import 'server-only';

export async function verifyTurnstile(token: unknown, ip?: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true; // not configured -> not enforced
  if (typeof token !== 'string' || !token) return false;
  try {
    const body = new URLSearchParams({ secret, response: token });
    if (ip) body.set('remoteip', ip);
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body,
      signal: AbortSignal.timeout(4000),
    });
    const json = (await res.json()) as { success?: boolean };
    return json.success === true;
  } catch (err) {
    console.error('[turnstile] verification failed:', err);
    return false; // configured but unreachable: fail closed
  }
}
