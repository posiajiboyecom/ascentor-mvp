// lib/billing/flags.ts
// The two billing switches, read from the environment at request time (never from a client). Both default OFF.
//   billingV2Enabled()   BILLING_V2 === 'on'  : shows the new checkout, Billing screen and card management
//   chargingMode()       lives in engine.ts   : BILLING_V2_CHARGING = off | dry | live
// No server-only import: safe to call from server components too.

export function billingV2Enabled(): boolean {
  return (process.env.BILLING_V2 ?? '').trim().toLowerCase() === 'on';
}
