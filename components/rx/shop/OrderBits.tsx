'use client';

import { useEffect } from 'react';
import { useCart } from '@/lib/shop-cart';

/** The order is placed once Paystack sends the member back, so the browser cart can be emptied. */
export function ClearCart() {
  const { clear } = useCart();
  useEffect(() => { clear(); }, [clear]);
  return null;
}

export function DownloadButton({ orderId, productId, label }: { orderId: string; productId: string; label: string }) {
  return (
    <a className="rx-btn secondary" href={`/api/shop/download?order=${encodeURIComponent(orderId)}&product=${encodeURIComponent(productId)}`}>
      {label}
    </a>
  );
}
