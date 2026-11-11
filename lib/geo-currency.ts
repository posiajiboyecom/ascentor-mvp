// lib/geo-currency.ts
// Which currency a visitor pays in. Pure, so it can be shared by server code, client code and tests.
//
// Rule (set by Posi): people in Nigeria pay naira, everyone else pays US dollars. Members cannot switch.
// An unknown country (local development, or a request Vercel could not place) counts as Nigeria, so nobody is
// ever charged dollars by accident.

import type { Currency } from '@/lib/billing/catalog';

/** ISO 3166-1 alpha-2 country code -> currency. */
export function currencyForCountry(country: string | null | undefined): Currency {
  const cc = (country ?? '').trim().toUpperCase();
  if (!cc || cc === 'NG' || cc === 'XX' || cc.length !== 2) return 'NGN';
  return 'USD';
}
