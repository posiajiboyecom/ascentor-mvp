// FILE: app/middleware/subscription-gate.ts
// FIX: Replaced basic/standard/premium plan names with explorer/builder/climber.
//      Added PLAN_ALIAS map so old DB values (basic→explorer, standard→builder,
//      premium→climber) still resolve correctly for existing users.
//      Plan limits updated to match subscriptionGuard.ts and session-limits.ts.

// ============================================================
// SUBSCRIPTION GATING MIDDLEWARE
// Protects paid routes and enforces usage limits.
//
// Canonical plan IDs: free | explorer | builder | climber
// ============================================================

import { createClient } from '@supabase/supabase-js';

export interface SubscriptionStatus {
  hasAccess: boolean;
  plan: string;             // 'free' | 'explorer' | 'builder' | 'climber'
  status: string;           // 'free' | 'trialing' | 'active' | 'cancelled' | 'past_due'
  isTrialing: boolean;
  trialDaysLeft: number;
  subscriptionEnd: string | null;
  limits: PlanLimits;
  message?: string;
}

export interface PlanLimits {
  coachingSessionsPerDay: number;
  maxCommunities: number;
  learnAccess: boolean;
  expertSessionAccess: boolean;
  exportData: boolean;
  advancedAnalytics: boolean;
}

// Canonical plan limits — aligned with subscriptionGuard.ts and session-limits.ts
const PLAN_LIMITS: Record<string, PlanLimits> = {
  free: {
    coachingSessionsPerDay: 5,
    maxCommunities: 1,
    learnAccess: false,
    expertSessionAccess: false,
    exportData: false,
    advancedAnalytics: false,
  },
  explorer: {
    coachingSessionsPerDay: 30,
    maxCommunities: 1,
    learnAccess: true,
    expertSessionAccess: true,
    exportData: false,
    advancedAnalytics: false,
  },
  builder: {
    coachingSessionsPerDay: -1, // unlimited
    maxCommunities: 3,
    learnAccess: true,
    expertSessionAccess: true,
    exportData: true,
    advancedAnalytics: true,
  },
  climber: {
    coachingSessionsPerDay: -1,
    maxCommunities: -1,
    learnAccess: true,
    expertSessionAccess: true,
    exportData: true,
    advancedAnalytics: true,
  },
};

// Legacy aliases — maps old plan names to canonical ones
const PLAN_ALIAS: Record<string, string> = {
  basic:    'explorer',
  standard: 'builder',
  premium:  'climber',
  pro:      'builder',
  elite:    'climber',
  tester:   'builder',
};

function resolvePlan(raw: string | null | undefined): string {
  if (!raw) return 'free';
  return PLAN_ALIAS[raw] ?? raw;
}

// Routes that require a paid subscription
const PAID_ROUTES = ['/learn', '/courses'];
// Routes that have limits but aren't fully blocked
const LIMITED_ROUTES = ['/coach', '/community'];

/**
 * Get the user's effective subscription status including trial + referral extensions.
 */
export async function getSubscriptionStatus(
  userId: string,
  supabaseUrl: string,
  serviceRoleKey: string
): Promise<SubscriptionStatus> {
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { data: profile } = await supabase
    .from('profiles')
    .select('subscription_plan, subscription_status, subscription_end, referred_by, referral_count')
    .eq('id', userId)
    .single();

  if (!profile) {
    return {
      hasAccess: false,
      plan: 'free',
      status: 'free',
      isTrialing: false,
      trialDaysLeft: 0,
      subscriptionEnd: null,
      limits: PLAN_LIMITS.free,
      message: 'No profile found.',
    };
  }

  const { subscription_plan, subscription_status, subscription_end } = profile;
  const now = new Date();
  const plan = resolvePlan(subscription_plan);

  // Check if subscription is active or trialing
  if (subscription_status === 'active' || subscription_status === 'trialing') {
    if (subscription_end) {
      const endDate = new Date(subscription_end);
      if (endDate > now) {
        const daysLeft = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        return {
          hasAccess: true,
          plan,
          status: subscription_status,
          isTrialing: subscription_status === 'trialing',
          trialDaysLeft: subscription_status === 'trialing' ? daysLeft : 0,
          subscriptionEnd: subscription_end,
          limits: PLAN_LIMITS[plan] || PLAN_LIMITS.explorer,
        };
      }
      // Subscription expired — fall through to free
    } else {
      // No end date but active — treat as active (admin-granted or legacy)
      return {
        hasAccess: true,
        plan,
        status: subscription_status,
        isTrialing: false,
        trialDaysLeft: 0,
        subscriptionEnd: null,
        limits: PLAN_LIMITS[plan] || PLAN_LIMITS.explorer,
      };
    }
  }

  // Cancelled but still within billing period
  if (subscription_status === 'cancelled' && subscription_end) {
    const endDate = new Date(subscription_end);
    if (endDate > now) {
      return {
        hasAccess: true,
        plan,
        status: 'cancelled',
        isTrialing: false,
        trialDaysLeft: 0,
        subscriptionEnd: subscription_end,
        limits: PLAN_LIMITS[plan] || PLAN_LIMITS.explorer,
        message: 'Your subscription is cancelled but active until the end of your billing period.',
      };
    }
  }

  // Free tier
  return {
    hasAccess: false,
    plan: 'free',
    status: 'free',
    isTrialing: false,
    trialDaysLeft: 0,
    subscriptionEnd: null,
    limits: PLAN_LIMITS.free,
  };
}

/**
 * Check if user can access a specific route.
 */
export function canAccessRoute(
  path: string,
  subscription: SubscriptionStatus
): { allowed: boolean; reason?: string } {
  // Paid routes — block free users entirely
  for (const route of PAID_ROUTES) {
    if (path.startsWith(route)) {
      if (!subscription.hasAccess) {
        return {
          allowed: false,
          reason: `The Learn section requires a subscription. Start your 7-day free trial to unlock all courses.`,
        };
      }
    }
  }

  return { allowed: true };
}

/**
 * Check daily coaching session usage.
 */
export async function checkCoachingLimit(
  userId: string,
  subscription: SubscriptionStatus,
  supabaseUrl: string,
  serviceRoleKey: string
): Promise<{ allowed: boolean; used: number; limit: number; remaining: number; message?: string }> {
  const limit = subscription.limits.coachingSessionsPerDay;
  if (limit === -1) return { allowed: true, used: 0, limit: -1, remaining: -1 };

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const { count } = await supabase
    .from('usage_tracking')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('feature', 'coachingSessions')
    .gte('created_at', todayStart.toISOString());

  const used = count || 0;
  const remaining = Math.max(0, limit - used);

  return {
    allowed: remaining > 0,
    used,
    limit,
    remaining,
    message: remaining > 0
      ? undefined
      : `You've used all ${limit} coaching sessions for today. ${subscription.plan === 'free' ? 'Upgrade for more sessions.' : 'Come back tomorrow!'}`,
  };
}

/**
 * Check community join limit.
 */
export async function checkCommunityLimit(
  userId: string,
  subscription: SubscriptionStatus,
  supabaseUrl: string,
  serviceRoleKey: string
): Promise<{ allowed: boolean; joined: number; limit: number; message?: string }> {
  const limit = subscription.limits.maxCommunities;
  if (limit === -1) return { allowed: true, joined: 0, limit: -1 };

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { count } = await supabase
    .from('cohort_members')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);

  const joined = count || 0;

  return {
    allowed: joined < limit,
    joined,
    limit,
    message: joined >= limit
      ? `You've joined ${limit} communities (free tier limit). Upgrade to join more.`
      : undefined,
  };
}
