// ============================================================
// PRODUCT PAYMENT VERIFY — /api/payment/product/verify
// Called after Paystack popup success for a product purchase.
// Verifies with Paystack, records in product_purchases, returns
// the product's cta_url so the client can redirect.
//
// Security: userId taken from session, NOT request body.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { createClient as createAuthClient } from '@/lib/supabase/server';

const supabase = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY || '';

export async function POST(req: NextRequest) {
  try {
    // ── 1. Auth ──────────────────────────────────────────────────
    const authClient = await createAuthClient();
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ── 2. Parse body ────────────────────────────────────────────
    const { reference, productId } = await req.json();
    if (!reference || !productId) {
      return NextResponse.json({ error: 'Missing reference or productId' }, { status: 400 });
    }

    // ── 3. Load product ──────────────────────────────────────────
    const { data: product, error: prodError } = await supabase
      .from('products')
      .select('id, name, price, currency, cta_url, published')
      .eq('id', productId)
      .single();

    if (prodError || !product || !product.published) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    // ── 4. Check not already purchased ──────────────────────────
    const { data: existing } = await supabase
      .from('product_purchases')
      .select('id')
      .eq('user_id', user.id)
      .eq('product_id', productId)
      .single();

    if (existing) {
      return NextResponse.json({
        success:     true,
        alreadyOwned: true,
        redirectUrl: product.cta_url,
      });
    }

    // ── 5. Verify with Paystack ──────────────────────────────────
    let paystackData: any = null;

    if (PAYSTACK_SECRET) {
      const verifyRes = await fetch(
        `https://api.paystack.co/transaction/verify/${reference}`,
        { headers: { Authorization: `Bearer ${PAYSTACK_SECRET}` } }
      );
      const verifyJson = await verifyRes.json();

      if (!verifyJson.status || verifyJson.data?.status !== 'success') {
        return NextResponse.json(
          { error: 'Payment verification failed', details: verifyJson.message },
          { status: 400 }
        );
      }
      paystackData = verifyJson.data;
    } else {
      // Dev mode — no Paystack keys
      paystackData = { reference, status: 'success', amount: 0, currency: 'NGN' };
    }

    // ── 6. Record purchase ───────────────────────────────────────
    await supabase.from('product_purchases').insert({
      user_id:       user.id,
      product_id:    productId,
      product_name:  product.name,
      amount_paid:   paystackData.amount ? paystackData.amount / 100 : product.price,
      currency:      paystackData.currency || 'NGN',
      reference,
      paystack_data: paystackData,
    });

    // ── 7. Audit log ─────────────────────────────────────────────
    try {
      await supabase.from('audit_logs').insert({
        user_id:     user.id,
        action:      'product_purchase',
        entity_type: 'product',
        entity_id:   productId,
        details:     {
          product_name: product.name,
          amount: paystackData.amount,
          currency: paystackData.currency,
          reference,
        },
      });
    } catch {} // Non-critical

    // ── 8. Notification ──────────────────────────────────────────
    try {
      await supabase.from('notifications').insert({
        user_id: user.id,
        type:    'payment',
        title:   `Purchase confirmed: ${product.name}`,
        message: `Your purchase of "${product.name}" was successful. Click to access it.`,
        link:    product.cta_url,
      });
    } catch {} // Non-critical

    return NextResponse.json({
      success:     true,
      productName: product.name,
      redirectUrl: product.cta_url,
    });

  } catch (err: any) {
    console.error('[product/verify]', err);
    return NextResponse.json({ error: 'Verification failed' }, { status: 500 });
  }
}
