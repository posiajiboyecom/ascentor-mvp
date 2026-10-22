// lib/shop-shared.ts
// Shop types and constants that are safe to import from client components. NGN only.

export const SHOP_CATEGORIES = ['Apparel', 'Accessories', 'Books and journals', 'Digital', 'Courses'] as const;
export type ShopCategory = (typeof SHOP_CATEGORIES)[number];

export type Fulfilment = 'ship' | 'digital' | 'learn';

// Delivery options and fees, exactly as in the app prototype.
export const SHOP_SHIPPING = {
  lagos:  { label: 'Lagos delivery',                 fee: 2500 },
  ng:     { label: 'Rest of Nigeria',                fee: 4500 },
  summit: { label: 'Pick up at the Summit, 19 Nov',  fee: 0 },
} as const;
export type ShopShippingKey = keyof typeof SHOP_SHIPPING;
export const SHOP_SHIPPING_KEYS = Object.keys(SHOP_SHIPPING) as ShopShippingKey[];

export const SHOP_SIZES = ['S', 'M', 'L', 'XL', 'XXL'] as const;

export interface ShopProduct {
  id: string;
  slug: string | null;
  name: string;
  tagline: string | null;
  description: string | null;
  image_url: string | null;
  hover_image_url?: string | null;
  gallery_urls?: string[] | null;
  badge: string | null;
  shop_category: ShopCategory;
  fulfilment: Fulfilment;
  price_ngn: number;
  stock: number | null;
  sizes: string[] | null;
  file_path: string | null;
  lead_capture: boolean;
  published: boolean;
  min_plan: string | null;
  sort_order: number;
  is_featured: boolean;
}

/** Fields safe to send to the browser (never the private file path). */
export type PublicShopProduct = Omit<ShopProduct, 'file_path'>;

export const naira = (n: number) => '₦' + String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

export const isFree = (p: Pick<ShopProduct, 'price_ngn'>) => p.price_ngn <= 0;
export const inStock = (p: Pick<ShopProduct, 'stock'>) => p.stock == null || p.stock > 0;

export const ORDER_STATUSES = ['pending', 'paid', 'packing', 'shipped', 'delivered', 'ready', 'cancelled'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

/** Cover first, then the hover picture, then the gallery. Pictures and GIFs are treated the same. */
export function productMedia(p: { image_url: string | null; hover_image_url?: string | null; gallery_urls?: string[] | null }): string[] {
  const all = [p.image_url, p.hover_image_url, ...(p.gallery_urls ?? [])].filter((u): u is string => !!u);
  return Array.from(new Set(all));
}
