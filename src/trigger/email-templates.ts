// ═══════════════════════════════════════════════════════════════
// ASCENTOR EMAIL TEMPLATES — The Rise Letter
// Aesthetic: Dark editorial luxury · Cormorant Garamond · Syne
// Brand: #0C0B08 bg · #E8A020 gold · #F5F0E8 cream text
// ═══════════════════════════════════════════════════════════════

const B = {
  black:    '#0C0B08',
  gold:     '#E8A020',
  goldDim:  '#C07010',
  cream:    '#F5F0E8',
  muted:    '#8A8070',
  faint:    '#4A4540',
  card:     '#181510',
  border:   '#2A2520',
  white:    '#FFFFFF',
};

// ── Google Fonts import block (works in most modern email clients) ──
const FONTS = `
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400;1,600&family=Syne:wght@400;600;700&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet">
`;

// ── Preheader hidden text ──
function preheader(text: string) {
  return `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;color:${B.black};line-height:1px">${text}&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌</div>`;
}

// ══════════════════════════════════════════════════════
// MASTER LAYOUT — newsletter edition
// ══════════════════════════════════════════════════════
function newsletterLayout(opts: {
  preheaderText: string;
  eyebrow?: string;
  headline: string;
  subhead?: string;
  meta?: string;
  pullQuote?: string;
  body: string;
  ctaText?: string;
  ctaUrl?: string;
  unsubscribeToken?: string;
}) {
  const {
    preheaderText, eyebrow = 'THE RISE LETTER · ASCENTOR · FOR THE AMBITIOUS',
    headline, subhead, meta = 'VOL 1 · 5-MIN READ',
    pullQuote, body,
    ctaText = 'Read on Ascentor →', ctaUrl = 'https://ascentorbi.com/blog',
    unsubscribeToken = '',
  } = opts;

  const pullQuoteBlock = pullQuote ? `
    <tr><td style="padding:0 40px 36px">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td width="3" style="background:${B.gold};border-radius:2px">&nbsp;</td>
          <td width="20">&nbsp;</td>
          <td>
            <p style="margin:0;font-family:'Cormorant Garamond',Georgia,serif;font-size:20px;font-style:italic;font-weight:600;color:${B.cream};line-height:1.55">
              &ldquo;${pullQuote}&rdquo;
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  ` : '';

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="color-scheme" content="dark">
  <meta name="supported-color-schemes" content="dark">
  <title>${headline}</title>
  ${FONTS}
  <!--[if mso]>
  <noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
  <![endif]-->
  <style>
    @media only screen and (max-width:600px) {
      .outer-wrap { padding: 0 !important; }
      .card { border-radius: 0 !important; border-left: none !important; border-right: none !important; }
      .header-pad { padding: 32px 24px 24px !important; }
      .body-pad { padding: 0 24px 24px !important; }
      .footer-pad { padding: 24px !important; }
      .headline { font-size: 32px !important; line-height: 1.2 !important; }
      .subhead { font-size: 14px !important; }
      .cta-btn { display: block !important; text-align: center !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:${B.black};-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%">
  ${preheader(preheaderText)}

  <!-- Outer wrapper -->
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color:${B.black}">
    <tr><td align="center" class="outer-wrap" style="padding:48px 20px 64px">

      <!-- Card -->
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" class="card"
        style="max-width:600px;background-color:${B.card};border-radius:4px;border:1px solid ${B.border};overflow:hidden">

        <!-- ── TOP RULE ── -->
        <tr><td style="height:3px;background:linear-gradient(90deg,${B.gold} 0%,${B.goldDim} 60%,transparent 100%)"></td></tr>

        <!-- ── HEADER ── -->
        <tr><td class="header-pad" style="padding:48px 40px 36px;text-align:center;border-bottom:1px solid ${B.border}">

          <!-- Wordmark -->
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
            <tr><td align="center" style="padding-bottom:32px">
              <a href="https://ascentorbi.com" style="text-decoration:none">
                <span style="font-family:'Cormorant Garamond',Georgia,serif;font-size:28px;font-weight:700;letter-spacing:0.08em;color:${B.cream}">ASCENTOR</span>
              </a>
            </td></tr>

            <!-- Eyebrow -->
            <tr><td align="center" style="padding-bottom:20px">
              <span style="font-family:'DM Mono',monospace,sans-serif;font-size:9px;letter-spacing:0.22em;text-transform:uppercase;color:${B.gold}">${eyebrow}</span>
            </td></tr>

            <!-- Divider with diamond -->
            <tr><td align="center" style="padding-bottom:24px">
              <table cellpadding="0" cellspacing="0" role="presentation" align="center">
                <tr>
                  <td style="width:80px;height:1px;background:${B.border};vertical-align:middle"></td>
                  <td style="padding:0 10px;color:${B.gold};font-size:10px;vertical-align:middle">◆</td>
                  <td style="width:80px;height:1px;background:${B.border};vertical-align:middle"></td>
                </tr>
              </table>
            </td></tr>

            <!-- Headline -->
            <tr><td align="center" style="padding-bottom:16px">
              <h1 class="headline" style="margin:0;font-family:'Cormorant Garamond',Georgia,serif;font-size:40px;font-weight:700;line-height:1.15;color:${B.cream};letter-spacing:-0.01em">
                ${headline}
              </h1>
            </td></tr>

            ${subhead ? `
            <!-- Subhead -->
            <tr><td align="center" style="padding-bottom:20px">
              <p class="subhead" style="margin:0;font-family:'Syne',Arial,sans-serif;font-size:15px;color:${B.muted};line-height:1.5;max-width:440px">
                ${subhead}
              </p>
            </td></tr>
            ` : ''}

            <!-- Meta -->
            <tr><td align="center">
              <span style="font-family:'DM Mono',monospace,sans-serif;font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:${B.faint}">${meta}</span>
            </td></tr>
          </table>
        </td></tr>

        <!-- ── PULL QUOTE ── -->
        ${pullQuoteBlock ? `<tr><td style="padding:32px 40px 0">${pullQuoteBlock.replace(/<tr><td[^>]*>|<\/td><\/tr>/g,'')}</td></tr>` : ''}

        <!-- ── BODY ── -->
        <tr><td class="body-pad" style="padding:32px 40px 40px">
          <div style="font-family:'Syne',Arial,sans-serif;font-size:15px;color:#B0A898;line-height:1.8">
            ${body}
          </div>
        </td></tr>

        <!-- ── CTA ── -->
        <tr><td style="padding:0 40px 48px;text-align:center">
          <table cellpadding="0" cellspacing="0" role="presentation" align="center">
            <tr><td style="background:${B.gold};border-radius:2px">
              <a href="${ctaUrl}" class="cta-btn"
                style="display:inline-block;padding:14px 36px;font-family:'Syne',Arial,sans-serif;font-size:13px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:${B.black};text-decoration:none">
                ${ctaText}
              </a>
            </td></tr>
          </table>
        </td></tr>

        <!-- ── FOOTER ── -->
        <tr><td class="footer-pad" style="padding:28px 40px;border-top:1px solid ${B.border};text-align:center">
          <!-- Logo mark -->
          <p style="margin:0 0 16px;font-family:'Cormorant Garamond',Georgia,serif;font-size:14px;letter-spacing:0.12em;color:${B.faint}">ASCENTOR</p>
          <p style="margin:0 0 10px;font-family:'DM Mono',monospace,sans-serif;font-size:10px;color:${B.faint};line-height:1.6;letter-spacing:0.04em">
            purposeful development for purposeful individuals worldwide.
          </p>
          <p style="margin:0;font-family:'DM Mono',monospace,sans-serif;font-size:10px;color:${B.faint}">
            <a href="https://ascentorbi.com/privacy" style="color:${B.faint};text-decoration:none">Privacy</a>
            &nbsp;·&nbsp;
            <a href="https://ascentorbi.com/terms" style="color:${B.faint};text-decoration:none">Terms</a>
            &nbsp;·&nbsp;
            <a href="https://ascentorbi.com/unsubscribe${unsubscribeToken ? `?token=${unsubscribeToken}` : ''}" style="color:${B.muted};text-decoration:underline">Unsubscribe</a>
          </p>
          <p style="margin:12px 0 0;font-family:'DM Mono',monospace,sans-serif;font-size:9px;color:${B.faint}">
            © ${new Date().getFullYear()} Ascentor · ascentorbi.com
          </p>
        </td></tr>

        <!-- ── BOTTOM RULE ── -->
        <tr><td style="height:1px;background:${B.border}"></td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ══════════════════════════════════════════════════════
// TRANSACTIONAL LAYOUT — welcome / coaching / reminders
// ══════════════════════════════════════════════════════
function transactionalLayout(opts: {
  preheaderText: string;
  headline: string;
  body: string;
  ctaText?: string;
  ctaUrl?: string;
}) {
  const { preheaderText, headline, body, ctaText, ctaUrl } = opts;

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="dark">
  <title>${headline}</title>
  ${FONTS}
  <style>
    @media only screen and (max-width:600px) {
      .outer-wrap { padding: 0 !important; }
      .card { border-radius: 0 !important; border-left:none !important; border-right:none !important; }
      .pad { padding: 28px 24px !important; }
      .h1 { font-size: 26px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:${B.black}">
  ${preheader(preheaderText)}

  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color:${B.black}">
    <tr><td align="center" class="outer-wrap" style="padding:48px 20px 64px">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" class="card"
        style="max-width:560px;background-color:${B.card};border-radius:4px;border:1px solid ${B.border};overflow:hidden">

        <!-- Top rule -->
        <tr><td style="height:2px;background:${B.gold}"></td></tr>

        <!-- Header -->
        <tr><td align="center" style="padding:36px 40px 24px;border-bottom:1px solid ${B.border}">
          <a href="https://ascentorbi.com" style="text-decoration:none">
            <span style="font-family:'Cormorant Garamond',Georgia,serif;font-size:22px;font-weight:700;letter-spacing:0.1em;color:${B.cream}">ASCENTOR</span>
          </a>
        </td></tr>

        <!-- Body -->
        <tr><td class="pad" style="padding:40px 40px 32px">
          <h1 class="h1" style="margin:0 0 20px;font-family:'Cormorant Garamond',Georgia,serif;font-size:30px;font-weight:700;color:${B.cream};line-height:1.2">
            ${headline}
          </h1>
          <div style="font-family:'Syne',Arial,sans-serif;font-size:15px;color:#A09888;line-height:1.8">
            ${body}
          </div>
          ${ctaText && ctaUrl ? `
          <table cellpadding="0" cellspacing="0" role="presentation" style="margin-top:32px">
            <tr><td style="background:${B.gold};border-radius:2px">
              <a href="${ctaUrl}"
                style="display:inline-block;padding:13px 32px;font-family:'Syne',Arial,sans-serif;font-size:13px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:${B.black};text-decoration:none">
                ${ctaText}
              </a>
            </td></tr>
          </table>
          ` : ''}
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:20px 40px 28px;border-top:1px solid ${B.border};text-align:center">
          <p style="margin:0;font-family:'DM Mono',monospace,sans-serif;font-size:10px;color:${B.faint}">
            <a href="https://ascentorbi.com/terms" style="color:${B.faint};text-decoration:none">Terms</a>
            &nbsp;·&nbsp;
            <a href="https://ascentorbi.com/privacy" style="color:${B.faint};text-decoration:none">Privacy</a>
            &nbsp;·&nbsp;
            © ${new Date().getFullYear()} Ascentor
          </p>
        </td></tr>

        <!-- Bottom rule -->
        <tr><td style="height:1px;background:${B.border}"></td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ══════════════════════════════════════════════════════
// HELPER — convert plain newsletter text to styled HTML
// Handles: **bold**, *italic*, section headers (##), bullet lists
// ══════════════════════════════════════════════════════
function parseNewsletterBody(raw: string): string {
  const lines = raw.split('\n');
  let html = '';
  let inList = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      if (inList) { html += `</ul>`; inList = false; }
      continue;
    }

    // Section header: **The Real Talk** or ## Header
    if (/^\*\*[^*]+\*\*$/.test(trimmed) || trimmed.startsWith('## ')) {
      if (inList) { html += `</ul>`; inList = false; }
      const text = trimmed.replace(/^\*\*|\*\*$|^## /g, '');
      html += `
        <table width="100%" cellpadding="0" cellspacing="0" style="margin:28px 0 14px">
          <tr>
            <td width="24" style="vertical-align:middle">
              <div style="width:2px;height:18px;background:${B.gold};border-radius:1px"></div>
            </td>
            <td>
              <span style="font-family:'Syne',Arial,sans-serif;font-size:11px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:${B.gold}">${text}</span>
            </td>
          </tr>
        </table>`;
      continue;
    }

    // Bullet
    if (trimmed.startsWith('- ') || trimmed.startsWith('• ')) {
      if (!inList) { html += `<ul style="margin:12px 0;padding-left:0;list-style:none">`; inList = true; }
      const text = trimmed.replace(/^[-•] /, '');
      html += `<li style="display:flex;gap:10px;margin:6px 0;font-size:15px;color:#A09888;line-height:1.7">
        <span style="color:${B.gold};flex-shrink:0;margin-top:4px">◆</span>
        <span>${formatInline(text)}</span>
      </li>`;
      continue;
    }

    if (inList) { html += `</ul>`; inList = false; }

    // Regular paragraph
    html += `<p style="margin:0 0 16px;font-size:15px;color:#A09888;line-height:1.8">${formatInline(trimmed)}</p>`;
  }

  if (inList) html += `</ul>`;
  return html;
}

function formatInline(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, `<strong style="color:${B.cream};font-weight:700">$1</strong>`)
    .replace(/\*(.+?)\*/g, `<em style="font-style:italic;color:${B.cream}">$1</em>`)
    .replace(/`(.+?)`/g, `<code style="font-family:'DM Mono',monospace;font-size:13px;color:${B.gold};background:rgba(232,160,32,0.08);padding:1px 5px;border-radius:3px">$1</code>`);
}

// ══════════════════════════════════════════════════════
// PUBLIC API
// ══════════════════════════════════════════════════════

// ─── NEWSLETTER EMAIL ──────────────────────────────────
export function newsletterEmail(
  subject: string,
  content: string,
  firstName?: string,
  opts?: {
    pullQuote?: string;
    subhead?: string;
    eyebrow?: string;
    meta?: string;
    ctaText?: string;
    ctaUrl?: string;
    unsubscribeToken?: string;
  }
) {
  const greeting = firstName ? `Hi ${firstName},` : 'Hi there,';
  const bodyHtml = parseNewsletterBody(content);

  const fullBody = `
    <p style="margin:0 0 20px;font-family:'Syne',Arial,sans-serif;font-size:15px;color:${B.muted}">${greeting}</p>
    ${bodyHtml}
  `;

  return {
    subject,
    html: newsletterLayout({
      preheaderText: opts?.subhead || subject,
      eyebrow: opts?.eyebrow,
      headline: subject,
      subhead: opts?.subhead,
      meta: opts?.meta,
      pullQuote: opts?.pullQuote,
      body: fullBody,
      ctaText: opts?.ctaText,
      ctaUrl: opts?.ctaUrl,
      unsubscribeToken: opts?.unsubscribeToken,
    }),
  };
}

// ─── WELCOME EMAIL ─────────────────────────────────────
export function welcomeEmail(name: string) {
  const firstName = name?.split(' ')[0] || 'there';
  return {
    subject: `Welcome to Ascentor, ${firstName}`,
    html: transactionalLayout({
      preheaderText: `You just took the first step. Here is what comes next.`,
      headline: `You are in, ${firstName}.`,
      body: `
        <p style="margin:0 0 16px">You just joined a platform built for professionals who are serious about where they are going. Welcome.</p>
        <p style="margin:0 0 24px">Here is how to get started:</p>

        <!-- Step 1 -->
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:12px">
          <tr>
            <td width="32" valign="top">
              <span style="display:inline-block;width:24px;height:24px;border-radius:2px;background:${B.gold};text-align:center;line-height:24px;font-family:'DM Mono',monospace;font-size:11px;font-weight:700;color:${B.black}">1</span>
            </td>
            <td valign="top">
              <p style="margin:0;font-size:15px;color:#A09888;line-height:1.6">
                <strong style="color:${B.cream}">Talk to Sage, your AI coach.</strong>
                Ask about your biggest challenge right now — career move, visibility, next promotion. Sage is ready.
              </p>
            </td>
          </tr>
        </table>

        <!-- Step 2 -->
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:12px">
          <tr>
            <td width="32" valign="top">
              <span style="display:inline-block;width:24px;height:24px;border-radius:2px;background:${B.gold};text-align:center;line-height:24px;font-family:'DM Mono',monospace;font-size:11px;font-weight:700;color:${B.black}">2</span>
            </td>
            <td valign="top">
              <p style="margin:0;font-size:15px;color:#A09888;line-height:1.6">
                <strong style="color:${B.cream}">Browse expert sessions.</strong>
                Real mentors. Real conversations. Register for one this week.
              </p>
            </td>
          </tr>
        </table>

        <!-- Step 3 -->
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px">
          <tr>
            <td width="32" valign="top">
              <span style="display:inline-block;width:24px;height:24px;border-radius:2px;background:${B.gold};text-align:center;line-height:24px;font-family:'DM Mono',monospace;font-size:11px;font-weight:700;color:${B.black}">3</span>
            </td>
            <td valign="top">
              <p style="margin:0;font-size:15px;color:#A09888;line-height:1.6">
                <strong style="color:${B.cream}">Join your peer cohort.</strong>
                The people around you matter. Introduce yourself.
              </p>
            </td>
          </tr>
        </table>

        <p style="margin:0;font-size:13px;color:${B.faint}">Your  is active. No credit card needed.</p>
      `,
      ctaText: 'Go to Dashboard →',
      ctaUrl: 'https://ascentorbi.com/dashboard',
    }),
  };
}

// ─── COACHING SUMMARY EMAIL ────────────────────────────
export function coachingSummaryEmail(
  name: string,
  summary: string,
  keyTakeaways: string[],
  nextSteps: string[]
) {
  const firstName = name?.split(' ')[0] || 'there';
  const takeawaysHtml = keyTakeaways.map(t => `
    <li style="display:flex;gap:10px;margin:8px 0;font-size:14px;color:#A09888;line-height:1.6;list-style:none">
      <span style="color:${B.gold};flex-shrink:0">◆</span>
      <span>${t}</span>
    </li>`).join('');
  const stepsHtml = nextSteps.map((s, i) => `
    <li style="display:flex;gap:12px;margin:8px 0;font-size:14px;color:#A09888;line-height:1.6;list-style:none">
      <span style="display:inline-block;min-width:22px;height:22px;border-radius:2px;background:rgba(232,160,32,0.12);text-align:center;line-height:22px;font-family:'DM Mono',monospace;font-size:11px;color:${B.gold};flex-shrink:0">${i + 1}</span>
      <span>${s}</span>
    </li>`).join('');

  return {
    subject: `Your session recap — Ascentor`,
    html: transactionalLayout({
      preheaderText: `Here is what you worked through today and what comes next.`,
      headline: `Session recap, ${firstName}`,
      body: `
        <p style="margin:0 0 24px;font-size:15px;color:#A09888;line-height:1.8">${summary}</p>

        ${keyTakeaways.length > 0 ? `
        <div style="border:1px solid ${B.border};border-radius:4px;padding:20px 24px;margin-bottom:20px">
          <p style="margin:0 0 12px;font-family:'DM Mono',monospace;font-size:10px;letter-spacing:0.16em;text-transform:uppercase;color:${B.gold}">Key Takeaways</p>
          <ul style="margin:0;padding:0">${takeawaysHtml}</ul>
        </div>
        ` : ''}

        ${nextSteps.length > 0 ? `
        <div style="border:1px solid ${B.border};border-radius:4px;padding:20px 24px">
          <p style="margin:0 0 12px;font-family:'DM Mono',monospace;font-size:10px;letter-spacing:0.16em;text-transform:uppercase;color:${B.gold}">Next Steps</p>
          <ul style="margin:0;padding:0">${stepsHtml}</ul>
        </div>
        ` : ''}
      `,
      ctaText: 'Continue with Sage →',
      ctaUrl: 'https://ascentorbi.com/coach',
    }),
  };
}

// ─── GOAL REMINDER EMAIL ───────────────────────────────
export function goalReminderEmail(
  name: string,
  goals: string[],
  daysSinceActive: number
) {
  const firstName = name?.split(' ')[0] || 'there';
  const goalsHtml = goals.map(g => `
    <li style="display:flex;gap:10px;margin:8px 0;font-size:14px;color:#A09888;line-height:1.6;list-style:none">
      <span style="color:${B.gold};flex-shrink:0">◆</span>
      <span>${g}</span>
    </li>`).join('');

  const urgency = daysSinceActive > 14
    ? `It has been ${daysSinceActive} days. That is long enough.`
    : `It has been ${daysSinceActive} days since your last session.`;

  return {
    subject: `${firstName} — your goals are still here`,
    html: transactionalLayout({
      preheaderText: `${urgency} Five minutes with Sage can get you back on track.`,
      headline: `Still with you, ${firstName}.`,
      body: `
        <p style="margin:0 0 20px;font-size:15px;color:#A09888;line-height:1.8">${urgency} Your goals did not disappear. They are waiting.</p>

        ${goals.length > 0 ? `
        <div style="border-left:2px solid ${B.gold};padding:16px 20px;margin:0 0 24px;background:rgba(232,160,32,0.04)">
          <p style="margin:0 0 10px;font-family:'DM Mono',monospace;font-size:10px;letter-spacing:0.16em;text-transform:uppercase;color:${B.gold}">Your Active Goals</p>
          <ul style="margin:0;padding:0">${goalsHtml}</ul>
        </div>
        ` : ''}

        <p style="margin:0;font-size:15px;color:#A09888;line-height:1.8">
          Five minutes with Sage is enough to get clarity. Your coach remembers exactly where you left off.
        </p>
      `,
      ctaText: 'Resume with Sage →',
      ctaUrl: 'https://ascentorbi.com/coach',
    }),
  };
}
