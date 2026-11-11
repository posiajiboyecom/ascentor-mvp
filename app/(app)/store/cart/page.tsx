import { getShellData } from '@/lib/shell-data';
import { listShopProducts, type ShopCard } from '@/lib/shop-data';
import CartClient from '@/components/rx/shop/CartClient';
import { visitorCurrency } from '@/lib/geo';

export const metadata = { title: 'Your cart' };

export default async function StoreCartPage() {
  const shell = await getShellData();
  let products: ShopCard[] = [];
  try { products = await listShopProducts(); } catch { /* empty catalogue */ }
  const abroad = (await visitorCurrency()) !== 'NGN';
  return <CartClient products={products} abroad={abroad} member={{ name: shell?.userName ?? '', email: shell?.email ?? '' }} />;
}
