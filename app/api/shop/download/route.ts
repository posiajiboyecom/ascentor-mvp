// GET /api/shop/download: redirects to a 2-minute signed link for a PDF in the private bucket.
//   ?order=<id>&product=<id>&t=<token>   paid order (emailed link, works for guests)
//   ?order=<id>&product=<id>             signed-in owner of a paid order
//   ?free=<productId>&email=<e>&t=<token> free item after the name + email form
// The file path is never sent to the browser.

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createAuthClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { signedFileUrl, verifyDownload } from '@/lib/shop';

const PAID = ['paid', 'packing', 'shipped', 'delivered', 'ready'];
const deny = (status = 403) => NextResponse.json({ error: 'This download link is not valid.' }, { status });

export async function GET(req: NextRequest) {
  const q = new URL(req.url).searchParams;
  const token = q.get('t') ?? '';
  const orderId = q.get('order');
  const productId = q.get('product');
  const freeId = q.get('free');
  let filePath: string | null = null;

  if (freeId) {
    const email = q.get('email') ?? '';
    if (!email || !verifyDownload(`free:${freeId}:${email}`, token)) return deny();
    const { data: product } = await supabaseAdmin.from('products')
      .select('file_path, price_ngn, published').eq('id', freeId).maybeSingle();
    if (!product?.published || product.price_ngn > 0) return deny(404);
    filePath = product.file_path;
  } else if (orderId && productId) {
    const { data: order } = await supabaseAdmin.from('shop_orders').select('id, user_id, status').eq('id', orderId).maybeSingle();
    if (!order || !PAID.includes(order.status)) return deny();

    let allowed = !!token && verifyDownload(`order:${orderId}:${productId}`, token);
    if (!allowed) {
      const auth = await createAuthClient();
      const { data: { user } } = await auth.auth.getUser();
      allowed = !!user && order.user_id === user.id;
    }
    if (!allowed) return deny();

    const { data: item } = await supabaseAdmin.from('shop_order_items')
      .select('id').eq('order_id', orderId).eq('product_id', productId).eq('fulfilment', 'digital').maybeSingle();
    if (!item) return deny(404);
    const { data: product } = await supabaseAdmin.from('products').select('file_path').eq('id', productId).maybeSingle();
    filePath = product?.file_path ?? null;
  } else {
    return deny(400);
  }

  const url = filePath ? await signedFileUrl(filePath) : null;
  if (!url) return NextResponse.json({ error: 'This file is not available yet. Please contact support.' }, { status: 404 });
  return NextResponse.redirect(url);
}
