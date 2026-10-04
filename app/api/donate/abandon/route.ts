import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getAttemptByReference, settleReference } from '@/lib/paymentSettlement';
import { paymentLimiter, getClientIp } from '@/lib/rate-limit';
import { parseJson, parseQuery } from '@/lib/validation/http';
import * as commerceSchemas from '@/lib/validation/schemas/commerce';

// Called by the browser the moment the payment window / confirm overlay is
// closed or the tab is left. Never trusts the browser: the reference must be
// a donation attempt issued for that donation, and Paystack is asked first -
// if the donor actually paid, this settles instead of marking it abandoned.
export async function POST(req: NextRequest) {
  const limit = paymentLimiter.check(getClientIp(req));
  if (!limit.allowed) return NextResponse.json({ ok: true });

  try {
    const parsed = await parseJson(req, commerceSchemas.donateAbandon);
    if (!parsed.ok) return NextResponse.json({ ok: true }); // best-effort beacon: never error
    const { reference, donationId } = parsed.data;

    const attempt = await getAttemptByReference(reference);
    if (!attempt || attempt.kind !== 'donation' || attempt.donation_id !== donationId) {
      return NextResponse.json({ ok: true });
    }
    if (attempt.status === 'success' || attempt.status === 'duplicate') {
      return NextResponse.json({ ok: true });
    }

    // If they actually paid (callback slow, closed tab right after), settle instead of abandoning.
    const result = await settleReference(reference);
    if (result.state === 'settled') return NextResponse.json({ ok: true });

    await supabaseAdmin
      .from('summit_donations')
      .update({ status: 'abandoned', updated_at: new Date().toISOString() })
      .eq('id', donationId)
      .eq('status', 'pending');

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[donate/abandon] error:', err);
    return NextResponse.json({ ok: true });
  }
}
