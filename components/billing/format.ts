// components/billing/format.ts
// Display helpers for the member billing screens. Pure and safe in client components. No prices here: prices come from
// lib/billing/catalog.ts (formatNaira) and are passed in from the server.

export const BILLING_TZ = 'Africa/Lagos';

export function fmtDate(iso: string | null | undefined, tz: string = BILLING_TZ): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: tz });
}

export function fmtDateShort(iso: string | null | undefined, tz: string = BILLING_TZ): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: tz });
}

/** "Visa" from "visa", "Mastercard" from "mastercard". */
export function brandName(brand: string | null | undefined): string {
  const b = (brand ?? '').trim();
  if (!b) return 'Card';
  const lower = b.toLowerCase();
  if (lower === 'visa') return 'Visa';
  if (lower === 'mastercard') return 'Mastercard';
  if (lower === 'verve') return 'Verve';
  return b.charAt(0).toUpperCase() + b.slice(1);
}

/** "08/2030" */
export function expiry(m: string | null | undefined, y: string | null | undefined): string {
  if (!m || !y) return '';
  return `${m.padStart(2, '0')}/${y}`;
}
