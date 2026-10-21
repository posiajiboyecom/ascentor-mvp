'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { ORDER_STATUSES, SHOP_SHIPPING, naira } from '@/lib/shop-shared';

// /admin/shop/orders: see orders and move them through fulfilment.

const brand = {
  font: "'Metropolis', system-ui, sans-serif",
  gold: '#E8A020', goldMuted: 'rgba(232,160,32,0.08)', goldBorder: 'rgba(232,160,32,0.22)',
  teal: '#14B8A6', red: '#EF4444', blue: '#60A5FA',
  card: 'var(--admin-bg-deep)', panel: 'var(--admin-bg-card)', border: 'var(--admin-border)',
  text: 'var(--admin-text)', heading: 'var(--admin-text-heading)', muted: 'var(--admin-text-muted)', faint: 'var(--admin-text-faint)',
};

type Item = { id: string; name: string; size: string | null; qty: number; unit_price: number; fulfilment: string };
type Order = {
  id: string; order_no: string; email: string; full_name: string | null; phone: string | null; status: string;
  shipping_key: string | null; shipping_fee: number; subtotal: number; total: number;
  address: Record<string, string> | null; created_at: string; items: Item[];
};

// Same rules the API enforces.
const NEXT: Record<string, { to: string; label: string }[]> = {
  paid: [{ to: 'packing', label: 'Packing' }, { to: 'shipped', label: 'Shipped' }],
  packing: [{ to: 'shipped', label: 'Shipped' }],
  shipped: [{ to: 'delivered', label: 'Delivered' }],
};

const STATUS_COLOR: Record<string, string> = {
  pending: brand.faint, paid: brand.gold, packing: brand.blue, shipped: '#A78BFA',
  delivered: brand.teal, ready: brand.teal, cancelled: brand.red,
};
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const shippingLabel = (k: string | null) => (k && k in SHOP_SHIPPING ? SHOP_SHIPPING[k as keyof typeof SHOP_SHIPPING].label : 'No shipping (digital)');

export default function AdminShopOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<string>('all');
  const [sel, setSel] = useState<Order | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/shop/orders');
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'Failed to load orders');
      setOrders(j.orders || []);
      setNotice(j.migrationNeeded ? j.notice : '');
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  }

  async function move(o: Order, status: string) {
    setBusy(true); setError('');
    try {
      const res = await fetch('/api/admin/shop/orders', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: o.id, status }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'Update failed');
      const next = { ...o, status };
      setOrders(prev => prev.map(x => x.id === o.id ? next : x));
      setSel(next);
    } catch (e: any) { setError(e.message); }
    setBusy(false);
  }

  const shown = filter === 'all' ? orders : orders.filter(o => o.status === filter);
  const count = (s: string) => orders.filter(o => o.status === s).length;

  return (
    <>
      <style>{`
        .so-table th { text-align: left; font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--admin-text-muted); font-weight: 500; padding: 10px 14px; border-bottom: 1px solid var(--admin-border); white-space: nowrap; }
        .so-table td { padding: 12px 14px; border-bottom: 1px solid var(--admin-border); font-size: 13px; color: var(--admin-text); }
        .so-table tbody tr { cursor: pointer; } .so-table tbody tr:hover { background: var(--admin-bg-card); }
        .so-table tr:last-child td { border-bottom: none; }
      `}</style>
      <div style={{ fontFamily: brand.font }}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontWeight: 700, fontSize: 'clamp(24px, 3vw, 32px)', color: brand.heading, margin: 0 }}>Shop orders</h1>
          <p style={{ fontSize: 11, color: brand.muted, marginTop: 6, letterSpacing: '0.04em' }}>
            {orders.length} TOTAL · {count('paid')} TO PACK · {count('packing') + count('shipped')} IN PROGRESS
          </p>
          <div style={{ height: 1, background: `linear-gradient(90deg, ${brand.gold} 0%, transparent 60%)`, marginTop: 18 }} />
        </div>

        {notice && <div style={{ padding: '12px 16px', borderRadius: 10, marginBottom: 16, background: brand.goldMuted, border: `1px solid ${brand.goldBorder}`, color: brand.text, fontSize: 13 }}>{notice}</div>}
        {error && <p style={{ color: brand.red, fontSize: 12, marginBottom: 12 }}>{error}</p>}

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
          {['all', ...ORDER_STATUSES].map(s => (
            <button key={s} onClick={() => setFilter(s)} style={{ fontFamily: brand.font, fontSize: 12, fontWeight: 600, padding: '6px 14px', borderRadius: 999, cursor: 'pointer', background: filter === s ? brand.goldMuted : 'transparent', color: filter === s ? brand.gold : brand.muted, border: `1px solid ${filter === s ? brand.goldBorder : brand.border}` }}>
              {cap(s)}{s !== 'all' && count(s) ? ` (${count(s)})` : ''}
            </button>
          ))}
        </div>

        {loading ? (
          <p style={{ textAlign: 'center', padding: '60px 0', fontSize: 11, color: brand.faint }}>Loading orders…</p>
        ) : shown.length === 0 ? (
          <p style={{ textAlign: 'center', padding: '60px 0', fontSize: 13, color: brand.faint }}>No orders here yet.</p>
        ) : (
          <div style={{ borderRadius: 12, background: brand.card, border: `1px solid ${brand.border}`, overflowX: 'auto' }}>
            <table className="so-table" style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
              <thead><tr><th>Order</th><th>Member</th><th>Items</th><th>Delivery</th><th>Total</th><th>Status</th></tr></thead>
              <tbody>
                {shown.map(o => (
                  <tr key={o.id} onClick={() => { setSel(o); setError(''); }}>
                    <td style={{ fontWeight: 700, color: brand.heading }}>{o.order_no}</td>
                    <td>{o.full_name || o.email}</td>
                    <td>{(o.items || []).reduce((n, i) => n + i.qty, 0)}</td>
                    <td>{shippingLabel(o.shipping_key)}</td>
                    <td>{naira(o.total)}</td>
                    <td><span style={{ color: STATUS_COLOR[o.status] || brand.muted, fontWeight: 600, fontSize: 12 }}>{cap(o.status)}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {sel && (
          <>
            <div onClick={() => setSel(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9990 }} />
            <aside style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 'min(480px, 100vw)', background: brand.card, borderLeft: `1px solid ${brand.goldBorder}`, zIndex: 9991, display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '18px 24px', background: brand.panel, borderBottom: `1px solid ${brand.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p style={{ fontWeight: 700, fontSize: 18, color: brand.heading, margin: 0 }}>{sel.order_no}</p>
                  <p style={{ fontSize: 11, color: brand.faint, margin: '2px 0 0' }}>{new Date(sel.created_at).toLocaleString()}</p>
                </div>
                <button onClick={() => setSel(null)} aria-label="Close" style={{ background: 'transparent', border: `1px solid ${brand.border}`, borderRadius: 6, color: brand.muted, cursor: 'pointer', padding: '4px 8px', display: 'flex' }}><X size={14} /></button>
              </div>

              <div style={{ padding: 24, overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 20, fontSize: 13, color: brand.text }}>
                <div>
                  <span style={{ color: STATUS_COLOR[sel.status], fontWeight: 700 }}>{cap(sel.status)}</span>
                  {sel.status === 'ready' && <span style={{ color: brand.faint }}> · digital order, no shipping needed</span>}
                </div>

                <section>
                  <p style={{ fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: brand.muted, margin: '0 0 6px' }}>Customer</p>
                  <p style={{ margin: 0 }}>{sel.full_name || 'No name'}</p>
                  <p style={{ margin: 0, color: brand.muted }}>{sel.email}</p>
                  {sel.phone && <p style={{ margin: 0, color: brand.muted }}>{sel.phone}</p>}
                </section>

                <section>
                  <p style={{ fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: brand.muted, margin: '0 0 6px' }}>Delivery</p>
                  <p style={{ margin: 0 }}>{shippingLabel(sel.shipping_key)}</p>
                  {sel.address && Object.values(sel.address).filter(Boolean).length > 0 && (
                    <p style={{ margin: '2px 0 0', color: brand.muted, lineHeight: 1.5 }}>{Object.values(sel.address).filter(Boolean).join(', ')}</p>
                  )}
                </section>

                <section>
                  <p style={{ fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: brand.muted, margin: '0 0 6px' }}>Items</p>
                  {(sel.items || []).map(i => (
                    <div key={i.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '6px 0', borderBottom: `1px solid ${brand.border}` }}>
                      <span>{i.qty} × {i.name}{i.size ? ` (${i.size})` : ''}{i.fulfilment !== 'ship' ? ` · ${i.fulfilment}` : ''}</span>
                      <span>{naira(i.unit_price * i.qty)}</span>
                    </div>
                  ))}
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, color: brand.muted }}><span>Subtotal</span><span>{naira(sel.subtotal)}</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: brand.muted }}><span>Shipping</span><span>{naira(sel.shipping_fee)}</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: brand.heading, marginTop: 4 }}><span>Total</span><span>{naira(sel.total)}</span></div>
                </section>

                {error && <p style={{ color: brand.red, fontSize: 12, margin: 0 }}>{error}</p>}
              </div>

              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', padding: '14px 24px', borderTop: `1px solid ${brand.border}`, background: brand.panel }}>
                {(NEXT[sel.status] || []).map(n => (
                  <button key={n.to} disabled={busy} onClick={() => move(sel, n.to)} style={{ fontFamily: brand.font, fontSize: 12, fontWeight: 700, padding: '10px 20px', borderRadius: 9, cursor: busy ? 'not-allowed' : 'pointer', background: brand.gold, color: 'var(--admin-bg)', border: 'none', opacity: busy ? 0.6 : 1 }}>
                    Mark {n.label}
                  </button>
                ))}
                {['pending', 'paid', 'packing', 'ready'].includes(sel.status) && (
                  <button disabled={busy} onClick={() => { if (confirm('Cancel this order?')) move(sel, 'cancelled'); }} style={{ fontFamily: brand.font, fontSize: 12, fontWeight: 600, padding: '10px 18px', borderRadius: 9, cursor: 'pointer', background: 'rgba(239,68,68,0.08)', color: brand.red, border: '1px solid rgba(239,68,68,0.25)' }}>Cancel order</button>
                )}
                {!(NEXT[sel.status] || []).length && !['pending', 'ready'].includes(sel.status) && <span style={{ fontSize: 12, color: brand.faint, alignSelf: 'center' }}>No further actions.</span>}
              </div>
            </aside>
          </>
        )}
      </div>
    </>
  );
}
