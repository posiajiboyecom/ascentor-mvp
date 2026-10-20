// /api/admin/shop/orders: list with items, move through fulfilment

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { logAudit } from '@/lib/audit-log';
import { parseJson } from '@/lib/validation/http';
import * as adminSchemas from '@/lib/validation/schemas/admin';
import { sendEmail } from '@/lib/nodemailer';
import { brandedEmailLayout, p, esc } from '@/lib/emailTemplate';
import { shopAdmin, forbidden, migrationMissing, MIGRATION_NOTICE } from '../_auth';

const NEXT: Record<string, string[]> = {
  pending: ['paid', 'cancelled'],
  paid: ['packing', 'shipped', 'cancelled'],
  packing: ['shipped', 'cancelled'],
  shipped: ['delivered'],
  ready: ['cancelled'],
  delivered: [],
  cancelled: [],
};

export async function GET() {
  if (!(await shopAdmin())) return forbidden();
  const { data, error } = await supabaseAdmin
    .from('shop_orders')
    .select('*, items:shop_order_items(*)')
    .order('created_at', { ascending: false })
    .limit(500);
  if (error) {
    if (migrationMissing(error)) return NextResponse.json({ orders: [], migrationNeeded: true, notice: MIGRATION_NOTICE });
    console.error('[shop orders GET]', error);
    return NextResponse.json({ error: 'Failed to load orders' }, { status: 500 });
  }
  return NextResponse.json({ orders: data || [] });
}

export async function PATCH(req: NextRequest) {
  const admin = await shopAdmin();
  if (!admin) return forbidden();
  const parsed = await parseJson(req, adminSchemas.shopOrderUpdate);
  if (!parsed.ok) return parsed.response;
  const { id, status } = parsed.data;

  const { data: order, error: readErr } = await supabaseAdmin.from('shop_orders').select('*').eq('id', id).maybeSingle();
  if (readErr) {
    if (migrationMissing(readErr)) return NextResponse.json({ error: MIGRATION_NOTICE, migrationNeeded: true }, { status: 503 });
    console.error('[shop orders PATCH read]', readErr);
    return NextResponse.json({ error: 'Failed to load order' }, { status: 500 });
  }
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  if (!(NEXT[order.status] || []).includes(status)) {
    return NextResponse.json({ error: `An order that is ${order.status} cannot move to ${status}.` }, { status: 409 });
  }

  const { error } = await supabaseAdmin.from('shop_orders').update({ status, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) {
    console.error('[shop orders PATCH]', error);
    return NextResponse.json({ error: 'Failed to update order' }, { status: 500 });
  }

  await logAudit(supabaseAdmin, { userId: admin.id, action: 'shop_order_status', entityType: 'shop_order', entityId: id, details: { order_no: order.order_no, from: order.status, to: status } });

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
      console.error('[shop orders email]', e);
    }
  }

  return NextResponse.json({ success: true, status, emailed });
}
