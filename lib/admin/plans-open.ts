// lib/admin/plans-open.ts
// Server-only. Which plans are open for sign-ups (admin: Plans and pricing > "Open for sign-ups").
// Ascentor sells three plans, Seeker ('explorer'), Builder and Pinnacle. Billing v2 checkout and the start / change-plan
// endpoints all check this. Fails open: if the setting cannot be read, a plan stays open so a settings problem
// can never block checkout.
import 'server-only';
import { getSettings, asBool, type SettingKey } from '@/lib/admin/settings';
import type { Tier } from '@/lib/billing/catalog';

export const PLAN_OPEN_KEY: Record<Tier, SettingKey> = {
  explorer: 'plan.seeker.open',
  builder: 'plan.builder.open',
  pinnacle: 'plan.pinnacle.open',
};

/** Plans that are currently closed for sign-ups. */
export async function closedPlanIds(): Promise<Tier[]> {
  try {
    const s = await getSettings();
    return (Object.keys(PLAN_OPEN_KEY) as Tier[]).filter((id) => !asBool(s[PLAN_OPEN_KEY[id]]));
  } catch {
    return [];
  }
}

export const CLOSED_PLAN_MESSAGE = 'That plan is not open for sign-ups right now. Choose another plan, or try again later.';
