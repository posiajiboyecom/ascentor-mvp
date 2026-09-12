import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { sendPaymentConfirmedEmail, sendAdminPaymentNotification } from '@/lib/summitEmails';

export async function POST(req: NextRequest) {
  const signature = req.headers.get('verif-hash');
  if (!signature || signature !== process.env.FLUTTERWAVE_SECRET_HASH) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  const payload = await req.json();

  if (payload.event !== 'charge.completed' || payload.data?.status !== 'successful') {
    return NextResponse.json({ received: true });
  }

  const { data: existing } = await supabaseAdmin
    .from('summit_registrations')
    .select('*')
    .eq('payment_reference', payload.data.tx_ref)
    .single();

  if (!existing || existing.payment_status === 'paid') {
    return NextResponse.json({ received: true });
  }

  await supabaseAdmin
    .from('summit_registrations')
    .update({
      payment_status: 'paid',
      status: 'confirmed',
      amount_paid: payload.data.amount,
      currency: payload.data.currency,
      flutterwave_tx_id: String(payload.data.id),
      paid_at: new Date().toISOString(),
      confirmed_at: new Date().toISOString(),
    })
    .eq('id', existing.id);

  try {
    await sendPaymentConfirmedEmail(existing.email, existing.full_name);
    await sendAdminPaymentNotification(existing.full_name, existing.email, existing.organisation);
  } catch (err) {
    console.error('Failed to send payment confirmation emails from webhook', err);
  }

  return NextResponse.json({ received: true });
}
