import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function POST(req: NextRequest) {
  const { registrationId } = await req.json();

  const { data: registration, error } = await supabaseAdmin
    .from('summit_registrations')
    .select('id, full_name, email, whatsapp')
    .eq('id', registrationId)
    .single();

  if (error || !registration) {
    return NextResponse.json({ error: 'Registration not found' }, { status: 404 });
  }

  const tx_ref = `summit-${registration.id}-${Date.now()}`;

  await supabaseAdmin
    .from('summit_registrations')
    .update({ payment_reference: tx_ref })
    .eq('id', registration.id);

  return NextResponse.json({
    tx_ref,
    amount: Number(process.env.SUMMIT_TICKET_PRICE_NGN) || 0,
    currency: 'NGN',
    public_key: process.env.NEXT_PUBLIC_FLUTTERWAVE_PUBLIC_KEY,
    customer: {
      email: registration.email,
      name: registration.full_name,
      phone_number: registration.whatsapp,
    },
  });
}
