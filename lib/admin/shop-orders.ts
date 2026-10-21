// lib/admin/shop-orders.ts
// Server-only. Shop order fulfilment rules shared by the console Shop orders screen. The transition table mirrors
// app/api/admin/shop/orders/route.ts (keep the two in step) and the shipped/delivered email is the same message.
import 'server-only';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { sendEmail } from '@/lib/nodemailer';
import { brandedEmailLayout, p, esc } from '@/lib/emailTemplate';

export const NEXT: Record<string, string[]> = {
  pending: ['paid', 'cancelled'],
  paid: ['packing', 'shipped', 'cancelled'],
  packing: ['shipped', 'cancelled'],
  shipped: ['delivered'],
  ready: ['cancelled'],
  delivered: [],
  cancelled: [],
};

export type MoveResult = { ok: true; emailed: boolean } | { ok: false; error: string };

export async function moveOrder(id: string, status: 'packing' | 'shipped' | 'delivered'): Promise<MoveResult> {
  const { data: order, error: readErr } = await supabaseAdmin.from('shop_orders').select('*').eq('id', id).maybeSingle();
  if (readErr) return { ok: false, error: 'We could not load this order.' };
  if (!order) return { ok: false, error: 'Order not found.' };
  if (!(NEXT[order.status] || []).includes(status)) return { ok: false, error: `An order that is ${order.status} cannot move to ${status}.` };

  const { error } = await supabaseAdmin.from('shop_orders').update({ status, updated_at: new Date().toISOString() }).eq('id', id).eq('status', order.status);
  if (error) return { ok: false, error: 'We could not update this order.' };

  let emailed = false;
  if ((status === 'shipped' || status === 'delivered') && order.email) {
    const first = esc((order.full_name || '').split(' ')[0] || 'there');
    const where = order.shipping_key === 'summit' ? ' It is ready for pick up at the Summit.' : '';
    const line = status === 'shipped'
      ? `Good news, your order ${esc(order.order_no)} is on its way.${where}`
      : `Your order ${esc(order.order_no)} has been delivered. We hope you enjoy it.`;
    try {
      await sendEmail({
        to: order.email,
        subject: status === 'shipped' ? `Your order ${order.order_no} has shipped` : `Your order ${order.order_no} was delivered`,
        html: brandedEmailLayout({
          preheader: status === 'shipped' ? 'Your order is on its way' : 'Your order has arrived',
          eyebrow: 'Ascentor Shop',
          heading: status === 'shipped' ? 'Your order has shipped' : 'Your order was delivered',
          content: p(`Hi ${first},`) + p(line) + p('Questions? Just reply to this email.'),
          recipient: order.email,
        }),
      });
      emailed = true;
    } catch (e) {
      console.error('[admin shop orders email]', e);
    }
  }
  return { ok: true, emailed };
}
