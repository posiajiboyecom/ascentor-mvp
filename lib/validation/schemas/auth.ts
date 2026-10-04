// lib/validation/schemas/auth.ts
import { z, email, text } from '../common';
import { safeNext } from '@/lib/auth/safe-next';

const captcha = z.string().max(4096).optional();

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

export const forgotPassword = z.strictObject({
  email,
  captchaToken: captcha,
});

export const resetPassword = z.strictObject({
  email,
  otp_code: z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit code from your email.'),
  new_password: z.string().min(1, 'A new password is required.').max(256),
});

/** Welcome email trigger. Identity is taken from the session; name is cosmetic. */
export const welcome = z.strictObject({
  email: email.optional(),
  userId: z.string().max(64).optional(),
  name: text(80).optional(),
});
