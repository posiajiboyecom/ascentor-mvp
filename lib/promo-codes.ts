// lib/promo-codes.ts
// ─────────────────────────────────────────────────────────────
// Single source of truth for all promo codes.
// Imported by:
//   - app/api/payment/initialize/route.ts
//   - app/api/payment/webhook/route.ts
//
// To add or retire a code: edit ONLY this file.
// ─────────────────────────────────────────────────────────────

export interface PromoCode {
  discount: number;  // 0.0–1.0 (e.g. 0.50 = 50% off, 1.0 = 100% free)
  label:    string;  // Human-readable label used in audit logs + notifications
}

export const PROMO_CODES: Record<string, PromoCode> = {
  'FOUNDER50':  { discount: 0.50, label: 'Founders 50% Off'       },
  'ASCENTOR50': { discount: 0.50, label: 'Ascentor 50% Off'       },
  'EARLYBIRD':  { discount: 0.50, label: 'Early Bird 50% Off'     },
  'TESTER100':  { discount: 1.00, label: 'Tester Free Access'     },
  'BETATESTER': { discount: 1.00, label: 'Beta Tester Free Access' },
  'FREEACCESS': { discount: 1.00, label: 'Free Access'            },
};

/**
 * Look up a promo code (case-insensitive).
 * Returns the PromoCode object or null if invalid.
 */
export function lookupPromo(code: string): PromoCode | null {
  return PROMO_CODES[code.trim().toUpperCase()] ?? null;
}
