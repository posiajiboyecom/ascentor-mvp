// ============================================================
// PAYMENT INITIALIZE — /api/payments/initialize
// Handles promo code activation (100% off = instant access)
// and Paystack transaction initialization for paid plans.
//
// SECURITY FIX (S2): userId is now taken from the authenticated
// session, NOT from the request body. A caller cannot activate
// a different user's account by passing an arbitrary userId.
// Promo codes validated server-side only (never sent to client).
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { createClient as createAuthClient } from '@/lib/supabase/server';
import { addOrUpdateSubscriber, ML_GROUPS } from '@/lib/mailerlite';
import { paymentLimiter, getClientIp } from '@/lib/rate-limit';
// Promo codes now read from DB — lib/promo-codes.ts kept for fallback legacy codes only

// Service role client — for writes that bypass RLS
const supabase = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Promo codes live SERVER-SIDE ONLY — never exposed to client bundle


export async function POST(req: NextRequest) {
  try {
    // ── 0. Rate limit — 10 requests/minute per IP (H-3 fix) ───────────
    const ip = getClientIp(req);
    const { allowed, retryAfter } = paymentLimiter.check(ip);
    if (!allowed) {
      return NextResponse.json(
        { error: 'Too many requests', retryAfter },
        { status: 429, headers: { 'Retry-After': String(retryAfter) } }
      );
    }

    // ── 1. AUTHENTICATE SESSION FIRST ──────────────────────────────
    const authClient = await createAuthClient();
    const { data: { user }, error: authError } = await authClient.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Use session user id — ignore any userId from body
    const userId = user.id;

    // ── 2. PARSE BODY ──────────────────────────────────────────────
    const body = await req.json();
    const promoCode: string | undefined = body.promoCode;
    const validateOnly: boolean = body.validateOnly === true; // just validate, don't activate
    // MED-2 FIX: capture the user's chosen plan so 100% promo activates the correct plan
    const chosenPlan: string = body.plan || 'explorer';

    // ── 3. HANDLE PROMO CODE ───────────────────────────────────────
    if (promoCode) {
      const code = promoCode.trim().toUpperCase();

      // C-2 fix: use atomic DB RPC to claim the code.
      // The RPC uses SELECT FOR UPDATE to prevent race conditions where
      // two simultaneous requests both pass the max_uses check and both
      // over-consume. See migration: 20240003_claim_promo_code.sql
      let promo: { discount: number; label: string } | null = null;
      let claimedViaRpc = false;

      const { data: rpcResult, error: rpcError } = await supabase
        .rpc('claim_promo_code', { p_code: code, p_validate_only: validateOnly });

      if (!rpcError && rpcResult) {
        if (rpcResult.error === 'invalid') {
          // Not found in DB — try legacy hardcoded fallback
          const { lookupPromo } = await import('@/lib/promo-codes');
          promo = lookupPromo(code);
        } else if (rpcResult.error === 'expired') {
          return NextResponse.json({ error: 'This promo code has expired' }, { status: 400 });
        } else if (rpcResult.error === 'limit_reached') {
          return NextResponse.json({ error: 'This promo code has reached its usage limit' }, { status: 400 });
        } else if (rpcResult.ok) {
          promo = { discount: rpcResult.discount, label: rpcResult.label };
          claimedViaRpc = true; // RPC already incremented current_uses
        }
      } else {
        // RPC not available (migration not run yet) — fall back to legacy path
        console.warn('[payment/initialize] claim_promo_code RPC unavailable, using legacy path:', rpcError);
        const { lookupPromo } = await import('@/lib/promo-codes');
        promo = lookupPromo(code);
      }

      if (!promo) {
        return NextResponse.json({ error: 'Invalid promo code' }, { status: 400 });
      }

      // 100% discount — if validateOnly just confirm the code, don't activate yet
      if (promo.discount >= 1.0 && validateOnly) {
        return NextResponse.json({
          success:  true,
          free:     true,
          discount: promo.discount,
          label:    promo.label,
        });
      }

      // 100% discount — activate immediately without payment
      if (promo.discount >= 1.0) {
        const subscriptionEnd = new Date();
        subscriptionEnd.setDate(subscriptionEnd.getDate() + 30);

        const { error: updateError } = await supabase.from('profiles').update({
          subscription_plan:   chosenPlan, // MED-2 FIX: user's actual chosen plan
          subscription_status: 'active',
          subscription_end:    subscriptionEnd.toISOString(),
          updated_at:          new Date().toISOString(),
        }).eq('id', userId);

        if (updateError) {
          return NextResponse.json({ error: 'Failed to activate account' }, { status: 500 });
        }

        // Audit log
        try {
          await supabase.from('audit_logs').insert({
            user_id:     userId,
            action:      'promo_activation',
            entity_type: 'payment',
            entity_id:   code,
            details:     { promo: promo.label, discount: '100%', atomic: claimedViaRpc },
          });
        } catch {} // Non-critical

        // Notification
        try {
          await supabase.from('notifications').insert({
            user_id: userId,
            type:    'payment',
            title:   'Account Activated! 🎉',
            message: `Your plan is active with ${promo.label}. Enjoy full access.`,
            link:    '/dashboard',
          });
        } catch {} // Non-critical

        // Sync promo activation to MailerLite
        try {
          const { data: authData } = await supabase.auth.admin.getUserById(userId);
          const userEmail = authData?.user?.email;
          if (userEmail) {
            await addOrUpdateSubscriber({
              email: userEmail,
              groups: [ML_GROUPS.APP_USERS, ML_GROUPS.PAID_USERS],
              fields: {
                plan:        'standard',
                promo_code:  code,
                upgraded_at: new Date().toISOString(),
              },
            });
          }
        } catch (mlErr) {
          console.error('[payment/initialize] MailerLite error (non-fatal):', mlErr);
        }

        return NextResponse.json({
          success:  true,
          free:     true,
          discount: promo.discount,
          message:  'Your account has been activated!',
        });
      }

      // Partial discount — RPC already claimed it atomically above
      return NextResponse.json({
        success:  true,
        free:     false,
        discount: promo.discount,
        label:    promo.label,
      });
    }

    // ── 4. NO PROMO — Initialize Paystack transaction ──────────────
    // FIX: Previously this returned { success: true } with no access_code/reference,
    // causing the checkout button to hang on "Loading payment..." forever.
    // Now we call the Paystack API and return the access_code + reference
    // that the client-side PaystackPop.setup() requires.
    const { plan, currency, email, metadata } = body;

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }
    if (!plan) {
      return NextResponse.json({ error: 'Plan code is required' }, { status: 400 });
    }

    const paystackRes = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        plan,
        // Do NOT send `currency` when using a plan code.
        // Paystack derives currency from the plan itself.
        // Sending currency alongside plan causes "Invalid Amount Sent".
        metadata: {
          ...metadata,
          // Ensure userId from session is in metadata, not from client body
          userId,
        },
      }),
    });

    const paystackData = await paystackRes.json();

    if (!paystackData.status) {
      console.error('[payment/initialize] Paystack error:', paystackData.message);
      return NextResponse.json(
        { error: paystackData.message || 'Failed to initialize payment' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      access_code: paystackData.data.access_code,
      reference:   paystackData.data.reference,
    });

  } catch (err: any) {
    console.error('Payment initialization error:', err);
    return NextResponse.json({ error: 'Payment initialization failed' }, { status: 500 });
  }
}
