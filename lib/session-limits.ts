// ============================================================
// FEATURE #5: Session Limiting per Subscription Type
// Middleware + utility to enforce usage limits based on plan.
// Free users get limited AI coaching sessions; paid get more.
// ============================================================

import { createClient } from '@supabase/supabase-js';

// --- Plan Limits ---
export interface PlanLimits {
  coachingSessions: number;    // per month
  sessionLength: number;       // max messages per session
  expertSessions: number;      // registrations per month
  communityPosts: number;      // per day
  courseAccess: boolean;        // can access learn module
  exportData: boolean;         // can export data
}

export const PLAN_LIMITS: Record<string, PlanLimits> = {
  // ── Free tier ─────────────────────────────────────────────────────
  free: {
    coachingSessions: 3,       // 3 sessions/month
    sessionLength:    10,
    expertSessions:   1,
    communityPosts:   3,       // 3 posts/day
    courseAccess:     false,
    exportData:       false,
  },

  // ── Explorer ($5/mo) — stage: 15–22 ──────────────────────────────
  explorer: {
    coachingSessions: 10,      // 10 sessions/month
    sessionLength:    20,
    expertSessions:   2,
    communityPosts:   10,
    courseAccess:     true,
    exportData:       false,
  },

  // ── Builder ($19/mo) — stage: 22–32 ─────────────────────────────
  builder: {
    coachingSessions: 50,      // 50 sessions/month (effectively unlimited)
    sessionLength:    50,
    expertSessions:   10,
    communityPosts:   20,
    courseAccess:     true,
    exportData:       true,
  },

  // ── Climber ($39/mo) — stage: 32–50 ─────────────────────────────
  climber: {
    coachingSessions: -1,      // -1 = unlimited
    sessionLength:    -1,
    expertSessions:   -1,
    communityPosts:   -1,
    courseAccess:     true,
    exportData:       true,
  },

  // ── Legacy / alias names (kept for backwards-compat with DB values)
  standard: {                  // old 'Builder' equivalent
    coachingSessions: 50,
    sessionLength:    50,
    expertSessions:   10,
    communityPosts:   20,
    courseAccess:     true,
    exportData:       true,
  },
  tester: {                    // promo code testers
    coachingSessions: 50,
    sessionLength:    50,
    expertSessions:   10,
    communityPosts:   20,
    courseAccess:     true,
    exportData:       true,
  },
  pro: {                       // legacy promo-activated accounts
    coachingSessions: 50,
    sessionLength:    50,
    expertSessions:   10,
    communityPosts:   20,
    courseAccess:     true,
    exportData:       true,
  },
  basic: {                     // legacy checkout id (now 'explorer')
    coachingSessions: 10,
    sessionLength:    20,
    expertSessions:   2,
    communityPosts:   10,
    courseAccess:     true,
    exportData:       false,
  },
  premium: {                   // legacy checkout id (now 'climber')
    coachingSessions: -1,
    sessionLength:    -1,
    expertSessions:   -1,
    communityPosts:   -1,
    courseAccess:     true,
    exportData:       true,
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

/**
 * Check if user has remaining quota for a specific feature.
 * Call this BEFORE allowing an action (e.g., starting a coaching session).
 */
export async function checkUsage(
  userId: string,
  feature: keyof PlanLimits,
  supabaseUrl: string,
  serviceRoleKey: string
): Promise<UsageCheckResult> {
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // Get user's plan
  const { data: profile } = await supabase
    .from('profiles')
    .select('subscription_plan, subscription_status, subscription_end')
    .eq('id', userId)
    .single();

  const plan = getEffectivePlan(profile);
  const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.free;
  const limit = limits[feature];

  // Boolean features (courseAccess, exportData)
  if (typeof limit === 'boolean') {
    return {
      allowed: limit,
      used: 0,
      limit: limit ? 1 : 0,
      remaining: limit ? 1 : 0,
      message: limit ? undefined : 'Upgrade to Standard to access this feature.',
    };
  }

  // Count-based features
  // -1 means unlimited (Climber plan)
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

/**
 * Increment usage counter after an action is performed.
 */
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

function getEffectivePlan(profile: any): string {
  if (!profile) return 'free';

  const { subscription_plan, subscription_status, subscription_end } = profile;

  // Active statuses: 'active' and 'trialing' both grant plan access
  const isActiveStatus = ['active', 'trialing'].includes(subscription_status);

  if (isActiveStatus) {
    if (subscription_end) {
      const endDate = new Date(subscription_end);
      if (endDate > new Date()) {
        // Return the stored plan name — PLAN_LIMITS handles all known values
        // including legacy names (basic, premium, pro, standard)
        return subscription_plan || 'builder';
      }
      // Expired
      return 'free';
    }
    // Active with no end date (lifetime / manually set)
    return subscription_plan || 'builder';
  }

  return 'free';
}

async function getUsageCount(
  supabase: any,
  userId: string,
  feature: keyof PlanLimits
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

function getPeriodDates(feature: keyof PlanLimits): { start: Date; end: Date } {
  const now = new Date();

  if (feature === 'communityPosts') {
    // Daily limit
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return { start, end };
  }

  // Monthly limit (default)
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  return { start, end };
}

function getPeriod(feature: keyof PlanLimits): string {
  return feature === 'communityPosts' ? 'day' : 'month';
}

function formatFeatureName(feature: keyof PlanLimits): string {
  const names: Record<string, string> = {
    coachingSessions: 'coaching session',
    sessionLength: 'message',
    expertSessions: 'expert session',
    communityPosts: 'community post',
  };
  return names[feature] || feature;
}

// --- SQL: usage_tracking table ---
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

// --- Client-side hook (for React components) ---
export const USAGE_CHECK_CLIENT_CODE = `
// Use in any component that needs to check limits before an action:
//
// import { useState, useEffect } from 'react';
//
// function useUsageCheck(feature: string) {
//   const [usage, setUsage] = useState<UsageCheckResult | null>(null);
//   const [loading, setLoading] = useState(true);
//
//   useEffect(() => {
//     fetch(\`/api/usage/check?feature=\${feature}\`)
//       .then(r => r.json())
//       .then(setUsage)
//       .finally(() => setLoading(false));
//   }, [feature]);
//
//   return { usage, loading };
// }
`;
