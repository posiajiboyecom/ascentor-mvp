// ================================================================
// POST /api/shop/checkout   (NGN only; orders from Nigeria only: the shop ships within Nigeria)
// Prices the cart on the SERVER, records the order + a payment attempt, and returns Paystack's
// hosted page. Settlement (callback, webhook, reconciliation) then fulfils it exactly once through
// lib/paymentSettlement.ts, comparing the payment to the amount recorded here.
// Guests may buy (the public shop): digital items are delivered by emailed link.
// ================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createAuthClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { createAttempt } from '@/lib/paymentSettlement';
import { paymentLimiter, getClientIp } from '@/lib/rate-limit';
import { parseJson } from '@/lib/validation/http';
import * as commerceSchemas from '@/lib/validation/schemas/commerce';
import { priceCart } from '@/lib/shop';
import type { ShopShippingKey } from '@/lib/shop-shared';
import { requestCurrency } from '@/lib/geo';

const APP_URL = process.env.NEXT_PUBLIC_URL || 'https://joinascentor.com';

export async function POST(req: NextRequest) {
  const limit = paymentLimiter.check(getClientIp(req));
  if (!limit.allowed) {
    return NextResponse.json({ error: 'Too many attempts. Please wait a minute and try again.' }, { status: 429, headers: { 'Retry-After': String(limit.retryAfter) } });
  }

  // Buyers outside Nigeria pay in US dollars everywhere else, but the shop is priced in naira and delivers within Nigeria
  // only, so it does not take orders from abroad.
  if (requestCurrency(req) !== 'NGN') {
    return NextResponse.json({ error: 'The shop delivers within Nigeria only for now, so orders can only be placed from Nigeria.', code: 'nigeria_only' }, { status: 403 });
  }

  const parsed = await parseJson(req, commerceSchemas.shopCheckout);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) {
    console.error('[shop/checkout] PAYSTACK_SECRET_KEY not set');
    return NextResponse.json({ error: 'Payment system misconfigured. Contact support.' }, { status: 500 });
  }

  const auth = await createAuthClient();
  const { data: { user } } = await auth.auth.getUser();

  const priced = await priceCart(
    body.items.map((i) => ({ productId: i.productId, size: i.size ?? null, qty: i.qty })),
    (body.shipping as ShopShippingKey | undefined) ?? null,
  );
  if (!priced.ok) return NextResponse.json({ error: priced.error }, { status: 400 });
  const { cart } = priced;

  // Delivery to an address needs one; Summit pickup does not.
  if (cart.needsShipping && body.shipping !== 'summit' && !(body.address && body.city)) {
    return NextResponse.json({ error: 'Add your delivery address.' }, { status: 400 });
  }

  const email = (user?.email ?? body.email).toLowerCase();

  const { data: order, error: orderErr } = await supabaseAdmin.from('shop_orders').insert({
    user_id: user?.id ?? null,
    email,
    full_name: body.fullName,
    phone: body.phone ?? null,
    status: 'pending',
    shipping_key: cart.needsShipping ? body.shipping : 'none',
    shipping_fee: cart.shippingFee,
    subtotal: cart.subtotal,
    total: cart.total,
    address: cart.needsShipping && body.shipping !== 'summit'
      ? { address: body.address, city: body.city, state: body.state ?? null } : null,
  }).select('id').single();
  if (orderErr || !order) {
    console.error('[shop/checkout] order insert failed:', orderErr?.message);
    return NextResponse.json({ error: 'Could not start checkout. Please try again.' }, { status: 500 });
  }

  const { error: itemsErr } = await supabaseAdmin.from('shop_order_items').insert(
    cart.lines.map((l) => ({
      order_id: order.id, product_id: l.product.id, name: l.product.name, size: l.size,
      qty: l.qty, unit_price: l.unitPrice, fulfilment: l.product.fulfilment,
    })),
  );
  if (itemsErr) {
    await supabaseAdmin.from('shop_orders').delete().eq('id', order.id);
    return NextResponse.json({ error: 'Could not start checkout. Please try again.' }, { status: 500 });
  }

  const amountKobo = cart.total * 100;
  const psRes = await fetch('https://api.paystack.co/transaction/initialize', {
    method: 'POST',
    headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      amount: amountKobo,
      currency: 'NGN',
      callback_url: `${APP_URL}/api/shop/callback`,
      channels: ['card', 'bank', 'bank_transfer', 'mobile_money', 'ussd', 'qr'],
      metadata: { order_id: order.id, kind: 'shop', ...(user ? { user_id: user.id } : {}) },
    }),
  });
  const ps = await psRes.json();
  if (!ps.status || !ps.data) {
    await supabaseAdmin.from('shop_orders').update({ status: 'cancelled' }).eq('id', order.id);
    return NextResponse.json({ error: ps.message || 'Payment initialization failed. Please try again.' }, { status: 400 });
  }

  try {
    await createAttempt({ reference: ps.data.reference, kind: 'shop', amountKobo, email, userId: user?.id ?? null, orderId: order.id });
    await supabaseAdmin.from('shop_orders').update({ reference: ps.data.reference }).eq('id', order.id);
  } catch (e) {
    console.error('[shop/checkout] Could not record payment attempt:', e);
    await supabaseAdmin.from('shop_orders').update({ status: 'cancelled' }).eq('id', order.id);
    return NextResponse.json({ error: 'Could not start checkout. Please try again.' }, { status: 500 });
  }

  return NextResponse.json({ authorizationUrl: ps.data.authorization_url, reference: ps.data.reference, orderId: order.id });
}
