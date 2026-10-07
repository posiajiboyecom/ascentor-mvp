'use server';

import { revalidatePath } from 'next/cache';
import { fail } from '@/lib/rx/server';
import type { ActionResult } from '@/lib/rx/types';
import { requireAdmin } from '@/lib/rx/admin';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { cleanText } from '@/lib/rx/safety';

export interface MentorInput { id?: string; email?: string; name: string; headline: string; bio: string; tags: string; langs: string; formats: string; capacity: number; accepting: boolean; active: boolean }

const list = (s: string) => s.split(',').map((x) => cleanText(x, 40)).filter(Boolean).slice(0, 12);

export async function saveHumanMentor(i: MentorInput): Promise<ActionResult> {
  try {
    await requireAdmin();
    const name = cleanText(i.name, 80);
    if (!name) throw new Error('Give the mentor a name.');
    const row = { name, headline: cleanText(i.headline, 120) || null, bio: cleanText(i.bio, 1200) || null, tags: list(i.tags), langs: list(i.langs).length ? list(i.langs) : ['English'], formats: list(i.formats).length ? list(i.formats) : ['Video'], capacity: Math.max(0, Math.min(8, Math.round(i.capacity))), accepting: !!i.accepting, active: !!i.active };
    if (i.id) {
      const { error } = await supabaseAdmin.from('human_mentors').update(row).eq('id', i.id);
      if (error) throw error;
    } else {
      const email = cleanText(i.email, 200).toLowerCase();
      if (!email) throw new Error('Enter the member’s email so they can sign in as a mentor.');
      const { data: p } = await supabaseAdmin.from('profiles').select('id, avatar_url').ilike('email', email).maybeSingle();
      if (!p) throw new Error('No member has that email.');
      const { error } = await supabaseAdmin.from('human_mentors').insert({ ...row, user_id: p.id, avatar_url: p.avatar_url ?? null });
      if (error) throw error;
    }
    revalidatePath('/admin/human-mentors');
    return { ok: true };
  } catch (e) { return fail(e, 'We couldn’t save that mentor. Is this member already a mentor?'); }
}
