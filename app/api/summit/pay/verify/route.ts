import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { sendPaymentConfirmedEmail, sendAdminPaymentNotification } from '@/lib/summitEmails';

export async function POST(req: NextRequest) {
  const { transaction_id, registrationId } = await req.json();

  const secret = process.env.FLUTTERWAVE_SECRET_KEY;
  if (!secret) {
    return NextResponse.json({ error: 'Payment system misconfigured' }, { status: 500 });
  }

  const flwRes = await fetch(
    `https://api.flutterwave.com/v3/transactions/${transaction_id}/verify`,
    { headers: { Authorization: `Bearer ${secret}` } }
  );
  const flwData = await flwRes.json();

  if (flwData.status !== 'success' || flwData.data?.status !== 'successful') {
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

  const expectedAmount = Number(process.env.SUMMIT_TICKET_PRICE_NGN) || 0;
  if (Number(flwData.data.amount) < expectedAmount) {
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
      amount_paid: flwData.data.amount,
      currency: flwData.data.currency,
      flutterwave_tx_id: String(flwData.data.id),
      paid_at: new Date().toISOString(),
      confirmed_at: new Date().toISOString(),
    })
    .eq('id', registrationId);

  try {
    await sendPaymentConfirmedEmail(registration.email, registration.full_name);
    await sendAdminPaymentNotification(registration.full_name, registration.email, registration.organisation);
  } catch (err) {
    console.error('Failed to send payment confirmation emails', err);
  }

  return NextResponse.json({ success: true });
}
