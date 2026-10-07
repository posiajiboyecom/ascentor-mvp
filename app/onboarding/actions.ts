'use server';

// app/onboarding/actions.ts
// Saves onboarding one step at a time (so a member can leave and resume), then finishes it: derives the
// starting stage, stores goals and the baseline survey, places the member in a Circle and marks the
// profile onboarded. Every write runs as the member; only the Circle placement uses the service role.

import { requireMember, assignCircle, fail, type ActionResult } from '@/lib/rx/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { cleanText } from '@/lib/rx/safety';
import {
  ALL_INTERESTS, LANGUAGES, LEAD_OPTIONS, PROJ_OPTIONS, SLOT_OPTIONS, SURVEY_QUESTIONS,
  OB_ORDER, deriveStage, dimensionOf, type ObStep, type Stage,
} from '@/lib/rx/constants';
import { TZC, tzInfo } from '@/lib/rx/timezones';
import { DEFAULT_TZ } from '@/lib/rx/dates';

export interface OnboardingInput {
  interests?: string[];
  purpose?: number;
  effort?: number;
  lead?: string;
  project?: string;
  goals?: { g: string; who: string }[];
  slots?: string[];
  timezone?: string;
  timezoneLabel?: string;
  language?: string;
  answers?: (number | null)[];
  remindLater?: boolean;
}

const scale = (n: unknown) => (typeof n === 'number' && n >= 1 && n <= 5 ? Math.round(n) : null);
const validZone = (z: unknown): string | null => {
  if (typeof z !== 'string') return null;
  try { new Intl.DateTimeFormat('en-US', { timeZone: z }); return z; } catch { return null; }
};

export async function saveOnboardingStep(step: ObStep, input: OnboardingInput): Promise<ActionResult> {
  try {
    const { db, userId } = await requireMember();
    const row: Record<string, unknown> = { user_id: userId, onboarding_step: OB_ORDER.includes(step) ? step : null, updated_at: new Date().toISOString() };

    if (input.interests) row.interests = input.interests.filter((i) => ALL_INTERESTS.includes(i)).slice(0, 40);
    if (input.purpose !== undefined) row.purpose_score = scale(input.purpose);
    if (input.effort !== undefined) row.effort_score = scale(input.effort);
    if (input.lead !== undefined && LEAD_OPTIONS.includes(input.lead)) row.lead_exp = input.lead;
    if (input.project !== undefined && PROJ_OPTIONS.includes(input.project)) row.project_exp = input.project;
    if (input.slots) row.slots = input.slots.filter((s) => SLOT_OPTIONS.includes(s));
    if (input.language && LANGUAGES.includes(input.language)) row.language = input.language;
    if (input.timezone) {
      const z = validZone(input.timezone);
      if (z) {
        const info = tzInfo(z);
        row.timezone = z;
        row.timezone_label = cleanText(input.timezoneLabel, 120) || `${info.city}, ${info.country} (${info.off})`;
        row.city = info.city;
        row.country = TZC[z] ?? info.country;
      }
    }
    if (input.answers) {
      row.baseline = { answers: input.answers.slice(0, SURVEY_QUESTIONS.length).map(scale) };
    }
    if (input.remindLater) row.survey_remind_at = new Date(Date.now() + 48 * 3600 * 1000).toISOString();

    // Goals live in the baseline column until the member finishes, then become user_goals rows.
    if (input.goals) {
      const goals = input.goals.slice(0, 3).map((x) => ({ g: cleanText(x.g, 240), who: cleanText(x.who, 120) }));
      const { data: cur } = await db.from('member_profile').select('baseline').eq('user_id', userId).maybeSingle();
      row.baseline = { ...((cur?.baseline as Record<string, unknown>) ?? {}), ...((row.baseline as Record<string, unknown>) ?? {}), goals };
    } else if (row.baseline) {
      const { data: cur } = await db.from('member_profile').select('baseline').eq('user_id', userId).maybeSingle();
      row.baseline = { ...((cur?.baseline as Record<string, unknown>) ?? {}), ...(row.baseline as Record<string, unknown>) };
    }

    const { error } = await db.from('member_profile').upsert(row, { onConflict: 'user_id' });
    if (error) throw error;
    return { ok: true };
  } catch (e) { return fail(e, 'We could not save that just now. Please try again.'); }
}

export interface FinishResult {
  stage: Stage;
  circle: { name: string; members: number } | null;
  openHouseMembers: number;
}

export async function finishOnboarding(): Promise<ActionResult<{ result: FinishResult }>> {
  try {
    const { db, userId } = await requireMember();
    const { data: mp } = await db.from('member_profile').select('*').eq('user_id', userId).maybeSingle();
    if (!mp) throw new Error('Please answer the earlier questions first.');

    const baseline = (mp.baseline ?? {}) as { answers?: (number | null)[]; goals?: { g: string; who: string }[] };
    const stage = deriveStage({ purpose: mp.purpose_score, lead: mp.lead_exp, project: mp.project_exp });
    const goals = (baseline.goals ?? []).filter((x) => x.g);

    // Goals: add the ones not already stored (safe to retry).
    const { data: existingGoals } = await db.from('user_goals').select('id, goal_text').eq('user_id', userId);
    const have = new Map((existingGoals ?? []).map((g: { id: string; goal_text: string }) => [g.goal_text.trim().toLowerCase(), g.id]));
    for (const [i, g] of goals.entries()) {
      const id = have.get(g.g.trim().toLowerCase());
      if (id) await db.from('user_goals').update({ serves: g.who || null, position: i }).eq('id', id);
      else await db.from('user_goals').insert({ user_id: userId, goal_text: g.g, serves: g.who || null, position: i, progress: 0, timeframe: '90 days' });
    }

    // Baseline survey scores (1 to 5): flourishing = questions 1 and 4, purpose = 2, initiative = 3.
    const a = baseline.answers ?? [];
    if (a.length === SURVEY_QUESTIONS.length && a.every((x) => typeof x === 'number')) {
      const n = (i: number) => (a[i] as number);
      await db.from('growth_scores').upsert(
        { user_id: userId, kind: 'baseline', flourishing: (n(0) + n(3)) / 2, purpose: n(1), initiative: n(2), taken_at: new Date().toISOString() },
        { onConflict: 'user_id,kind' },
      );
    }

    // Profile: dimension, building, stage, referral code, onboarded.
    const { data: prof } = await db.from('profiles').select('referral_code, onboarding_completed').eq('id', userId).maybeSingle();
    let referral: string | undefined = prof?.referral_code ?? undefined;
    for (let i = 0; !referral && i < 6; i++) {
      const candidate = 'ASC-' + Math.random().toString(36).substring(2, 8).toUpperCase();
      const { data: taken } = await db.from('profiles').select('id').eq('referral_code', candidate).maybeSingle();
      if (!taken) referral = candidate;
    }
    const firstDim = dimensionOf((mp.interests as string[])[0] ?? '') ?? null;
    const dimMap: Record<string, string> = { Mind: 'mind', Character: 'character', Vocation: 'work', Relationships: 'relationships', Community: 'community', Legacy: 'legacy' };
    const stageMap: Record<Stage, string> = { Seeking: 'seeker', Building: 'builder', Leading: 'leader' };
    const profileUpdate: Record<string, unknown> = {
      primary_dimension: (firstDim && dimMap[firstDim]) || 'purpose',
      what_building: goals[0]?.g ?? null,
      ascent_stage: stageMap[stage],
      referral_code: referral,
      onboarding_completed: true,
      onboarding_completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const { error: pErr } = await db.from('profiles').update(profileUpdate).eq('id', userId);
    if (pErr) throw pErr;

    await db.from('member_profile').update({ stage, onboarded_at: new Date().toISOString(), onboarding_step: 'stage', timezone: mp.timezone ?? DEFAULT_TZ }).eq('user_id', userId);

    // Place in a Circle and read it back.
    let circle: FinishResult['circle'] = null;
    const cid = await assignCircle(userId);
    if (cid) {
      const { data: c } = await supabaseAdmin.from('circles').select('name').eq('id', cid).maybeSingle();
      const { count } = await supabaseAdmin.from('circle_seats').select('user_id', { count: 'exact', head: true }).eq('circle_id', cid).eq('role', 'member');
      circle = { name: (c?.name as string) ?? 'Your Circle', members: count ?? 1 };
    }
    const { data: oh } = await db.from('rx_groups').select('id').eq('slug', 'open-house').maybeSingle();
    const { count: ohCount } = oh ? await supabaseAdmin.from('rx_group_members').select('user_id', { count: 'exact', head: true }).eq('group_id', oh.id) : { count: 0 };

    return { ok: true, result: { stage, circle, openHouseMembers: ohCount ?? 0 } };
  } catch (e) { return fail(e, 'We could not finish setting you up. Please try again.'); }
}

/** Joins (or declines) the Open house invitation shown at the end of onboarding. */
export async function answerOpenHouse(join: boolean): Promise<ActionResult> {
  try {
    const { db, userId } = await requireMember();
    if (join) {
      const { data: g } = await db.from('rx_groups').select('id').eq('slug', 'open-house').maybeSingle();
      if (g) {
        const { error } = await db.from('rx_group_members').upsert({ group_id: g.id, user_id: userId }, { onConflict: 'group_id,user_id', ignoreDuplicates: true });
        if (error) throw error;
      }
    }
    await db.from('member_profile').update({ oh_invite: join ? 'joined' : 'later' }).eq('user_id', userId);
    return { ok: true };
  } catch (e) { return fail(e); }
}

/** Fires the welcome email once, after the first completion. */
export async function loadOnboardingState() {
  const { db, userId } = await requireMember();
  const [{ data: mp }, { data: prof }, { data: { user } }] = await Promise.all([
    db.from('member_profile').select('*').eq('user_id', userId).maybeSingle(),
    db.from('profiles').select('full_name, onboarding_completed').eq('id', userId).maybeSingle(),
    db.auth.getUser(),
  ]);
  return { userId, email: user?.email ?? null, profile: mp, fullName: (prof?.full_name as string | null) ?? null, completed: prof?.onboarding_completed === true };
}
