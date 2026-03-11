// ============================================================
// PARTNER PAYSTACK WEBHOOK — /api/partner/webhook
//
// Separate from the main Ascentor webhook.
// Each partner registers THIS URL in their own Paystack account.
// Paystack signs with THEIR secret — we look it up per-partner.
//
// Revenue flow:
//   Member pays → Partner's Paystack subaccount receives revenue_share%
//   → Ascentor's subaccount receives platform_fee%
//   → This webhook records and credits correctly
//
// Partners register: https://ascentorbi.com/api/partner/webhook?partner_id=xxx
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Verify signature using PARTNER'S Paystack secret (not Ascentor's)
function verifySignature(rawBody: string, signature: string, secret: string): boolean {
  const hash = crypto.createHmac('sha512', secret).update(rawBody).digest('hex');
  return hash === signature;
}

async function getPartnerById(partnerId: string) {
  const { data } = await supabase
    .from('partners')
    .select('id, name, owner_id, status, revenue_share_percent, paystack_subaccount_code, paystack_secret_key')
    .eq('id', partnerId)
    .single();
  return data;
}

async function getMemberByEmail(email: string, partnerId: string) {
  // Member must be associated with this partner
  const { data } = await supabase
    .from('partner_members')
    .select('user_id, profiles(subscription_plan, subscription_status, subscription_end)')
    .eq('partner_id', partnerId)
    .eq('email', email)
    .maybeSingle();
  return data;
}

// ── charge.success — member payment confirmed ─────────────
async function handleChargeSuccess(data: any, partner: any) {
  const email = data.customer?.email;
  const plan = data.metadata?.plan || 'explorer';
  const billing = data.metadata?.billing_cycle || 'monthly';

  if (!email) return;

  // Find this member in the partner's community
  const member = await getMemberByEmail(email, partner.id);
  if (!member) {
    console.warn(`[PartnerWebhook] No member found: ${email} for partner ${partner.id}`);
    return;
  }

  const userId = member.user_id;

  // Calculate subscription period
  const paidAt = data.paid_at ? new Date(data.paid_at) : new Date();
  const subscriptionEnd = new Date(paidAt);
  if (billing === 'yearly') {
    subscriptionEnd.setFullYear(subscriptionEnd.getFullYear() + 1);
  } else {
    subscriptionEnd.setDate(subscriptionEnd.getDate() + 30);
  }

  // Activate member's subscription
  await supabase.from('profiles').update({
    subscription_plan:   plan,
    subscription_status: 'active',
    subscription_start:  paidAt.toISOString(),
    subscription_end:    subscriptionEnd.toISOString(),
    payment_method:      data.channel || 'card',
    updated_at:          new Date().toISOString(),
  }).eq('id', userId);

  // Record partner revenue transaction
  const amountNGN = (data.amount || 0) / 100; // Paystack uses kobo
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
    paystack_reference:  data.reference,
    status:              'completed',
    paid_at:             paidAt.toISOString(),
  });

  // Notify member
  await supabase.from('notifications').insert({
    user_id: userId,
    type:    'success',
    title:   `Welcome to ${partner.name}! 🎉`,
    message: `Your ${plan} subscription is now active.`,
    link:    '/dashboard',
  });

  // Notify partner owner
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
    // Partner ID passed as query param: /api/partner/webhook?partner_id=xxx
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

    const rawBody = await req.text();
    const signature = req.headers.get('x-paystack-signature') || '';

    // Use partner's own Paystack secret key for verification
    const partnerSecret = partner.paystack_secret_key || process.env.PAYSTACK_SECRET_KEY!;
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
