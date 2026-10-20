'use client';
// lib/shop-cart.ts
// The shop cart lives in the browser (localStorage) so it survives page changes and works offline,
// and is shared by the public shop and the member shop. It stores ONLY product id, size and quantity:
// names and prices are shown from the catalogue and re-priced on the server at checkout.

import { useCallback, useEffect, useState } from 'react';

export type CartItem = { productId: string; size: string | null; qty: number };

const KEY = 'ascentor.shop.cart.v1';
const EVENT = 'ascentor:cart';

function read(): CartItem[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.filter((i) => i && typeof i.productId === 'string' && Number.isInteger(i.qty) && i.qty > 0)
      : [];
  } catch {
    return [];
  }
}

function write(items: CartItem[]) {
  try { window.localStorage.setItem(KEY, JSON.stringify(items)); } catch { /* private mode: cart lasts this page only */ }
  window.dispatchEvent(new Event(EVENT));
}

export function useCart() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const sync = () => setItems(read());
    sync();
    setReady(true);
    window.addEventListener(EVENT, sync);
    window.addEventListener('storage', sync);
    return () => { window.removeEventListener(EVENT, sync); window.removeEventListener('storage', sync); };
  }, []);

  const add = useCallback((productId: string, size: string | null = null, qty = 1) => {
    const cur = read();
    const hit = cur.find((i) => i.productId === productId && i.size === size);
    if (hit) hit.qty = Math.min(20, hit.qty + qty); else cur.push({ productId, size, qty });
    write(cur);
  }, []);

  const setQty = useCallback((productId: string, size: string | null, qty: number) => {
    write(read().flatMap((i) => (i.productId === productId && i.size === size ? (qty > 0 ? [{ ...i, qty: Math.min(20, qty) }] : []) : [i])));
  }, []);

  const remove = useCallback((productId: string, size: string | null) => setQty(productId, size, 0), [setQty]);
  const clear = useCallback(() => write([]), []);
  const count = items.reduce((a, i) => a + i.qty, 0);

  return { items, count, ready, add, setQty, remove, clear };
}
