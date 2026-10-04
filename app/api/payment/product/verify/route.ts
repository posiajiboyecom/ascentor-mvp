import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY;

export async function POST(req: NextRequest) {
  try {
    const { reference, productId } = await req.json();

    if (!reference || !productId) {
      return NextResponse.json({ success: false, error: 'Missing reference or product' }, { status: 400 });
    }

    if (!PAYSTACK_SECRET) {
      return NextResponse.json({ success: false, error: 'Payment system misconfigured' }, { status: 500 });
    }

    const verifyRes = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      {
        headers: { Authorization: `Bearer ${PAYSTACK_SECRET}` },
        cache: 'no-store',
      }
    );
    const verifyData = await verifyRes.json();

    if (!verifyData.status || verifyData.data?.status !== 'success') {
      console.error('[payment/product/verify] Paystack verification failed:', verifyData.message);
      return NextResponse.json({ success: false, error: 'Payment not verified' }, { status: 400 });
    }

    const tx = verifyData.data;
    const userId = tx.metadata?.user_id;
    const metadataProductId = tx.metadata?.product_id;

    if (!userId) {
      return NextResponse.json({ success: false, error: 'Missing user in payment metadata' }, { status: 400 });
    }

    if (metadataProductId !== productId) {
      return NextResponse.json({ success: false, error: 'Product mismatch' }, { status: 400 });
    }

    const { data: product, error: productError } = await supabaseAdmin
      .from('products')
      .select('*')
      .eq('id', productId)
      .single();

    if (productError || !product) {
      console.error('[payment/product/verify] Product not found:', productError?.message);
      return NextResponse.json({ success: false, error: 'Product not found' }, { status: 404 });
    }

    // Idempotency - don't duplicate purchases
    const { data: existing } = await supabaseAdmin
      .from('product_purchases')
      .select('id')
      .eq('reference', reference)
      .maybeSingle();

    if (!existing) {
      await supabaseAdmin.from('product_purchases').insert({
        user_id:       userId,
        product_id:    productId,
        product_name:  product.name,
        amount_paid:   tx.amount ? tx.amount / 100 : 0,
        currency:      tx.currency || 'NGN',
        reference:     reference,
        paystack_data: tx,
        created_at:    new Date().toISOString(),
      });
    }

    return NextResponse.json({ success: true, redirectUrl: product.cta_url });
  } catch (err: any) {
    console.error('[payment/product/verify] Unexpected error:', err.message);
    return NextResponse.json({ success: false, error: 'Verification failed' }, { status: 500 });
  }
}
