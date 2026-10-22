'use server';

// Billing group admin actions. Admin is the only place that lists who is in a group. Levels are checked here, not in the page.
import { revalidatePath } from 'next/cache';
import { staffForAction } from '@/lib/admin/access';
import { auditAdmin } from '@/lib/admin/audit';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { logBillingEvent } from '@/lib/billing/events';

const AREA = 'Members';
type Res = { ok: boolean; message?: string; error?: string };
const msg = (e: unknown) => (e instanceof Error && e.message ? e.message : 'That did not work. Please try again.');
const isId = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f-]{36}$/i.test(v);

async function groupCode(id: string): Promise<string | null> {
  const { data } = await supabaseAdmin.from('billing_groups').select('code').eq('id', id).maybeSingle();
  return (data?.code as string | undefined) ?? null;
}

export async function flagGroup(groupId: string, reason: string): Promise<Res> {
  try {
    const staff = await staffForAction();
    staff.require('members', 'edit');
    if (!isId(groupId)) return { ok: false, error: 'Unknown group.' };
    const why = String(reason ?? '').trim().slice(0, 200);
    if (!why) return { ok: false, error: 'Add a short reason so the next person knows why it was flagged.' };
    const code = await groupCode(groupId);
    if (!code) return { ok: false, error: 'That group no longer exists.' };
    const { error } = await supabaseAdmin.from('billing_groups').update({ flagged: true, flag_reason: why }).eq('id', groupId);
    if (error) return { ok: false, error: 'We could not flag this group. Please try again.' };
    await auditAdmin(staff, 'Flagged a group for review', code, AREA);
    revalidatePath('/admin/c/members/groups');
    return { ok: true, message: 'Flagged for review.' };
  } catch (e) { return { ok: false, error: msg(e) }; }
}

export async function clearGroupFlag(groupId: string): Promise<Res> {
  try {
    const staff = await staffForAction();
    staff.require('members', 'edit');
    if (!isId(groupId)) return { ok: false, error: 'Unknown group.' };
    const code = await groupCode(groupId);
    if (!code) return { ok: false, error: 'That group no longer exists.' };
    const { error } = await supabaseAdmin.from('billing_groups').update({ flagged: false, flag_reason: null }).eq('id', groupId);
    if (error) return { ok: false, error: 'We could not clear the flag. Please try again.' };
    await auditAdmin(staff, 'Cleared a group flag', code, AREA);
    revalidatePath('/admin/c/members/groups');
    return { ok: true, message: 'Flag cleared.' };
  } catch (e) { return { ok: false, error: msg(e) }; }
}

export async function removeGroupMember(groupId: string, userId: string): Promise<Res> {
  try {
    const staff = await staffForAction();
    staff.require('members', 'full');
    if (!isId(groupId) || !isId(userId)) return { ok: false, error: 'Unknown group or member.' };
    const code = await groupCode(groupId);
    if (!code) return { ok: false, error: 'That group no longer exists.' };
    const { data: row } = await supabaseAdmin.from('billing_group_members').select('user_id').eq('group_id', groupId).eq('user_id', userId).is('left_at', null).maybeSingle();
    if (!row) return { ok: false, error: 'That member is not in this group any more.' };
    const { data: prof } = await supabaseAdmin.from('profiles').select('full_name, email').eq('id', userId).maybeSingle();
    const { error } = await supabaseAdmin.from('billing_group_members').update({ left_at: new Date().toISOString() }).eq('group_id', groupId).eq('user_id', userId).is('left_at', null);
    if (error) return { ok: false, error: 'We could not remove this member. Please try again.' };
    await logBillingEvent(userId, 'group_left', { group_id: groupId, by: 'admin' });
    await auditAdmin(staff, `Removed a member from group ${code}`, ((prof?.full_name as string | null) || (prof?.email as string | null) || userId).trim(), AREA);
    revalidatePath('/admin/c/members/groups');
    return { ok: true, message: 'Member removed from the group.' };
  } catch (e) { return { ok: false, error: msg(e) }; }
}
