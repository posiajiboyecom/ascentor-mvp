import { notFound } from 'next/navigation';
import { getShellData } from '@/lib/shell-data';
import { getShopProduct, listRelated, type ShopCard } from '@/lib/shop-data';
import ProductDetail from '@/components/rx/shop/ProductDetail';

export default async function StoreProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const shell = await getShellData();
  let product: ShopCard | null = null;
  let related: ShopCard[] = [];
  try {
    product = await getShopProduct(slug);
    if (product) related = await listRelated(product.id, 3);
  } catch { /* treated as not found */ }
  if (!product) notFound();

  return <ProductDetail product={product} related={related} member={{ name: shell?.userName ?? '', email: shell?.email ?? '' }} />;
}
