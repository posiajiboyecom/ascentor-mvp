import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function POST(req: NextRequest) {
  try {
    const { registrationId } = await req.json();

    const { data: registration, error } = await supabaseAdmin
      .from('summit_registrations')
      .select('id, full_name, email')
      .eq('id', registrationId)
      .single();

    if (error || !registration) {
      return NextResponse.json({ error: 'Registration not found' }, { status: 404 });
    }

    const reference = `summit-${registration.id}-${Date.now()}`;
    const amountNaira = Number(process.env.SUMMIT_TICKET_PRICE_NGN);
    const amountKobo = amountNaira * 100;

    await supabaseAdmin
      .from('summit_registrations')
      .update({ payment_reference: reference })
      .eq('id', registration.id);

    return NextResponse.json({
      reference,
      amount: amountKobo,
      currency: 'NGN',
      public_key: process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY,
      email: registration.email,
      full_name: registration.full_name,
    });
  } catch (err: any) {
    console.error('[summit/pay/initiate] Unexpected error:', err);
    return NextResponse.json({ error: 'Could not prepare payment' }, { status: 500 });
  }
}
