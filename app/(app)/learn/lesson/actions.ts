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
