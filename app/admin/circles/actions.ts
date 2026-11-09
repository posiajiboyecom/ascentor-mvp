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

export async function updateCircleMeeting(circleId: string, input: { dow: number; time: string }): Promise<ActionResult> {
  try {
    await requireAdmin();
    if (!(input.dow >= 0 && input.dow <= 6)) throw new Error('Choose a weekday.');
    if (!/^\d{2}:\d{2}$/.test(input.time)) throw new Error('Enter the time as HH:MM.');
    const { error } = await supabaseAdmin.from('circles').update({ meeting_dow: input.dow, meeting_time: input.time }).eq('id', circleId);
    if (error) throw error;
    revalidatePath('/admin/circles');
    return { ok: true };
  } catch (e) { return fail(e); }
}

export async function renameCircle(circleId: string, name: string): Promise<ActionResult> {
  try {
    await requireAdmin();
    const n = cleanText(name, 60);
    if (!n) throw new Error('Enter a name.');
    const { error } = await supabaseAdmin.from('circles').update({ name: n }).eq('id', circleId);
    if (error) throw error;
    revalidatePath('/admin/circles');
    return { ok: true };
  } catch (e) { return fail(e); }
}

export async function setCircleStatus(circleId: string, status: 'forming' | 'active' | 'completed'): Promise<ActionResult> {
  try {
    await requireAdmin();
    const update: Record<string, unknown> = { status };
    if (status === 'active') update.cycle_start = update.cycle_start ?? new Date().toISOString().slice(0, 10);
    const { error } = await supabaseAdmin.from('circles').update(update).eq('id', circleId);
    if (error) throw error;
    revalidatePath('/admin/circles');
    return { ok: true };
  } catch (e) { return fail(e); }
}

export async function addCircleMember(circleId: string, email: string): Promise<ActionResult> {
  try {
    await requireAdmin();
    const m = await memberByEmail(email);
    // Check seat count
    const { count } = await supabaseAdmin.from('circle_seats').select('id', { count: 'exact', head: true }).eq('circle_id', circleId).eq('role', 'member');
    if ((count ?? 0) >= 8) throw new Error('Circle is full (8 members max).');
    const { error } = await supabaseAdmin.from('circle_seats').upsert({ circle_id: circleId, user_id: m.id, role: 'member' }, { onConflict: 'circle_id,user_id', ignoreDuplicates: true });
    if (error) throw error;
    revalidatePath('/admin/circles');
    return { ok: true };
  } catch (e) { return fail(e); }
}

export async function removeCircleMember(circleId: string, userId: string): Promise<ActionResult> {
  try {
    await requireAdmin();
    const { error } = await supabaseAdmin.from('circle_seats').delete().eq('circle_id', circleId).eq('user_id', userId).eq('role', 'member');
    if (error) throw error;
    revalidatePath('/admin/circles');
    return { ok: true };
  } catch (e) { return fail(e); }
}

export async function getCircleMembers(circleId: string): Promise<{ ok: true; members: { id: string; name: string; email: string }[] } | { ok: false; error: string }> {
  try {
    await requireAdmin();
    const { data: seats } = await supabaseAdmin.from('circle_seats').select('user_id').eq('circle_id', circleId).eq('role', 'member');
    if (!seats || seats.length === 0) return { ok: true, members: [] };
    const ids = (seats as { user_id: string }[]).map((s) => s.user_id);
    const { data: profiles } = await supabaseAdmin.from('profiles').select('id, full_name, email').in('id', ids);
    return { ok: true, members: ((profiles ?? []) as { id: string; full_name: string | null; email: string | null }[]).map((p) => ({ id: p.id, name: p.full_name?.trim() || 'Member', email: p.email ?? '' })) };
  } catch (e) { return fail(e) as { ok: false; error: string }; }
}
