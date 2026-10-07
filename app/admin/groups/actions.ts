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
