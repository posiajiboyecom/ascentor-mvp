// lib/billing/webhook.ts
// Billing v2 handling for the shared Paystack webhook (app/api/pay/webhook/route.ts). The route has ALREADY verified the
// HMAC signature before calling this. Server-only.
//
//   handleBillingV2Event(payload) -> NextResponse | null
//     null  = not ours (metadata.purpose is something else): the route continues with its existing handling, unchanged.
//     a response = handled here. 5xx asks Paystack to retry (only for a transient Paystack/DB problem).
//
// Handled, all idempotent and all re-verified with Paystack (a webhook body is never trusted for money or cards):
//   purpose 'card_verify'          charge.success -> save the card if not saved yet and refund the check (₦50 or $1)
//   purpose 'subscription_charge'  charge.success -> settle; charge.failed -> the engine's failure path
//   refund.processed / charge.dispute.create -> cancel the referral credit earned by that payment, then fall through
//     (the existing handler still sees the event)

import 'server-only';
import { NextResponse } from 'next/server';
import { completeCardVerification } from './cards';
import { settleSubscriptionChargeReference, cancelCreditForPayment } from './engine';

type Payload = { event?: string; data?: Record<string, unknown> } | null;

function metaOf(data: Record<string, unknown> | undefined): Record<string, unknown> {
  const m = data?.metadata;
  if (!m) return {};
  if (typeof m === 'string') { try { return JSON.parse(m) as Record<string, unknown>; } catch { return {}; } }
  return m as Record<string, unknown>;
}

export async function handleBillingV2Event(payload: Payload): Promise<NextResponse | null> {
  const event = payload?.event;
  const data = payload?.data;
  if (!event || !data) return null;

  if (event === 'refund.processed' || event === 'charge.dispute.create') {
    const ref = (data.transaction_reference as string | undefined) ?? ((data.transaction as { reference?: string } | undefined)?.reference);
    if (ref) {
      try { await cancelCreditForPayment(ref); } catch (e) { console.error('[billing/webhook] credit cancel failed:', e instanceof Error ? e.message : 'unknown'); }
    }
    return null; // keep the existing handling
  }

  const purpose = metaOf(data).purpose;
  if (purpose !== 'card_verify' && purpose !== 'subscription_charge') return null;
  const reference = typeof data.reference === 'string' ? data.reference : '';
  if (!reference) return NextResponse.json({ received: true });

  if (purpose === 'card_verify') {
    if (event !== 'charge.success') return NextResponse.json({ received: true });
    const userId = metaOf(data).user_id;
    if (typeof userId !== 'string') return NextResponse.json({ received: true });
    const r = await completeCardVerification(userId, reference);
    if (!r.ok && r.retryable) return NextResponse.json({ error: 'Try again' }, { status: 500 });
    return NextResponse.json({ received: true });
  }

  // subscription_charge
  if (event !== 'charge.success' && event !== 'charge.failed') return NextResponse.json({ received: true });
  const out = await settleSubscriptionChargeReference(reference);
  if (out === 'pending' && event === 'charge.success') return NextResponse.json({ error: 'Try again' }, { status: 500 });
  return NextResponse.json({ received: true });
}
