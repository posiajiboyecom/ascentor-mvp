// ============================================================
// FEATURE #5: Session Limiting per Subscription Type
// Middleware + utility to enforce usage limits based on plan.
//
// Plan ID mapping (Supabase subscription_plan → display name):
//   free    → Free
//   builder → Explorer  (₦12,000/mo)
//   pro     → Builder   (₦25,000/mo)
//   elite   → Climber   (₦60,000/mo)
// ============================================================

import { createClient } from '@supabase/supabase-js';

export interface PlanLimits {
  coachingSessions: number;   // per month (-1 = unlimited)
  sessionLength: number;      // max messages per session (-1 = unlimited)
  expertSessions: number;     // registrations per month (-1 = unlimited)
  communityPosts: number;     // per day (-1 = unlimited)
  communityLimit: number;     // max cohorts joined (-1 = unlimited)
  courseAccess: 'none' | 'preview' | 'full'; // course access level
}

export const PLAN_LIMITS: Record<string, PlanLimits> = {
  free: {
    coachingSessions: 5,        // 5 sessions/month — matches pricing page
    sessionLength: 8,           // 8 messages per session
    expertSessions: 0,          // is_free sessions only (enforced separately)
    communityPosts: 2,          // 2 posts/day
    communityLimit: 1,          // 1 cohort
    courseAccess: 'preview',    // 1 preview course
  },

  // ── Current Supabase plan IDs ────────────────────────────────────────────
  builder: {                    // Display: Explorer (₦12,000/mo)
    coachingSessions: 30,
    sessionLength: 20,
    expertSessions: 1,          // 1 expert session/month
    communityPosts: 5,
    communityLimit: 3,          // up to 3 cohorts
    courseAccess: 'full',
  },
  pro: {                        // Display: Builder (₦25,000/mo)
    coachingSessions: -1,       // unlimited
    sessionLength: 50,
    expertSessions: 2,          // 2 expert sessions/month
    communityPosts: -1,
    communityLimit: -1,
    courseAccess: 'full',
  },
  elite: {                      // Display: Climber (₦60,000/mo)
    coachingSessions: -1,
    sessionLength: -1,
    expertSessions: -1,         // unlimited
    communityPosts: -1,
    communityLimit: -1,
    courseAccess: 'full',
  },

  // ── Legacy aliases — kept for backward-compat ────────────────────────────
  explorer: {                   // old display-name key — same as builder
    coachingSessions: 30,
    sessionLength: 20,
    expertSessions: 1,
    communityPosts: 5,
    communityLimit: 3,
    courseAccess: 'full',
  },
  standard: {                   // old legacy key — builder-level
    coachingSessions: -1,
    sessionLength: 50,
    expertSessions: 2,
    communityPosts: -1,
    communityLimit: -1,
    courseAccess: 'full',
  },
  tester: {                     // promo — builder-level
    coachingSessions: -1,
    sessionLength: 50,
    expertSessions: 2,
    communityPosts: -1,
    communityLimit: -1,
    courseAccess: 'full',
  },
  climber: {                    // old display-name key — same as elite
    coachingSessions: -1,
    sessionLength: -1,
    expertSessions: -1,
    communityPosts: -1,
    communityLimit: -1,
    courseAccess: 'full',
  },
  pro_legacy: {                 // old pro maps to elite-level
    coachingSessions: -1,
    sessionLength: -1,
    expertSessions: -1,
    communityPosts: -1,
    communityLimit: -1,
    courseAccess: 'full',
  },
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
  const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.free;
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
      return new Date(subscription_end) > new Date() ? (subscription_plan || 'builder') : 'free';
    }
    return subscription_plan || 'builder';
  }
  if (subscription_status === 'cancelled' && subscription_end) {
    return new Date(subscription_end) > new Date() ? (subscription_plan || 'builder') : 'free';
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
