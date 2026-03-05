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

// Service role client — for writes that bypass RLS
const supabase = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Promo codes live SERVER-SIDE ONLY — never exposed to client bundle
const PROMO_CODES: Record<string, { discount: number; label: string }> = {
  'FOUNDER50':  { discount: 0.50, label: 'Founders 50% Off' },
  'ASCENTOR50': { discount: 0.50, label: 'Ascentor 50% Off' },
  'EARLYBIRD':  { discount: 0.50, label: 'Early Bird 50% Off' },
  'TESTER100':  { discount: 1.00, label: 'Tester Free Access' },
  'BETATESTER': { discount: 1.00, label: 'Beta Tester Free Access' },
  'FREEACCESS': { discount: 1.00, label: 'Free Access' },
};

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

    // ── 3. HANDLE PROMO CODE ───────────────────────────────────────
    if (promoCode) {
      const promo = PROMO_CODES[promoCode.trim().toUpperCase()];

      if (!promo) {
        return NextResponse.json({ error: 'Invalid promo code' }, { status: 400 });
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

      // Partial discount — return the discount amount so checkout can apply it
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
