// ============================================================
// FILE LOCATION: app/api/partner/webhook/route.ts
//
// BUG FIXED:
//   BUG-07 — No idempotency check on charge.success handler.
//             Paystack's documentation states webhooks may be
//             delivered more than once (retries on non-200, or
//             duplicate delivery during failover). Without a
//             duplicate check, every retry would:
//               1. Insert a second partner_transactions row
//                  (double revenue credit to partner)
//               2. Reset subscription_end to a new future date
//                  (subscription extended incorrectly)
//               3. Send duplicate "Welcome!" notifications to
//                  both the member and the partner owner.
//
//             Fix: before processing charge.success, check
//             partner_transactions for an existing row with the
//             same paystack_reference. If found, return 200
//             immediately (Paystack stops retrying on 200).
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { decryptSecret } from '@/lib/crypto';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function verifySignature(rawBody: string, signature: string, secret: string): boolean {
  const hash = crypto.createHmac('sha512', secret).update(rawBody).digest('hex');
  return hash === signature;
}

async function getPartnerById(partnerId: string) {
  const { data } = await supabase
    .from('partners')
    .select('id, name, owner_id, status, revenue_share_percent, paystack_subaccount_code, paystack_secret_key_enc')
    .eq('id', partnerId)
    .single();
  return data;
}

async function getMemberByEmail(email: string, partnerId: string) {
  const { data } = await supabase
    .from('partner_members')
    .select('user_id, profiles(subscription_plan, subscription_status, subscription_end)')
    .eq('partner_id', partnerId)
    .eq('email', email)
    .maybeSingle();
  return data;
}

// ── charge.success ────────────────────────────────────────
async function handleChargeSuccess(data: any, partner: any) {
  const email   = data.customer?.email;
  const plan    = data.metadata?.plan || 'explorer';
  const billing = data.metadata?.billing_cycle || 'monthly';
  const ref     = data.reference;

  if (!email) return;

  // FIX BUG-07: idempotency guard — exit early if already processed
  const { data: existingTx } = await supabase
    .from('partner_transactions')
    .select('id')
    .eq('paystack_reference', ref)
    .maybeSingle();

  if (existingTx) {
    console.log(`[PartnerWebhook] Duplicate event for ref ${ref} — skipping`);
    return;
  }

  const member = await getMemberByEmail(email, partner.id);
  if (!member) {
    console.warn(`[PartnerWebhook] No member found: ${email} for partner ${partner.id}`);
    return;
  }

  const userId = member.user_id;

  const paidAt = data.paid_at ? new Date(data.paid_at) : new Date();
  const subscriptionEnd = new Date(paidAt);
  if (billing === 'yearly') {
    subscriptionEnd.setFullYear(subscriptionEnd.getFullYear() + 1);
  } else {
    subscriptionEnd.setDate(subscriptionEnd.getDate() + 30);
  }

  await supabase.from('profiles').update({
    subscription_plan:   plan,
    subscription_status: 'active',
    subscription_start:  paidAt.toISOString(),
    subscription_end:    subscriptionEnd.toISOString(),
    payment_method:      data.channel || 'card',
    updated_at:          new Date().toISOString(),
  }).eq('id', userId);

  const amountNGN    = (data.amount || 0) / 100;
  const partnerShare = Math.round(amountNGN * (partner.revenue_share_percent / 100));
  const ascentorFee  = amountNGN - partnerShare;

  await supabase.from('partner_transactions').insert({
    partner_id:          partner.id,
    user_id:             userId,
    amount_ngn:          amountNGN,
    partner_share_ngn:   partnerShare,
    ascentor_fee_ngn:    ascentorFee,
    revenue_share_pct:   partner.revenue_share_percent,
    plan,
    billing_cycle:       billing,
    paystack_reference:  ref,
    status:              'completed',
    paid_at:             paidAt.toISOString(),
  });

  await supabase.from('notifications').insert({
    user_id: userId,
    type:    'success',
    title:   `Welcome to ${partner.name}! 🎉`,
    message: `Your ${plan} subscription is now active.`,
    link:    '/dashboard',
  });

  await supabase.from('notifications').insert({
    user_id: partner.owner_id,
    type:    'success',
    title:   'New subscription payment',
    message: `${email} subscribed to ${plan} plan. Your share: ₦${partnerShare.toLocaleString()}.`,
    link:    '/partner/revenue',
  });

  console.log(`[PartnerWebhook] ✅ ${email} → ${plan} | partner: ${partner.name} | share: ₦${partnerShare}`);
}

// ── invoice.payment_failed ────────────────────────────────
async function handlePaymentFailed(data: any, partner: any) {
  const email = data.customer?.email;
  if (!email) return;

  const member = await getMemberByEmail(email, partner.id);
  if (!member) return;

  await supabase.from('profiles').update({
    subscription_status: 'past_due',
    updated_at:          new Date().toISOString(),
  }).eq('id', member.user_id);

  await supabase.from('notifications').insert({
    user_id: member.user_id,
    type:    'warning',
    title:   'Payment Failed',
    message: 'We couldn\'t process your subscription payment. Please update your payment details.',
    link:    '/checkout',
  });
}

// ── subscription.disable ──────────────────────────────────
async function handleSubscriptionDisable(data: any, partner: any) {
  const email = data.customer?.email;
  if (!email) return;

  const member = await getMemberByEmail(email, partner.id);
  if (!member) return;

  await supabase.from('profiles').update({
    subscription_status: 'cancelled',
    updated_at:          new Date().toISOString(),
  }).eq('id', member.user_id);
}

// ── Main handler ──────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const partnerId = searchParams.get('partner_id');

    if (!partnerId) {
      return NextResponse.json({ error: 'Missing partner_id' }, { status: 400 });
    }

    const partner = await getPartnerById(partnerId);
    if (!partner) {
      return NextResponse.json({ error: 'Partner not found' }, { status: 404 });
    }
    if (partner.status !== 'active') {
      return NextResponse.json({ error: 'Partner not active' }, { status: 403 });
    }

    const rawBody  = await req.text();
    const signature = req.headers.get('x-paystack-signature') || '';

    let partnerSecret = process.env.PAYSTACK_SECRET_KEY!;
    if ((partner as any).paystack_secret_key_enc) {
      try {
        partnerSecret = decryptSecret((partner as any).paystack_secret_key_enc);
      } catch (decryptErr) {
        console.error(`[PartnerWebhook] Failed to decrypt secret for partner ${partnerId}:`, decryptErr);
        // Do NOT fall back to Ascentor's global key — that would allow any
        // Ascentor-signed webhook to pass HMAC verification for this partner.
        return NextResponse.json({ error: 'Webhook configuration error' }, { status: 500 });
      }
    }

    if (!verifySignature(rawBody, signature, partnerSecret)) {
      console.error(`[PartnerWebhook] Invalid signature for partner ${partnerId}`);
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const event = JSON.parse(rawBody);
    const { event: eventName, data } = event;

    console.log(`[PartnerWebhook] 📥 ${eventName} for ${partner.name}`);

    switch (eventName) {
      case 'charge.success':
        await handleChargeSuccess(data, partner);
        break;
      case 'invoice.payment_failed':
        await handlePaymentFailed(data, partner);
        break;
      case 'subscription.disable':
      case 'subscription.not_renew':
        await handleSubscriptionDisable(data, partner);
        break;
      default:
        console.log(`[PartnerWebhook] Unhandled: ${eventName}`);
    }

    return NextResponse.json({ received: true });

  } catch (err: any) {
    console.error('[PartnerWebhook] Fatal:', err);
    return NextResponse.json({ received: true, warning: 'Processing error' });
  }
}

export async function GET() {
  return NextResponse.json({ status: 'Partner webhook active' });
}
