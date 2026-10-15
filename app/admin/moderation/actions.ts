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

/** Removes a flagged or reported post or comment from the feed. A post is hidden (kept for the record), a comment is deleted. */
export async function removeContent(kind: string, refId: string): Promise<ActionResult> {
  try {
    await requireStaffMember();
    if (!/^[0-9a-f-]{36}$/i.test(refId)) throw new Error('That item is no longer available.');
    if (kind === 'post') {
      const { error } = await supabaseAdmin.from('feed_posts').update({ deleted: true }).eq('id', refId);
      if (error) throw error;
    } else if (kind === 'comment') {
      const { error } = await supabaseAdmin.from('feed_replies').delete().eq('id', refId);
      if (error) throw error;
    } else throw new Error('Only posts and comments can be removed here.');
    revalidatePath('/admin/moderation'); revalidatePath('/community');
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
