import { NextRequest, NextResponse } from 'next/server';
import { settleReference } from '@/lib/paymentSettlement';
import { paymentLimiter, getClientIp } from '@/lib/rate-limit';

// Called by the browser right after the Paystack popup reports success.
// It does NOT trust the browser: the reference must belong to a payment_attempts
// row we created for THIS registration, and Paystack must confirm the amount
// and currency we recorded. Settlement is shared with the webhook and cron.
export async function POST(req: NextRequest) {
  const limit = paymentLimiter.check(getClientIp(req));
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Too many attempts. Please wait a moment and try again.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfter) } }
    );
  }

  try {
    const body = await req.json().catch(() => null);
    const reference      = body?.reference;
    const registrationId = body?.registrationId;

    if (typeof reference !== 'string' || typeof registrationId !== 'string') {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    const result = await settleReference(reference);

    if (result.state === 'rejected') {
      // Unknown reference or failed validation. Deliberately generic.
      return NextResponse.json({ error: 'Payment not verified' }, { status: 400 });
    }

    // The reference must have been issued for the registration being claimed.
    if (result.attempt.kind !== 'summit' || result.attempt.registration_id !== registrationId) {
      return NextResponse.json({ error: 'Payment not verified' }, { status: 400 });
    }

    if (result.state === 'settled') {
      return NextResponse.json({ success: true });
    }

    // pending / failed / not found at Paystack yet. The webhook and the
    // scheduled reconciliation will complete it if the payment lands later.
    return NextResponse.json(
      { error: 'Payment not confirmed yet', pending: result.state === 'pending' },
      { status: 402 }
    );
  } catch (err: any) {
    console.error('[summit/pay/verify] Unexpected error:', err);
    return NextResponse.json({ error: 'Could not verify payment' }, { status: 500 });
  }
}
