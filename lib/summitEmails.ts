import { summitMailer } from './nodemailer';

// ---------------------------------------------------------------------------
// Branded email shell — table layout + inline styles (the only combination
// that renders reliably across Gmail, Outlook, and Apple Mail).
// Assets are hosted PNGs: SVGs are blocked by most email clients.
// ---------------------------------------------------------------------------

const SITE_URL = 'https://ascentorbi.com';
const LOGO_URL = `${SITE_URL}/images/ascentor-logo-email.png`;
const SUMMIT_URL = `${SITE_URL}/elevation-summit`;

const SOCIALS = [
  { label: 'X', url: 'https://x.com/joinascentor', icon: `${SITE_URL}/images/email/icon-x.png` },
  { label: 'LinkedIn', url: 'https://linkedin.com/company/joinascentor', icon: `${SITE_URL}/images/email/icon-linkedin.png` },
  { label: 'Instagram', url: 'https://instagram.com/joinascentor', icon: `${SITE_URL}/images/email/icon-instagram.png` },
];

// User-supplied strings (names, orgs) must never break the markup.
const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const divider = (pad = '28px') =>
  `<tr><td style="padding:0 40px;"><div style="border-top:1px solid #E8E6E1;font-size:0;line-height:0;height:0;">&nbsp;</div></td></tr>
   <tr><td style="height:${pad};font-size:0;line-height:0;">&nbsp;</td></tr>`;

function summitEmailLayout(opts: {
  preheader: string;
  eyebrow: string;
  heading: string;
  content: string;
  recipient: string;
}): string {
  const socialIcons = SOCIALS.map(
    (s) => `<a href="${s.url}" target="_blank" style="display:inline-block;margin:0 8px;text-decoration:none;">
      <img src="${s.icon}" alt="${s.label}" width="20" height="20" style="display:block;border:0;" />
    </a>`
  ).join('');

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${esc(opts.heading)}</title>
</head>
<body style="margin:0;padding:0;background-color:#F0EDE6;">
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${esc(opts.preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F0EDE6;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background-color:#FFFFFF;border-radius:12px;overflow:hidden;">

          <!-- Logo -->
          <tr>
            <td align="center" style="background-color:#FFFFFF;padding:32px 40px 24px;">
              <a href="${SITE_URL}" target="_blank">
                <img src="${LOGO_URL}" alt="ASCENTOR" width="150" style="display:block;border:0;max-width:150px;height:auto;" />
              </a>
            </td>
          </tr>
          <tr><td style="height:3px;background-color:#C8A96E;font-size:0;line-height:0;">&nbsp;</td></tr>

          <!-- Main content (left-aligned) -->
          <tr>
            <td style="padding:36px 40px 8px;">
              <p style="margin:0 0 10px;font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:bold;letter-spacing:2px;color:#C8A96E;text-transform:uppercase;">${esc(opts.eyebrow)}</p>
              <h1 style="margin:0 0 20px;font-family:Arial,Helvetica,sans-serif;font-size:26px;line-height:1.3;font-weight:bold;color:#0F0F0E;">${esc(opts.heading)}</h1>
              <div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.7;color:#3F3F3C;">
                ${opts.content}
              </div>
            </td>
          </tr>
          <tr><td style="height:28px;font-size:0;line-height:0;">&nbsp;</td></tr>

          ${divider()}

          <!-- About Ascentor -->
          <tr>
            <td align="center" style="padding:0 40px;">
              <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.7;color:#6B7280;">
                Ascentor is the official platform of The Elevation Summit movement — a global gathering
                for purposeful individuals building lives of meaning, leadership, and lasting impact.
              </p>
            </td>
          </tr>
          <tr><td style="height:20px;font-size:0;line-height:0;">&nbsp;</td></tr>

          <!-- Socials -->
          <tr>
            <td align="center" style="padding:0 40px;">${socialIcons}</td>
          </tr>
          <tr><td style="height:8px;font-size:0;line-height:0;">&nbsp;</td></tr>

          ${divider('24px')}

          <!-- Copyright -->
          <tr>
            <td align="center" style="padding:0 40px;">
              <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#9CA3AF;">
                &copy; 2026 Ascentor. All rights reserved.
              </p>
            </td>
          </tr>
          <tr><td style="height:12px;font-size:0;line-height:0;">&nbsp;</td></tr>
          <tr><td style="padding:0 40px;"><div style="border-top:1px solid #E8E6E1;font-size:0;line-height:0;height:0;">&nbsp;</div></td></tr>
          <tr><td style="height:16px;font-size:0;line-height:0;">&nbsp;</td></tr>

          <!-- Recipient line -->
          <tr>
            <td align="center" style="padding:0 40px 28px;">
              <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#9CA3AF;">
                This email was sent to <a href="mailto:${esc(opts.recipient)}" style="color:#C8A96E;text-decoration:none;">${esc(opts.recipient)}</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// Reusable content blocks ---------------------------------------------------

const p = (text: string) => `<p style="margin:0 0 16px;">${text}</p>`;

const goldButton = (label: string, url: string) => `
  <table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 4px;">
    <tr>
      <td style="background-color:#C8A96E;border-radius:8px;">
        <a href="${url}" target="_blank" style="display:inline-block;padding:13px 28px;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:bold;color:#0F0F0E;text-decoration:none;">${label}</a>
      </td>
    </tr>
  </table>`;

const summaryRow = (label: string, value: string) => `
  <tr>
    <td style="padding:10px 0;font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:bold;letter-spacing:1.5px;text-transform:uppercase;color:#9CA3AF;vertical-align:top;width:110px;">${label}</td>
    <td style="padding:10px 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;color:#0F0F0E;vertical-align:top;">${value}</td>
  </tr>`;

const summaryBox = (rows: string) => `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 20px;background-color:#FAFAF8;border:1px solid #F0EDE6;border-radius:10px;">
    <tr><td style="padding:14px 20px;">${rows}</td></tr>
  </table>`;

// ---------------------------------------------------------------------------

export async function sendRegistrationReceivedEmail(to: string, fullName: string) {
  await summitMailer.sendMail({
    from: process.env.SUMMIT_MAIL_FROM,
    to,
    subject: 'We received your Elevation Summit registration',
    html: summitEmailLayout({
      preheader: 'One step left — complete payment to secure your place.',
      eyebrow: 'Elevation Summit · 19 November 2026',
      heading: 'Registration received.',
      recipient: to,
      content:
        p(`Hi ${esc(fullName)},`) +
        p('We have received your registration for the Elevation Summit, 19 November 2026, Lagos.') +
        p('<strong>Your spot is not yet confirmed.</strong> Complete payment to secure your place.') +
        goldButton('Complete Your Registration →', `${SUMMIT_URL}#register`),
    }),
  });
}

export async function sendPaymentConfirmedEmail(to: string, fullName: string, attendanceType?: string) {
  const isVirtual = attendanceType === 'virtual';
  // The Zoom link is created and shared manually by the organizers,
  // not injected from an env var. If this is ever automated, a
  // per-event or per-registration link store would be needed instead.
  const attendanceBlock = isVirtual
    ? p('Your Zoom link for the virtual session will be shared with you separately closer to the event date. Keep an eye on your inbox.')
    : p('Venue details will follow closer to the event date.');
  await summitMailer.sendMail({
    from: process.env.SUMMIT_MAIL_FROM,
    to,
    subject: 'Your Elevation Summit registration is confirmed',
    html: summitEmailLayout({
      preheader: 'Your payment is confirmed — see you at the Elevation Summit.',
      eyebrow: 'Elevation Summit · 19 November 2026',
      heading: "You're confirmed.",
      recipient: to,
      content:
        p(`Hi ${esc(fullName)},`) +
        p(`Your payment has been received and your <strong>${isVirtual ? 'virtual' : 'onsite'} place</strong> at the Elevation Summit is confirmed.`) +
        summaryBox(
          summaryRow('Attendance', isVirtual ? 'Virtual' : 'Onsite — Lagos') +
          summaryRow('Date', '19 November 2026') +
          summaryRow('Status', '<span style="color:#C8A96E;">Confirmed &amp; Paid</span>')
        ) +
        attendanceBlock +
        p('We look forward to seeing you there.') +
        goldButton('View Event Details →', SUMMIT_URL),
    }),
  });
}

export async function sendAdminPaymentNotification(fullName: string, email: string, organisation: string) {
  const adminEmail = process.env.ADMIN_EMAIL ?? '';
  await summitMailer.sendMail({
    from: process.env.SUMMIT_MAIL_FROM,
    to: adminEmail,
    subject: `Paid registration confirmed: ${fullName}`,
    html: summitEmailLayout({
      preheader: `New paid registration: ${fullName}`,
      eyebrow: 'Admin Notification',
      heading: 'New paid registration.',
      recipient: adminEmail,
      content:
        p('A new paid registration has been confirmed for the Elevation Summit.') +
        summaryBox(
          summaryRow('Name', esc(fullName)) +
          summaryRow('Email', esc(email)) +
          summaryRow('Company', esc(organisation) || '—')
        ),
    }),
  });
}
