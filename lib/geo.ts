// lib/geo.ts
// The visitor's country and currency, read from the request on the server. Never from the client.
//
// Vercel adds `x-vercel-ip-country` at its edge and replaces any value the visitor sent, so it cannot be set by hand.
// A VPN can still change it; a subscription keeps the currency it started in (member_subscriptions.currency), so
// renewals never switch currency when a member travels.

import 'server-only';
import { headers } from 'next/headers';
import { currencyForCountry } from '@/lib/geo-currency';
import type { Currency } from '@/lib/billing/catalog';

export { currencyForCountry };

/** Two-letter country code of the current request, or null when unknown. */
export async function visitorCountry(): Promise<string | null> {
  try {
    const h = await headers();
    const cc = h.get('x-vercel-ip-country');
    return cc && /^[A-Za-z]{2}$/.test(cc) ? cc.toUpperCase() : null;
  } catch {
    return null; // outside a request (build, cron): no visitor
  }
}

/** NGN for visitors in Nigeria (or unknown), USD for everyone else. */
export async function visitorCurrency(): Promise<Currency> {
  return currencyForCountry(await visitorCountry());
}

/** Country of a Request object (route handlers that receive `req`). */
export function requestCountry(req: Request): string | null {
  const cc = req.headers.get('x-vercel-ip-country');
  return cc && /^[A-Za-z]{2}$/.test(cc) ? cc.toUpperCase() : null;
}

export function requestCurrency(req: Request): Currency {
  return currencyForCountry(requestCountry(req));
}
