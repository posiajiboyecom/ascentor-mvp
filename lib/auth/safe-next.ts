// lib/auth/safe-next.ts
// Validates a post-login destination so it can only ever be a path on THIS
// site. Anything else (absolute URLs, protocol-relative `//host`, backslash
// tricks, `@host` / `.host` suffixes appended to an origin) collapses to the
// fallback. Always use this before redirecting to a user-supplied `next` or
// `redirect` parameter.

const DUMMY_ORIGIN = 'https://safe-next.invalid';

export function safeNext(raw: string | null | undefined, fallback = '/dashboard'): string {
  if (!raw || typeof raw !== 'string') return fallback;
  const value = raw.trim();

  // Must be a single-slash relative path.
  if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return fallback;
  // No control characters / whitespace tricks.
  if (/[\u0000-\u001f\u007f]/.test(value)) return fallback;

  try {
    const url = new URL(value, DUMMY_ORIGIN);
    if (url.origin !== DUMMY_ORIGIN) return fallback;
    // Never bounce back into the auth screens themselves.
    if (/^\/(login|signup|admin-login|auth)(\/|$)/.test(url.pathname)) return fallback;
    return url.pathname + url.search + url.hash;
  } catch {
    return fallback;
  }
}
