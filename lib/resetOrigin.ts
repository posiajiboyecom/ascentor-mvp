// Remembers that a password reset started from the staff sign-in page
// (/admin-login links to /forgot-password?from=admin) so the reset flow can
// send the user back to the right place afterwards. sessionStorage is used
// because the flow spans two pages and must not depend on query params
// surviving the email step.

const KEY = 'reset-from';

export function rememberResetOrigin(): void {
  try {
    if (new URLSearchParams(window.location.search).get('from') === 'admin') {
      sessionStorage.setItem(KEY, 'admin');
    }
  } catch { /* storage unavailable: fall back to the default */ }
}

export function signInPathAfterReset(): string {
  try {
    return sessionStorage.getItem(KEY) === 'admin' ? '/admin-login' : '/login';
  } catch {
    return '/login';
  }
}
