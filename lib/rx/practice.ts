import 'server-only';
// lib/rx/practice.ts
// A member's weekly if-then practice, daily check-ins, and the pathway lessons that feed them.

import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import { getMe, getMyCircle } from './server';
import { addDays, cycleWeek, diffDays, mondayOfISO } from './dates';

export interface Practice {
  id: string;
  week_start: string;
  obstacle: string | null;
  cue: string;
  action: string;
  trigger: string | null;
  fallback: string | null;
  source: string | null;
  created_at: string;
}

export interface Lesson {
  id: string;
  slug: string;
  title: string;
  dimension: string;
  sub: string | null;
  minutes: number;
  format: 'Video' | 'Reading';
  video_url: string | null;
  body: string | null;
  week_no: number | null;
  sort: number;
  thumbnail_url: string | null;
  /** Self-hosted R2/HLS video. Null when none is attached or it is still processing (RLS hides non-ready rows). */
  video: { id: string; hls_url: string; thumbnail_url: string | null } | null;
}

export interface LessonProgress { lesson_id: string; practice_id: string | null; reflection: string | null; completed_at: string | null; watch_percent?: number | null; last_position_sec?: number | null }

export const getLessons = cache(async (): Promise<Lesson[]> => {
  const db = await createClient();
  const { data } = await db.from('rx_lessons').select('id, slug, title, dimension, sub, minutes, format, video_url, body, week_no, sort, thumbnail_url, video:ascentor_videos!rx_lessons_video_id_fkey(id, hls_url, thumbnail_url)').eq('published', true).order('sort');
  return (data ?? []) as unknown as Lesson[];
});

export const getLessonProgress = cache(async (): Promise<Map<string, LessonProgress>> => {
  const me = await getMe();
  const out = new Map<string, LessonProgress>();
  if (!me) return out;
  const db = await createClient();
  const full = await db.from('rx_lesson_progress').select('lesson_id, practice_id, reflection, completed_at, watch_percent, last_position_sec').eq('user_id', me.userId);
  // watch columns not applied yet: fall back to the core columns
  const rows = full.error ? (await db.from('rx_lesson_progress').select('lesson_id, practice_id, reflection, completed_at').eq('user_id', me.userId)).data : full.data;
  for (const r of (rows ?? []) as LessonProgress[]) out.set(r.lesson_id, r);
  return out;
});

/**
 * This week's lesson: the one anchored to the pathway week. When that week has no lesson yet, the nearest unfinished
 * lesson in pathway order (later weeks first, then earlier ones, then unanchored), so a gap never jumps members to a
 * lesson that only happens to sort first.
 */
export function pickWeekLesson(lessons: Lesson[], week: number, progress: Map<string, LessonProgress>): Lesson | null {
  if (!lessons.length) return null;
  const anchored = lessons.find((l) => l.week_no === week);
  if (anchored) return anchored;
  const open = lessons.filter((l) => !progress.get(l.id)?.completed_at);
  const byWeek = (a: Lesson, b: Lesson) => (a.week_no ?? 99) - (b.week_no ?? 99);
  const later = open.filter((l) => l.week_no != null && l.week_no > week).sort(byWeek);
  const earlier = open.filter((l) => l.week_no != null && l.week_no < week).sort((a, b) => byWeek(b, a));
  const loose = open.filter((l) => l.week_no == null);
  return later[0] ?? earlier[0] ?? loose[0] ?? lessons[0];
}

export interface TodayState {
  week: number;                      // pathway week (1 until the Circle's cycle starts)
  hasCycle: boolean;
  practice: Practice | null;         // this week's
  keptThisWeek: number;
  daysThisWeek: number;
  todayStatus: 'kept' | 'not' | null;
  missed: boolean;                   // a plan exists and yesterday has no check-in
  goal: { id: string; goal_text: string; serves: string | null } | null;
  pathway: { week: number; state: 'done' | 'current' | 'behind' | 'upcoming' }[];
  nextUnlock: string;
}

export const getTodayState = cache(async (): Promise<TodayState | null> => {
  const me = await getMe();
  if (!me) return null;
  const db = await createClient();
  const circle = await getMyCircle();
  const cycleStart = circle?.circle.cycle_start ?? null;
  const week = cycleWeek(cycleStart, me.today) ?? 1;

  const [{ data: practiceRow }, { data: checkins }, { data: goals }, { data: practices }, lessons, progress] = await Promise.all([
    db.from('practices').select('*').eq('user_id', me.userId).eq('week_start', me.weekStart).maybeSingle(),
    db.from('practice_checkins').select('day, status').eq('user_id', me.userId).gte('day', addDays(me.weekStart, -7)).order('day'),
    db.from('user_goals').select('id, goal_text, serves').eq('user_id', me.userId).order('position').order('created_at').limit(1),
    db.from('practices').select('week_start').eq('user_id', me.userId),
    getLessons(),
    getLessonProgress(),
  ]);

  const practice = (practiceRow as Practice | null) ?? null;
  const cs = (checkins ?? []) as { day: string; status: 'kept' | 'not' }[];
  const thisWeek = cs.filter((c) => c.day >= me.weekStart && c.day <= me.today);
  const keptThisWeek = thisWeek.filter((c) => c.status === 'kept').length;
  const startedOn = practice ? (practice.created_at.slice(0, 10) > me.weekStart ? practice.created_at.slice(0, 10) : me.weekStart) : me.today;
  const daysThisWeek = practice ? Math.min(7, Math.max(1, diffDays(me.today, startedOn) + 1)) : 0;
  const todayStatus = thisWeek.find((c) => c.day === me.today)?.status ?? null;
  const yesterday = addDays(me.today, -1);
  const missed = !!practice && yesterday >= startedOn && !cs.some((c) => c.day === yesterday);

  // Pathway: a past week is done when a practice was set in it or its lesson was finished.
  const doneWeeks = new Set<number>();
  if (cycleStart) {
    for (const p of (practices ?? []) as { week_start: string }[]) {
      const w = Math.floor(diffDays(mondayOfISO(p.week_start), mondayOfISO(cycleStart)) / 7) + 1;
      if (w >= 1 && w <= 12) doneWeeks.add(w);
    }
  }
  for (const l of lessons) if (l.week_no && progress.get(l.id)?.completed_at) doneWeeks.add(l.week_no);
  const pathway = Array.from({ length: 12 }, (_, i) => {
    const w = i + 1;
    const state: 'done' | 'current' | 'behind' | 'upcoming' = w === week ? 'current' : w < week ? (doneWeeks.has(w) ? 'done' : 'behind') : 'upcoming';
    return { week: w, state };
  });
  const nextMonday = addDays(mondayOfISO(me.today), 7);
  const nextUnlock = new Date(nextMonday + 'T00:00:00Z').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });

  return {
    week, hasCycle: !!cycleStart, practice, keptThisWeek, daysThisWeek, todayStatus, missed,
    goal: ((goals ?? [])[0] as TodayState['goal']) ?? null,
    pathway, nextUnlock,
  };
});
