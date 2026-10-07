'use server';

import { revalidatePath } from 'next/cache';
import { requireMember, fail } from '@/lib/rx/server';
import type { ActionResult } from '@/lib/rx/types';
import { DM_POLICIES, LANGUAGES, NOTIF_TYPES } from '@/lib/rx/constants';
import { TZC, tzInfo } from '@/lib/rx/timezones';

async function patch(values: Record<string, unknown>): Promise<ActionResult> {
  try {
    const { db, userId } = await requireMember();
    const { error } = await db.from('member_profile').upsert({ user_id: userId, ...values, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
    if (error) throw error;
    revalidatePath('/settings');
    return { ok: true };
  } catch (e) { return fail(e); }
}

export async function saveNotifications(notif: Record<string, boolean>, annMuted: boolean, quietHours: boolean): Promise<ActionResult> {
  const clean: Record<string, boolean> = {};
  for (const k of NOTIF_TYPES) clean[k] = !!notif[k];
  return patch({ notif: clean, ann_muted: !!annMuted, quiet_hours: !!quietHours });
}

export async function saveMessaging(policy: string): Promise<ActionResult> {
  if (!DM_POLICIES.some((p) => p.value === policy)) return { ok: false, error: 'Choose one of the options.' };
  return patch({ dm_policy: policy });
}

export async function saveResearch(on: boolean): Promise<ActionResult> { return patch({ research_opt_in: !!on }); }

export async function saveLanguage(language: string): Promise<ActionResult> {
  if (!LANGUAGES.includes(language)) return { ok: false, error: 'Choose one of the languages.' };
  return patch({ language });
}

/** Changes the member's time zone. Times across the app follow it. */
export async function saveTimezone(zone: string): Promise<ActionResult> {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: zone });
  } catch { return { ok: false, error: 'That time zone isn’t valid.' }; }
  const info = tzInfo(zone);
  return patch({ timezone: zone, timezone_label: `${info.city}, ${info.country} (${info.off})`, city: info.city, country: TZC[zone] ?? info.country });
}

export async function unblockMember(blockedId: string): Promise<ActionResult> {
  try {
    const { db, userId } = await requireMember();
    const { error } = await db.from('dm_blocks').delete().eq('blocker_id', userId).eq('blocked_id', blockedId);
    if (error) throw error;
    revalidatePath('/settings');
    return { ok: true };
  } catch (e) { return fail(e); }
}
