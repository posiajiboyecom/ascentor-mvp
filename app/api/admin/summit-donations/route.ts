// app/api/admin/summit-donations/route.ts
//   GET   list all donations, newest first, plus summary stats.
//   POST  { action: 'resend', id }  resend the donor receipt email (paid only)
// All behind admin auth, all writes through the service role.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { sendDonationReceiptEmail } from '@/lib/summitEmails';
import { parseJson, parseQuery } from '@/lib/validation/http';
import * as adminSchemas from '@/lib/validation/schemas/admin';
import { guardApi } from '@/lib/admin/api-guard';

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
  const _g = await guardApi('donations', 'view', req);
  if ('error' in _g) return _g.res;
  try {
    if (!(await requireAdmin(req))) return forbidden();

    const { data, error } = await supabaseAdmin
      .from('summit_donations')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;

    const donations = data ?? [];
    const paid = donations.filter((d) => d.status === 'paid');
    // Naira and US dollar donations are totalled separately (donors abroad give in dollars).
    const isUsd = (d: { currency?: string | null }) => (d.currency || 'NGN').toUpperCase() === 'USD';
    // Estimate only when Paystack's fee was not recorded: local cards 1.5% + ₦100 (capped ₦2,000); international 3.9%.
    const estFee = (a: number) => (a ? Math.min(a * 0.015 + (a >= 2500 ? 100 : 0), 2000) : 0);
    const estFeeUsd = (a: number) => (a ? Math.round(a * 0.039 * 100) / 100 : 0);
    const ngn = paid.filter((d) => !isUsd(d));
    const usd = paid.filter(isUsd);
    const gross = ngn.reduce((t, d) => t + (Number(d.amount) || 0), 0);
    const fees = ngn.reduce((t, d) => t + (d.paystack_fee != null ? Number(d.paystack_fee) : estFee(Number(d.amount) || 0)), 0);
    const grossUsd = usd.reduce((t, d) => t + (Number(d.amount) || 0), 0);
    const feesUsd = usd.reduce((t, d) => t + (d.paystack_fee != null ? Number(d.paystack_fee) : estFeeUsd(Number(d.amount) || 0)), 0);

    return NextResponse.json({
      donations,
      stats: {
        total: donations.length,
        paid: paid.length,
        pending: donations.filter((d) => d.status === 'pending').length,
        abandoned: donations.filter((d) => d.status === 'abandoned').length,
        gross, fees, net: gross - fees,
        grossUsd, feesUsd, netUsd: grossUsd - feesUsd,
      },
    });
  } catch (err) {
    console.error('[admin/summit-donations] GET error:', err);
    return NextResponse.json({ error: 'Failed to fetch donations' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const _g = await guardApi('donations', 'edit', req);
  if ('error' in _g) return _g.res;
  try {
    if (!(await requireAdmin(req))) return forbidden();

    const parsed = await parseJson(req, adminSchemas.summitDonationAction);
    if (!parsed.ok) return parsed.response;
    const { id } = parsed.data;

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
