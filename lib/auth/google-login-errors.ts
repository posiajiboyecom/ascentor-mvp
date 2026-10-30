// lib/auth/google-login-errors.ts
// Client-safe (no Node imports): the messages /login shows after a failed Google sign-in.
/** The /login?error= codes this flow can produce, and what /login says for each. */
export const LOGIN_ERRORS = {
  google_cancelled: 'You cancelled the Google sign-in. Try again whenever you are ready.',
  google_state: 'That Google sign-in expired or was started in a different browser. Please start again.',
  google_failed: 'We could not finish signing you in with Google. Please try again, or sign in with your email.',
  google_rate: 'Too many sign-in attempts. Please wait a few minutes and try again.',
} as const;
export type GoogleLoginError = keyof typeof LOGIN_ERRORS;
