// lib/promo-codes.ts
// ─────────────────────────────────────────────────────────────
// FALLBACK-ONLY — not the primary promo code system.
//
// Your PRIMARY promo code system is fully DB-driven:
//   - Admin creates/manages codes at /admin/promo-codes
//   - Stored in the `promo_codes` Supabase table
//   - Claimed atomically via the `claim_promo_code` RPC
//   - Supports: expiry dates, usage caps, auto-apply, bulk generation
//
// This file is ONLY imported by /api/payments/initialize as a
// last-resort fallback when the DB RPC call fails (e.g. migration
// not yet run). It should never be the primary path.
//
// HIGH-3 ACTION: Codes below are hardcoded backdoors with no
// expiry and no usage cap. They bypass your admin UI entirely.
// Migrate them to the DB then delete this file:
//   1. Go to /admin/promo-codes
//   2. Recreate each active code with expires_at + max_uses
//   3. Comment out / delete the line here
//   4. Once PROMO_CODES is empty, delete this file and remove
//      the lookupPromo() fallback calls from initialize routes.
// ─────────────────────────────────────────────────────────────

export interface PromoCode {
  discount: number;
  label:    string;
}

// ⚠️  MIGRATE THESE TO DB THEN DELETE — see instructions above
export const PROMO_CODES: Record<string, PromoCode> = {
  // Comment out each line once migrated to /admin/promo-codes:
  // 'FOUNDER50':  { discount: 0.50, label: 'Founders 50% Off'        }, // → add to DB with expires_at
  // 'ASCENTOR50': { discount: 0.50, label: 'Ascentor 50% Off'        }, // → add to DB with expires_at
  // 'EARLYBIRD':  { discount: 0.50, label: 'Early Bird 50% Off'      }, // → add to DB with expires_at
  // 'TESTER100':  { discount: 1.00, label: 'Tester Free Access'      }, // → add to DB, max_uses: 5
  // 'BETATESTER': { discount: 1.00, label: 'Beta Tester Free Access'  }, // → add to DB, max_uses: 10
  // 'FREEACCESS': { discount: 1.00, label: 'Free Access'             }, // → DELETE, too generic
};

/**
 * Fallback lookup — returns null once all codes are migrated to DB.
 */
export function lookupPromo(code: string): PromoCode | null {
  return PROMO_CODES[code.trim().toUpperCase()] ?? null;
}
