// lib/billing/labels.ts
// Pure display helpers shared by the billing modules and the UI.
//   formatPlanName(tier, cycle)  -> "Seeker, monthly" | "Builder, yearly"
import { tierLabel, type Tier, type Cycle } from './catalog';

export function formatPlanName(tier: Tier, cycle: Cycle): string {
  return `${tierLabel(tier)}, ${cycle === 'yearly' ? 'yearly' : 'monthly'}`;
}
