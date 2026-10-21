'use server';

import { revalidatePath } from 'next/cache';
import { requireMember, fail, type ActionResult } from '@/lib/rx/server';

const UUID = /^[0-9a-f-]{36}$/i;

/** Marks one of the member's own notifications read. Row-level security limits this to their own rows. */
export async function markNotificationRead(id: string): Promise<ActionResult> {
  try {
    const { db, userId } = await requireMember();
    if (!UUID.test(id)) throw new Error('That notification can’t be found.');
    const { error } = await db.from('notifications').update({ read: true }).eq('id', id).eq('user_id', userId);
    if (error) throw error;
    revalidatePath('/notifications');
    return { ok: true };
  } catch (e) { return fail(e); }
}

export async function markAllNotificationsRead(): Promise<ActionResult> {
  try {
    const { db, userId } = await requireMember();
    const { error } = await db.from('notifications').update({ read: true }).eq('user_id', userId).eq('read', false);
    if (error) throw error;
    revalidatePath('/notifications');
    return { ok: true };
  } catch (e) { return fail(e); }
}
