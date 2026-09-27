// app/api/admin/summit-donations/route.ts
//   GET   list all donations, newest first, plus summary stats.
//   POST  { action: 'resend', id }  resend the donor receipt email (paid only)
// All behind admin auth, all writes through the service role.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { sendDonationReceiptEmail } from '@/lib/summitEmails';

export const dynamic = 'force-dynamic';

async function requireAdmin(req: NextRequest): Promise<{ id: string } | null> {
  const anonClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: req.headers.get('authorization') || '' } } },
  );
  const { data: { user } } = await anonClient.auth.getUser();
  if (!user) return null;
  const { data } = await supabaseAdmin.from('profiles').select('role').eq('id', user.id).single();
  return data?.role === 'admin' ? { id: user.id } : null;
}

const forbidden = () => NextResponse.json({ error: 'Forbidden: admin only' }, { status: 403 });

export async function GET(req: NextRequest) {
  try {
    if (!(await requireAdmin(req))) return forbidden();

    const { data, error } = await supabaseAdmin
      .from('summit_donations')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;

    const donations = data ?? [];
    const paid = donations.filter((d) => d.status === 'paid');
    const estFee = (a: number) => (a ? Math.min(a * 0.015 + (a >= 2500 ? 100 : 0), 2000) : 0);
    const gross = paid.reduce((t, d) => t + (Number(d.amount) || 0), 0);
    const fees = paid.reduce((t, d) => t + (d.paystack_fee != null ? Number(d.paystack_fee) : estFee(Number(d.amount) || 0)), 0);

    return NextResponse.json({
      donations,
      stats: {
        total: donations.length,
        paid: paid.length,
        pending: donations.filter((d) => d.status === 'pending').length,
        abandoned: donations.filter((d) => d.status === 'abandoned').length,
        gross, fees, net: gross - fees,
      },
    });
  } catch (err) {
    console.error('[admin/summit-donations] GET error:', err);
    return NextResponse.json({ error: 'Failed to fetch donations' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!(await requireAdmin(req))) return forbidden();

    const body = await req.json().catch(() => null);
    const id: unknown = body?.id;
    const action: unknown = body?.action;

    if (typeof id !== 'string' || action !== 'resend') {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    const { data: donation } = await supabaseAdmin.from('summit_donations').select('*').eq('id', id).maybeSingle();
    if (!donation) return NextResponse.json({ error: 'Donation not found' }, { status: 404 });
    if (donation.status !== 'paid') {
      return NextResponse.json({ error: 'Only paid donations have a receipt to resend' }, { status: 409 });
    }

    try {
      await sendDonationReceiptEmail({
        full_name: donation.full_name,
        email: donation.email,
        amount: Number(donation.amount) || 0,
        currency: donation.currency || 'NGN',
        reference: donation.payment_reference || '',
      });
      await supabaseAdmin.from('summit_donations')
        .update({ receipt_email_sent_at: new Date().toISOString(), receipt_email_error: null })
        .eq('id', id);
      return NextResponse.json({ ok: true, message: `Receipt sent to ${donation.email}` });
    } catch (err) {
      console.error('[admin/summit-donations] resend failed:', err);
      await supabaseAdmin.from('summit_donations')
        .update({ receipt_email_error: String((err as Error).message).slice(0, 300) })
        .eq('id', id);
      return NextResponse.json({ error: 'Email failed to send. Check SMTP settings.' }, { status: 502 });
    }
  } catch (err) {
    console.error('[admin/summit-donations] POST error:', err);
    return NextResponse.json({ error: 'Action failed' }, { status: 500 });
  }
}
