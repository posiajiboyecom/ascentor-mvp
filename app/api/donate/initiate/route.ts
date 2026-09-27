import { NextRequest, NextResponse } from 'next/server';
import { isValidPhoneNumber } from 'libphonenumber-js';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { createAttempt } from '@/lib/paymentSettlement';
import { paymentLimiter, getClientIp } from '@/lib/rate-limit';

// Minimum/maximum a donor can send through the online form. Below the
// minimum, Paystack fees would eat most of the donation; above the maximum,
// we ask them to contact us directly rather than risk a mistyped amount.
const MIN_KOBO = 50_000;        // ₦500
const MAX_KOBO = 500_000_000;   // ₦5,000,000

export async function POST(req: NextRequest) {
  const secret    = process.env.PAYSTACK_SECRET_KEY;
  const publicKey = process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY;
  if (!secret || !publicKey) {
    console.error('[donate/initiate] Missing PAYSTACK_SECRET_KEY / NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY');
    return NextResponse.json({ error: 'Payment system misconfigured' }, { status: 500 });
  }

  const limit = paymentLimiter.check(getClientIp(req));
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Too many attempts. Please wait a few minutes and try again.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfter) } }
    );
  }

  let data;
  try {
    data = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const fullName = typeof data?.full_name === 'string' ? data.full_name.trim() : '';
  const email    = typeof data?.email === 'string' ? data.email.trim().toLowerCase() : '';
  const phone    = typeof data?.phone === 'string' ? data.phone.trim() : '';
  const message  = typeof data?.message === 'string' ? data.message.trim().slice(0, 500) : null;
  const amountNaira = Number(data?.amount);

  if (!fullName || fullName.length < 2) {
    return NextResponse.json({ error: 'Full name is required.' }, { status: 400 });
  }
  if (!email || !email.includes('@')) {
    return NextResponse.json({ error: 'A valid email address is required.' }, { status: 400 });
  }
  if (!phone || !isValidPhoneNumber(phone)) {
    return NextResponse.json({ error: 'A valid phone number is required.' }, { status: 400 });
  }
  if (!Number.isFinite(amountNaira) || amountNaira <= 0) {
    return NextResponse.json({ error: 'Enter a donation amount.' }, { status: 400 });
  }

  const amountKobo = Math.round(amountNaira * 100);
  if (amountKobo < MIN_KOBO) {
    return NextResponse.json({ error: 'The minimum donation is NGN 500.' }, { status: 400 });
  }
  if (amountKobo > MAX_KOBO) {
    return NextResponse.json({ error: 'That amount is too large for online payment. Please contact us directly.' }, { status: 400 });
  }

  try {
    const { data: donation, error } = await supabaseAdmin
      .from('summit_donations')
      .insert({
        full_name: fullName,
        email,
        phone,
        amount: amountNaira,
        currency: 'NGN',
        status: 'pending',
        message: message || null,
      })
      .select('id')
      .single();

    if (error || !donation) {
      console.error('[donate/initiate] DB error:', error?.message);
      return NextResponse.json({ error: 'Could not start your donation. Please try again.' }, { status: 500 });
    }

    const reference = `donate-${donation.id}-${Date.now()}`;

    // One row per attempt, same pattern as Summit ticket payments: retries,
    // second tabs and re-opened popups each get their own reference.
    await createAttempt({
      reference,
      kind:        'donation',
      amountKobo,
      email,
      donationId:  donation.id,
    });

    await supabaseAdmin
      .from('summit_donations')
      .update({ payment_reference: reference })
      .eq('id', donation.id)
      .neq('status', 'paid');

    return NextResponse.json({
      donationId: donation.id,
      reference,
      amount:     amountKobo,
      currency:   'NGN',
      public_key: publicKey,
      email,
      full_name:  fullName,
    });
  } catch (err) {
    console.error('[donate/initiate] Unexpected error:', err);
    return NextResponse.json({ error: 'Could not start your donation.' }, { status: 500 });
  }
}
