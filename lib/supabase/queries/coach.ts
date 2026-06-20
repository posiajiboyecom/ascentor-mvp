// lib/supabase/queries/coach.ts
// ============================================================
// Data fetching for the AI Coach page (app/(app)/coach/page.tsx).
//
// Table: coaching_sessions (confirmed via src/trigger/coaching-summary.ts)
//   One row per session. `messages` is a flat array of
//   { role: 'user' | 'assistant', content: string, ... } objects,
//   stored as a single jsonb column — not one DB row per message.
// ============================================================

import { createClient } from '@/lib/supabase/server';
import { effectivePlan } from '@/lib/planTier';
import { getAvailableSessionTypes, type SessionType } from '@/lib/session-types';
import type { CoachingSession } from '@/database/database';

export interface RecentSessionSummary {
  id: string;
  sessionTypeLabel: string;
  preview: string;
  createdAt: string;
}

export interface CoachPageData {
  userId: string;
  firstName: string;
  planTier: string;
  availableSessionTypes: SessionType[];
  recentSessions: RecentSessionSummary[];
  /**
   * Sessions used "today". NOTE: this is a DAY-scoped count to match
   * the prototype's "x of N today" usage bar. The real plan limits in
   * lib/session-limits.ts are MONTH-scoped (5/30/unlimited) and don't
   * map onto a daily "15" anywhere — this is a known placeholder per
   * product decision. See PLACEHOLDER_DAILY_LIMIT below.
   */
  usedToday: number;
}

/**
 * Placeholder daily display limit — not enforced anywhere server-side.
 * Replace once a real daily cap is decided; until then the bar is
 * cosmetic and the actual gate is the monthly limit in session-limits.ts,
 * enforced inside the /api/coach/session route.
 */
export const PLACEHOLDER_DAILY_LIMIT = 15;

function startOfTodayWAT(): string {
  const now = new Date();
  const watParts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Lagos',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);

  const y = Number(watParts.find((p) => p.type === 'year')!.value);
  const m = Number(watParts.find((p) => p.type === 'month')!.value);
  const d = Number(watParts.find((p) => p.type === 'day')!.value);

  // Africa/Lagos is UTC+1, no DST.
  const startUtcMs = Date.UTC(y, m - 1, d, 0, 0, 0) - 1 * 60 * 60 * 1000;
  return new Date(startUtcMs).toISOString();
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max).trimEnd() + '…';
}

export async function getCoachPageData(): Promise<CoachPageData | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const [profileRes, sessionsRes, todayCountRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('full_name, subscription_plan, subscription_status, subscription_end')
      .eq('id', user.id)
      .single(),

    supabase
      .from('coaching_sessions')
      .select('id, session_type, user_input, ai_response, summary, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10),

    supabase
      .from('coaching_sessions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', startOfTodayWAT()),
  ]);

  const plan = effectivePlan(profileRes.data);
  const availableSessionTypes = getAvailableSessionTypes(plan);
  const firstName =
    (profileRes.data as { full_name?: string | null } | null)?.full_name
      ?.trim()
      .split(/\s+/)[0] ?? 'there';

  const allSessionTypesForLabels = getAvailableSessionTypes('climber');
  const recentSessions: RecentSessionSummary[] = (sessionsRes.data ?? []).map(
    (
      row: Pick<
        CoachingSession,
        'id' | 'session_type' | 'user_input' | 'ai_response' | 'summary' | 'created_at'
      >
    ) => {
      const sessionType = row.session_type
        ? allSessionTypesForLabels.find((t) => t.id === row.session_type)
        : null;

      return {
        id: row.id,
        sessionTypeLabel: sessionType?.label ?? 'Coaching session',
        preview: truncate(row.summary || row.user_input || '', 110),
        createdAt: row.created_at,
      };
    }
  );

  return {
    userId: user.id,
    firstName,
    planTier: plan,
    availableSessionTypes,
    recentSessions,
    usedToday: todayCountRes.count ?? 0,
  };
}
