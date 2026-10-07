'use server';

import { revalidatePath } from 'next/cache';
import { requireMember, fail } from '@/lib/rx/server';
import type { ActionResult } from '@/lib/rx/types';
import { cleanText } from '@/lib/rx/safety';
import { SURVEY_QUESTIONS } from '@/lib/rx/constants';

/** Records a follow-up survey. Flourishing = questions 1 and 4, purpose = 2, initiative = 3 (each 1 to 5). */
export async function submitSurvey(answers: number[]): Promise<ActionResult> {
  try {
    const { db, userId } = await requireMember();
    if (answers.length !== SURVEY_QUESTIONS.length || answers.some((a) => !(a >= 1 && a <= 5))) throw new Error('Answer every question to finish.');
    const { data: rows } = await db.from('growth_scores').select('kind, taken_at').eq('user_id', userId);
    const have = new Map(((rows ?? []) as { kind: string; taken_at: string }[]).map((r) => [r.kind, r.taken_at]));
    const base = have.get('baseline');
    if (!base) throw new Error('Take the baseline first.');
    const days = (Date.now() - new Date(base).getTime()) / 86400000;
    const kind = !have.has('m3') ? 'm3' : !have.has('m6') ? 'm6' : null;
    if (!kind) throw new Error('You’ve completed all three surveys.');
    if ((kind === 'm3' && days < 60) || (kind === 'm6' && days < 150)) throw new Error('This survey isn’t due yet.');
    const [a, b, c, d] = answers;
    const { error } = await db.from('growth_scores').insert({ user_id: userId, kind, flourishing: (a + d) / 2, purpose: b, initiative: c });
    if (error) throw error;
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
