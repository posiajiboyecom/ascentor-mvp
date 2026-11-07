// ---------------------------------------------------------------------------
// Shared branded email shell  -  used by every email the system sends
// (summit emails in summitEmails.ts, auth emails in email.ts).
// Table layout + inline styles: the only combination that renders reliably
// across Gmail, Outlook, and Apple Mail. Assets are hosted PNGs because
// SVGs are blocked by most email clients.
// ---------------------------------------------------------------------------

const SITE_URL = 'https://joinascentor.com';
// Gold mark + dark wordmark on transparent background - same logo shown on
// joinascentor.com/elevation-summit. This email shell has a white header, so it
// needs the dark-text variant (do not point this at ascentor-logo-email.png,
// which is white text meant for lib/summitTicket.ts's black PDF header).
const LOGO_URL = `${SITE_URL}/images/ascentor-logo-email-light.png`;

const SOCIALS = [
  { label: 'WhatsApp', url: 'https://wa.me/+2348168692012', icon: `${SITE_URL}/images/email/icon-whatsapp.png` },
  { label: 'X', url: 'https://x.com/joinascentor', icon: `${SITE_URL}/images/email/icon-x.png` },
  { label: 'LinkedIn', url: 'https://linkedin.com/company/joinascentor', icon: `${SITE_URL}/images/email/icon-linkedin.png` },
  { label: 'Instagram', url: 'https://instagram.com/joinascentor', icon: `${SITE_URL}/images/email/icon-instagram.png` },
];

// User-supplied strings (names, orgs) must never break the markup.
export const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const divider = (pad = '28px') =>
  `<tr><td style="padding:0 40px;"><div style="border-top:1px solid #E8E6E1;font-size:0;line-height:0;height:0;">&nbsp;</div></td></tr>
   <tr><td style="height:${pad};font-size:0;line-height:0;">&nbsp;</td></tr>`;

export function brandedEmailLayout(opts: {
  preheader: string;
  eyebrow: string;
  heading: string;
  content: string;
  recipient: string;
  /** Extra footer HTML under the recipient line (bulk mail: why they got it and how to unsubscribe). */
  footer?: string;
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
                Ascentor is the official platform of The Elevation Summit movement, a global gathering
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
              ${opts.footer ?? ''}
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

export const p = (text: string) => `<p style="margin:0 0 16px;">${text}</p>`;

export const goldButton = (label: string, url: string) => `
  <table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 4px;">
    <tr>
      <td style="background-color:#C8A96E;border-radius:8px;">
        <a href="${url}" target="_blank" style="display:inline-block;padding:13px 28px;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:bold;color:#0F0F0E;text-decoration:none;">${label}</a>
      </td>
    </tr>
  </table>`;

export const summaryRow = (label: string, value: string) => `
  <tr>
    <td style="padding:10px 0;font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:bold;letter-spacing:1.5px;text-transform:uppercase;color:#9CA3AF;vertical-align:top;width:110px;">${label}</td>
    <td style="padding:10px 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;color:#0F0F0E;vertical-align:top;">${value}</td>
  </tr>`;

export const summaryBox = (rows: string) => `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 20px;background-color:#FAFAF8;border:1px solid #F0EDE6;border-radius:10px;">
    <tr><td style="padding:14px 20px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table></td></tr>
  </table>`;

// Secondary/outline button  -  pairs with goldButton for two-action emails.
export const outlineButton = (label: string, url: string) => `
  <table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 4px;">
    <tr>
      <td style="border:1.5px solid #E8E6E1;border-radius:8px;">
        <a href="${url}" target="_blank" style="display:inline-block;padding:12px 26px;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:bold;color:#0F0F0E;text-decoration:none;">${label}</a>
      </td>
    </tr>
  </table>`;

// Quoted message block  -  renders a user's free-text message safely.
// Input must already be escaped; newlines become <br>.
export const messageBlock = (escapedText: string) => `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 20px;background-color:#FAFAF8;border:1px solid #F0EDE6;border-radius:10px;">
    <tr>
      <td style="padding:16px 20px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.7;color:#3F3F3C;">
        ${escapedText.replace(/\n/g, '<br>')}
      </td>
    </tr>
  </table>`;

// Centered code/OTP display box (password resets, verification codes).
export const codeBox = (code: string) => `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 20px;background-color:#FAFAF8;border:1px solid #F0EDE6;border-radius:10px;">
    <tr>
      <td align="center" style="padding:24px 20px;">
        <span style="font-family:Arial,Helvetica,sans-serif;font-size:32px;font-weight:bold;letter-spacing:6px;color:#0F0F0E;">${code}</span>
      </td>
    </tr>
  </table>`;
