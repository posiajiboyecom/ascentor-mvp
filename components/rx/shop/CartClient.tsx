'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Lock, ShoppingBag } from 'lucide-react';
import { Aside, BackLink, Page, Title } from '@/components/rx/ui';
import { useCart } from '@/lib/shop-cart';
import { inStock, isFree, naira, SHOP_SHIPPING, SHOP_SHIPPING_KEYS, type ShopShippingKey } from '@/lib/shop-shared';
import type { ShopCard } from '@/lib/shop-data';
import { Thumb, type Member } from './parts';

export default function CartClient({ products, member }: { products: ShopCard[]; member: Member }) {
  const { items, ready, setQty, remove } = useCart();
  const [ship, setShip] = useState<ShopShippingKey>('lagos');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Free items are claimed one by one and never sit in a paid cart.
  const lines = items.map((i) => ({ ...i, p: products.find((x) => x.id === i.productId) })).filter((l) => !l.p || !isFree(l.p));
  const live = lines.filter((l): l is typeof l & { p: ShopCard } => !!l.p && inStock(l.p));
  const blocked = lines.length !== live.length;
  const needsShipping = live.some((l) => l.p.fulfilment === 'ship');
  const needsAddress = needsShipping && ship !== 'summit';
  const subtotal = live.reduce((a, l) => a + l.p.price_ngn * l.qty, 0);
  const fee = needsShipping ? SHOP_SHIPPING[ship].fee : 0;
  const total = subtotal + fee;
  const addressOk = !needsAddress || (address.trim() && city.trim());
  const canPay = live.length > 0 && !blocked && !!addressOk && !busy;

  const pay = async () => {
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/shop/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: live.map((l) => ({ productId: l.productId, size: l.size ?? undefined, qty: l.qty })),
          shipping: needsShipping ? ship : undefined,
          fullName: member.name,
          email: member.email,
          phone: phone.trim() || undefined,
          address: needsAddress ? address.trim() : undefined,
          city: needsAddress ? city.trim() : undefined,
          state: needsAddress ? state.trim() || undefined : undefined,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.authorizationUrl) { setError(j.error || 'We could not start the payment. Try again.'); setBusy(false); return; }
      window.location.href = j.authorizationUrl;
    } catch {
      setError('We could not start the payment. Check your connection and try again.');
      setBusy(false);
    }
  };

  return (
    <Page>
      <BackLink href="/store">Keep shopping</BackLink>
      <Title>Your cart</Title>
      <div className="rx-two">
        <div className="rx-stack">
          {ready && lines.length === 0 && (
            <div className="rx-card rx-empty">
              <ShoppingBag aria-hidden style={{ width: 36, height: 36, color: 'var(--rx-muted)' }} />
              <p className="rx-h3">Your cart is empty.</p>
              <Link href="/store" className="rx-btn secondary">Browse the shop</Link>
            </div>
          )}
          {lines.map((l) => {
            const p = l.p;
            const out = !!p && !inStock(p);
            return (
              <div key={`${l.productId}|${l.size ?? ''}`} className="rx-card rx-row rx-nw" style={{ gap: 14, padding: 14 }}>
                <div style={{ width: 72, flex: 'none' }}>{p ? <Thumb p={{ ...p, badge: null }} /> : null}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p className="rx-strong" style={{ margin: 0 }}>{p ? p.name : 'No longer available'}</p>
                  <p className="rx-sm">
                    {p && !out ? `${l.size ? `Size ${l.size} · ` : ''}${naira(p.price_ngn)} each` : out ? 'Out of stock. Remove it to continue.' : 'Remove it to continue.'}
                  </p>
                  {p && !out && <p className="rx-strong" style={{ margin: '4px 0 0', fontSize: 15 }}>{naira(p.price_ngn * l.qty)}</p>}
                </div>
                <div className="rx-stack-sm" style={{ alignItems: 'flex-end', flex: 'none' }}>
                  {p && !out && (
                    <div className="rx-row" style={{ gap: 4 }}>
                      <button type="button" className="rx-ib" aria-label="One fewer" onClick={() => setQty(l.productId, l.size, l.qty - 1)}>−</button>
                      <span className="rx-strong" style={{ minWidth: 20, textAlign: 'center' }}>{l.qty}</span>
                      <button type="button" className="rx-ib" aria-label="One more" onClick={() => setQty(l.productId, l.size, l.qty + 1)}>+</button>
                    </div>
                  )}
                  <button type="button" className="rx-link muted" style={{ minHeight: 32, fontSize: 13 }} onClick={() => remove(l.productId, l.size)}>Remove</button>
                </div>
              </div>
            );
          })}
        </div>
        {lines.length > 0 && (
          <Aside>
            {needsShipping ? (
              <>
                <p className="rx-label">Delivery</p>
                <div className="rx-optcol">
                  {SHOP_SHIPPING_KEYS.map((k) => (
                    <button key={k} type="button" className="rx-opt" aria-pressed={ship === k} onClick={() => setShip(k)}>
                      <span style={{ flex: 1, textAlign: 'left', whiteSpace: 'normal' }}>{SHOP_SHIPPING[k].label}</span>
                      <span className="rx-sm">{SHOP_SHIPPING[k].fee ? naira(SHOP_SHIPPING[k].fee) : 'Free'}</span>
                    </button>
                  ))}
                </div>
                {needsAddress && (
                  <div className="rx-stack-sm">
                    <div className="rx-fld"><label htmlFor="sh-addr">Delivery address</label><input id="sh-addr" className="rx-in" value={address} onChange={(e) => setAddress(e.target.value)} autoComplete="street-address" /></div>
                    <div className="rx-fld"><label htmlFor="sh-city">City</label><input id="sh-city" className="rx-in" value={city} onChange={(e) => setCity(e.target.value)} autoComplete="address-level2" /></div>
                    <div className="rx-fld"><label htmlFor="sh-state">State</label><input id="sh-state" className="rx-in" value={state} onChange={(e) => setState(e.target.value)} autoComplete="address-level1" /></div>
                  </div>
                )}
              </>
            ) : (
              <p className="rx-sm">Nothing to deliver. Digital items arrive by email and courses open in Learn.</p>
            )}
            <div className="rx-fld"><label htmlFor="sh-phone">Phone (optional)</label><input id="sh-phone" className="rx-in" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" /></div>
            <div className="rx-stack-sm">
              <div className="rx-between"><span>Subtotal</span><span>{naira(subtotal)}</span></div>
              {needsShipping && <div className="rx-between"><span>Delivery</span><span>{fee ? naira(fee) : 'Free'}</span></div>}
              <div className="rx-between rx-strong" style={{ fontSize: 18, borderTop: '1px solid var(--rx-border)', paddingTop: 10 }}><span>Total</span><span>{naira(total)}</span></div>
            </div>
            {error && <p className="rx-sm" role="alert" style={{ color: 'var(--rx-danger)' }}>{error}</p>}
            <button type="button" className="rx-btn primary block" disabled={!canPay} onClick={pay}>{busy ? 'Opening Paystack…' : `Pay ${naira(total)} with Paystack`}</button>
            <p className="rx-sm rx-row rx-nw" style={{ gap: 8 }}><Lock aria-hidden style={{ width: 16, height: 16, flex: 'none' }} />Card, bank transfer or USSD.</p>
          </Aside>
        )}
      </div>
    </Page>
  );
}
