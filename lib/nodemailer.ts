import nodemailer from 'nodemailer';
import { FROM_DEFAULT, CONTACT_EMAIL } from './contact';
import { fallbackEnabled, sendViaFallback } from './emailFallback';

// Inferred from the factory - avoids namespace-reference errors
// across different TypeScript/module-resolution configurations.
type Mailer = ReturnType<typeof nodemailer.createTransport>;

// ---------------------------------------------------------------------------
// One mailbox sends everything. Set these in Vercel:
//   SMTP_HOST   smtp.hostinger.com        (this is the default)
//   SMTP_PORT   465                       (defaults to 465)
//   SMTP_USER   the mailbox address
//   SMTP_PASS   the mailbox password
//   EMAIL_FROM  Ascentor <hello@joinascentor.com>   (defaults to this)
//
// Summit mail uses the same mailbox and settings, so there is nothing else to keep in step. Hostinger: smtp.hostinger.com,
// port 465 with SSL (port 587 with STARTTLS also works if a network blocks 465). There is no Gmail fallback.
// ---------------------------------------------------------------------------

function smtpSettings() {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const port = Number(process.env.SMTP_PORT || 465);
  const host = process.env.SMTP_HOST || 'smtp.hostinger.com';
  return { user, pass, port, host };
}

function makeTransport(): Mailer | null {
  const { user, pass, port, host } = smtpSettings();
  if (!user || !pass) return null;
  return nodemailer.createTransport({
    host,
    port,
    // Port 465 is implicit SSL (Hostinger's recommended setting). Any other port, such as 587, upgrades with STARTTLS.
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

export const DEFAULT_FROM = process.env.EMAIL_FROM || FROM_DEFAULT;

export function addressOf(from: string): string {
  const m = from.match(/<([^>]+)>/);
  return (m ? m[1] : from).trim().toLowerCase();
}

export function nameOf(from: string): string {
  const m = from.match(/^\s*"?([^"<]+?)"?\s*</);
  return m ? m[1].trim() : 'Ascentor';
}

/** A login failure: wrong or stale mailbox credentials, or a locked mailbox. NOT a sender problem and never worth retrying. */
export function isAuthFailure(err: unknown): boolean {
  const e = err as { code?: string; responseCode?: number; response?: string; message?: string } | null;
  const text = `${e?.response ?? ''} ${e?.message ?? ''}`.toLowerCase();
  return e?.code === 'EAUTH' || e?.responseCode === 535 || e?.responseCode === 534 || /invalid login|authentication (failed|unsuccessful)|auth(entication)? (rejected|required)/.test(text);
}

/**
 * A 5xx refusal that is about the sender address, not the login, the recipient or the content.
 * A 535 "authentication failed" must NOT count: it used to match on the word "authenticat", so a bad password was reported as
 * "sender refused" and retried, which logged in a second time and doubled the failed logins on the mailbox.
 */
export function refusedSender(err: unknown): boolean {
  if (isAuthFailure(err)) return false;
  const e = err as { responseCode?: number; response?: string; message?: string } | null;
  const code = e?.responseCode ?? 0;
  const text = `${e?.response ?? ''} ${e?.message ?? ''}`.toLowerCase();
  return (code >= 500 && code < 600) && /(sender|from address|not owned|not allowed|spoof|mismatch|553|550 5\.7)/.test(text);
}

export type EmailFailureKind = 'not_configured' | 'auth' | 'sender' | 'connection' | 'rejected' | 'unknown';

/** Sorts a mail error into a cause an admin can act on. Looks only at codes and server replies, never credentials. */
export function classifyEmailError(err: unknown): EmailFailureKind {
  const e = err as { code?: string; responseCode?: number } | null;
  if (e?.code === 'ENOTCONFIGURED') return 'not_configured';
  if (isAuthFailure(err)) return 'auth';
  if (refusedSender(err)) return 'sender';
  if (['ECONNECTION', 'ETIMEDOUT', 'ESOCKET', 'ECONNREFUSED', 'EDNS', 'ENOTFOUND'].includes(e?.code ?? '')) return 'connection';
  if ((e?.responseCode ?? 0) >= 500) return 'rejected';
  return 'unknown';
}

const FIX_HINT: Record<EmailFailureKind, string> = {
  not_configured: 'Set SMTP_USER and SMTP_PASS in Vercel (Production and Preview) and redeploy.',
  auth: 'The mail server rejected the mailbox login (535). Check SMTP_USER is the full mailbox address and SMTP_PASS is its current password; if both are right, the mailbox is locked or suspended. Redeploy after changing either.',
  sender: 'The mail server refused the From address. SMTP_USER must be the mailbox that owns the From address, or the From address must be an alias of it.',
  connection: 'Could not reach the mail server. Check SMTP_HOST and SMTP_PORT (465 SSL or 587 STARTTLS).',
  rejected: 'The mail server refused this message. See the response code.',
  unknown: 'Unknown mail error.',
};

/** One log line per failed send: the cause, the server's reply and the fix. Never the password, never the message body. */
export function logEmailFailure(err: unknown, ctx: { to: string; subject: string }) {
  const e = err as { code?: string; responseCode?: number; response?: string; command?: string; message?: string } | null;
  const kind = classifyEmailError(err);
  const s = smtpSettings();
  console.error('[email] SEND FAILED', JSON.stringify({
    kind,
    code: e?.code ?? null,
    responseCode: e?.responseCode ?? null,
    command: e?.command ?? null,
    response: (e?.response ?? e?.message ?? '').toString().slice(0, 200),
    host: s.host,
    port: s.port,
    mailbox: s.user ?? null,
    toDomain: ctx.to.split('@')[1] ?? null,
    subject: ctx.subject.slice(0, 80),
    fix: FIX_HINT[kind],
  }));
}

/** A short code for storing on a record ("EAUTH", "535", "ETIMEDOUT"). Never a message, so never a secret. */
export function emailErrorCode(err: unknown): string {
  const e = err as { code?: string; responseCode?: number } | null;
  return (e?.code || (e?.responseCode ? String(e.responseCode) : '') || classifyEmailError(err)).toString().slice(0, 40);
}

/** Like sendEmail, but never throws: returns whether the message went out. For flows where a failed email must not block the visitor. */
export async function sendEmailSafe(opts: Parameters<typeof sendEmail>[0]): Promise<boolean> {
  if (!getMailer() && !fallbackEnabled()) { await sendEmail(opts).catch(() => {}); return false; }
  try { await sendEmail(opts); return true; } catch { return false; }
}

// Hard limits so one broken mailbox is never hammered: at most MAX_ATTEMPTS sends per message, a pause between them, and after
// a login failure no further logins from this server instance for AUTH_COOLDOWN_MS (a lockout on the mailbox helps nobody).
const MAX_ATTEMPTS = 2;
let retryDelayMs = 1500;
const AUTH_COOLDOWN_MS = 120_000;
let authBlock: { until: number; err: unknown } | null = null;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** For tests only. */
export function __testHooks(h: { mailer?: Mailer | null; retryDelayMs?: number; reset?: boolean }) {
  if (h.mailer !== undefined) cachedMailer = h.mailer;
  if (h.retryDelayMs !== undefined) retryDelayMs = h.retryDelayMs;
  if (h.reset) authBlock = null;
}

export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  /** Optional plain-text alternative. */
  text?: string;
  from?: string;
  replyTo?: string;
  attachments?: { filename: string; content: Buffer; contentType: string }[];
  /** Codes the member cannot continue without (sign-up, password reset): throw instead of skipping when mail is not configured. */
  required?: boolean;
}): Promise<void> {
  const mailer = getMailer();
  const viaFallback = () => sendViaFallback({ from: opts.from || DEFAULT_FROM, to: opts.to, subject: opts.subject, html: opts.html, text: opts.text, replyTo: opts.replyTo || CONTACT_EMAIL, attachments: opts.attachments });
  if (!mailer) {
    if (fallbackEnabled()) { await viaFallback(); return; }
    console.error('[email] SEND FAILED', JSON.stringify({ kind: 'not_configured', toDomain: opts.to.split('@')[1] ?? null, subject: opts.subject.slice(0, 80), fix: FIX_HINT.not_configured }));
    if (opts.required) throw new Error('SMTP is not configured (SMTP_USER / SMTP_PASS missing)');
    return;
  }
  if (authBlock && Date.now() < authBlock.until) { // cooling down after a login failure: do not try SMTP again
    if (fallbackEnabled()) { await viaFallback(); return; }
    throw authBlock.err;
  }
  authBlock = null;

  const from = opts.from || DEFAULT_FROM;
  const base = { to: opts.to, subject: opts.subject, html: opts.html, text: opts.text, attachments: opts.attachments };
  let attemptFrom = from;
  let attemptReplyTo = opts.replyTo || CONTACT_EMAIL;
  let lastErr: unknown;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      await mailer.sendMail({ ...base, from: attemptFrom, replyTo: attemptReplyTo });
      return;
    } catch (err) {
      lastErr = err;
      if (isAuthFailure(err)) { authBlock = { until: Date.now() + AUTH_COOLDOWN_MS, err }; break; }
      // Some hosts only let a mailbox send as itself. If the server refuses the From address, send once more as the mailbox and
      // keep the intended address as the reply-to, so the message still goes out and replies still reach the right inbox.
      const mailbox = smtpSettings().user;
      if (attempt < MAX_ATTEMPTS && mailbox && refusedSender(err) && addressOf(attemptFrom) !== mailbox.toLowerCase()) {
        console.warn('[email] sender refused, retrying as the mailbox:', addressOf(attemptFrom), '->', mailbox);
        attemptReplyTo = opts.replyTo || addressOf(attemptFrom);
        attemptFrom = `${nameOf(attemptFrom)} <${mailbox}>`;
        await sleep(retryDelayMs);
        continue;
      }
      break;
    }
  }
  logEmailFailure(lastErr, opts);
  // SMTP could not send. If a fallback provider has been switched on, use it rather than lose the message. A refusal of the
  // message itself (bad recipient, content) is not retried elsewhere.
  const kind = classifyEmailError(lastErr);
  if (fallbackEnabled() && kind !== 'rejected') {
    try { await viaFallback(); console.warn('[email] sent through the fallback provider'); return; }
    catch (fbErr) { console.error('[email] fallback provider also failed:', (fbErr as Error).message.slice(0, 160)); }
  }
  throw lastErr;
}
