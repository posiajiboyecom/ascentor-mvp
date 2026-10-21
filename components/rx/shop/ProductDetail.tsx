'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Lock } from 'lucide-react';
import { BackLink, Page, Tag } from '@/components/rx/ui';
import { useToast } from '@/components/rx/Toast';
import { useCart } from '@/lib/shop-cart';
import { isFree, SHOP_SIZES } from '@/lib/shop-shared';
import type { ShopCard } from '@/lib/shop-data';
import { ProductCard } from './ShopList';
import { inStock, priceLabel, Thumb, useFreeGet, type Member } from './parts';

export default function ProductDetail({ product: p, related, member }: { product: ShopCard; related: ShopCard[]; member: Member }) {
  const router = useRouter();
  const toast = useToast();
  const { add } = useCart();
  const { get, busy } = useFreeGet(member);
  const sizes = p.sizes?.length ? (SHOP_SIZES as readonly string[]).filter((s) => p.sizes!.includes(s)).concat(p.sizes.filter((s) => !(SHOP_SIZES as readonly string[]).includes(s))) : null;
  const [size, setSize] = useState<string | null>(sizes ? (sizes.includes('M') ? 'M' : sizes[0]) : null);
  const [qty, setQty] = useState(1);
  const out = !inStock(p);
  const free = isFree(p);
  const maxQty = p.stock != null ? Math.max(1, Math.min(20, p.stock)) : 20;
  const desc = p.description || p.tagline;

  const addToCart = (go: boolean) => {
    add(p.id, size, qty);
    if (go) router.push('/store/cart');
    else toast(`${p.name}${size ? `, size ${size},` : ''} added to your cart.`);
  };

  return (
    <Page>
      <BackLink href="/store">Store</BackLink>
      <div className="rx-grid2" style={{ marginTop: 8, gap: 24, alignItems: 'start' }}>
        <div className="rx-stack">
          <Thumb p={{ ...p, badge: null }} height={340} />
          <p className="rx-label">About this item</p>
          {desc && <p className="rx-p">{desc}</p>}
          {p.fulfilment === 'ship' && <p className="rx-sm">Ships from Lagos, or collect it at the Summit.</p>}
          {p.fulfilment === 'digital' && <p className="rx-sm">Sent to your email after payment.</p>}
          {p.fulfilment === 'learn' && <p className="rx-sm">Opens in Learn after payment.</p>}
        </div>
        <div className="rx-card rx-stack">
          {p.badge && <div><Tag gold>{p.badge}</Tag></div>}
          <h1 className="rx-h2">{p.name}</h1>
          <p className="rx-big">{priceLabel(p)}</p>
          {out && <p className="rx-sm" role="status">Out of stock right now.</p>}
          {!out && !free && sizes && (
            <div className="rx-fld">
              <span className="rx-fld-label">Size</span>
              <div className="rx-opts">{sizes.map((s) => <button key={s} type="button" className="rx-opt" aria-pressed={size === s} onClick={() => setSize(s)}>{s}</button>)}</div>
            </div>
          )}
          {!out && !free && (
            <div className="rx-fld">
              <span className="rx-fld-label">Quantity</span>
              <div className="rx-row" style={{ gap: 8 }}>
                <button type="button" className="rx-ib" aria-label="One fewer" onClick={() => setQty((q) => Math.max(1, q - 1))}>−</button>
                <span className="rx-strong" style={{ minWidth: 24, textAlign: 'center' }}>{qty}</span>
                <button type="button" className="rx-ib" aria-label="One more" onClick={() => setQty((q) => Math.min(maxQty, q + 1))}>+</button>
              </div>
            </div>
          )}
          {out
            ? <button type="button" className="rx-btn secondary block" disabled>Out of stock</button>
            : free
              ? <button type="button" className="rx-btn primary block" disabled={busy === p.id} onClick={() => get(p)}>{busy === p.id ? 'Getting…' : 'Get'}</button>
              : (
                <>
                  <button type="button" className="rx-btn primary block" onClick={() => addToCart(false)}>Add to cart</button>
                  <button type="button" className="rx-btn secondary block" onClick={() => addToCart(true)}>Buy now</button>
                </>
              )}
          <p className="rx-sm rx-row rx-nw" style={{ gap: 8 }}><Lock aria-hidden style={{ width: 16, height: 16, flex: 'none' }} />Secure checkout through Paystack.</p>
        </div>
      </div>
      {related.length > 0 && (
        <div className="rx-stack-sm" style={{ marginTop: 32 }}>
          <p className="rx-label">You may also like</p>
          <div className="rx-grid3">{related.map((r) => <ProductCard key={r.id} p={r} member={member} compact />)}</div>
        </div>
      )}
    </Page>
  );
}
