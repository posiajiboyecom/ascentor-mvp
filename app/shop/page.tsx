import type { Metadata } from 'next';
import PublicShell from '@/components/layout/PublicShell';
import ShopStyles from '@/components/shop/ShopStyles';
import ShopCatalogue from '@/components/shop/ShopCatalogue';
import { listShopProducts, type ShopCard } from '@/lib/shop-data';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Shop | Ascentor',
  description: 'Apparel, journals, digital guides and courses from Ascentor and The Elevation Summit. Pay in naira.',
  alternates: { canonical: '/shop' },
};

export default async function ShopPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  let products: ShopCard[] = [];
  let failed = false;
  try { products = await listShopProducts(); } catch { failed = true; }

  return (
    <PublicShell>
      <ShopStyles />
      <div className="sp">
        <div className="sp-wrap">
          <div className="sp-hero">
            <div className="sp-eyebrow">The Ascentor Shop</div>
            <h1>Made for people who build.</h1>
            <p className="sp-sub">Apparel, journals, guides and courses to carry the work forward.</p>
            {error === 'payment_failed' && <p className="sp-err">Your payment did not go through. Nothing was charged. Please try again.</p>}
          </div>
          <ShopCatalogue products={products} failed={failed} />
        </div>
      </div>
    </PublicShell>
  );
}
