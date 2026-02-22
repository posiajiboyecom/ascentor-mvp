// ============================================================
// ANALYTICS — Event Tracking Library
//
// Track key conversion funnel events + feature usage.
// Works with Plausible. Falls back silently if not configured.
//
// Usage:
//   import { trackEvent, trackRevenue, analytics } from '@/lib/analytics';
//
//   // Simple event
//   trackEvent('signup_completed');
//
//   // Event with properties
//   trackEvent('coaching_session_started', { topic: 'leadership' });
//
//   // Revenue event
//   trackRevenue('subscription_started', { plan: 'standard' }, 25);
//
//   // Pre-defined funnel events
//   analytics.signupStarted('google');
//   analytics.trialStarted('standard');
//   analytics.subscriptionStarted('standard', 25);
// ============================================================

declare global {
  interface Window {
    plausible?: (...args: any[]) => void;
  }
}

/**
 * Track a custom event in Plausible.
 */
export function trackEvent(
  eventName: string,
  props?: Record<string, string | number | boolean>
): void {
  try {
    if (typeof window !== 'undefined' && window.plausible) {
      window.plausible(eventName, props ? { props } : undefined);
    }
  } catch {
    // Silent fail — analytics should never break the app
  }
}

/**
 * Track a revenue event.
 */
export function trackRevenue(
  eventName: string,
  props: Record<string, string | number | boolean>,
  amountUSD: number
): void {
  try {
    if (typeof window !== 'undefined' && window.plausible) {
      window.plausible(eventName, {
        props,
        revenue: { currency: 'USD', amount: amountUSD },
      });
    }
  } catch {}
}

// ============================================================
// PRE-DEFINED FUNNEL EVENTS
// Wire these into the relevant components/pages.
// ============================================================

export const analytics = {
  // --- Auth Funnel ---
  signupStarted: (method: 'email' | 'google' | 'linkedin') =>
    trackEvent('signup_started', { method }),

  signupCompleted: (method: 'email' | 'google' | 'linkedin') =>
    trackEvent('signup_completed', { method }),

  loginCompleted: (method: 'email' | 'google' | 'linkedin') =>
    trackEvent('login_completed', { method }),

  onboardingCompleted: () =>
    trackEvent('onboarding_completed'),

  // --- Subscription Funnel ---
  checkoutViewed: (source: string) =>
    trackEvent('checkout_viewed', { source }),

  planSelected: (plan: string, billing: 'monthly' | 'yearly') =>
    trackEvent('plan_selected', { plan, billing }),

  promoCodeApplied: (code: string, discount: number) =>
    trackEvent('promo_code_applied', { code, discount }),

  trialStarted: (plan: string) =>
    trackEvent('trial_started', { plan }),

  paymentStarted: (plan: string, amount: number) =>
    trackEvent('payment_started', { plan, amount }),

  subscriptionStarted: (plan: string, amount: number) =>
    trackRevenue('subscription_started', { plan }, amount),

  subscriptionCancelled: (plan: string, reason?: string) =>
    trackEvent('subscription_cancelled', { plan, reason: reason || 'not_specified' }),

  // --- Coaching ---
  coachingSessionStarted: (topic?: string) =>
    trackEvent('coaching_session_started', { topic: topic || 'general' }),

  coachingSessionCompleted: (messageCount: number) =>
    trackEvent('coaching_session_completed', { message_count: messageCount }),

  coachingLimitReached: () =>
    trackEvent('coaching_limit_reached'),

  // --- Feature Usage ---
  courseViewed: (courseId: string) =>
    trackEvent('course_viewed', { course_id: courseId }),

  communityJoined: (cohortId: string) =>
    trackEvent('community_joined', { cohort_id: cohortId }),

  communityLimitReached: () =>
    trackEvent('community_limit_reached'),

  expertSessionRegistered: (sessionId: string) =>
    trackEvent('expert_session_registered', { session_id: sessionId }),

  profileUpdated: () =>
    trackEvent('profile_updated'),

  referralShared: (channel: 'whatsapp' | 'twitter' | 'linkedin' | 'copy') =>
    trackEvent('referral_shared', { channel }),

  referralConverted: () =>
    trackEvent('referral_converted'),

  // --- Engagement ---
  pageViewed: (page: string) =>
    trackEvent('pageview', { page }),

  upgradePromptShown: (feature: string) =>
    trackEvent('upgrade_prompt_shown', { feature }),

  upgradePromptClicked: (feature: string) =>
    trackEvent('upgrade_prompt_clicked', { feature }),

  pwaBannerShown: () =>
    trackEvent('pwa_banner_shown'),

  pwaInstalled: () =>
    trackEvent('pwa_installed'),
};
