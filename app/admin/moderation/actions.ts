'use server';

import { revalidatePath } from 'next/cache';
import { fail, getMe } from '@/lib/rx/server';
import type { ActionResult } from '@/lib/rx/types';
import { supabaseAdmin } from '@/lib/supabase/admin';

async function requireStaffMember() {
  const me = await getMe();
  if (!me || !me.isStaff) throw new Error('Staff only.');
  return me;
}

export async function resolveItem(source: 'flag' | 'report', id: string, status: 'dismissed' | 'actioned'): Promise<ActionResult> {
  try {
    await requireStaffMember();
    const table = source === 'flag' ? 'rx_flags' : 'rx_reports';
    const { error } = await supabaseAdmin.from(table).update({ status }).eq('id', id);
    if (error) throw error;
    revalidatePath('/admin/moderation');
    return { ok: true };
  } catch (e) { return fail(e); }
}

/** Turns messaging off (or back on) for one member. They can still use their Circle and the rest of the app. */
export async function setMessagingBlocked(userId: string, blocked: boolean): Promise<ActionResult> {
  try {
    await requireStaffMember();
    const { error } = await supabaseAdmin.from('member_profile').upsert({ user_id: userId, messaging_blocked: blocked, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
    if (error) throw error;
    revalidatePath('/admin/moderation');
    return { ok: true };
  } catch (e) { return fail(e); }
}
