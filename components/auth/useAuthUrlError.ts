'use client';

// The message for ?error=... on /login and /signup, from one place so both pages say the same thing.
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { LOGIN_ERRORS, type GoogleLoginError } from '@/lib/auth/google-login-errors';

export function authUrlError(code: string | null): string | null {
  if (!code) return null;
  if (code === 'auth_failed') return 'We couldn’t complete that sign-in. The link may have expired. Please try again.';
  if (code === 'login_blocked') return 'For your security that sign-in was blocked because it looked unusual. Please try again in a few minutes.';
  if (code === 'session_missing') return 'Your session didn’t start. Please sign in again.';
  if (code in LOGIN_ERRORS) return LOGIN_ERRORS[code as GoogleLoginError];
  return null;
}

/** The error from the address, as state the page can also overwrite with its own errors. */
export function useAuthUrlError(): [string | null, (m: string | null) => void] {
  const sp = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { const m = authUrlError(sp.get('error')); if (m) setError(m); }, [sp]);
  return [error, setError];
}
