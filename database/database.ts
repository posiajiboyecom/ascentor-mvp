// ============================================================
// DATABASE TYPES — Ascentor MVP
// C2 FIX: Replaces `any` on all Supabase query results.
//
// Usage:
//   import type { Tables, Profile, Course } from '@/types/database';
//
// To regenerate from live DB:
//   npx supabase gen types typescript --project-id YOUR_ID \
//     --schema public > types/database.ts
// ============================================================

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

// ── Enums ─────────────────────────────────────────────────────

export type SubscriptionPlan =
  | 'free' | 'explorer' | 'builder' | 'climber'
  | 'standard' | 'tester' | 'pro' | 'basic' | 'premium'; // legacy

export type SubscriptionStatus =
  | 'active' | 'trialing' | 'cancelled' | 'inactive' | 'past_due';

export type UserRole = 'admin' | 'moderator' | 'member';

export type ReferralStatus = 'signed_up' | 'onboarded' | 'subscribed' | 'rewarded';

export type DeletionStatus = 'pending' | 'processing' | 'completed';

export type CourseDifficulty = 'beginner' | 'intermediate' | 'advanced';

// ── Row interfaces ────────────────────────────────────────────

export interface Profile {
  id:                   string;
  email:                string | null;
  full_name:            string | null;
  avatar_url:           string | null;
  current_role:         string | null;
  industry:             string | null;
  goal_role:            string | null;
  biggest_challenge:    string | null;
  time_commitment:      string | null;
  role:                 UserRole;
  subscription_plan:    SubscriptionPlan;
  subscription_status:  SubscriptionStatus | null;
  subscription_end:     string | null;
  payment_method:       string | null;
  referral_code:        string | null;
  referral_count:       number;
  referral_bonus_days:  number;
  referred_by:          string | null;
  onboarding_completed: boolean;
  created_at:           string;
  updated_at:           string | null;
}

export interface CoachingSession {
  id:           string;
  user_id:      string;
  session_type: string | null;
  user_input:   string;
  ai_response:  string;
  messages:     Json | null;
  goals:        Json | null;
  summary:      string | null;
  token_usage:  number | null;
  created_at:   string;
}

export interface Cohort {
  id:           string;
  name:         string;
  description:  string | null;
  category:     string | null;
  icon:         string | null;
  cover_image:  string | null;
  member_count: number;
  max_members:  number | null;
  is_public:    boolean;
  created_by:   string | null;
  created_at:   string;
}

export interface CohortMember {
  id:        string;
  cohort_id: string;
  user_id:   string;
  role:      string | null;
  joined_at: string;
}

export interface CohortPost {
  id:         string;
  cohort_id:  string;
  user_id:    string;
  content:    string;
  upvotes:    number;
  created_at: string;
}

export interface CohortReply {
  id:         string;
  post_id:    string;
  user_id:    string;
  content:    string;
  upvotes:    number;
  created_at: string;
}

export interface CohortVote {
  id:         string;
  user_id:    string;
  post_id:    string | null;
  reply_id:   string | null;
  created_at: string;
}

export interface Course {
  id:                     string;
  title:                  string;
  description:            string | null;
  youtube_id:             string;
  category:               string | null;
  difficulty:             CourseDifficulty | null;
  duration:               string | null;
  sort_order:             number;
  is_published:           boolean;
  total_duration_seconds: number | null;
  created_at:             string;
}

export interface UserProgress {
  id:               string;
  user_id:          string;
  course_id:        string;
  progress_percent: number;
  last_position:    number;
  completed:        boolean;
  updated_at:       string;
}

export interface UserGoal {
  id:          string;
  user_id:     string;
  goal_text:   string;
  milestone_1: string | null;
  milestone_2: string | null;
  milestone_3: string | null;
  progress:    number;
  created_at:  string;
  updated_at:  string | null;
}

export interface UserCommitment {
  id:              string;
  user_id:         string;
  commitment_text: string;
  completed:       boolean;
  completed_at:    string | null;
  due_date:        string | null;
  created_at:      string;
}

export interface Notification {
  id:         string;
  user_id:    string;
  type:       string;
  title:      string;
  message:    string;
  link:       string | null;
  read:       boolean;
  created_at: string;
}

export interface NotificationPreferences {
  id:                 string;
  user_id:            string;
  session_reminders:  boolean;
  weekly_digest:      boolean;
  community_activity: boolean;
  expert_sessions:    boolean;
  referral_updates:   boolean;
  product_updates:    boolean;
}

export interface ExpertSession {
  id:                string;
  title:             string;
  expert_name:       string;
  expert_bio:        string | null;
  expert_avatar:     string | null;
  session_date:      string;
  duration_minutes:  number;
  max_attendees:     number | null;
  current_attendees: number;
  meeting_url:       string | null;
  registration_url:  string | null;
  topic:             string | null;
  is_published:      boolean;
  created_at:        string;
}

export interface SessionRegistration {
  id:            string;
  session_id:    string;
  user_id:       string;
  registered_at: string;
}

export interface Referral {
  id:            string;
  referrer_id:   string;
  referred_id:   string;
  referral_code: string;
  status:        ReferralStatus;
  rewarded_at:   string | null;
  created_at:    string;
}

export interface BlogPost {
  id:                string;
  title:             string;
  slug:              string;
  content:           string | null;
  excerpt:           string | null;
  category:          string | null;
  author_name:       string | null;
  author_avatar:     string | null;
  cover_image:       string | null;
  is_published:      boolean;
  published_at:      string | null;
  read_time_minutes: number | null;
  created_at:        string;
}

export interface Payment {
  id:            string;
  user_id:       string;
  amount:        number;
  currency:      string;
  reference:     string;
  provider:      string;
  status:        string;
  paystack_data: Json | null;
  created_at:    string;
}

export interface PromoCode {
  id:           string;
  code:         string;
  discount:     number;
  label:        string;
  applies_to:   string[] | null;
  max_uses:     number | null;
  current_uses: number;
  expires_at:   string | null;
  active:       boolean;
  created_at:   string;
}

export interface AuditLog {
  id:          string;
  user_id:     string | null;
  action:      string;
  entity_type: string | null;
  entity_id:   string | null;
  details:     Json | null;
  ip_address:  string | null;
  created_at:  string;
}

export interface UsageTracking {
  id:         string;
  user_id:    string;
  feature:    string;
  created_at: string;
}

export interface PushSubscription {
  id:           string;
  user_id:      string;
  subscription: Json;
  created_at:   string;
}

export interface DeletionRequest {
  id:           string;
  user_id:      string;
  email:        string;
  status:       DeletionStatus;
  requested_at: string;
  processed_at: string | null;
  notes:        string | null;
}

export interface WaitlistEntry {
  id:         string;
  email:      string;
  name:       string | null;
  created_at: string;
}

export interface NewsletterSubscriber {
  id:         string;
  email:      string;
  first_name: string | null;
  created_at: string;
}

// ── Convenience helper ────────────────────────────────────────
// Use this to type any Supabase .from('table') result:
//   const profile: Tables<'profiles'> = data;
export type Tables<T extends keyof TableMap> = TableMap[T];

type TableMap = {
  profiles:                 Profile;
  coaching_sessions:        CoachingSession;
  cohorts:                  Cohort;
  cohort_members:           CohortMember;
  cohort_posts:             CohortPost;
  cohort_replies:           CohortReply;
  cohort_votes:             CohortVote;
  courses:                  Course;
  user_progress:            UserProgress;
  user_goals:               UserGoal;
  user_commitments:         UserCommitment;
  notifications:            Notification;
  notification_preferences: NotificationPreferences;
  expert_sessions:          ExpertSession;
  session_registrations:    SessionRegistration;
  referrals:                Referral;
  blog_posts:               BlogPost;
  payments:                 Payment;
  promo_codes:              PromoCode;
  audit_logs:               AuditLog;
  usage_tracking:           UsageTracking;
  push_subscriptions:       PushSubscription;
  deletion_requests:        DeletionRequest;
  waitlist_entries:         WaitlistEntry;
  newsletter_subscribers:   NewsletterSubscriber;
};
