import { sendEmail } from './nodemailer';
import { brandedEmailLayout, esc, p, codeBox } from './emailTemplate';

type SendPasswordResetOTPParams = {
  to: string;
  otpCode: string;
  firstName: string;
};

export async function sendPasswordResetOTP({ to, otpCode, firstName }: SendPasswordResetOTPParams) {
  const html = brandedEmailLayout({
    preheader: `Your Ascentor password reset code is ${otpCode}`,
    eyebrow: 'Account Security',
    heading: 'Reset your password.',
    recipient: to,
    content:
      p(`Hi ${esc(firstName || 'there')},`) +
      p('Use the code below to reset your Ascentor password. This code expires in <strong>15 minutes</strong>.') +
      codeBox(esc(otpCode)) +
      p('<span style="color:#9CA3AF;font-size:13px;">If you did not request a password reset, you can safely ignore this email. Your account remains secure.</span>') +
      p('The Ascentor Team'),
  });

  await sendEmail({
    to,
    subject: 'Reset your Ascentor password',
    html,
  });
}
