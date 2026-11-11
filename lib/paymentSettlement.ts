// lib/paymentSettlement.ts
// ─────────────────────────────────────────────────────────────────────────────
// SINGLE SOURCE OF TRUTH for turning a Paystack transaction into a fulfilled
// order. Used by every path that can learn a payment succeeded:
//
//   • /api/donate/verify        (browser callback after the popup)
//   • Plans are sold through Billing v2 only (lib/billing). The old one-time
//     subscription checkout (kind 'subscription') is retired: such attempts are
//     refused here and never grant a plan.
//   • /api/pay/webhook         (charge.success)
//   • lib/paymentReconciliation (scheduled sweep)
//   • Summit ticket checkout has been retired (registration is free); this
//     settlement path is kept for admin reconciliation of the historical
//     paid registrations from before that change.
//
// Guarantees:
//   1. A transaction only fulfils an order if its reference exists in
//      payment_attempts (we created it) - unknown references are rejected, so a
//      payment made outside our flow (e.g. a N100 inline-popup transaction with
//      forged metadata) can never grant anything.
//   2. Amount, currency and owner are compared to what the SERVER recorded when
//      the attempt was created, never to anything the client/metadata says.
//   3. Fulfilment is claimed with a conditional UPDATE (status pending ->
//      success), so concurrent verify/webhook/cron runs fulfil exactly once and
//      emails are sent exactly once.
//   4. If fulfilment throws after the claim, the claim is released so the next
//      retry (Paystack webhook retry / cron) can complete it.
// ─────────────────────────────────────────────────────────────────────────────

import 'server-only';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { deliverPaidEmails, deliverDonationEmails } from '@/lib/summitEmails';

// ── Types ────────────────────────────────────────────────────────────────────

export type AttemptKind = 'subscription' | 'summit' | 'donation' | 'shop';
export type AttemptStatus = 'pending' | 'success' | 'failed' | 'abandoned' | 'duplicate';

export interface PaymentAttempt {
  id:              string;
  reference:       string;
  kind:            AttemptKind;
  status:          AttemptStatus;
  user_id:         string | null;
  plan_id:         string | null;
  billing:         string | null;
  registration_id: string | null;
  donation_id:     string | null;
  order_id:        string | null;
  email:           string | null;
  amount_kobo:     number | null;
  currency:        string | null;
  created_at:      string;
  recovery_sent_at: string | null;
  admin_notified_at: string | null;
}

export type SettleResult =
  | { state: 'settled';  attempt: PaymentAttempt; alreadySettled: boolean }
  | { state: 'pending';  attempt: PaymentAttempt; providerStatus: string }
  | { state: 'failed';   attempt: PaymentAttempt; providerStatus: string }
  | { state: 'notfound'; attempt: PaymentAttempt }
  | { state: 'rejected'; reason: string; attempt: PaymentAttempt | null };

export interface PaystackTransaction {
  id:        number;
  status:    string;
  reference: string;
  amount:    number;
  currency:  string;
  channel?:  string;
  fees?:     number | null;
  paid_at?:  string;
  metadata?: Record<string, any> | null;
  authorization?: Record<string, any> | null;
  customer?: { email?: string } | null;
}

export interface SummitPrices { onsite: number; virtual: number }

/** Reads the per-type ticket prices; returns null (never NaN) when misconfigured. */
export function getSummitPricesNaira(): SummitPrices | null {
  const onsite  = Number(process.env.SUMMIT_TICKET_PRICE_ONSITE_NGN);
  const virtual = Number(process.env.SUMMIT_TICKET_PRICE_VIRTUAL_NGN);
  if (!Number.isFinite(onsite) || onsite <= 0)   return null;
  if (!Number.isFinite(virtual) || virtual <= 0) return null;
  return { onsite, virtual };
}

// ── Paystack ─────────────────────────────────────────────────────────────────

type PaystackLookup =
  | { found: true;  tx: PaystackTransaction }
  | { found: false };

/**
 * Verifies a reference with Paystack.
 * Returns { found:false } when Paystack has never seen the reference (checkout
 * opened but never started). Throws on network/5xx so callers can retry.
 */
export async function fetchPaystackTransaction(reference: string): Promise<PaystackLookup> {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) throw new Error('PAYSTACK_SECRET_KEY is not configured');

  const res = await fetch(
    `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
    { headers: { Authorization: `Bearer ${secret}` }, cache: 'no-store' }
  );
  const body = await res.json().catch(() => null);

  if (res.status === 404 || (body && body.status === false && /not found/i.test(String(body.message ?? '')))) {
    return { found: false };
  }
  if (!res.ok || !body?.status || !body.data) {
    throw new Error(`Paystack verify failed (${res.status}): ${body?.message ?? 'no body'}`);
  }
  return { found: true, tx: body.data as PaystackTransaction };
}

// ── Attempts ─────────────────────────────────────────────────────────────────

const ATTEMPT_COLUMNS =
  'id, reference, kind, status, user_id, plan_id, billing, registration_id, donation_id, order_id, email, amount_kobo, currency, created_at, recovery_sent_at, admin_notified_at';

export async function getAttemptByReference(reference: string): Promise<PaymentAttempt | null> {
  const { data, error } = await supabaseAdmin
    .from('payment_attempts')
    .select(ATTEMPT_COLUMNS)
    .eq('reference', reference)
    .maybeSingle();
  if (error) throw new Error(`payment_attempts lookup failed: ${error.message}`);
  return (data as PaymentAttempt | null) ?? null;
}

export async function createAttempt(input: {
  reference:       string;
  kind:            AttemptKind;
  amountKobo:      number;
  email:           string;
  userId?:         string | null;
  planId?:         string | null;
  billing?:        string | null;
  registrationId?: string | null;
  donationId?:     string | null;
  orderId?:        string | null;
  /** NGN (default) or USD. Settlement rejects a payment Paystack took in any other currency. */
  currency?:       'NGN' | 'USD';
}): Promise<void> {
  const { error } = await supabaseAdmin.from('payment_attempts').insert({
    reference:       input.reference,
    kind:            input.kind,
    status:          'pending',
    user_id:         input.userId ?? null,
    plan_id:         input.planId ?? null,
    billing:         input.billing ?? null,
    registration_id: input.registrationId ?? null,
    donation_id:     input.donationId ?? null,
    order_id:        input.orderId ?? null,
    email:           input.email,
    amount_kobo:     input.amountKobo,
    currency:        input.currency ?? 'NGN',
  });
  if (error) throw new Error(`Could not record payment attempt: ${error.message}`);
}

async function setAttemptStatus(
  reference: string,
  from: AttemptStatus[],
  patch: Record<string, unknown>,
): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from('payment_attempts')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('reference', reference)
    .in('status', from)
    .select('id');
  if (error) throw new Error(`payment_attempts update failed: ${error.message}`);
  return (data?.length ?? 0) > 0;
}

// ── Admin notifications ──────────────────────────────────────────────────────

/** In-app notification for every admin + one email to the admin mailbox. */
export async function notifyAdmins(input: {
  title:   string;
  message: string;
  link?:   string;
  type?:   string;
  emailHtml?: string;
}): Promise<void> {
  try {
    const { data: admins } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('role', 'admin');

    if (admins?.length) {
      await supabaseAdmin.from('notifications').insert(
        admins.map((a: { id: string }) => ({
          user_id: a.id,
          type:    input.type ?? 'payment_alert',
          title:   input.title,
          message: input.message,
          link:    input.link ?? '/admin',
        }))
      );
    }
  } catch (err) {
    console.error('[notifyAdmins] in-app notification failed:', err);
  }

  try {
    const { sendEmail } = await import('@/lib/nodemailer');
    const { brandedEmailLayout, esc, p, goldButton } = await import('@/lib/emailTemplate');
    const { adminNotifyEmail } = await import('@/lib/contact');
    const adminEmail = adminNotifyEmail(process.env.ADMIN_EMAIL);
    const base = process.env.NEXT_PUBLIC_URL || 'https://joinascentor.com';
    await sendEmail({
      to: adminEmail,
      subject: input.title,
      html: brandedEmailLayout({
        preheader: input.message.slice(0, 120),
        eyebrow:   'Admin Alert',
        heading:   input.title,
        recipient: adminEmail,
        content:
          (input.emailHtml ?? p(esc(input.message))) +
          goldButton('Open admin dashboard', `${base}${input.link ?? '/admin'}`),
      }),
    });
  } catch (err) {
    console.error('[notifyAdmins] email failed:', err);
  }
}

// ── Fulfilment ───────────────────────────────────────────────────────────────

type FulfilOutcome = 'fulfilled' | 'duplicate';

async function fulfilSummit(attempt: PaymentAttempt, tx: PaystackTransaction): Promise<FulfilOutcome> {
  if (!attempt.registration_id) throw new Error('Summit attempt has no registration_id');

  const nowIso = new Date().toISOString();
  const { data: rows, error } = await supabaseAdmin
    .from('summit_registrations')
    .update({
      payment_status:         'paid',
      status:                 'confirmed',
      payment_reference:      attempt.reference,
      amount_paid:            tx.amount / 100,
      currency:               tx.currency,
      payment_provider_tx_id: String(tx.id),
      paid_at:                nowIso,
      confirmed_at:           nowIso,
      updated_at:             nowIso,
    })
    .eq('id', attempt.registration_id)
    .neq('payment_status', 'paid')
    .select('*');
  if (error) throw new Error(`summit_registrations update failed: ${error.message}`);

  const registration = rows?.[0];
  if (!registration) {
    // Either the registration is already paid (customer paid twice) or it no
    // longer exists. Both need a human: flag for a refund.
    return 'duplicate';
  }

  // Paystack fee (kobo). Best-effort: needs the paystack_fee column and must
  // never be able to undo a paid ticket.
  if (tx.fees != null) {
    try {
      await supabaseAdmin.from('summit_registrations')
        .update({ paystack_fee: tx.fees / 100 }).eq('id', registration.id);
    } catch { /* column not migrated yet */ }
  }

  // Claim winner only. Customer + admin emails are independent and tracked;
  // failures never undo a paid ticket and are retried by reconciliation / admin Resend.
  await deliverPaidEmails(registration, tx.amount / 100, tx.currency ?? 'NGN', attempt.reference);
  return 'fulfilled';
}

async function fulfilShop(attempt: PaymentAttempt): Promise<FulfilOutcome> {
  if (!attempt.order_id) throw new Error('Shop attempt has no order_id');
  const { data: order } = await supabaseAdmin
    .from('shop_orders').select('id, status').eq('id', attempt.order_id).maybeSingle();
  if (!order) return 'duplicate';
  if (order.status !== 'pending') return 'duplicate';

  const { data: items } = await supabaseAdmin
    .from('shop_order_items').select('product_id, qty, fulfilment').eq('order_id', attempt.order_id);
  const hasShip = (items ?? []).some((i: { fulfilment: string }) => i.fulfilment === 'ship');

  // Claim winner only: pending -> paid (physical) or ready (digital / course only).
  const { data: claimed } = await supabaseAdmin.from('shop_orders')
    .update({ status: hasShip ? 'paid' : 'ready', paid_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', attempt.order_id).eq('status', 'pending').select('id');
  if (!claimed?.length) return 'duplicate';

  for (const it of items ?? []) {
    if (it.product_id) await supabaseAdmin.rpc('shop_after_sale', { p_product: it.product_id, p_qty: it.qty });
  }
  // Receipt and admin alert never undo a paid order; failures are logged and the admin can resend.
  const { deliverShopEmails } = await import('@/lib/shopEmails');
  await deliverShopEmails(attempt.order_id).catch((e) => console.error('[shop] receipt email failed:', e));
  return 'fulfilled';
}

async function fulfilDonation(attempt: PaymentAttempt, tx: PaystackTransaction): Promise<FulfilOutcome> {
  if (!attempt.donation_id) throw new Error('Donation attempt has no donation_id');

  const nowIso = new Date().toISOString();
  const { data: rows, error } = await supabaseAdmin
    .from('summit_donations')
    .update({
      status:                 'paid',
      payment_reference:      attempt.reference,
      payment_provider_tx_id: String(tx.id),
      amount:                 tx.amount / 100,
      currency:               tx.currency,
      paid_at:                nowIso,
      updated_at:             nowIso,
    })
    .eq('id', attempt.donation_id)
    .neq('status', 'paid')
    .select('*');
  if (error) throw new Error(`summit_donations update failed: ${error.message}`);

  const donation = rows?.[0];
  if (!donation) {
    // Already paid (customer paid twice) or the row no longer exists.
    return 'duplicate';
  }

  if (tx.fees != null) {
    try {
      await supabaseAdmin.from('summit_donations')
        .update({ paystack_fee: tx.fees / 100 }).eq('id', donation.id);
    } catch { /* column not migrated yet */ }
  }

  await deliverDonationEmails(donation);
  return 'fulfilled';
}



// ── Public: settle one reference ─────────────────────────────────────────────

/**
 * Verifies `reference` with Paystack and fulfils the matching attempt exactly
 * once. Safe to call repeatedly and concurrently. Throws only for transient
 * problems (Paystack/DB unavailable) - callers should turn that into a 5xx so
 * Paystack retries.
 */
export async function settleReference(reference: string): Promise<SettleResult> {
  if (!reference || typeof reference !== 'string' || reference.length > 200) {
    return { state: 'rejected', reason: 'invalid_reference', attempt: null };
  }

  const attempt = await getAttemptByReference(reference);
  if (!attempt) {
    return { state: 'rejected', reason: 'unknown_reference', attempt: null };
  }
  if (attempt.status === 'success' || attempt.status === 'duplicate') {
    return { state: 'settled', attempt, alreadySettled: true };
  }
  // The old subscription checkout is retired; plans are sold only through Billing v2 (Seeker, Builder and Pinnacle).
  if (attempt.kind === 'subscription') {
    return { state: 'rejected', reason: 'retired_subscription_checkout', attempt };
  }

  const lookup = await fetchPaystackTransaction(reference);
  if (!lookup.found) {
    return { state: 'notfound', attempt };
  }
  const tx = lookup.tx;

  if (tx.status !== 'success') {
    if (tx.status === 'failed' || tx.status === 'reversed') {
      await setAttemptStatus(reference, ['pending', 'abandoned'], {
        status: 'failed', provider_status: tx.status, failure_reason: `Paystack status: ${tx.status}`,
      });
      return { state: 'failed', attempt, providerStatus: tx.status };
    }
    // abandoned | ongoing | pending | processing | queued
    await supabaseAdmin
      .from('payment_attempts')
      .update({ provider_status: tx.status, updated_at: new Date().toISOString() })
      .eq('reference', reference)
      .eq('status', 'pending');
    return { state: 'pending', attempt, providerStatus: tx.status };
  }

  // ── Paystack says success: validate against what WE recorded ──
  const expectedKobo = attempt.amount_kobo ?? null;

  let reject: string | null = null;
  if (expectedKobo == null)                                          reject = 'no_expected_amount';
  else if (tx.amount < expectedKobo)                                 reject = `amount_mismatch (paid ${tx.amount}, expected ${expectedKobo})`;
  else if ((tx.currency || 'NGN') !== (attempt.currency || 'NGN'))   reject = `currency_mismatch (${tx.currency})`;
  else if (attempt.user_id && tx.metadata?.user_id && tx.metadata.user_id !== attempt.user_id) reject = 'user_mismatch';

  if (reject) {
    console.error(`[paymentSettlement] REJECTED ${reference}: ${reject}`);
    await setAttemptStatus(reference, ['pending', 'abandoned'], {
      status: 'failed', provider_status: 'success', failure_reason: `rejected: ${reject}`,
    });
    await notifyAdmins({
      title:   'Payment rejected - needs review',
      message: `Reference ${reference} succeeded at Paystack but failed validation: ${reject}. No access was granted.`,
      link:    attempt.kind === 'donation' ? '/admin/summit-donations' : '/admin/elevation-summit/registrations',
      type:    'payment_alert',
    });
    return { state: 'rejected', reason: reject, attempt };
  }

  // ── Claim (exactly-once) ──
  const claimed = await setAttemptStatus(reference, ['pending', 'abandoned', 'failed'], {
    status:          'success',
    provider_status: 'success',
    provider_tx_id:  String(tx.id),
    paid_at:         tx.paid_at || new Date().toISOString(),
    failure_reason:  null,
  });
  if (!claimed) {
    // Another request won the race and is fulfilling (or has fulfilled) it.
    return { state: 'settled', attempt, alreadySettled: true };
  }

  try {
    const outcome = attempt.kind === 'summit'
      ? await fulfilSummit(attempt, tx)
      : attempt.kind === 'donation'
      ? await fulfilDonation(attempt, tx)
      : await fulfilShop(attempt);

    if (outcome === 'duplicate') {
      await setAttemptStatus(reference, ['success'], { status: 'duplicate', failure_reason: `${attempt.kind} already paid` });
      await notifyAdmins({
        title:   'Duplicate payment - refund needed',
        message: attempt.kind === 'donation'
          ? `${attempt.email ?? 'A donor'} was charged twice for the same donation (ref ${reference}). Please refund one payment in Paystack.`
          : attempt.kind === 'shop'
          ? `${attempt.email ?? 'A customer'} paid for a shop order that was already settled (ref ${reference}). Please check it and refund the extra payment in Paystack.`
          : `${attempt.email ?? 'A customer'} paid twice for the same Summit registration (ref ${reference}). Please refund one payment in Paystack.`,
        link:    attempt.kind === 'donation' ? '/admin/summit-donations' : attempt.kind === 'shop' ? '/admin/shop/orders' : '/admin/elevation-summit/registrations',
        type:    'payment_alert',
      });
    }
    return { state: 'settled', attempt: { ...attempt, status: outcome === 'duplicate' ? 'duplicate' : 'success' }, alreadySettled: false };
  } catch (err) {
    // Release the claim so the next webhook retry / cron run can finish the job.
    await setAttemptStatus(reference, ['success'], {
      status: 'pending', failure_reason: `fulfilment error: ${(err as Error).message}`.slice(0, 500),
    }).catch(() => undefined);
    throw err;
  }
}
