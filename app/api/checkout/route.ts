import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    /* ── Validate promo code ── */
    if (action === 'validate-promo') {
      const { code } = body;
      if (!code || typeof code !== 'string') {
        return NextResponse.json({ valid: false, error: 'Please enter a promo code' }, { status: 400 });
      }

      const { data, error } = await supabase
        .rpc('validate_promo_code', { input_code: code.toUpperCase() });

      if (error) {
        console.error('Promo validation error:', error);
        return NextResponse.json({ valid: false, error: 'Something went wrong. Try again.' }, { status: 500 });
      }

      const result = data?.[0];
      if (!result || !result.is_valid) {
        return NextResponse.json({
          valid: false,
          error: result?.error_message || 'Invalid promo code',
        });
      }

      return NextResponse.json({
        valid: true,
        promoId: result.promo_id,
        code: result.code,
        discountPercent: result.discount_percent,
        promoType: result.promo_type,
      });
    }

    /* ── Create subscription ── */
    if (action === 'create-subscription') {
      const { userId, promoCode, provider, providerReference, amountCents } = body;

      if (!userId) {
        return NextResponse.json({ error: 'User ID required' }, { status: 400 });
      }

      const now = new Date();
      const trialEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      const periodEnd = new Date(now.getTime() + 37 * 24 * 60 * 60 * 1000);
      const refundUntil = new Date(trialEnd.getTime() + 30 * 24 * 60 * 60 * 1000);

      let plan = 'standard';
      let status = 'trialing';
      let promoId = null;

      // Validate promo if provided
      if (promoCode) {
        const promoData = await supabase
          .rpc('validate_promo_code', { input_code: promoCode.toUpperCase() });
        const promo = promoData.data?.[0];
        if (promo?.is_valid) {
          promoId = promo.promo_id;
          if (promo.promo_type === 'tester') { plan = 'tester'; status = 'active'; }
          else if (promo.promo_type === 'founders') { plan = 'founder'; }
        }
      }

      // Upsert subscription
      const { data: sub, error: subError } = await supabase
        .from('subscriptions')
        .upsert({
          user_id: userId,
          plan,
          status,
          price_cents: amountCents || 0,
          currency: 'USD',
          promo_code_id: promoId,
          payment_provider: provider || 'free',
          provider_reference: providerReference || null,
          trial_starts_at: now.toISOString(),
          trial_ends_at: trialEnd.toISOString(),
          current_period_start: now.toISOString(),
          current_period_end: periodEnd.toISOString(),
          refund_eligible_until: refundUntil.toISOString(),
          updated_at: now.toISOString(),
        }, { onConflict: 'user_id' })
        .select()
        .single();

      if (subError) {
        console.error('Subscription error:', subError);
        return NextResponse.json({ error: 'Failed to create subscription' }, { status: 500 });
      }

      // Log payment
      if (provider && provider !== 'free') {
        await supabase.from('payments').insert({
          user_id: userId,
          subscription_id: sub.id,
          provider,
          provider_reference: providerReference || `manual_${Date.now()}`,
          amount_cents: amountCents || 0,
          currency: 'USD',
          status: 'success',
          promo_code: promoCode || null,
          metadata: { plan, promoId },
        });
      }

      // Increment promo usage
      if (promoId) {
        await supabase.rpc('increment_promo_usage', { promo_id_input: promoId });
      }

      return NextResponse.json({
        success: true,
        subscription: {
          id: sub.id,
          plan: sub.plan,
          status: sub.status,
          trialEndsAt: sub.trial_ends_at,
          refundEligibleUntil: sub.refund_eligible_until,
        },
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err) {
    console.error('Checkout API error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
