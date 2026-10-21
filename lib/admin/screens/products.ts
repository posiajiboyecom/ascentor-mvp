// lib/admin/screens/products.ts
// Revenue · Shop products, over the same products table the shop editor (/admin/shop/products) uses.
import 'server-only';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { naira, count, isMissingSchema } from '@/lib/admin/revenue-util';
import type { ScreenModule, ScreenSpec, ActionResult } from '@/lib/admin/types';

export const spec: ScreenSpec = {
  area: "products",
  group: "Revenue",
  title: "Shop products",
  sub: "Merch, journals and digital products in the member shop.",
  cols: [
    "Product",
    "Category",
    "Price",
    "Stock",
    "Sold",
    "Status"
  ],
  statusCol: 5,
  actions: [
    {
      id: "publish",
      label: "Publish",
      col: 5,
      to: "Published"
    },
    {
      id: "mark-out-of-stock",
      label: "Mark out of stock",
      col: 5,
      to: "Out of stock"
    },
    {
      id: "hide",
      label: "Hide",
      col: 5,
      to: "Draft"
    }
  ],
  buttons: [
    {
      id: "new-product",
      label: "New product",
      href: "/admin/shop/products"
    }
  ]
};

type P = { id: string; name: string; shop_category: string | null; price_ngn: number | null; stock: number | null; sold_count: number | null; published: boolean | null };

const statusOf = (p: P) => (!p.published ? 'Draft' : p.stock != null && p.stock <= 0 ? 'Out of stock' : 'Published');

const screen: ScreenModule = {
  spec,
  async load() {
    const { data, error } = await supabaseAdmin.from('products')
      .select('id, name, shop_category, price_ngn, stock, sold_count, published')
      .order('sort_order', { ascending: true }).limit(200);
    if (error) {
      if (isMissingSchema(error)) return { rows: [], note: 'The shop tables are not set up yet (20261020_shop.sql).' };
      throw new Error(error.message);
    }
    return {
      rows: ((data ?? []) as P[]).map((p) => ({
        id: p.id,
        cells: [
          p.name,
          p.shop_category || '\-',
          p.price_ngn ? naira(p.price_ngn) : 'Free',
          p.stock == null ? 'Unlimited' : count(p.stock),
          count(p.sold_count ?? 0),
          statusOf(p),
        ],
      })),
    };
  },

  async act(_ctx, actionId, rowId): Promise<ActionResult> {
    const { data: p } = await supabaseAdmin.from('products').select('id, name, shop_category, price_ngn, stock, sold_count, published').eq('id', rowId).maybeSingle();
    if (!p) return { ok: false, error: 'That product no longer exists.' };
    const now = new Date().toISOString();

    if (actionId === 'publish') {
      if (p.published) return { ok: false, error: p.stock != null && p.stock <= 0 ? 'This product is published but out of stock. Add stock in the shop editor.' : 'This product is already published.' };
      const { error } = await supabaseAdmin.from('products').update({ published: true, updated_at: now }).eq('id', rowId);
      if (error) return { ok: false, error: 'We could not publish this product.' };
      return { ok: true, message: p.stock != null && p.stock <= 0 ? 'Published, but it shows as out of stock until you add stock.' : undefined };
    }
    if (actionId === 'mark-out-of-stock') {
      if (p.stock === 0) return { ok: false, error: 'This product is already out of stock.' };
      const { error } = await supabaseAdmin.from('products').update({ stock: 0, updated_at: now }).eq('id', rowId);
      if (error) return { ok: false, error: 'We could not update the stock.' };
      return { ok: true };
    }
    if (actionId === 'hide') {
      if (!p.published) return { ok: false, error: 'This product is already hidden.' };
      const { error } = await supabaseAdmin.from('products').update({ published: false, updated_at: now }).eq('id', rowId);
      if (error) return { ok: false, error: 'We could not hide this product.' };
      return { ok: true };
    }
    return { ok: false, error: 'Unknown action.' };
  },
};

export default screen;
