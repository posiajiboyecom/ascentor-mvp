// lib/supabase/queries/dashboard.ts
// ============================================================
// All data the Home / Dashboard screen needs, in one fetch.
// Called from a Server Component (app/(app)/dashboard/page.tsx).
//
// Tables touched:
//   profiles, user_goals, user_commitments, expert_sessions,
//   session_registrations, usage_tracking,
//   channel_read_positions, community_messages  ← added for unread counts
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
  /** Total unread messages across all channels the user has visited. */
  unreadCircleCount: number;
}

const WAT_OFFSET_HOURS = 1; // Africa/Lagos is UTC+1, no DST

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
    readPositionsRes,
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

    // Fetch last-read timestamps for all channels this user has visited.
    // Degrades to empty array if channel_read_positions doesn't exist yet
    // (migration pending) — unreadCircleCount will be 0, which is safe.
    supabase
      .from('channel_read_positions')
      .select('channel_slug, last_read_at')
      .eq('user_id', user.id),
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

  // ── Unread circle count ───────────────────────────────────────────────────
  // For each channel the user has visited, count messages posted after their
  // last_read_at. Sum across all channels for the dashboard badge.
  // This is the same logic as community/page.tsx but summed rather than per-channel.
  let unreadCircleCount = 0;
  const readPositions = readPositionsRes.data ?? [];

  if (readPositions.length > 0) {
    const countResults = await Promise.all(
      readPositions.map(async (pos: { channel_slug: string; last_read_at: string }) => {
        const { count } = await supabase
          .from('community_messages')
          .select('id', { count: 'exact', head: true })
          .eq('channel', pos.channel_slug)
          .eq('deleted', false)
          .gt('created_at', pos.last_read_at);
        return count ?? 0;
      })
    );
    unreadCircleCount = countResults.reduce((sum, n) => sum + n, 0);
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
    goalProgressPct: goal?.progress ?? 0,
    commitments,
    upcomingSession,
    summitDaysAway: daysUntilSummit(),
    unreadCircleCount,
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
