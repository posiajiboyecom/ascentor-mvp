// ============================================================
// PAYMENT INITIALIZE — /api/payment/initialize
// Handles promo code activation (100% off = instant activation)
// For paid plans, the popup is handled client-side
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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
    const { email, userId, promoCode } = await req.json();

    if (!email || !userId) {
      return NextResponse.json({ error: 'Email and userId are required' }, { status: 400 });
    }

    if (promoCode) {
      const promo = PROMO_CODES[promoCode.toUpperCase()];
      if (!promo) {
        return NextResponse.json({ error: 'Invalid promo code' }, { status: 400 });
      }

      // 100% discount — activate immediately without payment
      if (promo.discount >= 1.0) {
        const subscriptionEnd = new Date();
        subscriptionEnd.setDate(subscriptionEnd.getDate() + 30);

        const { error: updateError } = await supabase.from('profiles').update({
          subscription_plan: 'pro',
          subscription_status: 'active',
          subscription_end: subscriptionEnd.toISOString(),
          updated_at: new Date().toISOString(),
        }).eq('id', userId);

        if (updateError) {
          return NextResponse.json({ error: 'Failed to activate account' }, { status: 500 });
        }

        // Audit log
        try {
          await supabase.from('audit_logs').insert({
            user_id: userId,
            action: 'promo_activation',
            entity_type: 'payment',
            entity_id: promoCode.toUpperCase(),
            details: { promo: promo.label, discount: '100%' },
          });
        } catch {} // Non-critical

        // Notification
        try {
          await supabase.from('notifications').insert({
            user_id: userId,
            type: 'payment',
            title: 'Account Activated!',
            message: `Your Pro plan is active with ${promo.label}. Enjoy unlimited coaching.`,
            link: '/dashboard',
          });
        } catch {} // Non-critical

        return NextResponse.json({
          success: true,
          free: true,
          message: 'Your account has been activated with free access!',
        });
      }
    }

    // For paid plans, the Paystack popup handles payment client-side
    // This endpoint is primarily for promo code processing
    return NextResponse.json({
      success: true,
      message: 'Use Paystack popup for payment',
    });
  } catch (err: any) {
    console.error('Payment initialization error:', err);
    return NextResponse.json({ error: 'Payment initialization failed' }, { status: 500 });
  }
}
