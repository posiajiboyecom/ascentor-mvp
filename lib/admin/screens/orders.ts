// lib/admin/screens/orders.ts
// Revenue · Shop orders, over shop_orders + shop_order_items (the same data and transition rules as /admin/shop/orders).
import 'server-only';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { moveOrder } from '@/lib/admin/shop-orders';
import { refundReference } from '@/lib/admin/refunds';
import { naira, count, isMissingSchema, csvCell } from '@/lib/admin/revenue-util';
import { SHOP_SHIPPING, type ShopShippingKey } from '@/lib/shop-shared';
import type { ScreenModule, ScreenSpec, ActionResult } from '@/lib/admin/types';

export const spec: ScreenSpec = {
  area: "orders",
  group: "Revenue",
  title: "Shop orders",
  sub: "Pack, ship and track orders. Summit pickups are collected at the merch desk.",
  cols: [
    "Order",
    "Member",
    "Items",
    "Delivery",
    "Total",
    "Status"
  ],
  statusCol: 5,
  actions: [
    {
      id: "mark-packed",
      label: "Mark packed",
      col: 5,
      to: "Packing",
      when: "Paid"
    },
    {
      id: "mark-shipped",
      label: "Mark shipped",
      col: 5,
      to: "Shipped",
      when: "Packing"
    },
    {
      id: "mark-delivered",
      label: "Mark delivered",
      col: 5,
      to: "Delivered",
      when: "Shipped"
    },
    {
      id: "refund",
      label: "Refund",
      col: 5,
      to: "Refunded",
      admin: true,
      danger: true,
      confirm: "Refund this order through Paystack?"
    }
  ],
  quick: 1,
  buttons: [
    {
      id: "summit-pickup-list",
      label: "Summit pickup list"
    }
  ]
};

const LABEL: Record<string, string> = { pending: 'Pending', paid: 'Paid', packing: 'Packing', shipped: 'Shipped', ready: 'Ready', delivered: 'Delivered', cancelled: 'Cancelled', refunded: 'Refunded' };
const PAID_LIKE = ['paid', 'packing', 'ready', 'shipped', 'delivered'];

const deliveryOf = (key: string | null) => (key && key in SHOP_SHIPPING ? (key === 'summit' ? 'Summit pickup' : SHOP_SHIPPING[key as ShopShippingKey].label) : 'Digital');
const itemText = (i: { name: string; size: string | null; qty: number }) => `${i.name}${i.size ? ` ${i.size}` : ''}${i.qty > 1 ? ` x${i.qty}` : ''}`;

async function itemsFor(orderIds: string[]): Promise<Record<string, string[]>> {
  const out: Record<string, string[]> = {};
  if (!orderIds.length) return out;
  const { data } = await supabaseAdmin.from('shop_order_items').select('order_id, name, size, qty').in('order_id', orderIds);
  for (const i of data ?? []) (out[i.order_id] ||= []).push(itemText(i as any));
  return out;
}

const head = (q: any) => q.then((r: { count: number | null }) => r.count ?? 0);

const screen: ScreenModule = {
  spec,
  async load() {
    const { data, error } = await supabaseAdmin.from('shop_orders')
      .select('id, order_no, full_name, email, shipping_key, total, status')
      .order('created_at', { ascending: false }).limit(200);
    if (error) {
      if (isMissingSchema(error)) return { rows: [], note: 'The shop tables are not set up yet (20261020_shop.sql).' };
      throw new Error(error.message);
    }
    const items = await itemsFor((data ?? []).map((o: any) => o.id));
    const q = () => supabaseAdmin.from('shop_orders').select('*', { count: 'exact', head: true });
    const [toPack, shipped, pickups, refunds] = await Promise.all([
      head(q().eq('status', 'paid')),
      head(q().eq('status', 'shipped')),
      head(q().eq('shipping_key', 'summit').in('status', ['paid', 'packing', 'ready', 'shipped'])),
      head(q().eq('status', 'refunded')),
    ]);
    return {
      rows: (data ?? []).map((o: any) => ({
        id: o.id,
        cells: [o.order_no, o.full_name || o.email || '\-', (items[o.id] ?? []).join(', ') || '\-', deliveryOf(o.shipping_key), naira(Number(o.total)), LABEL[o.status] ?? o.status],
      })),
      kpis: [
        { label: 'To pack', value: count(toPack) },
        { label: 'Shipped', value: count(shipped) },
        { label: 'Summit pickups', value: count(pickups), note: 'Not yet collected' },
        { label: 'Refunds', value: count(refunds) },
      ],
      note: (data?.length ?? 0) >= 200 ? 'Showing the 200 newest orders.' : undefined,
    };
  },

  async act(_ctx, actionId, rowId): Promise<ActionResult> {
    if (actionId === 'mark-packed' || actionId === 'mark-shipped' || actionId === 'mark-delivered') {
      const to = actionId === 'mark-packed' ? 'packing' : actionId === 'mark-shipped' ? 'shipped' : 'delivered';
      const r = await moveOrder(rowId, to);
      if (!r.ok) return r;
      return { ok: true, message: r.emailed ? `Order marked ${to}. The customer was emailed.` : undefined };
    }
    if (actionId === 'refund') {
      const { data: o } = await supabaseAdmin.from('shop_orders').select('id, status, reference, order_no').eq('id', rowId).maybeSingle();
      if (!o) return { ok: false, error: 'Order not found.' };
      if (o.status === 'refunded') return { ok: false, error: 'This order was already refunded.' };
      if (!PAID_LIKE.includes(o.status)) return { ok: false, error: `An order that is ${o.status} was not paid, so there is nothing to refund.` };
      if (!o.reference) return { ok: false, error: 'This order has no payment reference. Use the Paystack dashboard.' };
      const r = await refundReference(o.reference);
      if (!r.ok) return { ok: false, error: r.error };
      await supabaseAdmin.from('shop_orders').update({ status: 'refunded', updated_at: new Date().toISOString() }).eq('id', rowId);
      return { ok: true, message: 'Refund requested through Paystack. Stock is not put back automatically.' };
    }
    return { ok: false, error: 'Unknown action.' };
  },

  async button(_ctx, buttonId): Promise<ActionResult> {
    if (buttonId !== 'summit-pickup-list') return { ok: false, error: 'This button is not connected yet.' };
    const { data, error } = await supabaseAdmin.from('shop_orders')
      .select('id, order_no, full_name, email, phone, status')
      .eq('shipping_key', 'summit').in('status', PAID_LIKE).order('created_at', { ascending: true }).limit(2000);
    if (error) return { ok: false, error: 'We could not load the pickup list.' };
    const items = await itemsFor((data ?? []).map((o: any) => o.id));
    const lines = [
      ['Order', 'Name', 'Phone', 'Email', 'Items', 'Status'].map(csvCell).join(','),
      ...(data ?? []).map((o: any) => [o.order_no, o.full_name ?? '', o.phone ?? '', o.email ?? '', (items[o.id] ?? []).join('; '), LABEL[o.status] ?? o.status].map(csvCell).join(',')),
    ];
    return { ok: true, message: `Pickup list ready: ${data?.length ?? 0} orders.`, download: { filename: 'summit-pickup-list.csv', mime: 'text/csv', content: lines.join('\n') } };
  },

  async badge() {
    const { count: n } = await supabaseAdmin.from('shop_orders').select('*', { count: 'exact', head: true }).eq('status', 'paid');
    return n ?? 0;
  },
};

export default screen;
