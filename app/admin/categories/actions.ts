'use server';

import { revalidatePath } from 'next/cache';
import { fail } from '@/lib/rx/server';
import type { ActionResult } from '@/lib/rx/types';
import { requireAdmin } from '@/lib/rx/admin';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { cleanText } from '@/lib/rx/safety';
import { pgTerm } from '@/lib/security';

const slugify = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_]+/g, '-').slice(0, 40);

export async function addCategory(rawName: string): Promise<ActionResult> {
  try {
    await requireAdmin();
    const name = cleanText(rawName, 40);
    if (name.length < 2) throw new Error('Give the category a name of at least two letters.');
    const slug = slugify(name);
    if (!slug) throw new Error('Use letters or numbers in the name.');
    const { data: clash } = await supabaseAdmin.from('feed_categories').select('slug').or(`slug.eq.${slug},name.ilike.${pgTerm(name, 40)}`).maybeSingle();
    if (clash) throw new Error('A category with that name already exists.');
    const { data: last } = await supabaseAdmin.from('feed_categories').select('position').order('position', { ascending: false }).limit(1).maybeSingle();
    const { error } = await supabaseAdmin.from('feed_categories').insert({ slug, name, position: ((last?.position as number | undefined) ?? 0) + 1 });
    if (error) throw error;
    revalidatePath('/admin/categories'); revalidatePath('/community');
    return { ok: true };
  } catch (e) { return fail(e, 'We couldn’t add that category.'); }
}

export async function renameCategory(slug: string, rawName: string): Promise<ActionResult> {
  try {
    await requireAdmin();
    const name = cleanText(rawName, 40);
    if (name.length < 2) throw new Error('Give the category a name of at least two letters.');
    const { data: old } = await supabaseAdmin.from('feed_categories').select('name').eq('slug', slug).maybeSingle();
    if (!old) throw new Error('That category doesn’t exist.');
    const { error } = await supabaseAdmin.from('feed_categories').update({ name }).eq('slug', slug);
    if (error) throw new Error('A category with that name already exists.');
    // Posts keep their category by name, so they move with the rename.
    await supabaseAdmin.from('feed_posts').update({ category: name }).eq('category', old.name as string);
    revalidatePath('/admin/categories'); revalidatePath('/community');
    return { ok: true };
  } catch (e) { return fail(e, 'We couldn’t rename that category.'); }
}

export async function setCategoryActive(slug: string, active: boolean): Promise<ActionResult> {
  try {
    await requireAdmin();
    const { error } = await supabaseAdmin.from('feed_categories').update({ active }).eq('slug', slug);
    if (error) throw error;
    revalidatePath('/admin/categories'); revalidatePath('/community');
    return { ok: true };
  } catch (e) { return fail(e); }
}
