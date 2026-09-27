import { NextRequest, NextResponse } from 'next/server';
import { settleReference } from '@/lib/paymentSettlement';
import { paymentLimiter, getClientIp } from '@/lib/rate-limit';

// Called by the browser right after the Paystack popup reports success. It
// does NOT trust the browser: the reference must belong to a payment_attempts
// row created for THIS donation, and Paystack must confirm the amount and
// currency recorded at initiate time. Settlement is shared with the summit
// ticket flow, the subscription webhook and the reconciliation cron.
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
    const reference  = body?.reference;
    const donationId = body?.donationId;

    if (typeof reference !== 'string' || typeof donationId !== 'string') {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    const result = await settleReference(reference);

    if (result.state === 'rejected') {
      return NextResponse.json({ error: 'Payment not verified' }, { status: 400 });
    }

    // The reference must have been issued for the donation being claimed.
    if (result.attempt.kind !== 'donation' || result.attempt.donation_id !== donationId) {
      return NextResponse.json({ error: 'Payment not verified' }, { status: 400 });
    }

    if (result.state === 'settled') {
      return NextResponse.json({ success: true });
    }

    return NextResponse.json(
      { error: 'Payment not confirmed yet', pending: result.state === 'pending' },
      { status: 402 }
    );
  } catch (err) {
    console.error('[donate/verify] Unexpected error:', err);
    return NextResponse.json({ error: 'Could not verify payment' }, { status: 500 });
  }
}
