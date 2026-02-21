// ============================================================
// FEATURE #4: Paystack Initialize Payment — /api/payments/initialize
// Called from checkout page to create a Paystack transaction.
// POST body: { email, amount, plan, promoCode, userId, referralCode? }
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY || '';
const PAYSTACK_BASE_URL = 'https://api.paystack.co';

// Promo codes and their discounts
const PROMO_CODES: Record<string, { discount: number; label: string }> = {
  'FOUNDER50':   { discount: 0.50, label: 'Founders 50% Off' },
  'ASCENTOR50':  { discount: 0.50, label: 'Ascentor 50% Off' },
  'EARLYBIRD':   { discount: 0.50, label: 'Early Bird 50% Off' },
  'TESTER100':   { discount: 1.00, label: 'Tester Free Access' },
  'BETATESTER':  { discount: 1.00, label: 'Beta Tester Free Access' },
  'FREEACCESS':  { discount: 1.00, label: 'Free Access' },
};

const STANDARD_PRICE_USD = 15; // $15/month

export async function POST(req: NextRequest) {
  try {
    const { email, promoCode, userId } = await req.json();

    if (!email || !userId) {
      return NextResponse.json({ error: 'Email and userId are required' }, { status: 400 });
    }

    // Calculate amount after promo
    let amount = STANDARD_PRICE_USD;
    let appliedPromo: string | null = null;

    if (promoCode) {
      const promo = PROMO_CODES[promoCode.toUpperCase()];
      if (promo) {
        amount = STANDARD_PRICE_USD * (1 - promo.discount);
        appliedPromo = promo.label;

        // 100% discount — activate immediately without payment
        if (promo.discount >= 1.0) {
          const subscriptionEnd = new Date();
          subscriptionEnd.setDate(subscriptionEnd.getDate() + 30);

          await supabase.from('profiles').update({
            subscription_plan: 'standard',
            subscription_status: 'active',
            subscription_tier: 'tester',
            subscription_end: subscriptionEnd.toISOString(),
            updated_at: new Date().toISOString(),
          }).eq('id', userId);

          // Log it
          try {
            await supabase.from('audit_logs').insert({
              user_id: userId,
              action: 'promo_activation',
              entity_type: 'payment',
              entity_id: promoCode.toUpperCase(),
              details: { promo: promo.label, discount: '100%' },
            });
          } catch {} // Non-critical

          return NextResponse.json({
            success: true,
            free: true,
            message: 'Your account has been activated with free access!',
          });
        }
      } else {
        return NextResponse.json({ error: 'Invalid promo code' }, { status: 400 });
      }
    }

    // Convert to kobo (NGN) — using approximate rate, adjust as needed
    // For production: use a real exchange rate API
    const NGN_RATE = 1600; // Approximate NGN per USD
    const amountKobo = Math.round(amount * NGN_RATE * 100);

    const reference = `asc_${userId.slice(0, 8)}_${Date.now()}`;

    // Initialize Paystack transaction
    if (!PAYSTACK_SECRET) {
      // No Paystack keys — return mock response for development
      return NextResponse.json({
        success: true,
        mock: true,
        data: {
          authorization_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/checkout/mock?ref=${reference}`,
          access_code: 'mock_access_code',
          reference,
        },
        amount: amount,
        currency: 'USD',
        applied_promo: appliedPromo,
        message: 'Development mode: Paystack keys not configured. Using mock checkout.',
      });
    }

    const paystackRes = await fetch(`${PAYSTACK_BASE_URL}/transaction/initialize`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PAYSTACK_SECRET}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        amount: amountKobo,
        reference,
        currency: 'NGN',
        callback_url: `${process.env.NEXT_PUBLIC_APP_URL}/checkout/verify?reference=${reference}`,
        metadata: {
          user_id: userId,
          plan: 'standard',
          promo_code: promoCode || null,
          custom_fields: [
            { display_name: 'Plan', variable_name: 'plan', value: 'Ascentor Standard' },
            ...(appliedPromo ? [{ display_name: 'Promo', variable_name: 'promo', value: appliedPromo }] : []),
          ],
        },
      }),
    });

    const paystackData = await paystackRes.json();

    if (!paystackData.status) {
      return NextResponse.json({
        error: paystackData.message || 'Failed to initialize payment',
      }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      data: paystackData.data,
      amount,
      currency: 'USD',
      applied_promo: appliedPromo,
    });
  } catch (err: any) {
    console.error('Payment initialization error:', err);
    return NextResponse.json({ error: 'Payment initialization failed' }, { status: 500 });
  }
}
