'use server';

import { revalidatePath } from 'next/cache';
import { staffForAction } from '@/lib/admin/access';
import { auditAdmin } from '@/lib/admin/audit';
import { setSetting, type SettingKey } from '@/lib/admin/settings';

export interface PlansInput {
  open: { seeker: boolean; builder: boolean };
}

export type SaveResult = { ok: true; message: string } | { ok: false; error: string };

export async function savePlans(input: PlansInput): Promise<SaveResult> {
  try {
    const staff = await staffForAction();
    staff.require('plans', 'edit');

    const writes: [SettingKey, string][] = [
      ['plan.seeker.open', String(input.open?.seeker === true)],
      ['plan.builder.open', String(input.open?.builder === true)],
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
