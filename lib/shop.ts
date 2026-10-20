// lib/shop.ts
// Shop catalogue, delivery options and SERVER-SIDE cart pricing. NGN only.
// The browser never decides a price: checkout re-reads every product from the database,
// re-checks size and stock, and the resulting total is what Paystack is asked to charge
// and what settlement later compares the payment against (see lib/paymentSettlement.ts).

import 'server-only';
import { createHmac, timingSafeEqual } from 'crypto';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { SHOP_SHIPPING, type ShopShippingKey, type ShopProduct } from '@/lib/shop-shared';

export type CartLineInput = { productId: string; size?: string | null; qty: number };

export interface PricedLine {
  product: ShopProduct;
  size: string | null;
  qty: number;
  unitPrice: number;
  lineTotal: number;
}

export interface PricedCart {
  lines: PricedLine[];
  subtotal: number;
  needsShipping: boolean;
  shippingFee: number;
  total: number;
}

export type PriceResult = { ok: true; cart: PricedCart } | { ok: false; error: string };

const PRODUCT_COLUMNS =
  'id, slug, name, tagline, description, image_url, badge, shop_category, fulfilment, price_ngn, stock, sizes, file_path, lead_capture, published, min_plan, sort_order, is_featured';

export async function priceCart(items: CartLineInput[], shippingKey: ShopShippingKey | null): Promise<PriceResult> {
  if (!items.length) return { ok: false, error: 'Your cart is empty.' };

  // Merge duplicate lines (same product + size) before checking stock.
  const merged = new Map<string, CartLineInput>();
  for (const it of items) {
    const key = `${it.productId}|${it.size ?? ''}`;
    const prev = merged.get(key);
    merged.set(key, { productId: it.productId, size: it.size ?? null, qty: (prev?.qty ?? 0) + it.qty });
  }

  const ids = [...new Set([...merged.values()].map((l) => l.productId))];
  const { data, error } = await supabaseAdmin.from('products').select(PRODUCT_COLUMNS).in('id', ids);
  if (error) return { ok: false, error: 'We could not load your cart. Please try again.' };
  const byId = new Map((data as ShopProduct[]).map((p) => [p.id, p]));

  const lines: PricedLine[] = [];
  const perProduct = new Map<string, number>();
  for (const l of merged.values()) {
    const product = byId.get(l.productId);
    if (!product || !product.published) return { ok: false, error: 'An item in your cart is no longer available.' };
    if (product.price_ngn <= 0) return { ok: false, error: `${product.name} is free. Use its download button instead.` };
    if (product.sizes?.length && (!l.size || !product.sizes.includes(l.size))) {
      return { ok: false, error: `Pick a size for ${product.name}.` };
    }
    if (!product.sizes?.length && l.size) l.size = null;
    if (l.qty < 1 || l.qty > 20) return { ok: false, error: 'Quantity must be between 1 and 20.' };
    // Digital goods are bought once per order line.
    if (product.fulfilment !== 'ship' && l.qty > 1) l.qty = 1;
    perProduct.set(product.id, (perProduct.get(product.id) ?? 0) + l.qty);
    lines.push({ product, size: l.size ?? null, qty: l.qty, unitPrice: product.price_ngn, lineTotal: product.price_ngn * l.qty });
  }
  for (const [id, qty] of perProduct) {
    const p = byId.get(id)!;
    if (p.stock != null && qty > p.stock) {
      return { ok: false, error: p.stock <= 0 ? `${p.name} is out of stock.` : `Only ${p.stock} of ${p.name} left.` };
    }
  }

  const needsShipping = lines.some((l) => l.product.fulfilment === 'ship');
  if (needsShipping && !shippingKey) return { ok: false, error: 'Choose a delivery option.' };
  const shippingFee = needsShipping && shippingKey ? SHOP_SHIPPING[shippingKey].fee : 0;
  const subtotal = lines.reduce((a, l) => a + l.lineTotal, 0);
  return { ok: true, cart: { lines, subtotal, needsShipping, shippingFee, total: subtotal + shippingFee } };
}

// ── Signed download links (for guests and emailed links) ─────────────────────

function secret(): string {
  const key = process.env.APP_SECRET_KEY;
  if (!key) throw new Error('APP_SECRET_KEY env var is not set');
  return key;
}

export function signDownload(scope: string): string {
  return createHmac('sha256', secret()).update(`shop-download:${scope}`).digest('base64url');
}

export function verifyDownload(scope: string, token: string): boolean {
  try {
    const a = Buffer.from(signDownload(scope));
    const b = Buffer.from(token);
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export const orderDownloadUrl = (appUrl: string, orderId: string, productId: string) =>
  `${appUrl}/api/shop/download?order=${orderId}&product=${productId}&t=${signDownload(`order:${orderId}:${productId}`)}`;

export const freeDownloadUrl = (appUrl: string, productId: string, email: string) =>
  `${appUrl}/api/shop/download?free=${productId}&email=${encodeURIComponent(email)}&t=${signDownload(`free:${productId}:${email}`)}`;

/** Short-lived signed link to a private PDF. */
export async function signedFileUrl(path: string, seconds = 120): Promise<string | null> {
  const { data, error } = await supabaseAdmin.storage.from('shop-files').createSignedUrl(path, seconds);
  return error ? null : data.signedUrl;
}
