import nodemailer from 'nodemailer';
import { brandedEmailLayout, esc, p, codeBox } from './emailTemplate';

type SendPasswordResetOTPParams = {
  to: string;
  otpCode: string;
  firstName: string;
};

export async function sendPasswordResetOTP({ to, otpCode, firstName }: SendPasswordResetOTPParams) {
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.EMAIL_FROM || 'Ascentor <no-reply@ascentorbi.com>';

  if (!user || !pass) {
    console.warn('[email] SMTP credentials not configured. Skipping email send.');
    return;
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

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
      p('— The Ascentor Team'),
  });

  await transporter.sendMail({
    from,
    to,
    subject: 'Reset your Ascentor password',
    html,
  });
}
