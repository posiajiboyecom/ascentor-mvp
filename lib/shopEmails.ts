// lib/shopEmails.ts
// Receipt for a paid shop order, with download links for PDFs and a note for physical goods.
// Failures here never undo a paid order (the caller logs and moves on).

import 'server-only';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { sendEmail } from '@/lib/nodemailer';
import { brandedEmailLayout, esc, goldButton, p, summaryBox, summaryRow } from '@/lib/emailTemplate';
import { naira, SHOP_SHIPPING, type ShopShippingKey } from '@/lib/shop-shared';
import { orderDownloadUrl } from '@/lib/shop';
import { notifyAdmins } from '@/lib/paymentSettlement';

const APP_URL = process.env.NEXT_PUBLIC_URL || 'https://joinascentor.com';

export async function deliverShopEmails(orderId: string): Promise<void> {
  const { data: order } = await supabaseAdmin.from('shop_orders').select('*').eq('id', orderId).maybeSingle();
  if (!order) return;
  const { data: items } = await supabaseAdmin.from('shop_order_items').select('*').eq('order_id', orderId);
  const lines = items ?? [];

  const rows = lines.map((i) =>
    summaryRow(esc(i.name), `${i.qty} × ${naira(i.unit_price)}${i.size ? ` · ${esc(i.size)}` : ''}`)).join('')
    + (order.shipping_fee ? summaryRow('Delivery', naira(order.shipping_fee)) : '')
    + summaryRow('Total', naira(order.total));

  const downloads = lines.filter((i) => i.fulfilment === 'digital' && i.product_id);
  const hasShip = lines.some((i) => i.fulfilment === 'ship');
  const hasLearn = lines.some((i) => i.fulfilment === 'learn');
  const shipLabel = order.shipping_key && SHOP_SHIPPING[order.shipping_key as ShopShippingKey]?.label;

  const content =
    p(`Thank you${order.full_name ? `, ${esc(String(order.full_name).split(' ')[0])}` : ''}. Your payment went through.`) +
    summaryBox(summaryRow('Order', esc(order.order_no)) + rows) +
    downloads.map((d) => goldButton(`Download ${esc(d.name)}`, orderDownloadUrl(APP_URL, orderId, d.product_id))).join('') +
    (hasLearn ? p('Your course is now on your Learn page.') + goldButton('Open Learn', `${APP_URL}/learn`) : '') +
    (hasShip ? p(`We are packing your order. ${shipLabel ? `Delivery: <strong>${esc(shipLabel)}</strong>. ` : ''}Lagos takes 2 to 4 working days, the rest of Nigeria 5 to 7. Summit pickups are at the merch desk.`) : '') +
    p('The Ascentor Team');

  await sendEmail({
    to: order.email,
    subject: `Your Ascentor order ${order.order_no}`,
    html: brandedEmailLayout({ preheader: `Order ${order.order_no} confirmed`, eyebrow: 'Shop', heading: 'Order confirmed.', recipient: order.email, content }),
  });

  await notifyAdmins({
    title: `New shop order ${order.order_no}`,
    message: `${order.full_name ?? order.email} paid ${naira(order.total)}${hasShip ? ' (needs packing)' : ''}.`,
    link: '/admin/shop/orders',
    type: 'shop_order',
  });
}
