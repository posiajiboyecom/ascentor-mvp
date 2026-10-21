'use client';

import { DELIVERY_NOTE_SHORT } from '@/lib/shop-policy';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ArrowRight, Lock } from 'lucide-react';
import { Aside, Empty } from '@/components/rx/ui';
import { useToast } from '@/components/rx/Toast';
import { useCart } from '@/lib/shop-cart';
import { isFree, naira } from '@/lib/shop-shared';
import type { ShopCard } from '@/lib/shop-data';
import { CartPill, inStock, priceLabel, productHref, Thumb, useFreeGet, type Member } from './parts';

export function CartSummaryAside({ products }: { products: ShopCard[] }) {
  const { items, count } = useCart();
  const subtotal = items.reduce((a, i) => a + (products.find((p) => p.id === i.productId)?.price_ngn ?? 0) * i.qty, 0);
  return (
    <Aside>
      <p className="rx-label">Your cart</p>
      <div className="rx-between"><span>{count} {count === 1 ? 'item' : 'items'}</span><span className="rx-strong">{naira(subtotal)}</span></div>
      <Link href="/store/cart" className="rx-btn primary block">View cart</Link>
      <Link href="/store/orders" className="rx-link">My orders<ArrowRight aria-hidden /></Link>
      <p className="rx-label">Pick up at the Summit</p>
      <p className="rx-p">Order ahead and collect free at Aderemi Makanjuola Hall on 19 November.</p>
      <p className="rx-label">Delivery</p>
      <p className="rx-p">{DELIVERY_NOTE_SHORT}</p>
      <p className="rx-sm rx-row rx-nw" style={{ gap: 8 }}><Lock aria-hidden style={{ width: 16, height: 16, flex: 'none' }} />Card, bank transfer or USSD, through Paystack.</p>
    </Aside>
  );
}

export function ProductCard({ p, member, compact }: { p: ShopCard; member: Member; compact?: boolean }) {
  const { items, add } = useCart();
  const toast = useToast();
  const { get, busy } = useFreeGet(member);
  const href = productHref(p);
  const out = !inStock(p);
  const free = isFree(p);
  const inCart = items.some((i) => i.productId === p.id);
  const sized = !!p.sizes?.length;

  let action: React.ReactNode = null;
  if (!compact) {
    if (out) action = <button type="button" className="rx-btn secondary" disabled style={{ minHeight: 40, padding: '0 14px' }}>Out of stock</button>;
    else if (free) action = <button type="button" className="rx-btn primary" style={{ minHeight: 40, padding: '0 14px' }} disabled={busy === p.id} onClick={() => get(p)}>{busy === p.id ? 'Getting…' : 'Get'}</button>;
    else if (sized) action = <Link href={href} className="rx-btn primary" style={{ minHeight: 40, padding: '0 14px' }}>Choose size</Link>;
    else action = (
      <button type="button" className={`rx-btn ${inCart ? 'secondary' : 'primary'}`} style={{ minHeight: 40, padding: '0 14px' }} onClick={() => { add(p.id, null, 1); toast(`${p.name} added to your cart.`); }}>
        {inCart ? 'Add another' : 'Add to cart'}
      </button>
    );
  }

  return (
    <div className="rx-card" style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 12, opacity: out ? 0.7 : 1 }}>
      <Link href={href} aria-label={`View ${p.name}`} style={{ display: 'block' }}><Thumb p={p} /></Link>
      <div className="rx-stack-sm" style={{ gap: 2, padding: '0 4px', minWidth: 0 }}>
        <Link href={href} className="rx-h3" style={{ textDecoration: 'none', color: 'inherit' }}>{p.name}</Link>
        {!compact && <p className="rx-sm">{p.shop_category}</p>}
      </div>
      <div className="rx-between" style={{ padding: '0 4px 4px', marginTop: 'auto', flexWrap: 'wrap' }}>
        <span className="rx-strong">{priceLabel(p)}</span>
        {action}
      </div>
    </div>
  );
}

export default function ShopList({ products, member }: { products: ShopCard[]; member: Member }) {
  const [cat, setCat] = useState<string>('All');
  const cats = useMemo(() => ['All', ...Array.from(new Set(products.map((p) => p.shop_category)))], [products]);
  const shown = cat === 'All' ? products : products.filter((p) => p.shop_category === cat);

  return (
    <div className="rx-two">
      <div className="rx-stack-lg">
        <p className="rx-p" style={{ maxWidth: 560, fontSize: 17 }}>Merch, journals and digital resources from Ascentor and The Elevation Summit.</p>
        {cats.length > 2 && (
          <div className="rx-opts" role="group" aria-label="Categories">
            {cats.map((c) => <button key={c} type="button" className="rx-opt" aria-pressed={cat === c} onClick={() => setCat(c)}>{c}</button>)}
          </div>
        )}
        {shown.length === 0
          ? <Empty>Nothing in the shop yet. Check back soon.</Empty>
          : <div className="rx-grid3">{shown.map((p) => <ProductCard key={p.id} p={p} member={member} />)}</div>}
      </div>
      <CartSummaryAside products={products} />
    </div>
  );
}
