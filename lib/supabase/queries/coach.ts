// lib/supabase/queries/coach.ts
// ============================================================
// Data fetching for the AI Coach page (app/(app)/coach/page.tsx).
//
// Table: coaching_sessions (confirmed via src/trigger/coaching-summary.ts)
//   One row per session. `messages` is a flat array of
//   { role: 'user' | 'assistant', content: string, ... } objects,
//   stored as a single jsonb column — not one DB row per message.
//
// Fix applied:
//   usedThisMonth + monthlyLimit replace the cosmetic PLACEHOLDER_DAILY_LIMIT.
//   The real gate is monthly (enforced in /api/coach/session). The usage bar
//   now shows the same window the server actually enforces, so users aren't
//   misled about how many sessions they have left.
// ============================================================

import { createClient } from '@/lib/supabase/server';
import { effectivePlan } from '@/lib/planTier';
import { getAvailableSessionTypes, type SessionType } from '@/lib/session-types';
import { PLAN_LIMITS } from '@/lib/session-limits';
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
  /** Sessions used this calendar month. Matches the server-side enforcement window. */
  usedThisMonth: number;
  /**
   * Monthly session limit for this plan (-1 = unlimited).
   * Pass directly to UsageBar; -1 hides the bar.
   */
  monthlyLimit: number;
}

function startOfMonthUTC(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
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

  const [profileRes, sessionsRes, monthCountRes] = await Promise.all([
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

    // Count sessions started this calendar month — the real enforcement window.
    supabase
      .from('coaching_sessions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', startOfMonthUTC()),
  ]);

  const plan = effectivePlan(profileRes.data);
  const planLimits = PLAN_LIMITS[plan] ?? PLAN_LIMITS.free;
  const monthlyLimit = planLimits.coachingSessions; // -1 = unlimited

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
    usedThisMonth: monthCountRes.count ?? 0,
    monthlyLimit,
  };
}
