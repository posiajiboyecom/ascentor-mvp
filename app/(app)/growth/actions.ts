'use server';

import { revalidatePath } from 'next/cache';
import { requireMember, fail } from '@/lib/rx/server';
import type { ActionResult } from '@/lib/rx/types';
import { cleanText } from '@/lib/rx/safety';
import { SURVEY } from '@/lib/rx/constants';
import { loadScores, saveAnswers, scoreWave } from '@/lib/rx/survey';

/** Records a follow-up survey (3 and 6 months after the baseline). Answers go to private tables only. */
export async function submitSurvey(answers: number[]): Promise<ActionResult> {
  try {
    const { userId } = await requireMember();
    if (answers.length !== SURVEY.length || answers.some((a) => !(a >= 1 && a <= 5))) throw new Error('Answer every question to finish.');
    const have = await loadScores(userId);
    const base = have.get('baseline');
    if (!base) throw new Error('Take the baseline first.');
    const days = (Date.now() - new Date(base.taken_at).getTime()) / 86400000;
    const wave = !have.has('m3') ? 'm3' : !have.has('m6') ? 'm6' : null;
    if (!wave) throw new Error('You’ve completed all three surveys.');
    if ((wave === 'm3' && days < 60) || (wave === 'm6' && days < 150)) throw new Error('This survey isn’t due yet.');
    await saveAnswers(userId, wave, answers);
    await scoreWave(userId, wave);
    revalidatePath('/growth');
    return { ok: true };
  } catch (e) { return fail(e); }
}

export async function saveBeyondSelf(text: string): Promise<ActionResult> {
  try {
    const { db, userId } = await requireMember();
    const t = cleanText(text, 300);
    const { data: cur } = await db.from('member_profile').select('beyond_self_project, beyond_self_since').eq('user_id', userId).maybeSingle();
    const since = t && (!cur?.beyond_self_since || cur.beyond_self_project !== t) ? new Date().toISOString().slice(0, 10) : cur?.beyond_self_since ?? null;
    const { error } = await db.from('member_profile').upsert({ user_id: userId, beyond_self_project: t || null, beyond_self_since: t ? since : null, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
    if (error) throw error;
    revalidatePath('/growth');
    return { ok: true };
  } catch (e) { return fail(e); }
}
