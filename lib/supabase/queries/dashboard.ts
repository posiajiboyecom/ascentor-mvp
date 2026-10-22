// lib/supabase/queries/dashboard.ts
// ============================================================
// Data for the Home / Dashboard screen.
//   getDashboardData() - the main fetch (one parallel pass).
//   getContinueData()  - secondary data, streamed behind <Suspense>.
// Called from Server Components (app/(app)/dashboard/page.tsx).
// ============================================================

import { createClient } from '@/lib/supabase/server';
import { TIER_META } from '@/lib/planTier';
import { effectivePlanForUser } from '@/lib/access';
import { daysUntilSummit } from '@/lib/elevationSummit';
import type {
  Profile,
  UserGoal,
  UserCommitment,
  ExpertSession,
} from '@/database/database';

export interface WeekBar {
  /** Monday of the week, ISO date (WAT). */
  label: string;
  done: number;
  total: number;
}

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
  /** Milestone-driven (falls back to the stored value when there are none). */
  goalProgressPct: number;
  /** Which day of the 90-day window the member is on (1+), or null. */
  goalDay: number | null;
  commitments: UserCommitment[];
  /** Last 6 weeks, oldest first, current week last. */
  weekHistory: WeekBar[];
  upcomingSession: (ExpertSession & { isRegistered: boolean }) | null;
  summitDaysAway: number;
  /** Whether this user has already registered for the Elevation Summit in-app. */
  summitRegistered: boolean;
}

export interface ContinueData {
  lastCoach: { preview: string; createdAt: string } | null;
  unreadCircleCount: number;
  notifications: {
    id: string;
    title: string;
    message: string;
    link: string | null;
    created_at: string;
  }[];
}

const WAT_OFFSET_HOURS = 1; // Africa/Lagos is UTC+1, no DST
const DAY_MS = 86400000;

/**
 * Returns the ISO timestamp for the most recent Monday 00:00, evaluated
 * in WAT (Africa/Lagos) rather than the server's local timezone.
 */
function startOfWeek(): string {
  const now = new Date();

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

  const mondayUtcMs =
    Date.UTC(y, m - 1, diff, 0, 0, 0) - WAT_OFFSET_HOURS * 60 * 60 * 1000;

  return new Date(mondayUtcMs).toISOString();
}

/** Progress that cannot go stale: milestones done / milestones set. */
function deriveGoalProgress(goal: UserGoal | null): number {
  if (!goal) return 0;
  const milestones = [
    { text: goal.milestone_1, done: goal.milestone_1_completed },
    { text: goal.milestone_2, done: goal.milestone_2_completed },
    { text: goal.milestone_3, done: goal.milestone_3_completed },
  ].filter((m) => m.text);
  if (milestones.length === 0) {
    return Math.min(100, Math.max(0, goal.progress ?? 0));
  }
  const done = milestones.filter((m) => m.done).length;
  return Math.round((done / milestones.length) * 100);
}

function deriveGoalDay(goal: UserGoal | null): number | null {
  if (!goal) return null;
  return Math.max(
    1,
    Math.floor((Date.now() - new Date(goal.created_at).getTime()) / DAY_MS) + 1
  );
}

export async function getDashboardData(): Promise<DashboardData | null> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const weekStart = startOfWeek();
  const weekStartMs = new Date(weekStart).getTime();
  const historyStart = new Date(weekStartMs - 5 * 7 * DAY_MS).toISOString();

  const [
    profileRes,
    goalRes,
    commitmentsRes,
    sessionsThisWeekRes,
    upcomingSessionRes,
    registrationsRes,
    summitRegRes,
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

    // 6 weeks of commitments: this week's list plus the history strip.
    supabase
      .from('user_commitments')
      .select('*')
      .eq('user_id', user.id)
      .gte('created_at', historyStart)
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
      .in('status', ['scheduled', 'live'])
      .gte('scheduled_at', new Date().toISOString())
      .order('scheduled_at', { ascending: true })
      .limit(1)
      .maybeSingle(),

    // Fetched alongside the session (not after it) to avoid a second round trip.
    supabase
      .from('session_registrations')
      .select('session_id')
      .eq('user_id', user.id),

    supabase
      .from('summit_registrations')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .limit(1),
  ]);

  const profile = profileRes.data as Pick<
    Profile,
    | 'id'
    | 'full_name'
    | 'subscription_plan'
    | 'subscription_status'
    | 'subscription_end'
  > | null;

  const plan = await effectivePlanForUser(user.id, profile);
  const tierMeta = TIER_META[plan];

  const allCommitments = (commitmentsRes.data ?? []) as UserCommitment[];
  const commitments = allCommitments.filter(
    (c) => new Date(c.created_at).getTime() >= weekStartMs
  );
  const commitmentsDone = commitments.filter((c) => c.completed).length;

  const weekHistory: WeekBar[] = Array.from({ length: 6 }, (_, i) => {
    const from = weekStartMs - (5 - i) * 7 * DAY_MS;
    const to = from + 7 * DAY_MS;
    const inWeek = allCommitments.filter((c) => {
      const t = new Date(c.created_at).getTime();
      return t >= from && t < to;
    });
    return {
      label: new Date(from + WAT_OFFSET_HOURS * 3600000).toISOString().slice(0, 10),
      done: inWeek.filter((c) => c.completed).length,
      total: inWeek.length,
    };
  });

  let upcomingSession: (ExpertSession & { isRegistered: boolean }) | null = null;
  if (upcomingSessionRes.data) {
    const session = upcomingSessionRes.data as ExpertSession;
    const registeredIds = new Set(
      (registrationsRes.data ?? []).map((r: { session_id: string }) => r.session_id)
    );
    upcomingSession = { ...session, isRegistered: registeredIds.has(session.id) };
  }

  const goal = (goalRes.data ?? null) as UserGoal | null;
  const firstName = profile?.full_name?.trim().split(/\s+/)[0] ?? 'there';

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
    goalProgressPct: deriveGoalProgress(goal),
    goalDay: deriveGoalDay(goal),
    commitments,
    weekHistory,
    upcomingSession,
    summitDaysAway: daysUntilSummit(),
    summitRegistered: (summitRegRes?.count ?? 0) > 0,
  };
}

/**
 * Secondary data, fetched inside a <Suspense> boundary so the main dashboard
 * paints first. Every query degrades to empty if its table/column is missing.
 */
export async function getContinueData(): Promise<ContinueData> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { lastCoach: null, unreadCircleCount: 0, notifications: [] };

  const [coachRes, notifRes, readRes] = await Promise.all([
    supabase
      .from('coaching_sessions')
      .select('summary, user_input, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('notifications')
      .select('id, title, message, link, created_at')
      .eq('user_id', user.id)
      .eq('read', false)
      .order('created_at', { ascending: false })
      .limit(4),
    supabase
      .from('channel_read_positions')
      .select('channel_slug, last_read_at')
      .eq('user_id', user.id),
  ]);

  // One query for every channel (was one per channel): pull everything newer
  // than the oldest read marker, then count per channel in memory.
  let unreadCircleCount = 0;
  const positions = (readRes.data ?? []) as {
    channel_slug: string;
    last_read_at: string;
  }[];
  if (positions.length > 0) {
    const oldest = positions.reduce(
      (min, p) => (p.last_read_at < min ? p.last_read_at : min),
      positions[0].last_read_at
    );
    const { data: msgs } = await supabase
      .from('community_messages')
      .select('channel, created_at')
      .in('channel', positions.map((p) => p.channel_slug))
      .eq('deleted', false)
      .gt('created_at', oldest)
      .limit(500);
    const readAt = new Map(positions.map((p) => [p.channel_slug, p.last_read_at]));
    unreadCircleCount = (msgs ?? []).filter(
      (m: { channel: string; created_at: string }) =>
        m.created_at > (readAt.get(m.channel) ?? '')
    ).length;
  }

  const c = coachRes.data as {
    summary: string | null;
    user_input: string | null;
    created_at: string;
  } | null;
  const text = (c?.summary || c?.user_input || '').trim();

  return {
    lastCoach: c
      ? {
          preview: text.length > 110 ? text.slice(0, 107) + '…' : text,
          createdAt: c.created_at,
        }
      : null,
    unreadCircleCount,
    notifications: (notifRes.data ?? []) as ContinueData['notifications'],
  };
}

/** Toggle a commitment's completed state. Used by the client checklist. */
export async function toggleCommitment(
  commitmentId: string,
  completed: boolean
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const { error } = await supabase
    .from('user_commitments')
    .update({
      completed,
      completed_at: completed ? new Date().toISOString() : null,
    })
    .eq('id', commitmentId)
    .eq('user_id', user.id);

  if (error) throw error;
}
