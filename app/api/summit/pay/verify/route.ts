import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { sendPaymentConfirmedEmail, sendAdminPaymentNotification } from '@/lib/summitEmails';

export async function POST(req: NextRequest) {
  try {
    const { reference, registrationId } = await req.json();

    const secret = process.env.PAYSTACK_SECRET_KEY;
    if (!secret) {
      return NextResponse.json({ error: 'Payment system misconfigured' }, { status: 500 });
    }

    const paystackRes = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      { headers: { Authorization: `Bearer ${secret}` }, cache: 'no-store' }
    );
    const paystackData = await paystackRes.json();

    if (!paystackData.status || paystackData.data?.status !== 'success') {
      return NextResponse.json({ error: 'Payment not verified' }, { status: 400 });
    }

    const { data: registration } = await supabaseAdmin
      .from('summit_registrations')
      .select('*')
      .eq('id', registrationId)
      .single();

    if (!registration) {
      return NextResponse.json({ error: 'Registration not found' }, { status: 404 });
    }

    const expectedNaira = registration.attendance_type === 'virtual'
      ? Number(process.env.SUMMIT_TICKET_PRICE_VIRTUAL_NGN)
      : Number(process.env.SUMMIT_TICKET_PRICE_ONSITE_NGN);
    if (paystackData.data.amount < expectedNaira * 100) {
      return NextResponse.json({ error: 'Amount mismatch' }, { status: 400 });
    }

    if (registration.payment_status === 'paid') {
      return NextResponse.json({ success: true });
    }

    await supabaseAdmin
      .from('summit_registrations')
      .update({
        payment_status: 'paid',
        status: 'confirmed',
        amount_paid: paystackData.data.amount / 100,
        currency: paystackData.data.currency,
        payment_provider_tx_id: String(paystackData.data.id),
        paid_at: new Date().toISOString(),
        confirmed_at: new Date().toISOString(),
      })
      .eq('id', registrationId);

    try {
      await sendPaymentConfirmedEmail(registration.email, registration.full_name, registration.attendance_type);
      await sendAdminPaymentNotification(registration.full_name, registration.email, registration.organisation);
    } catch (err) {
      console.error('Failed to send payment confirmation emails', err);
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[summit/pay/verify] Unexpected error:', err);
    return NextResponse.json({ error: 'Could not verify payment' }, { status: 500 });
  }
}
