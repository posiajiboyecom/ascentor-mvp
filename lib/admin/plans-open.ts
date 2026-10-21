// lib/admin/plans-open.ts
// Server-only. Which plans are open for sign-ups (Plans and pricing > "Open for sign-ups"). Fails open: if the
// setting cannot be read, a plan stays open so a settings problem can never block checkout.
import 'server-only';
import { getSettings, asBool, type SettingKey } from '@/lib/admin/settings';

export const PLAN_OPEN_KEY: Record<string, SettingKey> = {
  explorer: 'plan.seeker.open',
  builder: 'plan.builder.open',
  leader: 'plan.leader.open',
};

/** Plan ids that are currently closed. Climber (legacy) is never in this list. */
export async function closedPlanIds(): Promise<string[]> {
  try {
    const s = await getSettings();
    return Object.entries(PLAN_OPEN_KEY).filter(([, k]) => !asBool(s[k])).map(([id]) => id);
  } catch {
    return [];
  }
}
