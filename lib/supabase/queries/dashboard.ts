// lib/supabase/queries/dashboard.ts
// ============================================================
// All data the Home / Dashboard screen needs, in one fetch.
// Called from a Server Component (app/(app)/dashboard/page.tsx).
//
// Tables touched:
//   profiles, user_goals, user_commitments, expert_sessions,
//   session_registrations, usage_tracking
// ============================================================

import { createClient } from '@/lib/supabase/server';
import { effectivePlan, TIER_META } from '@/lib/planTier';
import { daysUntilSummit } from '@/lib/elevationSummit';
import type {
  Profile,
  UserGoal,
  UserCommitment,
  ExpertSession,
} from '@/database/database';

export interface DashboardData {
  firstName: string;
  planLabel: string;
  planColor: string;
  planBg: string;
  planBorder: string;
  sessionsThisWeek: number;
  commitmentsDone: number;
  commitmentsTotal: number;
  goal: UserGoal | null;
  goalProgressPct: number;
  commitments: UserCommitment[];
  upcomingSession: (ExpertSession & { isRegistered: boolean }) | null;
  summitDaysAway: number;
}

const WAT_OFFSET_HOURS = 1; // Africa/Lagos is UTC+1, no DST

/**
 * Returns the ISO timestamp for the most recent Monday 00:00, evaluated
 * in WAT (Africa/Lagos) rather than the server's local timezone — the
 * server (Vercel) runs UTC, which would roll the week over ~1 hour
 * early/late relative to what a Lagos-based user expects.
 */
function startOfWeek(): string {
  const now = new Date();

  // Get the current wall-clock date/weekday as seen in Lagos.
  const watParts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Lagos',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  }).formatToParts(now);

  const y = Number(watParts.find((p) => p.type === 'year')!.value);
  const m = Number(watParts.find((p) => p.type === 'month')!.value);
  const d = Number(watParts.find((p) => p.type === 'day')!.value);
  const weekdayShort = watParts.find((p) => p.type === 'weekday')!.value;

  const weekdayMap: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };
  const day = weekdayMap[weekdayShort] ?? 1;
  const diff = d - day + (day === 0 ? -6 : 1); // shift to Monday

  // Construct Monday 00:00 WAT, expressed as a correct UTC instant.
  const mondayUtcMs =
    Date.UTC(y, m - 1, diff, 0, 0, 0) - WAT_OFFSET_HOURS * 60 * 60 * 1000;

  return new Date(mondayUtcMs).toISOString();
}

export async function getDashboardData(): Promise<DashboardData | null> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const weekStart = startOfWeek();

  const [
    profileRes,
    goalRes,
    commitmentsRes,
    sessionsThisWeekRes,
    upcomingSessionRes,
  ] = await Promise.all([
    supabase
      .from('profiles')
      .select(
        'id, full_name, subscription_plan, subscription_status, subscription_end'
      )
      .eq('id', user.id)
      .single(),

    supabase
      .from('user_goals')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),

    supabase
      .from('user_commitments')
      .select('*')
      .eq('user_id', user.id)
      .gte('created_at', weekStart)
      .order('created_at', { ascending: true }),

    supabase
      .from('usage_tracking')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('feature', 'session_attended')
      .gte('created_at', weekStart),

    supabase
      .from('expert_sessions')
      .select('*')
      .eq('is_published', true)
      .gte('session_date', new Date().toISOString())
      .order('session_date', { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);

  const profile = profileRes.data as Pick<
    Profile,
    | 'id'
    | 'full_name'
    | 'subscription_plan'
    | 'subscription_status'
    | 'subscription_end'
  > | null;

  const plan = effectivePlan(profile);
  const tierMeta = TIER_META[plan];

  const commitments = (commitmentsRes.data ?? []) as UserCommitment[];
  const commitmentsDone = commitments.filter((c) => c.completed).length;

  let upcomingSession:
    | (ExpertSession & { isRegistered: boolean })
    | null = null;

  if (upcomingSessionRes.data) {
    const session = upcomingSessionRes.data as ExpertSession;
    const { data: registration } = await supabase
      .from('session_registrations')
      .select('id')
      .eq('session_id', session.id)
      .eq('user_id', user.id)
      .maybeSingle();

    upcomingSession = { ...session, isRegistered: !!registration };
  }

  const goal = (goalRes.data ?? null) as UserGoal | null;

  const firstName =
    profile?.full_name?.trim().split(/\s+/)[0] ?? 'there';

  return {
    firstName,
    planLabel: tierMeta.label,
    planColor: tierMeta.color,
    planBg: tierMeta.bg,
    planBorder: tierMeta.border,
    sessionsThisWeek: sessionsThisWeekRes.count ?? 0,
    commitmentsDone,
    commitmentsTotal: commitments.length,
    goal,
    goalProgressPct: goal?.progress ?? 0,
    commitments,
    upcomingSession,
    summitDaysAway: daysUntilSummit(),
  };
}

/** Toggle a commitment's completed state. Used by the client checklist. */
export async function toggleCommitment(
  commitmentId: string,
  completed: boolean
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from('user_commitments')
    .update({
      completed,
      completed_at: completed ? new Date().toISOString() : null,
    })
    .eq('id', commitmentId);

  if (error) throw error;
}
