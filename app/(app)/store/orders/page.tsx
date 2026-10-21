import Link from 'next/link';
import { DELIVERY_NOTE, RETURNS_HEADING, RETURNS_POLICY } from '@/lib/shop-policy';
import { redirect } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { Aside, BackLink, Banner, Empty, GoLink, Page, Tag, Title } from '@/components/rx/ui';
import { ClearCart, DownloadButton } from '@/components/rx/shop/OrderBits';
import { naira, SHOP_SHIPPING, type ShopShippingKey } from '@/lib/shop-shared';

export const metadata = { title: 'My orders' };

type Item = { product_id: string | null; name: string; size: string | null; qty: number; unit_price: number; fulfilment: string | null };
type Order = {
  id: string; order_no: string; status: string; shipping_key: string | null; shipping_fee: number | null;
  total: number; created_at: string; items: Item[];
};

const STATUS_LABEL: Record<string, string> = {
  pending: 'Awaiting payment', paid: 'Paid', packing: 'Packing', shipped: 'On the way',
  delivered: 'Delivered', ready: 'Ready', cancelled: 'Cancelled',
};
const STEPS = ['paid', 'packing', 'shipped', 'delivered'];
const STEP_LABEL = ['Paid', 'Packing', 'On the way', 'Delivered'];

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'Africa/Lagos' });

function Timeline({ status }: { status: string }) {
  const at = STEPS.indexOf(status);
  return (
    <ol className="rx-row rx-nw" style={{ gap: 6, listStyle: 'none', margin: 0, padding: 0 }} aria-label={`Order status: ${STATUS_LABEL[status]}`}>
      {STEP_LABEL.map((l, i) => (
        <li key={l} style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', height: 4, borderRadius: 2, background: i <= at ? 'var(--rx-rust)' : 'var(--rx-border)', marginBottom: 6 }} />
          <span className="rx-sm" style={{ fontWeight: i === at ? 700 : 400, color: i === at ? 'var(--rx-ink)' : undefined }}>{l}</span>
        </li>
      ))}
    </ol>
  );
}

export default async function StoreOrdersPage({ searchParams }: { searchParams: Promise<{ paid?: string; order?: string }> }) {
  const sp = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  let orders: Order[] = [];
  try {
    const { data, error } = await supabase
      .from('shop_orders')
      .select('id, order_no, status, shipping_key, shipping_fee, total, created_at, shop_order_items(product_id, name, size, qty, unit_price, fulfilment)')
      .neq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(50);
    if (!error && data) {
      orders = (data as unknown as (Omit<Order, 'items'> & { shop_order_items: Item[] | null })[]).map(({ shop_order_items, ...o }) => ({ ...o, items: shop_order_items ?? [] }));
    }
  } catch { /* migration not applied yet: empty state */ }

  const confirmed = sp.paid === '1';
  const processing = sp.paid === 'processing';

  return (
    <Page>
      {(confirmed || processing) && <ClearCart />}
      <BackLink href="/store">Shop</BackLink>
      <Title>My orders</Title>
      {confirmed && <div style={{ marginBottom: 16 }}><Banner>Payment received. Thank you. Your order is below and a receipt is on its way to your email.</Banner></div>}
      {processing && <div style={{ marginBottom: 16 }}><Banner>We are confirming your payment. This usually takes a minute. Refresh this page shortly and your order will appear.</Banner></div>}
      <div className="rx-two">
        <div className="rx-stack">
          {orders.length === 0 && <Empty action={<Link href="/store" className="rx-btn secondary">Browse the shop</Link>}>No orders yet.</Empty>}
          {orders.map((o) => {
            const shipLabel = o.shipping_key && o.shipping_key in SHOP_SHIPPING ? SHOP_SHIPPING[o.shipping_key as ShopShippingKey].label : null;
            const hasShip = o.items.some((i) => i.fulfilment === 'ship');
            const paidOut = o.status !== 'cancelled';
            return (
              <div key={o.id} className="rx-card rx-stack-sm">
                <div className="rx-between" style={{ alignItems: 'flex-start' }}>
                  <div>
                    <p className="rx-h3">{o.order_no}</p>
                    <p className="rx-sm">{fmtDate(o.created_at)}{shipLabel && hasShip ? ` · ${shipLabel}` : !hasShip ? ' · Digital' : ''}</p>
                  </div>
                  <Tag gold={o.status === 'packing' || o.status === 'shipped'}>{STATUS_LABEL[o.status] ?? o.status}</Tag>
                </div>
                {hasShip && STEPS.includes(o.status) && <Timeline status={o.status} />}
                {o.items.map((i, k) => (
                  <div key={k} className="rx-stack-sm">
                    <div className="rx-between"><span>{i.name}{i.size ? ` (${i.size})` : ''} × {i.qty}</span><span>{naira(i.unit_price * i.qty)}</span></div>
                    {paidOut && i.product_id && i.fulfilment === 'digital' && <div><DownloadButton orderId={o.id} productId={i.product_id} label={`Get ${i.name.toLowerCase().includes('workbook') ? 'the workbook' : 'your download'}`} /></div>}
                    {paidOut && i.fulfilment === 'learn' && <GoLink href="/learn">Open in Learn</GoLink>}
                  </div>
                ))}
                <div className="rx-between rx-strong" style={{ borderTop: '1px solid var(--rx-border)', paddingTop: 10 }}><span>Total</span><span>{naira(o.total)}</span></div>
                {o.status === 'delivered' && o.items.length > 0 && o.items[0].product_id && (
                  <Link href={`/store/${o.items[0].product_id}`} className="rx-link" style={{ fontSize: 14 }}>Buy again<ArrowRight aria-hidden /></Link>
                )}
              </div>
            );
          })}
        </div>
        <Aside>
          <p className="rx-label">Delivery</p>
          <p className="rx-p">{DELIVERY_NOTE}</p>
          <p className="rx-label">{RETURNS_HEADING}</p>
          <p className="rx-p">{RETURNS_POLICY}</p>
          <GoLink href="/contact">Help with an order</GoLink>
        </Aside>
      </div>
    </Page>
  );
}
