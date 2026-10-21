// lib/admin/badges.ts
// Menu badge counts. Only the areas the teammate can see are counted, each screen supplies its own cheap count
// (ScreenModule.badge), and any failure just shows no badge. It never blocks the page.
import 'server-only';
import { getScreen } from '@/lib/admin/screens';

export const BADGE_AREAS = ['recs', 'moderation', 'matching', 'payments', 'mentors', 'orders'] as const;

export async function getBadges(visible: string[]): Promise<Record<string, number>> {
  const keys = BADGE_AREAS.filter((k) => visible.includes(k));
  const entries = await Promise.all(keys.map(async (k) => {
    try {
      const screen = await getScreen(k);
      return [k, screen?.badge ? await screen.badge() : 0] as const;
    } catch {
      return [k, 0] as const;
    }
  }));
  return Object.fromEntries(entries.filter(([, n]) => n > 0));
}
