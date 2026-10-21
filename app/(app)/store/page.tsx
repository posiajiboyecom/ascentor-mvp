import { getShellData } from '@/lib/shell-data';
import { listShopProducts, type ShopCard } from '@/lib/shop-data';
import { Page, Title } from '@/components/rx/ui';
import ShopList from '@/components/rx/shop/ShopList';
import { CartPill } from '@/components/rx/shop/parts';

export const metadata = { title: 'Shop' };

export default async function StorePage() {
  const shell = await getShellData();
  let products: ShopCard[] = [];
  try { products = await listShopProducts(); } catch { /* shop tables not ready: show the empty state */ }

  return (
    <Page>
      <Title tag={<CartPill />}>Shop</Title>
      <ShopList products={products} member={{ name: shell?.userName ?? '', email: shell?.email ?? '' }} />
    </Page>
  );
}
