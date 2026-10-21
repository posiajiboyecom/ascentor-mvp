'use server';

import { revalidatePath } from 'next/cache';
import { staffForAction } from '@/lib/admin/access';
import { auditAdmin } from '@/lib/admin/audit';
import { setSetting, type SettingKey } from '@/lib/admin/settings';

export interface PlansInput {
  open: { seeker: boolean; builder: boolean; leader: boolean };
  extraDays: number;
  graceDays: number;
  light: { today: boolean; chat: boolean; sage: boolean; learn: boolean; mentor: boolean; groups: boolean };
}

export type SaveResult = { ok: true; message: string } | { ok: false; error: string };

const wholeInRange = (v: unknown, min: number, max: number) => typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;

export async function savePlans(input: PlansInput): Promise<SaveResult> {
  try {
    const staff = await staffForAction();
    staff.require('plans', 'edit');

    if (!wholeInRange(input?.extraDays, 0, 60)) return { ok: false, error: 'Extra days must be a whole number from 0 to 60.' };
    if (!wholeInRange(input?.graceDays, 0, 60)) return { ok: false, error: 'The grace period must be a whole number of days from 0 to 60.' };

    const writes: [SettingKey, string][] = [
      ['plan.seeker.open', String(input.open?.seeker === true)],
      ['plan.builder.open', String(input.open?.builder === true)],
      ['plan.leader.open', String(input.open?.leader === true)],
      ['billing.extra_days', String(input.extraDays)],
      ['billing.grace_days', String(input.graceDays)],
      ['light.today', String(input.light?.today === true)],
      ['light.chat', String(input.light?.chat === true)],
      ['light.sage', String(input.light?.sage === true)],
      ['light.learn', String(input.light?.learn === true)],
      ['light.mentor', String(input.light?.mentor === true)],
      ['light.groups', String(input.light?.groups === true)],
    ];
    for (const [k, v] of writes) {
      const err = await setSetting(k, v);
      if (err) return { ok: false, error: err };
    }

    await auditAdmin(staff, 'Saved changes', 'Plans and pricing', 'Plans and pricing');
    revalidatePath('/admin/c/plans');
    revalidatePath('/checkout');
    return { ok: true, message: 'Saved. Members see the change straight away.' };
  } catch (e) {
    return { ok: false, error: e instanceof Error && e.message ? e.message : 'That did not work. Please try again.' };
  }
}
