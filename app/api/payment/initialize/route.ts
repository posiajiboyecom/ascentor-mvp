// ============================================================
// PAYMENT INITIALIZE — /api/payment/initialize
// Handles promo code activation (100% off = instant access)
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
// Promo codes now read from DB — lib/promo-codes.ts kept for fallback legacy codes only

// Service role client — for writes that bypass RLS
const supabase = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Promo codes live SERVER-SIDE ONLY — never exposed to client bundle


export async function POST(req: NextRequest) {
  try {
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

    // ── 3. HANDLE PROMO CODE ───────────────────────────────────────
    if (promoCode) {
      const code = promoCode.trim().toUpperCase();

      // Look up code in database first
      const { data: dbPromo, error: promoErr } = await supabase
        .from('promo_codes')
        .select('*')
        .eq('code', code)
        .eq('active', true)
        .single();

      // Build promo object — DB takes priority, then fallback to legacy hardcoded list
      let promo: { discount: number; label: string } | null = null;

      if (dbPromo && !promoErr) {
        // Validate expiry
        if (dbPromo.expires_at && new Date(dbPromo.expires_at) < new Date()) {
          return NextResponse.json({ error: 'This promo code has expired' }, { status: 400 });
        }
        // Validate max uses
        if (dbPromo.max_uses !== null && dbPromo.current_uses >= dbPromo.max_uses) {
          return NextResponse.json({ error: 'This promo code has reached its usage limit' }, { status: 400 });
        }
        promo = { discount: dbPromo.discount, label: dbPromo.label };
      } else {
        // Fallback: check legacy hardcoded codes
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
          subscription_plan:   'standard',
          subscription_status: 'active',
          subscription_end:    subscriptionEnd.toISOString(),
          updated_at:          new Date().toISOString(),
        }).eq('id', userId);

        if (updateError) {
          return NextResponse.json({ error: 'Failed to activate account' }, { status: 500 });
        }

        // Increment usage count in DB
        try {
          if (dbPromo) {
            await supabase.from('promo_codes')
              .update({ current_uses: (dbPromo.current_uses || 0) + 1 })
              .eq('id', dbPromo.id);
          }
        } catch {}

        // Audit log
        try {
          await supabase.from('audit_logs').insert({
            user_id:     userId,
            action:      'promo_activation',
            entity_type: 'payment',
            entity_id:   promoCode.toUpperCase(),
            details:     { promo: promo.label, discount: '100%' },
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
                plan:        'pro',
                promo_code:  body.promoCode?.toUpperCase() || '',
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

      // Partial discount — only increment usage on actual payment (not validate-only check)
      if (!validateOnly) {
        try {
          if (dbPromo) {
            await supabase.from('promo_codes')
              .update({ current_uses: (dbPromo.current_uses || 0) + 1 })
              .eq('id', dbPromo.id);
          }
        } catch {}
      }

      return NextResponse.json({
        success:  true,
        free:     false,
        discount: promo.discount,
        label:    promo.label,
      });
    }

    // No promo — Paystack popup handles payment client-side
    return NextResponse.json({ success: true, message: 'Use Paystack popup for payment' });

  } catch (err: any) {
    console.error('Payment initialization error:', err);
    return NextResponse.json({ error: 'Payment initialization failed' }, { status: 500 });
  }
}
