'use server';

import { revalidatePath } from 'next/cache';
import { requireMember, fail, type ActionResult } from '@/lib/rx/server';
import { getMemberAnnouncements } from '@/lib/rx/announcements';

export async function markAnnouncementRead(id: string): Promise<ActionResult> {
  try {
    const { db, userId } = await requireMember();
    const { error } = await db.from('announcement_reads').upsert({ user_id: userId, announcement_id: id }, { onConflict: 'user_id,announcement_id' });
    if (error) throw error;
    revalidatePath('/announcements');
    return { ok: true };
  } catch (e) { return fail(e); }
}

export async function markAllAnnouncementsRead(): Promise<ActionResult> {
  try {
    const { db, userId } = await requireMember();
    const all = await getMemberAnnouncements();
    const rows = all.filter((a) => !a.isRead).map((a) => ({ user_id: userId, announcement_id: a.id }));
    if (rows.length) {
      const { error } = await db.from('announcement_reads').upsert(rows, { onConflict: 'user_id,announcement_id' });
      if (error) throw error;
    }
    revalidatePath('/announcements');
    revalidatePath('/dashboard');
    return { ok: true };
  } catch (e) { return fail(e); }
}
