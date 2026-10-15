import nodemailer from 'nodemailer';
import { FROM_DEFAULT, CONTACT_EMAIL } from './contact';

// Inferred from the factory - avoids namespace-reference errors
// across different TypeScript/module-resolution configurations.
type Mailer = ReturnType<typeof nodemailer.createTransport>;

// ---------------------------------------------------------------------------
// One mailbox sends everything. Set these in Vercel:
//   SMTP_HOST   smtp.hostinger.com        (defaults to smtp.gmail.com)
//   SMTP_PORT   465                       (defaults to 465)
//   SMTP_USER   the mailbox address
//   SMTP_PASS   the mailbox password
//   EMAIL_FROM  Ascentor <hello@joinascentor.com>   (defaults to this)
//
// The Summit mailer follows the same settings, so there is no second mailbox to keep in step. Old Gmail settings
// (SUMMIT_GMAIL_USER and SUMMIT_GMAIL_APP_PASSWORD) are only used when SMTP_USER and SMTP_PASS are not set.
// ---------------------------------------------------------------------------

function smtpSettings() {
  const user = process.env.SMTP_USER || process.env.SUMMIT_GMAIL_USER;
  const pass = process.env.SMTP_PASS || process.env.SUMMIT_GMAIL_APP_PASSWORD;
  const port = Number(process.env.SMTP_PORT || 465);
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  return { user, pass, port, host };
}

function makeTransport(): Mailer | null {
  const { user, pass, port, host } = smtpSettings();
  if (!user || !pass) return null;
  return nodemailer.createTransport({
    host,
    port,
    // 465 (implicit TLS) rather than 587 (STARTTLS): many home and office networks block 587.
    secure: port === 465,
    auth: { user, pass },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
  });
}

let cachedMailer: Mailer | null = null;

export function getMailer(): Mailer | null {
  if (!cachedMailer) cachedMailer = makeTransport();
  return cachedMailer;
}

/** What the mailer is set up to use, without the password. For the email test script and diagnostics. */
export function mailerInfo(): { configured: boolean; host: string; port: number; user: string | null; from: string } {
  const s = smtpSettings();
  return { configured: !!(s.user && s.pass), host: s.host, port: s.port, user: s.user ?? null, from: DEFAULT_FROM };
}

/**
 * The Summit mailer. It now shares the main mailbox and server, so Summit tickets and notifications leave from the same
 * place. Kept as its own export because the Summit code imports it by name.
 */
const fallbackSettings = smtpSettings();
export const summitMailer: Mailer = getMailer() ?? nodemailer.createTransport({
  host: fallbackSettings.host, port: fallbackSettings.port, secure: fallbackSettings.port === 465,
  auth: { user: fallbackSettings.user, pass: fallbackSettings.pass },
});

export const DEFAULT_FROM = process.env.EMAIL_FROM || FROM_DEFAULT;

export function addressOf(from: string): string {
  const m = from.match(/<([^>]+)>/);
  return (m ? m[1] : from).trim().toLowerCase();
}

export function nameOf(from: string): string {
  const m = from.match(/^\s*"?([^"<]+?)"?\s*</);
  return m ? m[1].trim() : 'Ascentor';
}

/** A 5xx refusal that is about the sender address, not the recipient or the content. */
export function refusedSender(err: unknown): boolean {
  const e = err as { responseCode?: number; response?: string; message?: string } | null;
  const code = e?.responseCode ?? 0;
  const text = `${e?.response ?? ''} ${e?.message ?? ''}`.toLowerCase();
  return (code >= 500 && code < 600) && /(sender|from address|not owned|not allowed|spoof|authenticat|mismatch|553|550 5\.7)/.test(text);
}

export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  from?: string;
  replyTo?: string;
  attachments?: { filename: string; content: Buffer; contentType: string }[];
}): Promise<void> {
  const mailer = getMailer();
  if (!mailer) {
    console.warn('[email] SMTP credentials not configured, skipping send to', opts.to);
    return;
  }
  const from = opts.from || DEFAULT_FROM;
  const replyTo = opts.replyTo || CONTACT_EMAIL;
  try {
    await mailer.sendMail({ from, to: opts.to, subject: opts.subject, html: opts.html, replyTo, attachments: opts.attachments });
  } catch (err) {
    // Some hosts only let a mailbox send as itself. If the server refuses the From address, send as the mailbox and keep
    // the intended address as the reply-to, so the message still goes out and replies still reach the right inbox.
    const mailbox = smtpSettings().user;
    if (mailbox && refusedSender(err) && addressOf(from) !== mailbox.toLowerCase()) {
      console.warn('[email] sender refused, retrying as the mailbox:', addressOf(from), '->', mailbox);
      await mailer.sendMail({ from: `${nameOf(from)} <${mailbox}>`, to: opts.to, subject: opts.subject, html: opts.html, replyTo: opts.replyTo || addressOf(from), attachments: opts.attachments });
      return;
    }
    throw err;
  }
}
