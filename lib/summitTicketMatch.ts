// Pure matching rules for "Find my ticket" (no server-only imports, so they can be unit tested).

/** The short code printed on the screen ticket, e.g. ES-1A2B3C4D. Derived from the registration id, so nothing extra is stored. */
export const referenceOf = (id: string) => `ES-${String(id).replace(/-/g, '').slice(0, 8).toUpperCase()}`;

const digits = (v: string) => String(v ?? '').replace(/\D/g, '');

/** Phone numbers are typed many ways (+234 803..., 0803...). Compare the last 9 digits, which is the part that identifies the line. */
export function samePhone(a: string, b: string): boolean {
  const x = digits(a), y = digits(b);
  return x.length >= 9 && y.length >= 9 && x.slice(-9) === y.slice(-9);
}

/** True when the second factor matches: the WhatsApp number given at registration, or the ES- reference code. Exact match only. */
export function secondFactorMatches(reg: { id: string; whatsapp?: string | null }, factor: { whatsapp?: string; reference?: string }): boolean {
  if (factor.reference && factor.reference.trim().toUpperCase() === referenceOf(reg.id)) return true;
  if (factor.whatsapp && reg.whatsapp && samePhone(factor.whatsapp, reg.whatsapp)) return true;
  return false;
}
