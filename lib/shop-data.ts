// lib/shop-data.ts
// Server-side reads for the shop, shared by the public site (/shop) and the member app (/store).
// Uses the service role so the private `file_path` can be reduced to a boolean before anything
// reaches the browser. Only published products are returned.

import 'server-only';
import { supabaseAdmin } from '@/lib/supabase/admin';
import type { PublicShopProduct, ShopProduct } from '@/lib/shop-shared';

const COLUMNS =
  'id, slug, name, tagline, description, image_url, hover_image_url, gallery_urls, badge, shop_category, fulfilment, price_ngn, stock, sizes, file_path, lead_capture, published, min_plan, sort_order, is_featured';

export type ShopCard = PublicShopProduct & { hasFile: boolean };

const strip = (p: ShopProduct): ShopCard => {
  const { file_path, ...rest } = p;
  return { ...rest, hasFile: !!file_path };
};

export async function listShopProducts(): Promise<ShopCard[]> {
  const { data } = await supabaseAdmin
    .from('products').select(COLUMNS).eq('published', true)
    .order('sort_order', { ascending: true }).order('created_at', { ascending: false });
  return ((data ?? []) as ShopProduct[]).map(strip);
}

/** By slug, falling back to id (so old /products/<uuid> links keep working). */
export async function getShopProduct(slugOrId: string): Promise<ShopCard | null> {
  const isUuid = /^[0-9a-f-]{36}$/i.test(slugOrId);
  const q = supabaseAdmin.from('products').select(COLUMNS).eq('published', true);
  const { data } = await (isUuid ? q.eq('id', slugOrId) : q.eq('slug', slugOrId)).maybeSingle();
  return data ? strip(data as ShopProduct) : null;
}

export async function listRelated(excludeId: string, limit = 3): Promise<ShopCard[]> {
  const all = await listShopProducts();
  return all.filter((p) => p.id !== excludeId).slice(0, limit);
}
