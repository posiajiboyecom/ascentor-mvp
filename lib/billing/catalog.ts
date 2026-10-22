// lib/billing/catalog.ts
// ─────────────────────────────────────────────────────────────────────────────
// Billing v2 plan catalog. THE ONLY PLACE PRICES LIVE. Copied from the Payments
// Developer Handoff. All amounts are integer KOBO (NGN x 100). Pure: no I/O.
//
// Exports
//   PLANS                                 all eight paid plans
//   PlanCode, Tier, PriceType, Cycle      types
//   planCodeFor(tier, priceType, cycle)   -> PlanCode
//   getPlan(code)                         -> Plan | null
//   priceFor(tier, priceType, cycle)      -> kobo
//   perMonthKobo(plan)                    -> monthly-equivalent kobo (rounded)
//   tierLabel(tier)                       -> 'Seeker' | 'Builder'
//   formatNaira(kobo)                     -> "₦3,000"
//   isPaidTier(x)                         -> type guard
//
// DB plan ids stay: Seeker = 'explorer', Builder = 'builder' (Leader = 'leader', free, not in this catalog).
// ─────────────────────────────────────────────────────────────────────────────

export type Tier = 'explorer' | 'builder';
export type PriceType = 'solo' | 'group';
export type Cycle = 'monthly' | 'yearly';

export type PlanCode =
  | 'seeker_solo_monthly' | 'seeker_solo_annual' | 'seeker_group_monthly' | 'seeker_group_annual'
  | 'builder_solo_monthly' | 'builder_solo_annual' | 'builder_group_monthly' | 'builder_group_annual';

export interface Plan {
  code: PlanCode;
  tier: Tier;
  priceType: PriceType;
  cycle: Cycle;
  /** Charged per cycle, in kobo. */
  amountKobo: number;
}

const naira = (n: number) => n * 100;

export const PLANS: readonly Plan[] = [
  { code: 'seeker_solo_monthly',   tier: 'explorer', priceType: 'solo',  cycle: 'monthly', amountKobo: naira(3_000) },
  { code: 'seeker_solo_annual',    tier: 'explorer', priceType: 'solo',  cycle: 'yearly',  amountKobo: naira(30_000) },
  { code: 'seeker_group_monthly',  tier: 'explorer', priceType: 'group', cycle: 'monthly', amountKobo: naira(2_000) },
  { code: 'seeker_group_annual',   tier: 'explorer', priceType: 'group', cycle: 'yearly',  amountKobo: naira(22_000) },
  { code: 'builder_solo_monthly',  tier: 'builder',  priceType: 'solo',  cycle: 'monthly', amountKobo: naira(7_000) },
  { code: 'builder_solo_annual',   tier: 'builder',  priceType: 'solo',  cycle: 'yearly',  amountKobo: naira(70_000) },
  { code: 'builder_group_monthly', tier: 'builder',  priceType: 'group', cycle: 'monthly', amountKobo: naira(5_000) },
  { code: 'builder_group_annual',  tier: 'builder',  priceType: 'group', cycle: 'yearly',  amountKobo: naira(55_000) },
];

export function isPaidTier(x: unknown): x is Tier {
  return x === 'explorer' || x === 'builder';
}

export function tierLabel(tier: Tier): 'Seeker' | 'Builder' {
  return tier === 'builder' ? 'Builder' : 'Seeker';
}

export function planCodeFor(tier: Tier, priceType: PriceType, cycle: Cycle): PlanCode {
  const t = tier === 'builder' ? 'builder' : 'seeker';
  return `${t}_${priceType}_${cycle === 'yearly' ? 'annual' : 'monthly'}` as PlanCode;
}

export function getPlan(code: string | null | undefined): Plan | null {
  return PLANS.find((p) => p.code === code) ?? null;
}

export function priceFor(tier: Tier, priceType: PriceType, cycle: Cycle): number {
  const plan = getPlan(planCodeFor(tier, priceType, cycle));
  if (!plan) throw new Error(`No plan for ${tier}/${priceType}/${cycle}`);
  return plan.amountKobo;
}

/** Monthly-equivalent price of a plan in kobo (yearly divided by 12, rounded). */
export function perMonthKobo(plan: Plan): number {
  return plan.cycle === 'yearly' ? Math.round(plan.amountKobo / 12) : plan.amountKobo;
}

/** "₦3,000" (drops the decimals when it is whole naira, otherwise shows two). */
export function formatNaira(kobo: number): string {
  const n = kobo / 100;
  const whole = Number.isInteger(n);
  return '₦' + n.toLocaleString('en-NG', { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: 2 });
}
