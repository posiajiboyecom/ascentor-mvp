import { getShellData } from '@/lib/shell-data';
import { listShopProducts, type ShopCard } from '@/lib/shop-data';
import { Page, Title } from '@/components/rx/ui';
import ShopList from '@/components/rx/shop/ShopList';
import { CartPill } from '@/components/rx/shop/parts';
import { visitorCurrency } from '@/lib/geo';

export const metadata = { title: 'Store' };

export default async function StorePage() {
  const shell = await getShellData();
  let products: ShopCard[] = [];
  try { products = await listShopProducts(); } catch { /* shop tables not ready: show the empty state */ }
  const abroad = (await visitorCurrency()) !== 'NGN';

  return (
    <Page>
      <Title tag={<CartPill />}>Store</Title>
      {abroad && <p className="rx-sm" role="note">The shop delivers within Nigeria only for now, so orders can only be placed from Nigeria.</p>}
      <ShopList products={products} member={{ name: shell?.userName ?? '', email: shell?.email ?? '' }} />
    </Page>
  );
}
