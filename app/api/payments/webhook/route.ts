// ============================================================
// PAYSTACK PAYMENT WEBHOOK — /api/payment/webhook
//
// BUG FIX (Bug 2 & 4): This file previously contained a copy of the OLD,
// insecure version of /api/payment/initialize — complete with userId read
// from the request body and no session check. That code:
//   - Provided no actual webhook handling
//   - Allowed any authenticated caller to activate an arbitrary userId
//     to subscription_plan 'pro' by passing a 100%-off promo code
//
// This file now contains the correct Paystack webhook handler for
// charge-level events (charge.success, charge.failed). It follows the
// same HMAC-SHA512 verification pattern as /api/subscription/webhook.
//
// NOTE: This route is NOT in proxy.ts PROTECTED_API_PREFIXES whitelist
// because /api/payment IS protected. Add '/api/payment/webhook' to
// PUBLIC_API_ROUTES in proxy.ts if Paystack is configured to POST here,
// so Paystack's servers (no auth cookie) can reach it.
//
// SECURITY: HMAC-SHA512 signature verified on every request using
// PAYSTACK_SECRET_KEY. No session auth — Paystack calls this server-to-server.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

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
  const { data } = await supabase
    .from('profiles')
    .select('id, subscription_plan, subscription_status, subscription_end')
    .eq('email', email)
    .maybeSingle();

  // H-4 fix: removed auth.admin.listUsers() fallback.
  // At scale, listUsers() fetches ALL users and fails past 1,000.
  // profiles.email must always be populated — enforced by the DB trigger
  // that copies auth.users.email on insert. If not found, the user hasn't
  // completed signup and we log a warning rather than scanning all users.
  if (!data) {
    console.warn(`[Payment Webhook] No profile found for email: ${email}. User may not have completed signup.`);
  }
  return data ?? null;
}

// ── Audit log helper ──────────────────────────────────────
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

// ── Notification helper ───────────────────────────────────
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
 * One-time charge succeeded. Used here for any direct charge events
 * not covered by /api/subscription/webhook (e.g. product purchases).
 */
async function handleChargeSuccess(data: any) {
  const email = data.customer?.email;
  if (!email) return;

  const profile = await getProfileByEmail(email);
  if (!profile) {
    console.warn(`[Payment Webhook] charge.success — no profile for ${email}`);
    return;
  }

  await logAudit(profile.id, 'charge_success', {
    amount: data.amount,
    reference: data.reference,
    channel: data.channel,
  });

  console.log(`[Payment Webhook] ✅ charge.success — ${email}`);
}

/**
 * charge.failed
 * One-time charge attempt failed.
 */
async function handleChargeFailed(data: any) {
  const email = data.customer?.email;
  if (!email) return;

  const profile = await getProfileByEmail(email);
  if (!profile) return;

  await logAudit(profile.id, 'charge_failed', {
    amount: data.amount,
    reference: data.reference,
    gateway_response: data.gateway_response,
  });

  await notify(
    profile.id,
    'warning',
    '⚠️ Payment Failed',
    'Your payment could not be processed. Please check your card details and try again.',
    '/checkout'
  );

  console.log(`[Payment Webhook] ❌ charge.failed — ${email}`);
}

// ── Main Route ────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get('x-paystack-signature') || '';

    if (!verifySignature(rawBody, signature)) {
      console.error('[Payment Webhook] ❌ Invalid signature');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const event = JSON.parse(rawBody);
    const { event: eventName, data } = event;

    console.log(`[Payment Webhook] 📥 ${eventName}`);

    switch (eventName) {
      case 'charge.success':
        await handleChargeSuccess(data);
        break;
      case 'charge.failed':
        await handleChargeFailed(data);
        break;
      default:
        console.log(`[Payment Webhook] Unhandled: ${eventName}`);
    }

    // Always 200 — Paystack retries on non-2xx
    return NextResponse.json({ received: true });

  } catch (err: any) {
    console.error('[Payment Webhook] Fatal:', err);
    return NextResponse.json({ received: true, warning: 'Processing error' });
  }
}

export async function GET() {
  return NextResponse.json({ status: 'Payment webhook active' });
}
