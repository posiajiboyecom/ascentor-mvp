// lib/billing/catalog.ts
// ─────────────────────────────────────────────────────────────────────────────
// Billing v2 plan catalog. THE ONLY PLACE PRICES LIVE. Pure: no I/O.
//
// Two currencies. Members in Nigeria pay naira; everyone else pays US dollars (lib/geo.ts decides, and a subscription
// keeps the currency it started in). Amounts are integer MINOR units of their currency: kobo for NGN (naira x 100),
// cents for USD (dollars x 100). Field and function names say "kobo" for history; read them as "minor units".
//   NGN  Seeker ₦3,000 / ₦30,000 a year, group ₦2,000 / ₦22,000;  Builder ₦7,000 / ₦70,000, group ₦5,000 / ₦55,000
//   USD  Seeker $5 / $50 a year;  Builder $10 / $100 a year.  No group discount in USD: group = solo.
//
// Exports
//   PLANS                                       all eight paid plans (NGN amounts in amountKobo, USD in amountUsdCents)
//   PlanCode, Tier, PriceType, Cycle, Currency  types
//   CURRENCIES, isCurrency(x)
//   planCodeFor(tier, priceType, cycle)         -> PlanCode
//   getPlan(code)                               -> Plan | null
//   planAmount(plan, currency)                  -> minor units
//   priceFor(tier, priceType, cycle, currency?) -> minor units (currency defaults to NGN)
//   perMonthKobo(plan, currency?)               -> monthly-equivalent minor units (rounded)
//   groupDiscountApplies(currency)              -> false for USD
//   tierLabel(tier)                             -> 'Seeker' | 'Builder'
//   formatMoney(minor, currency)                -> "₦3,000" | "$5" | "$4.17"
//   formatNaira(kobo)                           -> "₦3,000"
//   isPaidTier(x)                               -> type guard
//
// DB plan ids stay: Seeker = 'explorer', Builder = 'builder' (Leader = 'leader', free, not in this catalog).
// ─────────────────────────────────────────────────────────────────────────────

export type Tier = 'explorer' | 'builder';
export type Currency = 'NGN' | 'USD';
export const CURRENCIES: readonly Currency[] = ['NGN', 'USD'];
export function isCurrency(x: unknown): x is Currency { return x === 'NGN' || x === 'USD'; }
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
  /** Charged per cycle in naira, in kobo. */
  amountKobo: number;
  /** Charged per cycle in US dollars, in cents. */
  amountUsdCents: number;
}

const naira = (n: number) => n * 100;
const usd = (n: number) => Math.round(n * 100);

export const PLANS: readonly Plan[] = [
  { code: 'seeker_solo_monthly',   tier: 'explorer', priceType: 'solo',  cycle: 'monthly', amountKobo: naira(3_000),  amountUsdCents: usd(5) },
  { code: 'seeker_solo_annual',    tier: 'explorer', priceType: 'solo',  cycle: 'yearly',  amountKobo: naira(30_000), amountUsdCents: usd(50) },
  { code: 'seeker_group_monthly',  tier: 'explorer', priceType: 'group', cycle: 'monthly', amountKobo: naira(2_000),  amountUsdCents: usd(5) },
  { code: 'seeker_group_annual',   tier: 'explorer', priceType: 'group', cycle: 'yearly',  amountKobo: naira(22_000), amountUsdCents: usd(50) },
  { code: 'builder_solo_monthly',  tier: 'builder',  priceType: 'solo',  cycle: 'monthly', amountKobo: naira(7_000),  amountUsdCents: usd(10) },
  { code: 'builder_solo_annual',   tier: 'builder',  priceType: 'solo',  cycle: 'yearly',  amountKobo: naira(70_000), amountUsdCents: usd(100) },
  { code: 'builder_group_monthly', tier: 'builder',  priceType: 'group', cycle: 'monthly', amountKobo: naira(5_000),  amountUsdCents: usd(10) },
  { code: 'builder_group_annual',  tier: 'builder',  priceType: 'group', cycle: 'yearly',  amountKobo: naira(55_000), amountUsdCents: usd(100) },
];

/** The amount a plan charges per cycle in the given currency, in that currency's minor units. */
export function planAmount(plan: Plan, currency: Currency = 'NGN'): number {
  return currency === 'USD' ? plan.amountUsdCents : plan.amountKobo;
}

/** Group pricing is a naira discount only; in USD a group member pays the solo price. */
export function groupDiscountApplies(currency: Currency): boolean {
  return currency === 'NGN';
}

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

export function priceFor(tier: Tier, priceType: PriceType, cycle: Cycle, currency: Currency = 'NGN'): number {
  const plan = getPlan(planCodeFor(tier, priceType, cycle));
  if (!plan) throw new Error(`No plan for ${tier}/${priceType}/${cycle}`);
  return planAmount(plan, currency);
}

/** Monthly-equivalent price of a plan in minor units (yearly divided by 12, rounded). */
export function perMonthKobo(plan: Plan, currency: Currency = 'NGN'): number {
  const amount = planAmount(plan, currency);
  return plan.cycle === 'yearly' ? Math.round(amount / 12) : amount;
}

/** "₦3,000" or "$5" / "$4.17": drops the decimals when the amount is whole, otherwise shows two. */
export function formatMoney(minor: number, currency: Currency = 'NGN'): string {
  if (currency === 'NGN') return formatNaira(minor);
  const n = minor / 100;
  const whole = Number.isInteger(n);
  return (n < 0 ? '-$' : '$') + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: 2 });
}

/** "₦3,000" (drops the decimals when it is whole naira, otherwise shows two). */
export function formatNaira(kobo: number): string {
  const n = kobo / 100;
  const whole = Number.isInteger(n);
  return '₦' + n.toLocaleString('en-NG', { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: 2 });
}
