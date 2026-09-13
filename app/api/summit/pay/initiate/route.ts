import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function POST(req: NextRequest) {
  // ── Env validation first — a missing/invalid var must fail loudly
  // here, not as a silent NaN inside the Paystack request.
  const secret = process.env.PAYSTACK_SECRET_KEY;
  const publicKey = process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY;
  const onsiteNaira = Number(process.env.SUMMIT_TICKET_PRICE_ONSITE_NGN);
  const virtualNaira = Number(process.env.SUMMIT_TICKET_PRICE_VIRTUAL_NGN);

  const missing: string[] = [];
  if (!secret) missing.push('PAYSTACK_SECRET_KEY');
  if (!publicKey) missing.push('NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY');
  if (!Number.isFinite(onsiteNaira) || onsiteNaira <= 0) missing.push('SUMMIT_TICKET_PRICE_ONSITE_NGN');
  if (!Number.isFinite(virtualNaira) || virtualNaira <= 0) missing.push('SUMMIT_TICKET_PRICE_VIRTUAL_NGN');

  if (missing.length > 0) {
    console.error('[summit/pay/initiate] Missing or invalid env vars:', missing.join(', '));
    return NextResponse.json({ error: 'Payment system misconfigured' }, { status: 500 });
  }

  try {
    const { registrationId } = await req.json();

    const { data: registration, error } = await supabaseAdmin
      .from('summit_registrations')
      .select('id, full_name, email, attendance_type')
      .eq('id', registrationId)
      .single();

    if (error || !registration) {
      return NextResponse.json({ error: 'Registration not found' }, { status: 404 });
    }

    const reference = `summit-${registration.id}-${Date.now()}`;
    const amountNaira = registration.attendance_type === 'virtual' ? virtualNaira : onsiteNaira;
    const amountKobo = amountNaira * 100;

    await supabaseAdmin
      .from('summit_registrations')
      .update({ payment_reference: reference })
      .eq('id', registration.id);

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
