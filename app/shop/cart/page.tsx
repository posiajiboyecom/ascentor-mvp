import type { Metadata } from 'next';
import PublicShell from '@/components/layout/PublicShell';
import ShopStyles from '@/components/shop/ShopStyles';
import CartView from '@/components/shop/CartView';
import { listShopProducts, type ShopCard } from '@/lib/shop-data';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Your cart | Ascentor Shop',
  description: 'Review your order and pay securely with Paystack.',
  robots: { index: false },
};

export default async function CartPage() {
  let products: ShopCard[] = [];
  try { products = await listShopProducts(); } catch { /* empty cart view */ }
  return (
    <PublicShell>
      <ShopStyles />
      <div className="sp">
        <div className="sp-wrap">
          <div className="sp-hero" style={{ paddingBottom: '1.5rem' }}>
            <div className="sp-eyebrow">The Ascentor Shop</div>
            <h1>Your cart</h1>
          </div>
          <CartView products={products} />
        </div>
      </div>
    </PublicShell>
  );
}
