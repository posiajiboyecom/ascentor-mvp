import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

// ── Idempotency ─ prevent double-processing on Paystack retries ───────────────
async function isAlreadyProcessed(idempotencyKey: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from('processed_webhook_events')
    .select('id')
    .eq('id', idempotencyKey)
    .maybeSingle();
  return !!data;
}

async function markProcessed(idempotencyKey: string): Promise<void> {
  await supabaseAdmin
    .from('processed_webhook_events')
    .upsert({ id: idempotencyKey }, { onConflict: 'id', ignoreDuplicates: true });
}

// ── Profile lookup ────────────────────────────────────────────────────────────
async function getProfileById(userId: string) {
  const { data } = await supabaseAdmin
    .from('profiles')
    .select('id, subscription_plan, subscription_status, subscription_end')
    .eq('id', userId)
    .maybeSingle();
  return data ?? null;
}

async function getProfileByEmail(email: string) {
  const { data } = await supabaseAdmin
    .from('profiles')
    .select('id, subscription_plan, subscription_status, subscription_end, billing_cycle')
    .eq('email', email)
    .maybeSingle();
  if (!data) {
    console.warn(`[pay/webhook] No profile found for email: ${email}`);
  }
  return data ?? null;
}

// ── Normalise plan ID to canonical set ───────────────────────────────────────
const LEGACY_PLAN_MAP: Record<string, string> = {
  pro:   'builder',
  elite: 'climber',
};

function normalisePlanId(raw: string | null | undefined): string {
  if (!raw) return 'explorer';
  return LEGACY_PLAN_MAP[raw] ?? raw;
}

// ── Billing period helper ─────────────────────────────────────────────────────
function nextPeriodEnd(currentEnd: string | null, billing: string): string {
  const base = currentEnd ? new Date(currentEnd) : new Date();
  if (billing === 'annual') {
    base.setFullYear(base.getFullYear() + 1);
  } else {
    base.setMonth(base.getMonth() + 1);
  }
  return base.toISOString();
}

// ── Notification helper ───────────────────────────────────────────────────────
async function notify(userId: string, type: string, title: string, message: string, link = '/account') {
  try {
    await supabaseAdmin.from('notifications').insert({ user_id: userId, type, title, message, link });
  } catch (_) {}
}

// ── Audit log helper ──────────────────────────────────────────────────────────
async function auditLog(userId: string, action: string, details: object) {
  try {
    await supabaseAdmin.from('audit_logs').insert({
      user_id:     userId,
      action,
      entity_type: 'payment',
      entity_id:   action,
      details,
    });
  } catch (_) {}
}

// ── EVENT HANDLERS ────────────────────────────────────────────────────────────

// charge.success is settled in /api/pay/webhook via lib/paymentSettlement, which
// only fulfils references we created and validates amount/currency/owner.
// Previously this handler granted a plan straight from webhook metadata, which
// an attacker could forge with the public Paystack key. Anything that reaches
// this point is not a checkout we started, so it is logged and never granted.
async function handleChargeSuccess(data: any) {
  console.warn('[pay/webhook] charge.success not matched to a checkout attempt - no access granted', {
    reference: data?.reference,
    amount:    data?.amount,
    email:     data?.customer?.email,
  });
}

async function handleSubscriptionCreate(data: any) {
  const email = data.customer?.email;
  if (!email) return;

  const profile = await getProfileByEmail(email);
  if (!profile) return;

  const billing =
    data.metadata?.billing ??
    (data.plan?.interval === 'annually' ? 'annual' : null);

  await supabaseAdmin.from('profiles').update({
    subscription_status: 'active',
    paystack_sub_code:   data.subscription_code,
    ...(billing ? { billing_cycle: billing } : {}),
    updated_at:          new Date().toISOString(),
  }).eq('id', profile.id);

  console.log(`[pay/webhook] subscription.create → sub code saved for ${email}${billing ? ` (${billing})` : ''}`);
}

async function handleSubscriptionDisable(data: any) {
  const email = data.customer?.email;
  if (!email) return;

  const profile = await getProfileByEmail(email);
  if (!profile) return;

  if (!['active', 'trialing', 'past_due'].includes(profile.subscription_status)) return;

  await supabaseAdmin.from('profiles').update({
    subscription_status: 'cancelled',
    updated_at:          new Date().toISOString(),
  }).eq('id', profile.id);

  const endDate = profile.subscription_end
    ? new Date(profile.subscription_end).toLocaleDateString('en-NG', {
        day: 'numeric', month: 'long', year: 'numeric',
      })
    : 'the end of your billing period';

  await notify(
    profile.id,
    'warning',
    'Subscription Cancelled',
    `Your subscription has been cancelled. You keep access until ${endDate}.`,
    '/account'
  );

  console.log(`[pay/webhook]  subscription.disable → ${email} cancelled`);
}

async function handleRenewalSuccess(data: any) {
  const email = data.customer?.email;
  if (!email) return;

  const profile = await getProfileByEmail(email);
  if (!profile) return;

  const billing = (
    data.subscription?.metadata?.billing ??
    data.metadata?.billing ??
    'monthly'
  ) as string;

  const newEnd = nextPeriodEnd(profile.subscription_end, billing);

  await supabaseAdmin.from('profiles').update({
    subscription_status: 'active',
    subscription_end:    newEnd,
    updated_at:          new Date().toISOString(),
  }).eq('id', profile.id);

  const renewalRef: string = data.transaction?.reference ?? `renewal-${Date.now()}`;
  try {
    await supabaseAdmin.from('payments').insert({
      user_id:    profile.id,
      reference:  renewalRef,
      provider_reference: renewalRef,
      amount_cents:       data.amount ?? 0,
      plan_id:    normalisePlanId(profile.subscription_plan),
      amount:     data.amount ? data.amount / 100 : 0,
      currency:   data.currency ?? 'NGN',
      provider:   'paystack',
      status:     'success',
      created_at: new Date().toISOString(),
    });
  } catch (_) {}

  await notify(
    profile.id,
    'payment',
    'Subscription Renewed',
    `Your subscription has been renewed. Access extended to ${new Date(newEnd).toLocaleDateString()}.`,
    '/account'
  );

  console.log(`[pay/webhook] invoice.payment_success → ${email} renewed (${billing}) until ${newEnd}`);
}

async function handleRenewalFailed(data: any) {
  const email = data.customer?.email;
  if (!email) return;

  const profile = await getProfileByEmail(email);
  if (!profile) return;

  await supabaseAdmin.from('profiles').update({
    subscription_status: 'past_due',
    updated_at:          new Date().toISOString(),
  }).eq('id', profile.id);

  await notify(
    profile.id,
    'error',
    'Payment Failed',
    'Your renewal payment failed. Update your payment method to keep your access.',
    '/account'
  );

  console.log(`[pay/webhook] invoice.payment_failed → ${email} marked past_due`);
}

// ── Public handler ─────────────────────────────────────────────────────────────

export async function handleSubscriptionWebhookEvent(payload: any) {
  try {
    const { event, data } = payload;

    const idempotencyKey = `${event}::${data?.reference ?? data?.subscription_code ?? data?.id ?? Date.now()}`;

    if (await isAlreadyProcessed(idempotencyKey)) {
      console.log(`[pay/webhook] Duplicate event skipped: ${idempotencyKey}`);
      return NextResponse.json({ received: true, duplicate: true });
    }

    console.log(`[pay/webhook] ${event}`);

    switch (event) {
      case 'charge.success':
        await handleChargeSuccess(data);
        break;
      case 'subscription.create':
        await handleSubscriptionCreate(data);
        break;
      case 'subscription.disable':
      case 'subscription.not_renew':
        await handleSubscriptionDisable(data);
        break;
      case 'invoice.payment_success':
        await handleRenewalSuccess(data);
        break;
      case 'invoice.payment_failed':
        await handleRenewalFailed(data);
        break;
      default:
        console.log(`[pay/webhook] Unhandled event: ${event}`);
    }

    await markProcessed(idempotencyKey);

    return NextResponse.json({ received: true });
  } catch (err: any) {
    // Surface the failure: the webhook route answers 5xx so Paystack retries.
    console.error('[pay/webhook] Fatal error:', err);
    throw err;
  }
}
