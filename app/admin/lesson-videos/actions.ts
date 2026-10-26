'use server';

import { revalidatePath } from 'next/cache';
import { fail } from '@/lib/rx/server';
import type { ActionResult } from '@/lib/rx/types';
import { requireAdmin } from '@/lib/rx/admin';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { parseVideoInput } from '@/lib/rx/video';

/** Sets (or clears, with an empty link) the video of one lesson. Stores the canonical link; the provider is read from it. */
export async function saveLessonVideo(lessonId: string, input: string): Promise<ActionResult<{ stored: string | null }>> {
  try {
    await requireAdmin();
    if (!/^[0-9a-f-]{36}$/i.test(lessonId)) throw new Error('That lesson was not found.');
    const raw = (input ?? '').trim();
    let stored: string | null = null;
    if (raw) {
      const v = parseVideoInput(raw);
      if (!v.ok) throw new Error(v.error);
      stored = v.stored;
    }
    const { data, error } = await supabaseAdmin.from('rx_lessons').update({ video_url: stored }).eq('id', lessonId).select('slug').maybeSingle();
    if (error) throw error;
    if (!data) throw new Error('That lesson was not found.');
    revalidatePath('/learn');
    revalidatePath(`/learn/lesson/${data.slug}`);
    return { ok: true, stored };
  } catch (e) {
    return fail(e, 'Could not save the video. Please try again.');
  }
}
