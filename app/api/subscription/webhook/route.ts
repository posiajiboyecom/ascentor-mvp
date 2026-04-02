// ============================================================
// PAYSTACK WEBHOOK — /api/subscription/webhook
//
// Matched to YOUR actual checkout flow:
// - Checkout uses PaystackPop inline (one-time charge), NOT recurring plans
// - Plans: explorer | builder | climber  (from AccountClient.tsx)
// - Prices in USD, charged in NGN at NGN_PER_USD rate
// - Verification at /api/payment/verify handles initial activation
// - THIS webhook handles: renewals, cancellations, failed payments
//   that happen AFTER the initial purchase
//
// SECURITY: HMAC-SHA512 signature verified on every request.
// This route is whitelisted in proxy.ts PUBLIC_API_ROUTES.
//
// BUG FIX (Bug 5): handleChargeSuccess previously checked
// profile.subscription_status === 'active' AFTER the profile had already
// been updated to 'active', making the pre-update status unreliable.
// The fix captures the previous status before the update and uses
// wasTrialing to correctly suppress the notification only for first-ever
// activations (trialing → active, handled by /api/payment/verify).
// Users recovering from past_due now correctly receive the renewal notice.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// Service role — webhook runs outside user session
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY!;

// ── Signature verification ────────────────────────────────
function verifySignature(rawBody: string, signature: string): boolean {
  const hash = crypto
    .createHmac('sha512', PAYSTACK_SECRET)
    .update(rawBody)
    .digest('hex');
  return hash === signature;
}

// ── Look up profile by email ──────────────────────────────
async function getProfileByEmail(email: string) {
  // Try profiles table first (has email column)
  const { data } = await supabase
    .from('profiles')
    .select('id, subscription_plan, subscription_status, subscription_end')
    .eq('email', email)
    .maybeSingle();

  // HIGH-4 FIX: Removed listUsers() fallback — it fetches ALL users and fails at scale.
  // Ensure your profiles table has an email column populated via DB trigger on user creation.
  if (!data) {
    console.warn(`[Webhook] No profile found for email: ${email}. Ensure profiles.email is populated.`);
  }
  return data ?? null;
}

// ── Derive plan from metadata ─────────────────────────────
// Your checkout passes metadata: { plan: 'explorer'|'builder'|'climber', ... }
function getPlanFromMetadata(metadata: any): string {
  // Paystack metadata comes back as custom_fields array or direct object
  if (metadata?.plan) return metadata.plan;
  if (metadata?.custom_fields) {
    const planField = metadata.custom_fields.find((f: any) => f.variable_name === 'plan');
    if (planField) return planField.value;
  }
  return 'explorer'; // safe default
}

// ── Audit log helper ─────────────────────────────────────
async function logAudit(userId: string, action: string, details: object) {
  try {
    await supabase.from('audit_logs').insert({
      user_id: userId,
      action,
      entity_type: 'payment',
      entity_id: action,
      details,
    });
  } catch { /* non-critical */ }
}

// ── In-app notification helper ────────────────────────────
async function notify(userId: string, type: string, title: string, message: string, link = '/account') {
  try {
    await supabase.from('notifications').insert({
      user_id: userId,
      type,
      title,
      message,
      link,
    });
  } catch { /* non-critical */ }
}

// ── EVENT HANDLERS ────────────────────────────────────────

/**
 * charge.success
 * Fires on successful payment — initial AND renewals.
 * Your /api/payment/verify handles the initial charge.success from the inline popup.
 * This webhook handles recurring renewals that come in without a browser session.
 */
async function handleChargeSuccess(data: any) {
  const email = data.customer?.email;
  if (!email) return;

  const profile = await getProfileByEmail(email);
  if (!profile) {
    console.warn(`[Webhook] charge.success — no profile for ${email}`);
    return;
  }

  const plan = getPlanFromMetadata(data.metadata);

  // BUG FIX (Bug 5): Capture the previous status BEFORE the update.
  // The original code checked profile.subscription_status === 'active' after
  // the update had already set it to 'active', making the check always pass
  // (even on first activation) or always fail (for past_due recoveries).
  // Correct logic: skip the notification only when this is the very first
  // payment (trialing → active), which is already handled by /api/payment/verify.
  const wasTrialing = profile.subscription_status === 'trialing';

  // CRIT-4 FIX: If user is currently trialing, this charge.success is the INITIAL
  // payment — already handled by /api/payment/verify which set subscription_end
  // correctly with the 7-day trial. Skip the update to avoid overwriting
  // subscription_end (37 days → 30 days) and bypassing the trial period.
  if (wasTrialing) {
    console.log(`[Webhook] Skipping charge.success update for trialing user ${email} — already activated by /api/payment/verify`);
    return;
  }

  // Calculate next billing date (30 days from payment) — for RENEWALS only
  const paidAt = data.paid_at ? new Date(data.paid_at) : new Date();
  const nextBilling = new Date(paidAt);
  nextBilling.setDate(nextBilling.getDate() + 30);

  await supabase.from('profiles').update({
    subscription_plan: plan,
    subscription_status: 'active',
    subscription_end: nextBilling.toISOString(),
    payment_method: data.channel || 'card',
    updated_at: new Date().toISOString(),
  }).eq('id', profile.id);

  await logAudit(profile.id, 'subscription_renewed', {
    plan,
    amount: data.amount,
    reference: data.reference,
    channel: data.channel,
  });

  // Only notify on renewal — not on first payment (trialing → active),
  // which is already handled by /api/payment/verify.
  // This correctly covers: active→active renewals AND past_due recoveries.
  if (!wasTrialing) {
    await notify(
      profile.id,
      'success',
      'Subscription Renewed',
      `Your ${plan} plan has been renewed successfully.`,
      '/account'
    );
  }

  console.log(`[Webhook] ✅ charge.success — ${email} → ${plan}`);
}

/**
 * invoice.payment_failed
 * Renewal charge failed (expired card, insufficient funds, etc.)
 * Paystack will retry — we mark past_due but don't revoke access yet.
 */
async function handlePaymentFailed(data: any) {
  const email = data.customer?.email;
  if (!email) return;

  const profile = await getProfileByEmail(email);
  if (!profile) return;

  await supabase.from('profiles').update({
    subscription_status: 'past_due',
    updated_at: new Date().toISOString(),
  }).eq('id', profile.id);

  await logAudit(profile.id, 'payment_failed', {
    amount: data.amount,
    reference: data.reference,
  });

  await notify(
    profile.id,
    'warning',
    '⚠️ Payment Failed',
    'We couldn\'t renew your subscription. Please update your payment details to keep your access.',
    '/checkout'
  );

  console.log(`[Webhook] ❌ invoice.payment_failed — ${email}`);
}

/**
 * subscription.disable / subscription.not_renew
 * User cancelled via Paystack dashboard or our cancel API.
 * Keep access until subscription_end — just update the status.
 */
async function handleSubscriptionDisable(data: any) {
  const email = data.customer?.email;
  if (!email) return;

  const profile = await getProfileByEmail(email);
  if (!profile) return;

  // Only update if currently active — don't overwrite already-expired
  if (!['active', 'trialing', 'past_due'].includes(profile.subscription_status)) return;

  await supabase.from('profiles').update({
    subscription_status: 'cancelled',
    updated_at: new Date().toISOString(),
  }).eq('id', profile.id);

  await logAudit(profile.id, 'subscription_cancelled_webhook', {
    plan: profile.subscription_plan,
    access_until: profile.subscription_end,
  });

  const endDate = profile.subscription_end
    ? new Date(profile.subscription_end).toLocaleDateString('en-NG', {
        day: 'numeric', month: 'long', year: 'numeric',
      })
    : 'the end of your billing period';

  await notify(
    profile.id,
    'info',
    'Subscription Cancelled',
    `Your ${profile.subscription_plan} plan has been cancelled. You'll keep access until ${endDate}.`,
    '/checkout'
  );

  console.log(`[Webhook] ⚠️ subscription.disable — ${email}`);
}

// ── Main Route ────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get('x-paystack-signature') || '';

    if (!verifySignature(rawBody, signature)) {
      console.error('[Webhook] ❌ Invalid signature');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const event = JSON.parse(rawBody);
    const { event: eventName, data } = event;

    console.log(`[Webhook] 📥 ${eventName}`);

    switch (eventName) {
      case 'charge.success':
        await handleChargeSuccess(data);
        break;
      case 'invoice.payment_failed':
        await handlePaymentFailed(data);
        break;
      case 'subscription.disable':
      case 'subscription.not_renew':
        await handleSubscriptionDisable(data);
        break;
      default:
        console.log(`[Webhook] Unhandled: ${eventName}`);
    }

    // Always 200 — Paystack retries on non-2xx
    return NextResponse.json({ received: true });

  } catch (err: any) {
    console.error('[Webhook] Fatal:', err);
    // Still 200 to prevent infinite retries; error is logged
    return NextResponse.json({ received: true, warning: 'Processing error' });
  }
}

export async function GET() {
  return NextResponse.json({ status: 'Webhook active' });
}
