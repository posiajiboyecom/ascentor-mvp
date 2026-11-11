// lib/billing/flags.ts
// Billing v2 is Ascentor's only billing system (Seeker, Builder and Pinnacle); the old subscription checkout is retired.
// billingV2Enabled() is kept for the call sites that still ask, and is always true. Charging itself is still
// controlled by BILLING_V2_CHARGING (off | dry | live, see lib/billing/engine.ts).
// No server-only import: safe to call from server components too.

export function billingV2Enabled(): boolean {
  return true;
}
