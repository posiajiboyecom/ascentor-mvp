// app/api/payment/active-promo/route.ts
// GET — returns the active auto-apply promo code for the checkout page
// Public endpoint — no auth needed (discount % is not sensitive)
// Only returns: code, discount, label, expires_at

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from('promo_codes')
      .select('code, discount, label, expires_at')
      .eq('active', true)
      .eq('auto_apply', true)
      .or(`expires_at.is.null,expires_at.gt.${now}`)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('[active-promo]', error);
      return NextResponse.json({ promo: null });
    }

    return NextResponse.json({ promo: data || null });
  } catch (err) {
    console.error('[active-promo]', err);
    return NextResponse.json({ promo: null });
  }
}
