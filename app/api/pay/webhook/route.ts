// ================================================================
// POST /api/pay/webhook  - SHARED PAYSTACK WEBHOOK
// ================================================================
// Single Paystack webhook endpoint for subscriptions and the
// Elevation Summit.
//
// Register this URL in Paystack Dashboard:
//   Settings -> API Keys & Webhooks -> Webhook URL
//   -> https://joinascentor.com/api/pay/webhook
//
// charge.success -> lib/paymentSettlement.settleReference()
//   The reference must belong to a payment_attempts row we created;
//   amount/currency/owner are checked against what the SERVER recorded.
//   Same code path as /api/summit/pay/verify and /api/pay/callback, so
//   fulfilment happens exactly once no matter who gets there first.
//
// Other events (renewals, cancellations) -> subscription handler.
//
// Security:
//   * HMAC-SHA512 signature verified on every request
//   * Transient failures return 5xx so Paystack retries (it retries
//     non-2xx responses with backoff for up to 72 hours)
// ================================================================

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { settleReference } from '@/lib/paymentSettlement';
import { handleSubscriptionWebhookEvent } from '@/lib/subscriptionWebhookHandler';

function verifySignature(rawBody: string, sig: string, secret: string): boolean {
  if (!/^[0-9a-f]{128}$/i.test(sig)) return false; // sha512 hex = 128 chars
  const expected = crypto.createHmac('sha512', secret).update(rawBody).digest();
  return crypto.timingSafeEqual(expected, Buffer.from(sig, 'hex'));
}

export async function POST(req: NextRequest) {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) {
    console.error('[pay/webhook] PAYSTACK_SECRET_KEY is not configured');
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 });
  }

  const rawBody   = await req.text();
  const signature = req.headers.get('x-paystack-signature') ?? '';

  if (!verifySignature(rawBody, signature, secret)) {
    console.error('[pay/webhook] Invalid HMAC signature - rejected');
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  try {
    const reference: string | undefined = payload?.data?.reference;

    if (payload?.event === 'charge.success' && reference) {
      const result = await settleReference(reference);

      if (result.state === 'rejected' && result.reason === 'unknown_reference') {
        // Not a checkout we created (e.g. Paystack-managed renewal or a payment
        // made outside our flow). Never grants access; renewals are handled by
        // the invoice.* events below.
        console.warn(`[pay/webhook] charge.success for unknown reference ${reference} - ignored`);
      }
      return NextResponse.json({ received: true });
    }

    return await handleSubscriptionWebhookEvent(payload);
  } catch (err: any) {
    // Real processing failure (Paystack/DB down, fulfilment error). 5xx makes
    // Paystack retry; settlement is idempotent so retries are safe.
    console.error('[pay/webhook] Processing error - asking Paystack to retry:', err);
    return NextResponse.json({ error: 'Processing error' }, { status: 500 });
  }
}
