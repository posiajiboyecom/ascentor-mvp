import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import PublicShell from '@/components/layout/PublicShell';
import ShopStyles from '@/components/shop/ShopStyles';
import ProductBuy from '@/components/shop/ProductBuy';
import ProductCard from '@/components/shop/ProductCard';
import { naira, isFree, inStock } from '@/lib/shop-shared';
import { getShopProduct, listRelated, type ShopCard } from '@/lib/shop-data';

export const dynamic = 'force-dynamic';

async function load(slug: string): Promise<ShopCard | null> {
  try { return await getShopProduct(slug); } catch { return null; }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const p = await load((await params).slug);
  if (!p) return { title: 'Shop | Ascentor' };
  const description = p.tagline || p.description?.slice(0, 160) || 'From the Ascentor shop.';
  return {
    title: `${p.name} | Ascentor Shop`,
    description,
    alternates: { canonical: `/shop/${p.slug || p.id}` },
    openGraph: { title: p.name, description, ...(p.image_url ? { images: [{ url: p.image_url }] } : {}) },
  };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const p = await load((await params).slug);
  if (!p) notFound();
  let related: ShopCard[] = [];
  try { related = await listRelated(p.id); } catch { /* optional */ }

  return (
    <PublicShell>
      <ShopStyles />
      <div className="sp">
        <div className="sp-wrap">
          <div className="sp-crumb"><Link href="/shop">Shop</Link> / {p.shop_category}</div>
          <div className="sp-detail">
            <div className="sp-img">
              {p.image_url ? <img src={p.image_url} alt={p.name} /> : <span>{p.shop_category}</span>}
              {p.badge && <span className="sp-tag">{p.badge}</span>}
              {!inStock(p) && <span className="sp-tag out">Out of stock</span>}
            </div>
            <div>
              <div className="sp-eyebrow">{p.shop_category}</div>
              <h1 style={{ fontSize: 'clamp(1.75rem,4vw,2.5rem)' }}>{p.name}</h1>
              {p.tagline && <p className="sp-sub">{p.tagline}</p>}
              <div className="sp-d-price">{isFree(p) ? 'Free' : naira(p.price_ngn)}</div>
              {p.description && <p className="sp-d-desc">{p.description}</p>}
              <ProductBuy p={p} />
            </div>
          </div>
          {related.length > 0 && (
            <div className="sp-related" style={{ paddingBottom: '4rem' }}>
              <h2>You may also like</h2>
              <div className="sp-grid" style={{ paddingBottom: 0 }}>{related.map((r) => <ProductCard key={r.id} p={r} />)}</div>
            </div>
          )}
        </div>
      </div>
    </PublicShell>
  );
}
