'use client';

import { useState } from 'react';
import Link from 'next/link';
import { SHOP_SIZES, isFree, inStock } from '@/lib/shop-shared';
import { useCart } from '@/lib/shop-cart';
import type { ShopCard } from '@/lib/shop-data';
import LeadForm from '@/components/shop/LeadForm';

export default function ProductBuy({ p }: { p: ShopCard }) {
  const { add } = useCart();
  const sizes = p.fulfilment === 'ship' ? (p.sizes?.length ? p.sizes : p.shop_category === 'Apparel' ? [...SHOP_SIZES] : []) : [];
  const [size, setSize] = useState<string | null>(null);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const [needSize, setNeedSize] = useState(false);

  if (p.fulfilment === 'learn') {
    return (
      <div className="sp-row">
        <Link href="/login?redirect=/store" className="sp-btn rust">Sign in to start learning</Link>
        <Link href="/signup" className="sp-btn ghost">Join Ascentor</Link>
      </div>
    );
  }
  if (!inStock(p)) return <button className="sp-btn" disabled>Out of stock</button>;
  if (p.lead_capture || isFree(p)) return <LeadForm productId={p.id} />;

  const onAdd = () => {
    if (sizes.length && !size) { setNeedSize(true); return; }
    add(p.id, size, qty);
    setAdded(true);
  };

  return (
    <div>
      {sizes.length > 0 && (
        <>
          <div className="sp-label">Size</div>
          <div className="sp-sizes">
            {sizes.map((s) => (
              <button key={s} className={`sp-size${size === s ? ' on' : ''}`} onClick={() => { setSize(s); setNeedSize(false); }}>{s}</button>
            ))}
          </div>
          {needSize && <p className="sp-err">Please choose a size.</p>}
        </>
      )}
      <div className="sp-label">Quantity</div>
      <div className="sp-qty">
        <button onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Less">-</button>
        <span>{qty}</span>
        <button onClick={() => setQty((q) => Math.min(20, q + 1))} aria-label="More">+</button>
      </div>
      <div className="sp-row">
        <button className="sp-btn rust" onClick={onAdd}>Add to cart</button>
        {added && <Link href="/shop/cart" className="sp-btn ghost">View cart</Link>}
      </div>
      {added && <p className="sp-ok">Added to your cart.</p>}
    </div>
  );
}
