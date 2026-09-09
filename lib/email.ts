import nodemailer from 'nodemailer';

type SendPasswordResetOTPParams = {
  to: string;
  otpCode: string;
  firstName: string;
};

type EmailTemplateParams = {
  title: string;
  preheader?: string;
  bodyHtml: string;
  footerHtml?: string;
};

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function getEmailTemplate({ title, preheader, bodyHtml, footerHtml }: EmailTemplateParams): string {
  const fontStack = "'Metropolis', Arial, 'Helvetica Neue', Helvetica";
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  <style>
    body { margin: 0; padding: 0; background: #FAFAF8; color: #0F0F0E; font-family: Metropolis; }
    .container { max-width: 480px; margin: 0 auto; padding: 40px 24px; background: #FAFAF8; }
    .header { padding-bottom: 24px; }
    .brand { font-size: 20px; font-weight: 700; color: #C8A96E; text-decoration: none; }
    .content { background: #FFFFFF; border: 1px solid #E8E6E1; border-radius: 12px; padding: 32px; }
    .title { font-size: 22px; font-weight: 700; margin: 0 0 12px; color: #0F0F0E; }
    .body { font-size: 16px; line-height: 1.6; color: #6B7280; margin: 0 0 24px; }
    .body-small { font-size: 14px; line-height: 1.6; color: #9CA3AF; margin: 0 0 16px; }
    .code-box { background: #F4F3EF; border: 1px solid #E8E6E1; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px; }
    .code { font-size: 32px; font-weight: 700; letter-spacing: 0.15em; color: #0F0F0E; }
    .footer { font-size: 14px; color: #9CA3AF; padding-top: 24px; line-height: 1.6; }
  </style>
</head>
<body>
  ${preheader ? `<div style="display:none;font-size:0;line-height:0;opacity:0;overflow:hidden;mso-hide:all;">${escapeHtml(preheader)}</div>` : ''}
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
    <tr><td align="center" style="background:#FAFAF8;padding:40px 12px;">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="480" style="max-width:480px;width:100%;">
        <tr><td class="header" style="padding-bottom:24px;">
          <a href="https://ascentorbi.com" class="brand" style="color:#C8A96E;text-decoration:none;font-weight:700;font-size:20px;">Ascentor</a>
        </td></tr>
        <tr><td class="content" style="background:#FFFFFF;border:1px solid #E8E6E1;border-radius:12px;padding:32px;">
          <h1 class="title" style="font-size:22px;font-weight:700;margin:0 0 12px;color:#0F0F0E;">${escapeHtml(title)}</h1>
          ${bodyHtml}
        </td></tr>
        <tr><td class="footer" style="font-size:14px;color:#9CA3AF;padding-top:24px;line-height:1.6;">
          ${footerHtml || 'This email was sent by Ascentor.'}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

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

  const bodyHtml = `
    <p class="body" style="font-size:16px;line-height:1.6;color:#6B7280;margin:0 0 24px;">
      Hi ${escapeHtml(firstName || 'there')},<br/>
      Use the code below to reset your Ascentor password. This code expires in 15 minutes.
    </p>
    <div class="code-box" style="background:#F4F3EF;border:1px solid #E8E6E1;border-radius:12px;padding:24px;text-align:center;margin-bottom:24px;">
      <span class="code" style="font-size:32px;font-weight:700;letter-spacing:0.15em;color:#0F0F0E;">${escapeHtml(otpCode)}</span>
    </div>
    <p class="body-small" style="font-size:14px;line-height:1.6;color:#9CA3AF;margin:0 0 16px;">
      If you did not request a password reset, you can safely ignore this email. Your account remains secure.
    </p>
  `;

  const html = getEmailTemplate({
    title: 'Reset your password',
    preheader: 'Your Ascentor password reset code is ' + escapeHtml(otpCode),
    bodyHtml,
    footerHtml: '- The Ascentor Team',
  });

  await transporter.sendMail({
    from,
    to,
    subject: 'Reset your Ascentor password',
    html,
  });
}
