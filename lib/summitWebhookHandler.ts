import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { sendPaymentConfirmedEmail, sendAdminPaymentNotification } from '@/lib/summitEmails';

export async function handleSummitWebhookEvent(payload: any) {
  if (payload.event !== 'charge.success') {
    return NextResponse.json({ received: true });
  }

  const { data: existing } = await supabaseAdmin
    .from('summit_registrations')
    .select('*')
    .eq('payment_reference', payload.data.reference)
    .single();

  if (!existing || existing.payment_status === 'paid') {
    return NextResponse.json({ received: true });
  }

  const expectedAmountKobo = Number(process.env.SUMMIT_TICKET_PRICE_NGN) * 100;
  if (payload.data.amount < expectedAmountKobo) {
    console.error('[summit/webhook] Amount mismatch for reference', payload.data.reference);
    return NextResponse.json({ received: true });
  }

  await supabaseAdmin
    .from('summit_registrations')
    .update({
      payment_status: 'paid',
      status: 'confirmed',
      amount_paid: payload.data.amount / 100,
      currency: payload.data.currency,
      payment_provider_tx_id: String(payload.data.id),
      paid_at: new Date().toISOString(),
      confirmed_at: new Date().toISOString(),
    })
    .eq('id', existing.id);

  try {
    await sendPaymentConfirmedEmail({
      email:          existing.email,
      fullName:       existing.full_name,
      whatsapp:       existing.whatsapp ?? '',
      organisation:   existing.organisation ?? '',
      attendanceType: existing.attendance_type as 'onsite' | 'virtual',
      amountPaid:     payload.data.amount / 100,
      currency:       payload.data.currency ?? 'NGN',
      registrationId: String(existing.id),
      reference:      payload.data.reference,
    });
    await sendAdminPaymentNotification(existing.full_name, existing.email, existing.organisation);
  } catch (err) {
    console.error('Failed to send payment confirmation emails from webhook', err);
  }

  return NextResponse.json({ received: true });
}
