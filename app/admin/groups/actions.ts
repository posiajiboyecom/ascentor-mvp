'use server';

import { revalidatePath } from 'next/cache';
import { fail } from '@/lib/rx/server';
import type { ActionResult } from '@/lib/rx/types';
import { requireAdmin } from '@/lib/rx/admin';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { cleanText } from '@/lib/rx/safety';
import { DIMENSIONS } from '@/lib/rx/constants';

const slugify = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_]+/g, '-').slice(0, 60);

export async function createGroup(input: { key?: string; name: string; description: string; dimension: string; fit: string[] }): Promise<ActionResult> {
  try {
    const me = await requireAdmin();
    const name = cleanText(input.name, 60);
    if (!name) throw new Error('Give the group a name.');
    const dimension = (DIMENSIONS as string[]).includes(input.dimension) ? input.dimension : 'Community';
    const db = await createClient();
    let slug = slugify(name) || 'group';
    const { data: clash } = await db.from('rx_groups').select('id').eq('slug', slug).maybeSingle();
    if (clash) slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`;
    const { error } = await db.from('rx_groups').insert({
      slug, name, description: cleanText(input.description, 160) || null, dimension, fit: input.fit.map((f) => cleanText(f, 60)).filter(Boolean),
      is_new: true, created_by: me.userId, prompt: 'Introduce yourself and what you hope to get from this group.',
    });
    if (error) throw error;
    if (input.key) await db.from('rx_group_suggestion_state').upsert({ key: input.key, status: 'created', decided_by: me.userId }, { onConflict: 'key' });
    revalidatePath('/admin/groups');
    return { ok: true };
  } catch (e) { return fail(e); }
}

export async function dismissSuggestion(key: string): Promise<ActionResult> {
  try {
    const me = await requireAdmin();
    const db = await createClient();
    const { error } = await db.from('rx_group_suggestion_state').upsert({ key, status: 'dismissed', decided_by: me.userId }, { onConflict: 'key' });
    if (error) throw error;
    revalidatePath('/admin/groups');
    return { ok: true };
  } catch (e) { return fail(e); }
}

async function notifyMembers(groupId: string, title: string, message: string, link: string) {
  const { data } = await supabaseAdmin.from('rx_group_members').select('user_id').eq('group_id', groupId);
  const rows = ((data ?? []) as { user_id: string }[]).map((m) => ({ user_id: m.user_id, type: 'community', title, message, link }));
  if (rows.length) await supabaseAdmin.from('notifications').insert(rows);
}

/** Archives a quiet group. Members keep their messages and are pointed to an active group. */
export async function archiveGroup(groupId: string): Promise<ActionResult> {
  try {
    await requireAdmin();
    const { data: g } = await supabaseAdmin.from('rx_groups').select('id, name, is_general, is_city, is_facilitators').eq('id', groupId).maybeSingle();
    if (!g || g.is_general || g.is_city || g.is_facilitators) throw new Error('This group can’t be archived.');
    await notifyMembers(groupId, `${g.name} has been archived`, 'It was quiet, so we closed it. Your messages are kept. Browse Groups to find an active one.', '/community/groups');
    const { error } = await supabaseAdmin.from('rx_groups').update({ status: 'archived' }).eq('id', groupId);
    if (error) throw error;
    revalidatePath('/admin/groups');
    return { ok: true };
  } catch (e) { return fail(e); }
}

export async function editGroup(groupId: string, input: { name: string; description: string }): Promise<ActionResult> {
  try {
    await requireAdmin();
    const name = cleanText(input.name, 60);
    if (!name) throw new Error('Give the group a name.');
    const { error } = await supabaseAdmin.from('rx_groups').update({ name, description: cleanText(input.description, 160) || null }).eq('id', groupId);
    if (error) throw error;
    revalidatePath('/admin/groups');
    return { ok: true };
  } catch (e) { return fail(e); }
}

export async function reactivateGroup(groupId: string): Promise<ActionResult> {
  try {
    await requireAdmin();
    const { data: g } = await supabaseAdmin.from('rx_groups').select('id, status').eq('id', groupId).maybeSingle();
    if (!g) throw new Error('Group not found.');
    if (g.status !== 'archived') throw new Error('Group is not archived.');
    const { error } = await supabaseAdmin.from('rx_groups').update({ status: 'active', is_new: false }).eq('id', groupId);
    if (error) throw error;
    revalidatePath('/admin/groups');
    return { ok: true };
  } catch (e) { return fail(e); }
}

export async function addGroupMember(groupId: string, email: string): Promise<ActionResult> {
  try {
    await requireAdmin();
    const e = cleanText(email, 200).toLowerCase();
    if (!e) throw new Error("Enter the member's email.");
    const { data: profile } = await supabaseAdmin.from('profiles').select('id').ilike('email', e).maybeSingle();
    if (!profile) throw new Error('No member has that email.');
    const { error } = await supabaseAdmin.from('rx_group_members').upsert({ group_id: groupId, user_id: (profile as { id: string }).id }, { onConflict: 'group_id,user_id', ignoreDuplicates: true });
    if (error) throw error;
    revalidatePath('/admin/groups');
    return { ok: true };
  } catch (e) { return fail(e); }
}

export async function removeGroupMember(groupId: string, userId: string): Promise<ActionResult> {
  try {
    await requireAdmin();
    const { error } = await supabaseAdmin.from('rx_group_members').delete().eq('group_id', groupId).eq('user_id', userId);
    if (error) throw error;
    revalidatePath('/admin/groups');
    return { ok: true };
  } catch (e) { return fail(e); }
}

export async function getGroupMembers(groupId: string): Promise<{ ok: true; members: { id: string; name: string; email: string }[] } | { ok: false; error: string }> {
  try {
    await requireAdmin();
    const { data: seats } = await supabaseAdmin.from('rx_group_members').select('user_id').eq('group_id', groupId);
    if (!seats || seats.length === 0) return { ok: true, members: [] };
    const ids = (seats as { user_id: string }[]).map((s) => s.user_id);
    const { data: profiles } = await supabaseAdmin.from('profiles').select('id, full_name, email').in('id', ids);
    return { ok: true, members: ((profiles ?? []) as { id: string; full_name: string | null; email: string | null }[]).map((p) => ({ id: p.id, name: p.full_name?.trim() || 'Member', email: p.email ?? '' })) };
  } catch (e) { return fail(e) as { ok: false; error: string }; }
}

/** Moves a quiet group's members into a close group, then archives it. Members are told. */
export async function mergeGroup(fromId: string, intoId: string): Promise<ActionResult> {
  try {
    await requireAdmin();
    if (fromId === intoId) throw new Error('Pick a different group to merge into.');
    const [{ data: from }, { data: into }] = await Promise.all([
      supabaseAdmin.from('rx_groups').select('id, name, is_general, is_city, is_facilitators').eq('id', fromId).maybeSingle(),
      supabaseAdmin.from('rx_groups').select('id, name, slug, status, is_facilitators').eq('id', intoId).maybeSingle(),
    ]);
    if (!from || !into || into.status !== 'active' || into.is_facilitators || from.is_general || from.is_city || from.is_facilitators) throw new Error('These groups can’t be merged.');
    const { data: members } = await supabaseAdmin.from('rx_group_members').select('user_id').eq('group_id', fromId);
    const rows = ((members ?? []) as { user_id: string }[]).map((m) => ({ group_id: intoId, user_id: m.user_id }));
    if (rows.length) await supabaseAdmin.from('rx_group_members').upsert(rows, { onConflict: 'group_id,user_id', ignoreDuplicates: true });
    await notifyMembers(fromId, `${from.name} is now part of ${into.name}`, `We merged the two groups. You’re already a member of ${into.name}.`, `/community/groups/${into.slug}`);
    const { error } = await supabaseAdmin.from('rx_groups').update({ status: 'archived' }).eq('id', fromId);
    if (error) throw error;
    revalidatePath('/admin/groups');
    return { ok: true };
  } catch (e) { return fail(e); }
}
