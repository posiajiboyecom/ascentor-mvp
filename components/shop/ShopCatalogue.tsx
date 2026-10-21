'use client';

import { useState } from 'react';
import Link from 'next/link';
import { SHOP_CATEGORIES } from '@/lib/shop-shared';
import { useCart } from '@/lib/shop-cart';
import type { ShopCard } from '@/lib/shop-data';
import ProductCard from '@/components/shop/ProductCard';

export default function ShopCatalogue({ products, failed }: { products: ShopCard[]; failed?: boolean }) {
  const [cat, setCat] = useState<string>('All');
  const { count } = useCart();
  const shown = products
    .filter((p) => cat === 'All' || p.shop_category === cat)
    .sort((a, b) => Number(b.is_featured) - Number(a.is_featured));

  return (
    <>
      <div className="sp-bar">
        <div className="sp-chips">
          {['All', ...SHOP_CATEGORIES].map((c) => (
            <button key={c} className={`sp-chip${cat === c ? ' on' : ''}`} onClick={() => setCat(c)}>{c}</button>
          ))}
        </div>
        <Link href="/shop/cart" className="sp-cartlink">Cart{count > 0 ? ` (${count})` : ''}</Link>
      </div>
      {shown.length === 0 ? (
        <div className="sp-empty">
          {failed ? 'The shop is warming up. Please check back shortly.' : cat === 'All' ? 'Nothing in the shop yet. Check back soon.' : 'Nothing in this category yet.'}
        </div>
      ) : (
        <div className="sp-grid">{shown.map((p) => <ProductCard key={p.id} p={p} />)}</div>
      )}
    </>
  );
}
