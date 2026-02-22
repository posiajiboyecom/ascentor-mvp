// ============================================================
// PAYMENT INITIALIZE — /api/payment/initialize (UPDATED)
// Validates promo codes from DB (promo_codes table) with
// fallback to hardcoded codes for backwards compatibility.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Fallback hardcoded codes (used if promo_codes table doesn't exist yet)
const FALLBACK_CODES: Record<string, { discount: number; label: string }> = {
  'FOUNDER50':  { discount: 0.50, label: 'Founders 50% Off' },
  'ASCENTOR50': { discount: 0.50, label: 'Ascentor 50% Off' },
  'EARLYBIRD':  { discount: 0.50, label: 'Early Bird 50% Off' },
  'TESTER100':  { discount: 1.00, label: 'Tester Free Access' },
  'BETATESTER': { discount: 1.00, label: 'Beta Tester Free Access' },
  'FREEACCESS': { discount: 1.00, label: 'Free Access' },
};

async function validatePromoCode(
  code: string,
  planId: string = 'standard'
): Promise<{ valid: boolean; discount: number; label: string; isFree: boolean }> {
  const upperCode = code.toUpperCase().trim();

  // Try database first
  try {
    const { data: dbCode } = await supabase
      .from('promo_codes')
      .select('discount, label, max_uses, current_uses, expires_at, active, applies_to')
      .eq('code', upperCode)
      .single();

    if (dbCode) {
      if (!dbCode.active) return { valid: false, discount: 0, label: '', isFree: false };
      if (dbCode.max_uses && dbCode.current_uses >= dbCode.max_uses) return { valid: false, discount: 0, label: '', isFree: false };
      if (dbCode.expires_at && new Date(dbCode.expires_at) < new Date()) return { valid: false, discount: 0, label: '', isFree: false };
      if (dbCode.applies_to && !dbCode.applies_to.includes(planId)) return { valid: false, discount: 0, label: '', isFree: false };

      return {
        valid: true,
        discount: parseFloat(dbCode.discount),
        label: dbCode.label,
        isFree: parseFloat(dbCode.discount) >= 1.0,
      };
    }
  } catch {
    // Table might not exist — fall through to hardcoded
  }

  // Fallback to hardcoded
  const fallback = FALLBACK_CODES[upperCode];
  if (fallback) {
    return { valid: true, discount: fallback.discount, label: fallback.label, isFree: fallback.discount >= 1.0 };
  }

  return { valid: false, discount: 0, label: '', isFree: false };
}

export async function POST(req: NextRequest) {
  try {
    const { email, userId, promoCode, plan } = await req.json();

    if (!email || !userId) {
      return NextResponse.json({ error: 'Email and userId are required' }, { status: 400 });
    }

    if (promoCode) {
      const promo = await validatePromoCode(promoCode, plan || 'standard');

      if (!promo.valid) {
        return NextResponse.json({ error: 'Invalid or expired promo code' }, { status: 400 });
      }

      // 100% discount — activate immediately
      if (promo.isFree) {
        const subscriptionEnd = new Date();
        subscriptionEnd.setDate(subscriptionEnd.getDate() + 30);

        const { error: updateError } = await supabase.from('profiles').update({
          subscription_plan: plan || 'standard',
          subscription_status: 'active',
          subscription_end: subscriptionEnd.toISOString(),
          updated_at: new Date().toISOString(),
        }).eq('id', userId);

        if (updateError) {
          return NextResponse.json({ error: 'Failed to activate account' }, { status: 500 });
        }

        // Increment promo usage
        try { await supabase.rpc('use_promo_code', { input_code: promoCode.toUpperCase() }); } catch {}

        // Audit + notification
        try {
          await supabase.from('audit_logs').insert({
            user_id: userId, action: 'promo_activation', entity_type: 'payment',
            entity_id: promoCode.toUpperCase(), details: { promo: promo.label, discount: '100%', plan },
          });
        } catch {}
        try {
          await supabase.from('notifications').insert({
            user_id: userId, type: 'payment', title: 'Account Activated!',
            message: `Your ${plan || 'standard'} plan is active with ${promo.label}.`, link: '/dashboard',
          });
        } catch {}

        return NextResponse.json({ success: true, free: true, message: 'Account activated with free access!' });
      }

      // Partial discount — return for client-side Paystack popup
      return NextResponse.json({ success: true, discount: promo.discount, label: promo.label });
    }

    return NextResponse.json({ success: true, message: 'Use Paystack popup for payment' });
  } catch (err: any) {
    console.error('Payment initialization error:', err);
    return NextResponse.json({ error: 'Payment initialization failed' }, { status: 500 });
  }
}
