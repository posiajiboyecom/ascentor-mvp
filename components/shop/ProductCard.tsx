import Link from 'next/link';
import { naira, isFree, inStock } from '@/lib/shop-shared';
import type { ShopCard } from '@/lib/shop-data';

export default function ProductCard({ p }: { p: ShopCard }) {
  const out = !inStock(p);
  return (
    <Link href={`/shop/${p.slug || p.id}`} className="sp-card">
      <div className="sp-img">
        {p.image_url ? <img src={p.image_url} alt={p.name} loading="lazy" /> : <span>{p.shop_category}</span>}
        {p.image_url && (p.hover_image_url || p.gallery_urls?.[0]) && <img className="sp-hover" src={(p.hover_image_url || p.gallery_urls?.[0]) as string} alt="" loading="lazy" aria-hidden />}
        {p.badge && <span className="sp-tag">{p.badge}</span>}
        {out && <span className="sp-tag out">Out of stock</span>}
      </div>
      <div className="sp-body">
        <span className="sp-cat">{p.shop_category}</span>
        <span className="sp-name">{p.name}</span>
        {p.tagline && <span className="sp-tagline">{p.tagline}</span>}
        <span className="sp-price">{isFree(p) ? 'Free' : naira(p.price_ngn)}</span>
      </div>
    </Link>
  );
}
