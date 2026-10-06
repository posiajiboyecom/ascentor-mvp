// lib/validation/schemas/auth.ts
import { z, email, text } from '../common';
import { safeNext } from '@/lib/auth/safe-next';

const captcha = z.string().max(4096).optional();
const code6 = z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit code from your email.');

export const login = z.strictObject({
  email,
  password: z.string().min(1, 'Password is required.').max(256),
  captchaToken: captcha,
  mode: z.enum(['member', 'staff']).optional(),
});

export const signup = z.strictObject({
  email,
  // Shape/strength rules live in lib/auth/password-policy (async: breach check).
  password: z.string().min(1, 'Password is required.').max(256),
  captchaToken: captcha,
  next: z.string().max(512).optional().transform((v) => safeNext(v, '/onboarding')),
});

/** Confirms the one-time code emailed during sign-up. */
export const verifySignup = z.strictObject({ email, code: code6 });

/** Sends a fresh sign-up code. */
export const resendSignup = z.strictObject({ email, captchaToken: captcha });

export const forgotPassword = z.strictObject({
  email,
  captchaToken: captcha,
});

export const resetPassword = z.strictObject({
  email,
  otp_code: code6,
  new_password: z.string().min(1, 'A new password is required.').max(256),
});

/** Change password from the settings page (signed in, email accounts only). */
export const changePassword = z.strictObject({
  currentPassword: z.string().min(1, 'Enter your current password.').max(256),
  newPassword: z.string().min(1, 'Enter a new password.').max(256),
});

/** Welcome email trigger. Identity is taken from the session; name is cosmetic. */
export const welcome = z.strictObject({
  email: email.optional(),
  userId: z.string().max(64).optional(),
  name: text(80).optional(),
});
