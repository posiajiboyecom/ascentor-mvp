'use client';

import { useState } from 'react';
import Link from 'next/link';
import { SHOP_SHIPPING, SHOP_SHIPPING_KEYS, naira, type ShopShippingKey } from '@/lib/shop-shared';
import { useCart } from '@/lib/shop-cart';
import type { ShopCard } from '@/lib/shop-data';

/** `abroad`: the visitor is outside Nigeria. The shop ships within Nigeria only, so checkout is closed for them. */
export default function CartView({ products, abroad = false }: { products: ShopCard[]; abroad?: boolean }) {
  const { items, ready, setQty, remove } = useCart();
  const [shipping, setShipping] = useState<ShopShippingKey>('lagos');
  const [f, setF] = useState({ fullName: '', email: '', phone: '', address: '', city: '', state: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const byId = new Map(products.map((p) => [p.id, p]));
  const lines = items.flatMap((i) => { const p = byId.get(i.productId); return p ? [{ ...i, p }] : []; });
  const physical = lines.some((l) => l.p.fulfilment === 'ship');
  const subtotal = lines.reduce((a, l) => a + l.p.price_ngn * l.qty, 0);
  const fee = physical ? SHOP_SHIPPING[shipping].fee : 0;
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  const needAddress = physical && shipping !== 'summit';

  async function pay(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr('');
    try {
      const res = await fetch('/api/shop/checkout', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: lines.map((l) => ({ productId: l.productId, size: l.size ?? undefined, qty: l.qty })),
          ...(physical ? { shipping } : {}),
          fullName: f.fullName.trim(), email: f.email.trim(),
          ...(f.phone.trim() ? { phone: f.phone.trim() } : {}),
          ...(needAddress ? { address: f.address.trim(), city: f.city.trim(), state: f.state.trim() } : {}),
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.authorizationUrl) { setErr(j.error || 'We could not start the payment. Please try again.'); setBusy(false); return; }
      window.location.href = j.authorizationUrl;
    } catch {
      setErr('Network problem. Please try again.');
      setBusy(false);
    }
  }

  if (!ready) return <div className="sp-empty">Loading your cart...</div>;
  if (lines.length === 0) {
    return (
      <div className="sp-empty">
        <p style={{ margin: '0 0 1rem' }}>Your cart is empty.</p>
        <Link href="/shop" className="sp-btn rust">Browse the shop</Link>
      </div>
    );
  }

  return (
    <form className="sp-cart" onSubmit={pay}>
      <div>
        <div className="sp-box">
          {lines.map((l) => (
            <div className="sp-line" key={`${l.productId}-${l.size}`}>
              <div className="sp-thumb">{l.p.image_url && <img src={l.p.image_url} alt="" />}</div>
              <div style={{ flex: '1 1 140px', minWidth: 0 }}>
                <Link href={`/shop/${l.p.slug || l.p.id}`} style={{ fontWeight: 700, color: 'inherit', textDecoration: 'none' }}>{l.p.name}</Link>
                <div style={{ fontSize: '.8rem', color: '#6B7280' }}>{l.size ? `Size ${l.size} · ` : ''}{naira(l.p.price_ngn)}</div>
                <button type="button" className="sp-link" onClick={() => remove(l.productId, l.size)}>Remove</button>
              </div>
              <div className="sp-qty">
                <button type="button" onClick={() => setQty(l.productId, l.size, l.qty - 1)} aria-label="Less">-</button>
                <span>{l.qty}</span>
                <button type="button" onClick={() => setQty(l.productId, l.size, l.qty + 1)} aria-label="More">+</button>
              </div>
              <div style={{ minWidth: 80, textAlign: 'right', fontWeight: 700 }}>{naira(l.p.price_ngn * l.qty)}</div>
            </div>
          ))}
        </div>
        {physical && (
          <div className="sp-box" style={{ marginTop: '1rem' }}>
            <div className="sp-label" style={{ marginTop: 0 }}>Delivery</div>
            {SHOP_SHIPPING_KEYS.map((k) => (
              <label key={k} className={`sp-opt${shipping === k ? ' on' : ''}`}>
                <span><input type="radio" name="ship" checked={shipping === k} onChange={() => setShipping(k)} /> {SHOP_SHIPPING[k].label}</span>
                <strong>{SHOP_SHIPPING[k].fee ? naira(SHOP_SHIPPING[k].fee) : 'Free'}</strong>
              </label>
            ))}
          </div>
        )}
      </div>
      <div className="sp-box">
        <div className="sp-label" style={{ marginTop: 0 }}>Your details</div>
        <label className="sp-field">Full name<input className="sp-input" required value={f.fullName} onChange={set('fullName')} autoComplete="name" /></label>
        <label className="sp-field">Email<input className="sp-input" type="email" required value={f.email} onChange={set('email')} autoComplete="email" /></label>
        <label className="sp-field">Phone<input className="sp-input" type="tel" required={physical} value={f.phone} onChange={set('phone')} autoComplete="tel" /></label>
        {needAddress && (
          <>
            <label className="sp-field">Address<input className="sp-input" required value={f.address} onChange={set('address')} autoComplete="street-address" /></label>
            <label className="sp-field">City<input className="sp-input" required value={f.city} onChange={set('city')} autoComplete="address-level2" /></label>
            <label className="sp-field">State<input className="sp-input" required value={f.state} onChange={set('state')} autoComplete="address-level1" /></label>
          </>
        )}
        <div style={{ marginTop: '.5rem' }}>
          <div className="sp-sum"><span>Subtotal</span><span>{naira(subtotal)}</span></div>
          {physical && <div className="sp-sum"><span>Delivery</span><span>{fee ? naira(fee) : 'Free'}</span></div>}
          <div className="sp-sum total"><span>Total</span><span>{naira(subtotal + fee)}</span></div>
        </div>
        {abroad && <p className="sp-err" role="note">The shop delivers within Nigeria only for now, so orders can only be placed from Nigeria.</p>}
        {err && <p className="sp-err">{err}</p>}
        <button className="sp-btn rust" style={{ width: '100%', marginTop: '.75rem' }} disabled={busy || abroad}>{busy ? 'Redirecting to Paystack...' : 'Pay with Paystack'}</button>
      </div>
    </form>
  );
}
