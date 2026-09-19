import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { createAttempt, getSummitPricesNaira } from '@/lib/paymentSettlement';
import { paymentLimiter, getClientIp } from '@/lib/rate-limit';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: NextRequest) {
  // ── Env validation first - a missing/invalid var must fail loudly here,
  // not as a silent NaN inside the Paystack request.
  const secret    = process.env.PAYSTACK_SECRET_KEY;
  const publicKey = process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY;
  const prices    = getSummitPricesNaira();

  const missing: string[] = [];
  if (!secret)    missing.push('PAYSTACK_SECRET_KEY');
  if (!publicKey) missing.push('NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY');
  if (!prices)    missing.push('SUMMIT_TICKET_PRICE_ONSITE_NGN / SUMMIT_TICKET_PRICE_VIRTUAL_NGN');

  if (missing.length > 0 || !prices) {
    console.error('[summit/pay/initiate] Missing or invalid env vars:', missing.join(', '));
    return NextResponse.json({ error: 'Payment system misconfigured' }, { status: 500 });
  }

  const limit = paymentLimiter.check(getClientIp(req));
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Too many attempts. Please wait a few minutes and try again.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfter) } }
    );
  }

  try {
    const body = await req.json().catch(() => null);
    const registrationId = body?.registrationId;
    if (typeof registrationId !== 'string' || !UUID_RE.test(registrationId)) {
      return NextResponse.json({ error: 'Registration not found' }, { status: 404 });
    }

    const { data: registration, error } = await supabaseAdmin
      .from('summit_registrations')
      .select('id, full_name, email, attendance_type, payment_status')
      .eq('id', registrationId)
      .single();

    if (error || !registration) {
      return NextResponse.json({ error: 'Registration not found' }, { status: 404 });
    }
    if (registration.payment_status === 'paid') {
      return NextResponse.json({ error: 'Already registered and confirmed' }, { status: 409 });
    }

    const reference   = `summit-${registration.id}-${Date.now()}`;
    const amountNaira = registration.attendance_type === 'virtual' ? prices.virtual : prices.onsite;
    const amountKobo  = Math.round(amountNaira * 100);

    // One row per attempt. Retries, second tabs and re-opened popups each get
    // their own reference, so no in-flight payment is ever orphaned.
    await createAttempt({
      reference,
      kind:           'summit',
      amountKobo,
      email:          registration.email,
      registrationId: registration.id,
    });

    // Convenience pointer for admin views; settlement binds by payment_attempts.
    await supabaseAdmin
      .from('summit_registrations')
      .update({ payment_reference: reference })
      .eq('id', registration.id)
      .neq('payment_status', 'paid');

    return NextResponse.json({
      reference,
      amount: amountKobo,
      currency: 'NGN',
      public_key: publicKey,
      email: registration.email,
      full_name: registration.full_name,
    });
  } catch (err: any) {
    console.error('[summit/pay/initiate] Unexpected error:', err);
    return NextResponse.json({ error: 'Could not prepare payment' }, { status: 500 });
  }
}
