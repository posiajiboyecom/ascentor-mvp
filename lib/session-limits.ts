// ============================================================
// Session Limiting per Subscription Type
//
// Plan IDs (canonical — what pay/start, pay/callback, and
// pay/webhook now write to profiles.subscription_plan):
//   free     → Free
//   explorer → Explorer  (₦12,000/mo)
//   builder  → Builder   (₦25,000/mo)
//   climber  → Climber   (₦60,000/mo)
//
// Legacy DB IDs that may still exist on old subscribers:
//   builder (old) → was Explorer — aliased to explorer limits
//   pro           → was Builder  — aliased to builder limits
//   elite         → was Climber  — aliased to climber limits
//
// The canonical IDs are the primary keys below; legacy IDs
// are explicit aliases at the bottom of PLAN_LIMITS so that
// getEffectivePlan() works correctly regardless of which value
// is stored in profiles.subscription_plan.
// ============================================================

import { createClient } from '@supabase/supabase-js';

export interface PlanLimits {
  coachingSessions: number;   // per month (-1 = unlimited)
  sessionLength: number;      // max messages per session (-1 = unlimited)
  expertSessions: number;     // registrations per month (-1 = unlimited)
  communityPosts: number;     // per day (-1 = unlimited)
  communityLimit: number;     // max cohorts joined (-1 = unlimited)
  courseAccess: 'none' | 'preview' | 'full';
}

// ── Canonical plan limits ────────────────────────────────────────────────────

const FREE_LIMITS: PlanLimits = {
  coachingSessions: 5,        // 5 sessions/month
  sessionLength: 8,           // 8 messages per session
  expertSessions: 0,
  communityPosts: 2,          // 2 posts/day
  communityLimit: 1,          // 1 circle
  courseAccess: 'preview',
};

const EXPLORER_LIMITS: PlanLimits = {
  coachingSessions: 30,
  sessionLength: 20,
  expertSessions: 1,          // 1 expert session/month
  communityPosts: 5,
  communityLimit: 3,          // up to 3 circles
  courseAccess: 'full',
};

const BUILDER_LIMITS: PlanLimits = {
  coachingSessions: -1,       // unlimited
  sessionLength: 50,
  expertSessions: 2,          // 2 expert sessions/month
  communityPosts: -1,
  communityLimit: -1,
  courseAccess: 'full',
};

const CLIMBER_LIMITS: PlanLimits = {
  coachingSessions: -1,
  sessionLength: -1,
  expertSessions: -1,         // unlimited
  communityPosts: -1,
  communityLimit: -1,
  courseAccess: 'full',
};

export const PLAN_LIMITS: Record<string, PlanLimits> = {
  // ── Canonical IDs (what the current payment system writes) ───────────────
  free:     FREE_LIMITS,
  explorer: EXPLORER_LIMITS,
  builder:  BUILDER_LIMITS,
  climber:  CLIMBER_LIMITS,

  // ── Legacy aliases — kept for backward-compat with old subscriber rows ────
  // Old DB value → canonical equivalent
  // (old) builder = Explorer tier
  // pro           = Builder tier
  // elite         = Climber tier
  basic:      EXPLORER_LIMITS,   // very old alias
  standard:   BUILDER_LIMITS,    // old legacy key
  pro:        BUILDER_LIMITS,    // old Builder DB ID
  elite:      CLIMBER_LIMITS,    // old Climber DB ID
  premium:    CLIMBER_LIMITS,    // very old alias
  tester:     BUILDER_LIMITS,    // promo — builder-level
  pro_legacy: CLIMBER_LIMITS,    // old pro maps to elite-level
  trialing:   FREE_LIMITS,       // trialing without a plan = free limits
};

// --- Usage Checking ---

interface UsageCheckResult {
  allowed: boolean;
  used: number;
  limit: number;
  remaining: number;
  message?: string;
}

export async function checkUsage(
  userId: string,
  feature: keyof Omit<PlanLimits, 'courseAccess'>,
  supabaseUrl: string,
  serviceRoleKey: string
): Promise<UsageCheckResult> {
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { data: profile } = await supabase
    .from('profiles')
    .select('subscription_plan, subscription_status, subscription_end')
    .eq('id', userId)
    .single();

  const plan = getEffectivePlan(profile);
  const limits = PLAN_LIMITS[plan] ?? PLAN_LIMITS.free;
  const limit = limits[feature] as number;

  if (limit === -1) {
    return { allowed: true, used: 0, limit: -1, remaining: -1 };
  }

  const used = await getUsageCount(supabase, userId, feature);
  const remaining = Math.max(0, limit - used);

  return {
    allowed: remaining > 0,
    used,
    limit,
    remaining,
    message: remaining > 0
      ? undefined
      : `You've reached your ${formatFeatureName(feature)} limit (${limit}/${getPeriod(feature)}). Upgrade to get more.`,
  };
}

export async function recordUsage(
  userId: string,
  feature: string,
  supabaseUrl: string,
  serviceRoleKey: string
): Promise<void> {
  const supabase = createClient(supabaseUrl, serviceRoleKey);
  await supabase.from('usage_tracking').insert({
    user_id: userId,
    feature,
    created_at: new Date().toISOString(),
  });
}

// --- Helpers ---

export function getEffectivePlan(profile: any): string {
  if (!profile) return 'free';
  const { subscription_plan, subscription_status, subscription_end } = profile;
  if (subscription_status === 'active' || subscription_status === 'trialing') {
    if (subscription_end) {
      return new Date(subscription_end) > new Date()
        ? (subscription_plan || 'explorer')
        : 'free';
    }
    return subscription_plan || 'explorer';
  }
  if (subscription_status === 'cancelled' && subscription_end) {
    return new Date(subscription_end) > new Date()
      ? (subscription_plan || 'explorer')
      : 'free';
  }
  return 'free';
}

async function getUsageCount(
  supabase: any,
  userId: string,
  feature: keyof Omit<PlanLimits, 'courseAccess'>
): Promise<number> {
  const period = getPeriodDates(feature);
  const { count } = await supabase
    .from('usage_tracking')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('feature', feature)
    .gte('created_at', period.start.toISOString())
    .lte('created_at', period.end.toISOString());
  return count || 0;
}

function getPeriodDates(feature: keyof Omit<PlanLimits, 'courseAccess'>): { start: Date; end: Date } {
  const now = new Date();
  if (feature === 'communityPosts') {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return { start, end };
  }
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  return { start, end };
}

function getPeriod(feature: keyof Omit<PlanLimits, 'courseAccess'>): string {
  return feature === 'communityPosts' ? 'day' : 'month';
}

function formatFeatureName(feature: keyof Omit<PlanLimits, 'courseAccess'>): string {
  const names: Record<string, string> = {
    coachingSessions: 'coaching session',
    sessionLength: 'message',
    expertSessions: 'expert session',
    communityPosts: 'community post',
    communityLimit: 'community',
  };
  return names[feature] || feature;
}

export const USAGE_TRACKING_SQL = `
CREATE TABLE IF NOT EXISTS usage_tracking (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  feature text NOT NULL,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_usage_tracking_user_feature
  ON usage_tracking(user_id, feature, created_at DESC);
ALTER TABLE usage_tracking ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own usage" ON usage_tracking
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service role can insert usage" ON usage_tracking
  FOR INSERT WITH CHECK (true);
`;
