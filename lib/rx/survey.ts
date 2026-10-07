import 'server-only';
// lib/rx/survey.ts
// Survey answers and scores live in private tables that no client (and no admin screen) can read: only these
// server functions touch them, always scoped to one member. Staff never see individual survey data.

import { supabaseAdmin } from '@/lib/supabase/admin';
import { SURVEY, surveyScores } from './constants';

export type Wave = 'baseline' | 'm3' | 'm6';
export interface ScoreRow { kind: Wave; flourishing: number; purpose: number; initiative: number; taken_at: string }

export async function saveAnswers(userId: string, wave: Wave, values: (number | null)[]): Promise<void> {
  const rows = values.slice(0, SURVEY.length).flatMap((v, i) => (typeof v === 'number' && v >= 1 && v <= 5 ? [{ user_id: userId, wave, item: i, value: v, taken_at: new Date().toISOString() }] : []));
  if (!rows.length) return;
  const { error } = await supabaseAdmin.from('private_survey_responses').upsert(rows, { onConflict: 'user_id,wave,item' });
  if (error) throw error;
}

export async function loadAnswers(userId: string, wave: Wave = 'baseline'): Promise<(number | null)[]> {
  const { data } = await supabaseAdmin.from('private_survey_responses').select('item, value').eq('user_id', userId).eq('wave', wave);
  const out: (number | null)[] = SURVEY.map(() => null);
  for (const r of (data ?? []) as { item: number; value: number }[]) if (r.item >= 0 && r.item < out.length) out[r.item] = r.value;
  return out;
}

/** Computes and stores the scores for a wave from its saved answers. Returns false when the survey is incomplete. */
export async function scoreWave(userId: string, wave: Wave): Promise<boolean> {
  const a = await loadAnswers(userId, wave);
  if (a.some((v) => v === null)) return false;
  const s = surveyScores(a as number[]);
  const { error } = await supabaseAdmin.from('private_growth_scores').upsert({ user_id: userId, kind: wave, ...s, taken_at: new Date().toISOString() }, { onConflict: 'user_id,kind' });
  if (error) throw error;
  return true;
}

export async function loadScores(userId: string): Promise<Map<Wave, ScoreRow>> {
  const { data } = await supabaseAdmin.from('private_growth_scores').select('kind, flourishing, purpose, initiative, taken_at').eq('user_id', userId);
  return new Map(((data ?? []) as ScoreRow[]).map((r) => [r.kind, r]));
}
