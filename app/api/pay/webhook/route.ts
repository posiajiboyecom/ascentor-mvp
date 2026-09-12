// ================================================================
// POST /api/pay/webhook  — SHARED PAYSTACK WEBHOOK
// ================================================================
// Single Paystack webhook endpoint for both subscriptions and the
// Elevation Summit. Events are dispatched by reference prefix.
//
// Register this URL in Paystack Dashboard:
//   Settings → API Keys & Webhooks → Webhook URL
//   → https://ascentorbi.com/api/pay/webhook
//
// Dispatch:
//   payload.data.reference starts with "summit-" → Summit
//   everything else                               → Subscriptions
//
// Security:
//   • HMAC-SHA512 signature verified on every request
// ================================================================

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { handleSummitWebhookEvent } from '@/lib/summitWebhookHandler';
import { handleSubscriptionWebhookEvent } from '@/lib/subscriptionWebhookHandler';

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY!;

function verifySignature(rawBody: string, sig: string): boolean {
  const expected = crypto
    .createHmac('sha512', PAYSTACK_SECRET)
    .update(rawBody)
    .digest('hex');
  if (expected.length !== sig.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(sig, 'hex'));
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get('x-paystack-signature') ?? '';

    if (!verifySignature(rawBody, signature)) {
      console.error('[pay/webhook] Invalid HMAC signature — rejected');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const payload = JSON.parse(rawBody);
    const reference: string | undefined = payload?.data?.reference;

    if (reference?.startsWith('summit-')) {
      return await handleSummitWebhookEvent(payload);
    }

    return await handleSubscriptionWebhookEvent(payload);
  } catch (err: any) {
    console.error('[pay/webhook] Fatal error:', err);
    return NextResponse.json({ received: true, warning: 'Processing error logged' });
  }
}
