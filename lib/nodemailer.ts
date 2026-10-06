import nodemailer from 'nodemailer';

// Inferred from the factory - avoids namespace-reference errors
// across different TypeScript/module-resolution configurations.
type Mailer = ReturnType<typeof nodemailer.createTransport>;

export const summitMailer = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  // 465 (implicit TLS) rather than 587 (STARTTLS): many home and office networks block 587,
  // while 465 is open everywhere Gmail is reachable.
  port: 465,
  secure: true,
  connectionTimeout: 10_000,
  greetingTimeout: 10_000,
  auth: {
    user: process.env.SUMMIT_GMAIL_USER,
    pass: process.env.SUMMIT_GMAIL_APP_PASSWORD,
  },
});

// ---------------------------------------------------------------------------
// Shared mailer for every non-summit email (replaces Resend).
// Prefers generic SMTP_* credentials; falls back to the summit Gmail account
// so a single mailbox can carry the whole system during early stages.
// ---------------------------------------------------------------------------

let cachedMailer: Mailer | null = null;

export function getMailer(): Mailer | null {
  const user = process.env.SMTP_USER || process.env.SUMMIT_GMAIL_USER;
  const pass = process.env.SMTP_PASS || process.env.SUMMIT_GMAIL_APP_PASSWORD;
  if (!user || !pass) return null;

  if (!cachedMailer) {
    const port = Number(process.env.SMTP_PORT || 465);
    cachedMailer = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port,
      secure: port === 465,
      auth: { user, pass },
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
    });
  }
  return cachedMailer;
}

export const DEFAULT_FROM =
  process.env.EMAIL_FROM || 'Ascentor <no-reply@ascentorbi.com>';

export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  from?: string;
  replyTo?: string;
}): Promise<void> {
  const mailer = getMailer();
  if (!mailer) {
    console.warn('[email] SMTP credentials not configured, skipping send to', opts.to);
    return;
  }
  await mailer.sendMail({
    from: opts.from || DEFAULT_FROM,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    replyTo: opts.replyTo,
  });
}
