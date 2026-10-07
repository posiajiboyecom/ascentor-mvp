'use server';

// Weekly practice (if-then plan) and daily check-ins. Runs as the member; one plan per week, one check-in per day.

import { revalidatePath } from 'next/cache';
import { requireMember, getMe, fail, type ActionResult } from '@/lib/rx/server';
import { cleanText } from '@/lib/rx/safety';

export interface PracticeInput {
  cue: string;
  action: string;
  trigger?: string;
  fallback?: string;
  obstacle?: string;
  source?: string;
}

export async function savePractice(input: PracticeInput): Promise<ActionResult<{ id: string }>> {
  try {
    const { db, userId } = await requireMember();
    const me = await getMe();
    if (!me) throw new Error('Please sign in again.');
    const cue = cleanText(input.cue, 140);
    const action = cleanText(input.action, 140);
    const trigger = cleanText(input.trigger, 140);
    const fallback = cleanText(input.fallback, 140);
    // All four blanks are required, 3 to 140 characters each.
    for (const [label, v] of [['After I', cue], ['I will', action], ['If', trigger], ['then I will', fallback]] as const) {
      if (v.length < 3) throw new Error(`Fill in “${label}” (at least 3 characters) to set your plan.`);
    }
    const { data, error } = await db.from('practices').upsert({
      user_id: userId, week_start: me.weekStart, cue, action,
      trigger, fallback,
      obstacle: cleanText(input.obstacle, 240) || null,
      source: cleanText(input.source, 120) || 'set on Today',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,week_start' }).select('id').single();
    if (error) throw error;
    revalidatePath('/dashboard');
    return { ok: true, id: data.id as string };
  } catch (e) { return fail(e, 'We could not save your plan. Please try again.'); }
}

export async function checkIn(status: 'kept' | 'not', note?: string): Promise<ActionResult> {
  try {
    if (status !== 'kept' && status !== 'not') throw new Error('Unknown check-in.');
    const { db, userId } = await requireMember();
    const me = await getMe();
    if (!me) throw new Error('Please sign in again.');
    const { data: practice } = await db.from('practices').select('id').eq('user_id', userId).eq('week_start', me.weekStart).maybeSingle();
    if (!practice) throw new Error('Set this week’s plan first, then check in.');
    const { error } = await db.from('practice_checkins').upsert(
      { user_id: userId, practice_id: practice.id, day: me.today, status, note: cleanText(note, 280) || null },
      { onConflict: 'user_id,day' },
    );
    if (error) throw error;
    revalidatePath('/dashboard');
    revalidatePath('/learn');
    return { ok: true };
  } catch (e) { return fail(e, 'We could not log that. Please try again.'); }
}
