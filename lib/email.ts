import { sendEmail } from './nodemailer';
import { brandedEmailLayout, esc, p, codeBox, goldButton } from './emailTemplate';

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || 'https://joinascentor.com').replace(/\/+$/, '');

type SendPasswordResetOTPParams = {
  to: string;
  otpCode: string;
  firstName: string;
};

export async function sendPasswordResetOTP({ to, otpCode, firstName }: SendPasswordResetOTPParams) {
  // The button carries the same one-time code the member could type: it is verified (hashed, attempt-limited,
  // single use) when they choose a new password, never by opening the link.
  const resetUrl = `${APP_URL}/reset-password?email=${encodeURIComponent(to)}&code=${encodeURIComponent(otpCode)}`;
  const html = brandedEmailLayout({
    preheader: 'Use this link to set a new Ascentor password. It works once, for 1 hour.',
    eyebrow: 'Account Security',
    heading: 'Reset your password.',
    recipient: to,
    content:
      p(`Hi ${esc(firstName || 'there')},`) +
      p('Use the button below to set a new Ascentor password. The link works once, for <strong>1 hour</strong>.') +
      goldButton('Set a new password', resetUrl) +
      p('<span style="color:#6B7280;font-size:13px;">Button not working? Go to the reset page and enter this code instead:</span>') +
      codeBox(esc(otpCode)) +
      p('<span style="color:#9CA3AF;font-size:13px;">If you did not request a password reset, you can safely ignore this email. Your account remains secure.</span>') +
      p('The Ascentor Team'),
  });

  await sendEmail({
    to,
    subject: 'Reset your Ascentor password',
    html,
    required: true,
  });
}

type SendPasswordChangedParams = {
  to: string;
  firstName: string;
};

export async function sendPasswordChangedEmail({ to, firstName }: SendPasswordChangedParams) {
  const html = brandedEmailLayout({
    preheader: 'Your Ascentor password was just changed',
    eyebrow: 'Account Security',
    heading: 'Your password was changed.',
    recipient: to,
    content:
      p(`Hi ${esc(firstName || 'there')},`) +
      p('The password for your Ascentor account was just changed, and you were signed out of all devices.') +
      p('<span style="color:#9CA3AF;font-size:13px;">If this was not you, reset your password immediately and contact support.</span>') +
      p('The Ascentor Team'),
  });

  await sendEmail({ to, subject: 'Your Ascentor password was changed', html });
}

type SendSignupOTPParams = {
  to: string;
  otpCode: string;
};

/** Six-digit code that confirms ownership of the email address during sign-up. */
export async function sendSignupOTP({ to, otpCode }: SendSignupOTPParams) {
  const html = brandedEmailLayout({
    preheader: `Your Ascentor verification code is ${otpCode}`,
    eyebrow: 'Welcome to Ascentor',
    heading: 'Confirm your email.',
    recipient: to,
    content:
      p('Enter this code to finish creating your Ascentor account. It expires in <strong>15 minutes</strong>.') +
      codeBox(esc(otpCode)) +
      p('<span style="color:#9CA3AF;font-size:13px;">If you did not start creating an account, you can ignore this email.</span>') +
      p('The Ascentor Team'),
  });

  await sendEmail({ to, subject: `${otpCode} is your Ascentor verification code`, html, required: true });
}

type SendAccountDeletedParams = {
  to: string;
  firstName: string;
};

/** Final confirmation that an account and its data were permanently deleted at the member's request. */
export async function sendAccountDeletedEmail({ to, firstName }: SendAccountDeletedParams) {
  const html = brandedEmailLayout({
    preheader: 'Your Ascentor account has been deleted',
    eyebrow: 'Account',
    heading: 'Your account has been deleted.',
    recipient: to,
    content:
      p(`Hi ${esc(firstName || 'there')},`) +
      p('As you asked, your Ascentor account and the personal data attached to it (profile, goals, commitments, coaching sessions and community messages) have been permanently deleted.') +
      p('Payment records held by our payment processor, and anything we are legally required to keep, are retained as the law requires.') +
      p('<span style="color:#9CA3AF;font-size:13px;">If you did not request this, contact support immediately.</span>') +
      p('The Ascentor Team'),
  });

  await sendEmail({ to, subject: 'Your Ascentor account has been deleted', html });
}
