// lib/summitDelivery.ts
// Server side of the Summit Delivery view: reads the confirmed registrations and sends tickets. Uses only columns that already exist
// (confirmation_email_*). Nothing is written except through deliverPaidEmails, which records every attempt.
import 'server-only';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { deliverPaidEmails, describeEmailFailure, resendUnsentBatch } from '@/lib/summitEmails';
import { toDeliveryRow, type DeliveryRow, type DeliveryRegRow } from '@/lib/summitDeliveryCore';

const COLS = 'id, full_name, email, confirmation_email_sent_at, confirmation_email_status, confirmation_email_attempts, confirmation_email_error_code, confirmation_email_last_attempt_at';

export async function loadDelivery(): Promise<{ rows: DeliveryRow[]; unconfirmed: number }> {
  const { data, error } = await supabaseAdmin
    .from('summit_registrations').select(`${COLS}, payment_status`).order('created_at', { ascending: true }).limit(5000);
  if (error) throw new Error(error.message);
  const all = (data ?? []) as (DeliveryRegRow & { payment_status: string | null })[];
  const paid = all.filter((r) => r.payment_status === 'paid');
  return { rows: paid.map((r) => toDeliveryRow(r)), unconfirmed: all.length - paid.length };
}

export interface BatchResult {
  sent: number; failed: number; remaining: number; failedIds: string[];
  /** Set when the run must stop on its own (login failure and similar), in plain words. */
  stopMessage?: string;
  /** Nothing could be sent this time because another send holds the remaining rows. */
  busy?: boolean;
}

/** One small batch, idempotent: each row is claimed before it is sent, so a double press or a second admin cannot double-send. */
export async function sendUnsentBatch(excludeIds: string[], limit = 4): Promise<BatchResult> {
  const r = await resendUnsentBatch(Math.min(Math.max(limit, 1), 5), 1500, undefined, excludeIds.slice(0, 500));
  const stopMessage = r.stopped ? describeEmailFailure(r.stopped.kind, r.stopped.code) : undefined;
  return { sent: r.sent, failed: r.failed, remaining: r.remaining, failedIds: r.failedIds, stopMessage, busy: !r.stopped && r.sent + r.failed === 0 && r.remaining > 0 };
}

export type OneResult = { ok: true; message: string } | { ok: false; error: string };

/** Resend to one person. A second press within 20 seconds is refused, so a double click sends one email. */
export async function resendOneTicket(id: string): Promise<OneResult> {
  const { data: reg } = await supabaseAdmin.from('summit_registrations').select('*').eq('id', id).maybeSingle();
  if (!reg) return { ok: false, error: 'Registration not found.' };
  if (reg.payment_status !== 'paid') return { ok: false, error: 'Only confirmed registrations are sent a ticket.' };
  const now = new Date();
  const guardAfter = new Date(now.getTime() - 20_000).toISOString();
  const stale = new Date(now.getTime() - 5 * 60_000).toISOString();
  // Claim: only one press can move the row into 'sending' (or take it over once the claim is 5 minutes old).
  const { data: claimed } = await supabaseAdmin.from('summit_registrations')
    .update({ confirmation_email_status: 'sending', confirmation_email_last_attempt_at: now.toISOString() })
    .eq('id', id)
    .or(`confirmation_email_last_attempt_at.is.null,confirmation_email_last_attempt_at.lt.${guardAfter}`)
    .or(`confirmation_email_status.is.null,confirmation_email_status.neq.sending,confirmation_email_last_attempt_at.lt.${stale}`)
    .select('*').maybeSingle();
  if (!claimed) return { ok: false, error: 'A ticket was just sent (or is being sent) to this person. Wait a moment before trying again.' };
  const out = await deliverPaidEmails(claimed, Number(claimed.amount_paid ?? 0), claimed.currency ?? 'NGN', claimed.payment_reference ?? '', { customer: true });
  if (!out.customer) return { ok: false, error: describeEmailFailure(out.customerError?.kind ?? 'unknown', out.customerError?.code) };
  return { ok: true, message: `Ticket sent to ${claimed.email}.` };
}
