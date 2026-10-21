'use client';

import Link from 'next/link';
import { useState } from 'react';
import { BookOpen, Download, GraduationCap, Shirt, ShoppingBag } from 'lucide-react';
import { useToast } from '@/components/rx/Toast';
import { useCart } from '@/lib/shop-cart';
import { isFree, inStock, naira, type ShopCategory } from '@/lib/shop-shared';
import type { ShopCard } from '@/lib/shop-data';

export type Member = { name: string; email: string };

const ICONS: Record<ShopCategory, typeof ShoppingBag> = {
  Apparel: Shirt,
  Accessories: ShoppingBag,
  'Books and journals': BookOpen,
  Digital: Download,
  Courses: GraduationCap,
};

export function Thumb({ p, height }: { p: Pick<ShopCard, 'name' | 'image_url' | 'shop_category' | 'badge'>; height?: number }) {
  const Icon = ICONS[p.shop_category] ?? ShoppingBag;
  return (
    <div
      className="rx-thumb"
      role="img"
      aria-label={`${p.name}, product photo`}
      style={{ aspectRatio: height ? 'auto' : '1 / 1', height, alignItems: 'center', justifyContent: 'center', padding: 0 }}
    >
      {p.image_url
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={p.image_url} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
        : <Icon aria-hidden style={{ width: 40, height: 40 }} />}
      {p.badge && <span className="rx-tag" style={{ position: 'absolute', top: 10, left: 10 }}>{p.badge}</span>}
    </div>
  );
}

export function CartPill() {
  const { count } = useCart();
  return (
    <Link href="/store/cart" className="rx-btn secondary" style={{ minHeight: 44 }}>
      <ShoppingBag aria-hidden style={{ width: 18, height: 18 }} />
      Cart · {count}
    </Link>
  );
}

/** One-click claim of a free item for a signed-in member. */
export function useFreeGet(member: Member) {
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const get = async (p: Pick<ShopCard, 'id' | 'name'>) => {
    setBusy(p.id);
    try {
      const res = await fetch('/api/shop/free', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: p.id, fullName: member.name, email: member.email }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.url) { toast(j.error || 'We could not get that for you. Try again.'); return; }
      toast(`${p.name} is on its way.`);
      window.location.href = j.url;
    } catch {
      toast('We could not get that for you. Try again.');
    } finally {
      setBusy(null);
    }
  };
  return { get, busy };
}

export const priceLabel = (p: Pick<ShopCard, 'price_ngn'>) => (isFree(p) ? 'Free' : naira(p.price_ngn));
export const productHref = (p: Pick<ShopCard, 'id' | 'slug'>) => `/store/${p.slug || p.id}`;
export { inStock };
