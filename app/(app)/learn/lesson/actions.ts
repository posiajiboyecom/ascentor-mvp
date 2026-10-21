'use server';

import { revalidatePath } from 'next/cache';
import { requireMember, fail, type ActionResult } from '@/lib/rx/server';
import { cleanText } from '@/lib/rx/safety';
import { savePractice, type PracticeInput } from '@/app/(app)/dashboard/practice-actions';

export async function saveReflection(lessonId: string, text: string): Promise<ActionResult> {
  try {
    const { db, userId } = await requireMember();
    const { error } = await db.from('rx_lesson_progress').upsert(
      { user_id: userId, lesson_id: lessonId, reflection: cleanText(text, 2000) || null, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,lesson_id' },
    );
    if (error) throw error;
    return { ok: true };
  } catch (e) { return fail(e); }
}

/** Sets this week's practice from a lesson. The lesson counts as done once its practice is set. */
export async function setLessonPractice(lessonId: string, lessonTitle: string, practice: PracticeInput, reflection: string): Promise<ActionResult> {
  try {
    const { db, userId } = await requireMember();
    const saved = await savePractice({ ...practice, source: `from “${cleanText(lessonTitle, 80)}”` });
    if (!saved.ok) return saved;
    const { error } = await db.from('rx_lesson_progress').upsert(
      { user_id: userId, lesson_id: lessonId, practice_id: saved.id, reflection: cleanText(reflection, 2000) || null, completed_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { onConflict: 'user_id,lesson_id' },
    );
    if (error) throw error;
    revalidatePath('/learn');
    revalidatePath('/dashboard');
    return { ok: true };
  } catch (e) { return fail(e, 'We could not set your practice. Please try again.'); }
}

/**
 * Remembers how far a member got through a lesson video (the furthest point, never less), so they can resume and so a
 * reminder can go out if they stop part way. Quietly does nothing until the watch columns exist.
 */
export async function saveWatchProgress(lessonId: string, percent: number, positionSec: number, durationSec: number): Promise<ActionResult> {
  try {
    const { db, userId } = await requireMember();
    const pct = Math.max(0, Math.min(100, Math.round(Number(percent) || 0)));
    const pos = Math.max(0, Number(positionSec) || 0);
    const dur = Math.max(0, Number(durationSec) || 0);
    if (!/^[0-9a-f-]{36}$/i.test(lessonId) || !dur) return { ok: true };
    const { data: cur, error: readErr } = await db.from('rx_lesson_progress').select('watch_percent').eq('user_id', userId).eq('lesson_id', lessonId).maybeSingle();
    if (readErr) return { ok: true }; // columns not there yet
    const best = Math.max(pct, (cur as { watch_percent?: number } | null)?.watch_percent ?? 0);
    const { error } = await db.from('rx_lesson_progress').upsert(
      { user_id: userId, lesson_id: lessonId, watch_percent: best, last_position_sec: pos, duration_sec: dur, reminded_at: null, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,lesson_id' },
    );
    if (error) return { ok: true };
    return { ok: true };
  } catch (e) { return fail(e); }
}
