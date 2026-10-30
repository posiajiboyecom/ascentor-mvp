// lib/summitDeliveryCore.ts
// The rules of the Summit "Delivery" view, with no database and no server-only imports so they can be tested and used in the
// browser. A registration is only in this view once it is confirmed (payment_status 'paid'): that is the point a ticket is owed.
//
// What we can know: whether OUR mail server accepted the message. What we cannot know: whether the recipient's inbox accepted it
// later. A bounce comes back to the sending mailbox as a separate email, so it is never visible here. "Unknown" below means a send
// that started and never reported back (for example the page was closed mid-send), not a bounce.

export type DeliveryStatus = 'sent' | 'unsent' | 'failed' | 'unknown';
export type DeliveryFilter = 'all' | 'sent' | 'unsent' | 'failed';

export interface DeliveryRegRow {
  id: string;
  full_name: string | null;
  email: string | null;
  confirmation_email_sent_at: string | null;
  confirmation_email_status: string | null;
  confirmation_email_attempts: number | null;
  confirmation_email_error_code: string | null;
  confirmation_email_last_attempt_at: string | null;
}

export interface DeliveryRow {
  id: string;
  name: string;
  email: string;
  status: DeliveryStatus;
  attempts: number;
  lastAttemptAt: string | null;
  sentAt: string | null;
  error: string;
}

/** A send that was claimed longer ago than this and never finished counts as stalled (and may be picked up again). */
export const STALE_SENDING_MS = 5 * 60_000;

export function deriveStatus(r: DeliveryRegRow): DeliveryStatus {
  if (r.confirmation_email_sent_at) return 'sent';
  if (r.confirmation_email_status === 'sending') return 'unknown'; // being sent right now, or started and never reported back
  if (r.confirmation_email_status === 'failed' || r.confirmation_email_error_code) return 'failed';
  return 'unsent';
}

export type FailureKind = 'auth' | 'sender' | 'connection' | 'not_configured' | 'rejected' | 'unknown';

/** Turns the short error code stored on the row ("EAUTH", "535", "ETIMEDOUT", "550") into a cause. Codes only, never message text. */
export function kindFromCode(code: string | null | undefined): FailureKind {
  const c = String(code ?? '').toUpperCase();
  if (!c) return 'unknown';
  if (c === 'EAUTH' || c === '535' || c === '534' || c === 'AUTH') return 'auth';
  if (c === 'ENOTCONFIGURED' || c === 'NOT_CONFIGURED') return 'not_configured';
  if (['ECONNECTION', 'ETIMEDOUT', 'ESOCKET', 'ECONNREFUSED', 'EDNS', 'ENOTFOUND', 'CONNECTION'].includes(c)) return 'connection';
  if (c === 'SENDER') return 'sender';
  if (/^5\d\d$/.test(c) || c === 'EENVELOPE' || c === 'REJECTED') return 'rejected';
  return 'unknown';
}

/** Plain-words reason for one row. No codes the admin has to decode, no secrets. */
export function plainError(code: string | null | undefined): string {
  switch (kindFromCode(code)) {
    case 'auth': return 'The mail server rejected our mailbox login.';
    case 'sender': return 'The mail server refused the From address.';
    case 'connection': return 'Could not reach the mail server.';
    case 'not_configured': return 'Email is not set up on the server.';
    case 'rejected': return code ? `The mail server refused this message (${String(code).slice(0, 12)}). The address may not exist.` : 'The mail server refused this message.';
    default: return code ? `Unknown mail error (${String(code).slice(0, 12)}).` : '';
  }
}

export function toDeliveryRow(r: DeliveryRegRow): DeliveryRow {
  const status = deriveStatus(r);
  return {
    id: r.id,
    name: (r.full_name ?? '').trim() || '-',
    email: (r.email ?? '').trim(),
    status,
    attempts: Number(r.confirmation_email_attempts ?? 0),
    lastAttemptAt: r.confirmation_email_last_attempt_at ?? null,
    sentAt: r.confirmation_email_sent_at ?? null,
    error: status === 'failed' ? plainError(r.confirmation_email_error_code) || 'The last attempt failed.' : status === 'unknown' ? 'A send is in progress, or started and did not report back. It is tried again after 5 minutes.' : '',
  };
}

export interface DeliveryCounts { total: number; sent: number; unsent: number; failed: number; unknown: number }

export function countDelivery(rows: { status: DeliveryStatus }[]): DeliveryCounts {
  const c: DeliveryCounts = { total: rows.length, sent: 0, unsent: 0, failed: 0, unknown: 0 };
  for (const r of rows) c[r.status]++;
  return c;
}

/** The tab filter: "Not sent" also holds sends that never reported back, because both still owe the person a ticket email. */
export function filterDelivery(rows: DeliveryRow[], filter: DeliveryFilter, q: string): DeliveryRow[] {
  const needle = q.trim().toLowerCase();
  return rows.filter((r) => {
    if (filter === 'sent' && r.status !== 'sent') return false;
    if (filter === 'unsent' && r.status !== 'unsent' && r.status !== 'unknown') return false;
    if (filter === 'failed' && r.status !== 'failed') return false;
    return !needle || r.name.toLowerCase().includes(needle) || r.email.toLowerCase().includes(needle);
  });
}

/** How many people still owe a ticket email, for the "Resend all unsent" button. */
export const owed = (c: DeliveryCounts) => c.unsent + c.failed + c.unknown;

const LABEL: Record<DeliveryStatus, string> = { sent: 'Sent', unsent: 'Not sent', failed: 'Failed', unknown: 'Unknown' };
export const statusLabel = (s: DeliveryStatus) => LABEL[s];

/** One CSV cell. Quotes when needed, and defuses spreadsheet formulas (a cell starting with = + - @ would run as one). */
export function csvCell(v: unknown): string {
  let s = v == null ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function deliveryCsv(rows: DeliveryRow[]): string {
  const head = ['Name', 'Email', 'Status', 'Attempts', 'Last attempt (UTC)', 'Sent at (UTC)', 'Last error'];
  const lines = [head.map(csvCell).join(',')];
  for (const r of rows) lines.push([r.name, r.email, statusLabel(r.status), r.attempts, r.lastAttemptAt ?? '', r.sentAt ?? '', r.error].map(csvCell).join(','));
  return lines.join('\r\n') + '\r\n';
}

/** Progress text for the run: "38 of 43 sent". */
export function progressText(done: number, total: number, failed: number): string {
  return `${done} of ${total} sent${failed ? `, ${failed} failed` : ''}`;
}
