// GET /api/shop/callback: Paystack sends the buyer here after the hosted page.
// Settlement is shared with the webhook and the reconciliation job; nothing here trusts the URL.

import { NextRequest, NextResponse } from 'next/server';
import { settleReference } from '@/lib/paymentSettlement';
import { supabaseAdmin } from '@/lib/supabase/admin';

const APP_URL = process.env.NEXT_PUBLIC_URL || 'https://joinascentor.com';

export async function GET(req: NextRequest) {
  const params = new URL(req.url).searchParams;
  const reference = params.get('reference') || params.get('trxref');
  if (!reference) return NextResponse.redirect(`${APP_URL}/shop?error=missing_reference`);

  // Signed-in members land in the app shop, guests on the public one.
  const { data: order } = await supabaseAdmin.from('shop_orders').select('id, user_id').eq('reference', reference).maybeSingle();
  const base = order?.user_id ? `${APP_URL}/store/orders` : `${APP_URL}/shop/thanks`;
  const withId = (q: string) => `${base}?${q}${order ? `&order=${order.id}` : ''}`;

  try {
    const result = await settleReference(reference);
    switch (result.state) {
      case 'settled': return NextResponse.redirect(withId('paid=1'));
      case 'pending': return NextResponse.redirect(withId('paid=processing'));
      default:        return NextResponse.redirect(`${APP_URL}/shop?error=payment_failed`);
    }
  } catch (err) {
    console.error('[shop/callback] Unexpected error:', err);
    return NextResponse.redirect(withId('paid=processing'));
  }
}
