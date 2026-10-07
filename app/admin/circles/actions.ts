'use server';

import { revalidatePath } from 'next/cache';
import { fail } from '@/lib/rx/server';
import type { ActionResult } from '@/lib/rx/types';
import { requireAdmin } from '@/lib/rx/admin';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { cleanText } from '@/lib/rx/safety';

async function memberByEmail(email: string) {
  const e = cleanText(email, 200).toLowerCase();
  if (!e) throw new Error('Enter the member’s email.');
  const { data } = await supabaseAdmin.from('profiles').select('id, full_name').ilike('email', e).maybeSingle();
  if (!data) throw new Error('No member has that email.');
  return data as { id: string; full_name: string | null };
}

/** Marks a member as a facilitator (or removes the flag). Members cannot set this on themselves. */
export async function setFacilitator(email: string, on: boolean): Promise<ActionResult> {
  try {
    await requireAdmin();
    const m = await memberByEmail(email);
    const { error } = await supabaseAdmin.from('member_profile').upsert({ user_id: m.id, is_facilitator: on, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
    if (error) throw error;
    revalidatePath('/admin/circles');
    return { ok: true };
  } catch (e) { return fail(e); }
}

export async function assignFacilitator(circleId: string, facilitatorId: string | null): Promise<ActionResult> {
  try {
    await requireAdmin();
    if (facilitatorId) {
      const { data: mp } = await supabaseAdmin.from('member_profile').select('is_facilitator').eq('user_id', facilitatorId).maybeSingle();
      if (!mp?.is_facilitator) throw new Error('Mark them as a facilitator first.');
    }
    await supabaseAdmin.from('circle_seats').delete().eq('circle_id', circleId).eq('role', 'facilitator');
    if (facilitatorId) await supabaseAdmin.from('circle_seats').upsert({ circle_id: circleId, user_id: facilitatorId, role: 'facilitator' }, { onConflict: 'circle_id,user_id' });
    const { error } = await supabaseAdmin.from('circles').update({ facilitator_id: facilitatorId }).eq('id', circleId);
    if (error) throw error;
    revalidatePath('/admin/circles');
    return { ok: true };
  } catch (e) { return fail(e); }
}

export async function updateCircleMeeting(circleId: string, input: { dow: number; time: string; url: string }): Promise<ActionResult> {
  try {
    await requireAdmin();
    if (!(input.dow >= 0 && input.dow <= 6)) throw new Error('Choose a weekday.');
    if (!/^\d{2}:\d{2}$/.test(input.time)) throw new Error('Enter the time as HH:MM.');
    const url = cleanText(input.url, 300);
    if (url && !/^https:\/\//i.test(url)) throw new Error('The meeting link must start with https://');
    const { error } = await supabaseAdmin.from('circles').update({ meeting_dow: input.dow, meeting_time: input.time, meeting_url: url || null }).eq('id', circleId);
    if (error) throw error;
    revalidatePath('/admin/circles');
    return { ok: true };
  } catch (e) { return fail(e); }
}
