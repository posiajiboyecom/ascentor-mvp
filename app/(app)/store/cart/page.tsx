import { getShellData } from '@/lib/shell-data';
import { listShopProducts, type ShopCard } from '@/lib/shop-data';
import CartClient from '@/components/rx/shop/CartClient';

export const metadata = { title: 'Your cart' };

export default async function StoreCartPage() {
  const shell = await getShellData();
  let products: ShopCard[] = [];
  try { products = await listShopProducts(); } catch { /* empty catalogue */ }
  return <CartClient products={products} member={{ name: shell?.userName ?? '', email: shell?.email ?? '' }} />;
}
