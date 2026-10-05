-- ============================================================================
-- 00000000_baseline.sql
-- Baseline of the live "public" schema, exported 2026-10-05 by scripts/export-schema.ts.
-- Structure only: tables, types, sequences, constraints, indexes, functions, triggers,
-- views, Row Level Security and policies. No data.
--
-- SECURITY NOTE: this is a faithful snapshot of production AFTER 20261005_lock_down_open_policies.sql
-- was applied (2026-10-05), so it contains the narrowed policies. Re-running that file is harmless.
--
-- Idempotent: safe on a database that already has these objects. Apply this FIRST on a
-- fresh project, then the dated migrations in order (they are all idempotent too).
-- Regenerate with: npx tsx scripts/export-schema.ts
-- ============================================================================

SET check_function_bodies = false;

-- ==========================================================================
-- Extensions
-- ==========================================================================

-- pg_stat_statements: managed by Supabase, enable from the dashboard if needed
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
-- supabase_vault: managed by Supabase, enable from the dashboard if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- ==========================================================================
-- Enum types
-- ==========================================================================


-- ==========================================================================
-- Sequences
-- ==========================================================================

CREATE SEQUENCE IF NOT EXISTS public."waitlist_position_seq";

-- ==========================================================================
-- Tables
-- ==========================================================================

CREATE TABLE IF NOT EXISTS public."audit_logs" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid,
  "action" text NOT NULL,
  "entity_type" text NOT NULL,
  "entity_id" text,
  "details" jsonb DEFAULT '{}'::jsonb,
  "ip_address" text,
  "user_agent" text,
  "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."blog_posts" (
  "id" uuid DEFAULT uuid_generate_v4() NOT NULL,
  "title" text NOT NULL,
  "slug" text NOT NULL,
  "excerpt" text,
  "content" text NOT NULL,
  "cover_image_url" text,
  "category" text DEFAULT 'General'::text,
  "tags" text[] DEFAULT '{}'::text[],
  "author_id" uuid,
  "author_name" text,
  "is_published" boolean DEFAULT false,
  "published_at" timestamp with time zone,
  "read_time_minutes" integer DEFAULT 5,
  "views" integer DEFAULT 0,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now(),
  "cover_image" text
);

CREATE TABLE IF NOT EXISTS public."channel_read_positions" (
  "user_id" uuid NOT NULL,
  "channel_slug" text NOT NULL,
  "last_read_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public."circle_members" (
  "channel_slug" text NOT NULL,
  "user_id" uuid NOT NULL,
  "joined_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public."clip_cta_jobs" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "created_by" uuid NOT NULL,
  "status" text DEFAULT 'queued'::text NOT NULL,
  "clip_url" text NOT NULL,
  "clip_duration_s" double precision,
  "clip_width" integer,
  "clip_height" integer,
  "cta_template" text NOT NULL,
  "cta_duration_s" double precision DEFAULT 8 NOT NULL,
  "cta_image_url" text,
  "cta_headline" text,
  "cta_subtitle" text,
  "cta_button_text" text,
  "cta_button_url" text,
  "cta_closing_line" text,
  "transition_type" text DEFAULT 'fade-black'::text NOT NULL,
  "video_url" text,
  "error_message" text,
  "trigger_run_id" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "started_at" timestamp with time zone,
  "completed_at" timestamp with time zone,
  "duration_ms" integer,
  "deleted_at" timestamp with time zone
);

CREATE TABLE IF NOT EXISTS public."coaching_sessions" (
  "id" uuid DEFAULT uuid_generate_v4() NOT NULL,
  "user_id" uuid NOT NULL,
  "session_type" text,
  "user_input" text NOT NULL,
  "ai_response" jsonb NOT NULL,
  "rating" integer,
  "user_feedback" text,
  "token_usage" jsonb,
  "created_at" timestamp with time zone DEFAULT now(),
  "summary" text,
  "key_takeaways" text[] DEFAULT '{}'::text[],
  "next_steps" text[] DEFAULT '{}'::text[],
  "goals" text[] DEFAULT '{}'::text[],
  "messages" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public."cohort_comments" (
  "id" uuid DEFAULT uuid_generate_v4() NOT NULL,
  "post_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "content" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."cohort_members" (
  "id" uuid DEFAULT uuid_generate_v4() NOT NULL,
  "cohort_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "joined_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."cohort_posts" (
  "id" uuid DEFAULT uuid_generate_v4() NOT NULL,
  "cohort_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "content" text NOT NULL,
  "likes_count" integer DEFAULT 0,
  "created_at" timestamp with time zone DEFAULT now(),
  "reply_count" integer DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public."cohort_replies" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "post_id" uuid,
  "user_id" uuid,
  "content" text NOT NULL,
  "upvotes" integer DEFAULT 0,
  "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."cohort_votes" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid,
  "post_id" uuid,
  "reply_id" uuid,
  "vote_type" text DEFAULT 'up'::text,
  "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."cohorts" (
  "id" uuid DEFAULT uuid_generate_v4() NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "max_members" integer DEFAULT 12,
  "created_at" timestamp with time zone DEFAULT now(),
  "category" text DEFAULT 'General'::text,
  "icon" text DEFAULT '👥'::text,
  "member_count" integer DEFAULT 0,
  "is_active" boolean DEFAULT true,
  "is_public" boolean DEFAULT true NOT NULL,
  "is_free" boolean DEFAULT false,
  "is_general" boolean DEFAULT false,
  "plan_tier" text DEFAULT 'free'::text NOT NULL
);

CREATE TABLE IF NOT EXISTS public."community_categories" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "collapsible" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now(),
  "icon" text,
  "color" text,
  "default_type" text DEFAULT 'chat'::text
);

CREATE TABLE IF NOT EXISTS public."community_channels" (
  "slug" text NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "emoji" text,
  "sort_order" integer DEFAULT 0,
  "category_id" uuid,
  "channel_type" text DEFAULT 'chat'::text,
  "is_pinned" boolean DEFAULT false,
  "member_count" integer DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public."community_messages" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "channel" text DEFAULT 'general'::text NOT NULL,
  "content" text NOT NULL,
  "flagged" boolean DEFAULT false NOT NULL,
  "deleted" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "likes" text[] DEFAULT '{}'::text[] NOT NULL,
  "reply_to_id" uuid,
  "pinned" boolean DEFAULT false,
  "dimension_tag" text,
  "reply_count" integer DEFAULT 0,
  "is_checkin" boolean DEFAULT false NOT NULL,
  "checkin_week" date
);

CREATE TABLE IF NOT EXISTS public."community_prompts" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "week_start" date NOT NULL,
  "question" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public."contact_messages" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "email" text NOT NULL,
  "subject" text NOT NULL,
  "message" text NOT NULL,
  "status" text DEFAULT 'new'::text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public."content_calendar" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "week" integer DEFAULT 1 NOT NULL,
  "pillar" text DEFAULT 'leadership'::text NOT NULL,
  "type" text DEFAULT 'Blog Post'::text NOT NULL,
  "title" text NOT NULL,
  "platform" text DEFAULT 'LinkedIn'::text NOT NULL,
  "status" text DEFAULT 'draft'::text NOT NULL,
  "scheduled_for" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "content_data" jsonb,
  "audience" text DEFAULT 'young_professional'::text,
  "approved_at" timestamp with time zone,
  "scheduled_date" date,
  "publish_notes" text,
  "published_at" timestamp with time zone,
  "triggered_by" text,
  "assigned_to" uuid,
  "assign_note" text
);

CREATE TABLE IF NOT EXISTS public."course_discussions" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "course_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "reply_to_id" uuid,
  "content" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public."course_notes" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "lesson_id" uuid NOT NULL,
  "course_id" uuid NOT NULL,
  "content" text DEFAULT ''::text NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public."courses" (
  "id" uuid DEFAULT uuid_generate_v4() NOT NULL,
  "title" text NOT NULL,
  "description" text,
  "thumbnail_url" text,
  "category" text,
  "difficulty" text,
  "lessons_count" integer DEFAULT 0,
  "created_at" timestamp with time zone DEFAULT now(),
  "is_published" boolean DEFAULT true,
  "sort_order" integer DEFAULT 0,
  "video_type" text DEFAULT 'youtube'::text,
  "created_by" uuid,
  "updated_at" timestamp with time zone DEFAULT now(),
  "lessons" integer DEFAULT 1,
  "duration" text,
  "emoji" text DEFAULT '📚'::text,
  "video_url" text,
  "youtube_id" text,
  "total_duration_seconds" integer DEFAULT 0,
  "plan_tier" text DEFAULT 'free'::text NOT NULL
);

CREATE TABLE IF NOT EXISTS public."deletion_requests" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "email" text NOT NULL,
  "status" text DEFAULT 'pending'::text NOT NULL,
  "requested_at" timestamp with time zone DEFAULT now(),
  "processed_at" timestamp with time zone,
  "notes" text
);

CREATE TABLE IF NOT EXISTS public."event_registrations" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "event_id" uuid NOT NULL,
  "full_name" text NOT NULL,
  "email" text NOT NULL,
  "whatsapp" text,
  "phone" text,
  "country" text,
  "city" text,
  "current_role" text,
  "organisation" text,
  "industry" text,
  "what_building" text,
  "why_attend" text,
  "how_heard" text,
  "dietary_needs" text,
  "accessibility" text,
  "status" text DEFAULT 'pending'::text NOT NULL,
  "ticket_type" text,
  "notes" text,
  "confirmed_at" timestamp with time zone,
  "notified_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "user_id" uuid
);

CREATE TABLE IF NOT EXISTS public."expert_registrations" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "session_id" text NOT NULL,
  "user_id" uuid,
  "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."expert_sessions" (
  "id" uuid DEFAULT uuid_generate_v4() NOT NULL,
  "title" text NOT NULL,
  "description" text,
  "expert_name" text NOT NULL,
  "expert_bio" text,
  "expert_photo_url" text,
  "scheduled_at" timestamp with time zone NOT NULL,
  "duration_minutes" integer DEFAULT 60,
  "max_participants" integer DEFAULT 50,
  "zoom_link" text,
  "recording_url" text,
  "status" text DEFAULT 'scheduled'::text,
  "created_at" timestamp with time zone DEFAULT now(),
  "join_url" text,
  "registration_url" text,
  "recording_type" text DEFAULT 'youtube'::text,
  "category" text,
  "created_by" uuid,
  "updated_at" timestamp with time zone DEFAULT now(),
  "partner_id" uuid,
  "plan_tier" text DEFAULT 'free'::text NOT NULL
);

CREATE TABLE IF NOT EXISTS public."guardsmann_applications" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "company" text NOT NULL,
  "title" text NOT NULL,
  "hq" text,
  "salary" text,
  "url" text,
  "status" text DEFAULT 'saved'::text NOT NULL,
  "notes" text,
  "applied_at" date,
  "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."guardsmann_jobs" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "company" text NOT NULL,
  "hq" text,
  "title" text NOT NULL,
  "salary" text,
  "url" text,
  "requirements" jsonb,
  "fit_note" text,
  "open_to_international" boolean DEFAULT true,
  "experience_required" text,
  "status" text DEFAULT 'saved'::text NOT NULL,
  "notes" text,
  "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."job_applications" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "job_id" uuid,
  "job_title" text NOT NULL,
  "department" text,
  "full_name" text NOT NULL,
  "email" text NOT NULL,
  "phone" text,
  "location" text,
  "linkedin_url" text,
  "portfolio_url" text,
  "cover_letter" text NOT NULL,
  "years_experience" text,
  "how_did_you_hear" text,
  "cv_url" text,
  "cv_filename" text,
  "cv_storage_path" text,
  "status" text DEFAULT 'new'::text NOT NULL,
  "admin_notes" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public."job_listings" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "title" text NOT NULL,
  "department" text DEFAULT 'Engineering'::text NOT NULL,
  "location" text DEFAULT 'Remote — Africa'::text NOT NULL,
  "type" text DEFAULT 'Full-time'::text NOT NULL,
  "mode" text DEFAULT 'Remote'::text NOT NULL,
  "description" text DEFAULT ''::text NOT NULL,
  "requirements" text[] DEFAULT '{}'::text[] NOT NULL,
  "nice_to_have" text[] DEFAULT '{}'::text[] NOT NULL,
  "apply_url" text,
  "apply_email" text,
  "is_active" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public."knowledge_chunks" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "chunk_id" text NOT NULL,
  "content" text NOT NULL,
  "embedding" vector(1024),
  "namespace" text DEFAULT 'default'::text NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "mentor_id" uuid,
  "mentor_slug" text
);

CREATE TABLE IF NOT EXISTS public."lead_magnet_downloads" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "magnet_id" text NOT NULL,
  "email" text NOT NULL,
  "first_name" text,
  "source" text DEFAULT 'direct'::text,
  "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."lead_magnets" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "type" text DEFAULT 'PDF'::text NOT NULL,
  "downloads" integer DEFAULT 0 NOT NULL,
  "conversions" integer DEFAULT 0 NOT NULL,
  "active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public."lessons" (
  "id" uuid DEFAULT uuid_generate_v4() NOT NULL,
  "course_id" uuid NOT NULL,
  "title" text NOT NULL,
  "description" text,
  "video_url" text NOT NULL,
  "duration_seconds" integer,
  "order_index" integer,
  "key_takeaways" text[],
  "quiz" jsonb,
  "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."marketing_pages" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "slug" text NOT NULL,
  "title" text NOT NULL,
  "route" text NOT NULL,
  "status" text DEFAULT 'draft'::text NOT NULL,
  "description" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public."marketing_repeating_items" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "section_id" uuid NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "draft_data" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "published_data" jsonb,
  "status" text DEFAULT 'draft'::text NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "published_at" timestamp with time zone
);

CREATE TABLE IF NOT EXISTS public."marketing_sections" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "page_id" uuid NOT NULL,
  "section_key" text NOT NULL,
  "label" text NOT NULL,
  "section_type" text NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "draft_data" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "published_data" jsonb,
  "status" text DEFAULT 'draft'::text NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "published_at" timestamp with time zone
);

CREATE TABLE IF NOT EXISTS public."mentor_applications" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "full_name" text NOT NULL,
  "email" text NOT NULL,
  "phone" text,
  "country" text NOT NULL,
  "role_title" text NOT NULL,
  "company" text NOT NULL,
  "years_experience" text NOT NULL,
  "industry" text NOT NULL,
  "linkedin_url" text,
  "career_summary" text NOT NULL,
  "why_mentor" text NOT NULL,
  "mentor_style" text NOT NULL,
  "success_story" text,
  "availability_hours" text NOT NULL,
  "has_mentored_before" text NOT NULL,
  "age_groups" text NOT NULL,
  "status" text DEFAULT 'pending'::text NOT NULL,
  "notes" text,
  "applied_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "terms_accepted" boolean DEFAULT false NOT NULL
);

CREATE TABLE IF NOT EXISTS public."mentor_profiles" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "slug" text NOT NULL,
  "name" text NOT NULL,
  "title" text NOT NULL,
  "bio" text DEFAULT ''::text NOT NULL,
  "background" text NOT NULL,
  "dimensions" text[] DEFAULT '{}'::text[] NOT NULL,
  "active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "dimension" text,
  "category" text,
  "avatar_url" text,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public."newsletter_queue" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "subject" text NOT NULL,
  "preview_text" text,
  "body" text,
  "pillar" text,
  "content_calendar_id" uuid,
  "status" text DEFAULT 'queued'::text,
  "queued_at" timestamp with time zone DEFAULT now(),
  "sent_at" timestamp with time zone
);

CREATE TABLE IF NOT EXISTS public."newsletter_subscribers" (
  "id" uuid DEFAULT uuid_generate_v4() NOT NULL,
  "email" text NOT NULL,
  "first_name" text,
  "source" text DEFAULT 'website'::text,
  "is_active" boolean DEFAULT true,
  "subscribed_at" timestamp with time zone DEFAULT now(),
  "unsubscribed_at" timestamp with time zone
);

CREATE TABLE IF NOT EXISTS public."notifications" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "type" text DEFAULT 'info'::text,
  "title" text NOT NULL,
  "message" text NOT NULL,
  "link" text,
  "read" boolean DEFAULT false,
  "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."partner_course_enrollments" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "partner_id" uuid NOT NULL,
  "course_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "enrolled_at" timestamp with time zone DEFAULT now() NOT NULL,
  "completed_at" timestamp with time zone,
  "progress_pct" integer DEFAULT 0 NOT NULL
);

CREATE TABLE IF NOT EXISTS public."partner_courses" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "partner_id" uuid NOT NULL,
  "title" text NOT NULL,
  "description" text,
  "youtube_id" text NOT NULL,
  "thumbnail_url" text,
  "category" text,
  "difficulty" text,
  "duration" text,
  "access_tier" text DEFAULT 'free'::text NOT NULL,
  "is_published" boolean DEFAULT false NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone
);

CREATE TABLE IF NOT EXISTS public."partner_enquiries" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "email" text NOT NULL,
  "organisation" text NOT NULL,
  "message" text,
  "status" text DEFAULT 'new'::text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public."partner_event_registrations" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "event_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "registered_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public."partner_events" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "partner_id" uuid NOT NULL,
  "title" text NOT NULL,
  "description" text,
  "expert_name" text NOT NULL,
  "expert_bio" text,
  "expert_avatar" text,
  "scheduled_at" timestamp with time zone NOT NULL,
  "duration_minutes" integer DEFAULT 60 NOT NULL,
  "max_attendees" integer,
  "meeting_url" text,
  "recording_url" text,
  "topic" text,
  "status" text DEFAULT 'draft'::text NOT NULL,
  "current_attendees" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public."partner_members" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "partner_id" uuid NOT NULL,
  "user_id" uuid,
  "email" text NOT NULL,
  "role" text DEFAULT 'member'::text NOT NULL,
  "status" text DEFAULT 'invited'::text NOT NULL,
  "invited_at" timestamp with time zone DEFAULT now(),
  "joined_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."partner_subscriptions" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "partner_id" uuid NOT NULL,
  "plan_tier" text NOT NULL,
  "billing_cycle" text DEFAULT 'monthly'::text NOT NULL,
  "amount_ngn" numeric(12,2) NOT NULL,
  "status" text DEFAULT 'active'::text NOT NULL,
  "paystack_reference" text,
  "current_period_start" timestamp with time zone DEFAULT now() NOT NULL,
  "current_period_end" timestamp with time zone DEFAULT (now() + '1 mon'::interval) NOT NULL,
  "cancelled_at" timestamp with time zone,
  "cancel_reason" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public."partner_transactions" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "partner_id" uuid NOT NULL,
  "user_id" uuid,
  "amount_ngn" numeric(12,2) NOT NULL,
  "partner_share_ngn" numeric(12,2) NOT NULL,
  "ascentor_fee_ngn" numeric(12,2) NOT NULL,
  "revenue_share_pct" integer NOT NULL,
  "plan" text,
  "billing_cycle" text,
  "paystack_reference" text,
  "status" text DEFAULT 'completed'::text,
  "paid_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."partners" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "slug" text NOT NULL,
  "subdomain" text NOT NULL,
  "name" text NOT NULL,
  "owner_id" uuid,
  "status" text DEFAULT 'pending'::text NOT NULL,
  "brand" jsonb DEFAULT '{"tagline": null, "bg_color": "#0C0B08", "logo_url": null, "font_body": "Syne", "card_color": "#141310", "text_color": "#D4CFC3", "favicon_url": null, "accent_color": "#C8851A", "font_heading": "Cormorant Garamond", "logo_dark_url": null, "platform_name": "", "primary_color": "#E8A020", "hide_ascentor_branding": false}'::jsonb NOT NULL,
  "paystack_subaccount_code" text,
  "paystack_secret_key" text,
  "revenue_share_percent" integer DEFAULT 70 NOT NULL,
  "custom_domain" text,
  "plan_overrides" jsonb,
  "features" jsonb DEFAULT '{"courses": true, "experts": false, "ai_coach": true, "community": true, "referrals": true}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now(),
  "onboarded_at" timestamp with time zone,
  "paystack_public_key" text,
  "plan_tier" text,
  "active_member_count" integer DEFAULT 0 NOT NULL,
  "ai_config" jsonb DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS public."password_reset_otps" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "email" text NOT NULL,
  "otp_code" text NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "used" boolean DEFAULT false,
  "created_at" timestamp with time zone DEFAULT now(),
  "attempts" integer DEFAULT 0 NOT NULL
);

CREATE TABLE IF NOT EXISTS public."payment_attempts" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid,
  "reference" text NOT NULL,
  "plan_id" text,
  "billing" text,
  "status" text DEFAULT 'pending'::text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "completed_at" timestamp with time zone,
  "kind" text DEFAULT 'subscription'::text NOT NULL,
  "registration_id" uuid,
  "email" text,
  "amount_kobo" bigint,
  "currency" text DEFAULT 'NGN'::text NOT NULL,
  "provider_tx_id" text,
  "provider_status" text,
  "failure_reason" text,
  "paid_at" timestamp with time zone,
  "abandoned_at" timestamp with time zone,
  "admin_notified_at" timestamp with time zone,
  "recovery_sent_at" timestamp with time zone,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "donation_id" uuid
);

CREATE TABLE IF NOT EXISTS public."payments" (
  "id" uuid DEFAULT uuid_generate_v4() NOT NULL,
  "user_id" uuid NOT NULL,
  "subscription_id" uuid,
  "provider" text NOT NULL,
  "provider_reference" text NOT NULL,
  "amount_cents" integer NOT NULL,
  "currency" text DEFAULT 'USD'::text NOT NULL,
  "status" text NOT NULL,
  "promo_code" text,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone DEFAULT now(),
  "reference" text,
  "paystack_data" jsonb,
  "plan_id" text,
  "billing" text,
  "amount" numeric,
  "paid_at" timestamp with time zone
);

CREATE TABLE IF NOT EXISTS public."personal_brand_briefs" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "week_number" integer,
  "pillar" text NOT NULL,
  "intent" text DEFAULT 'authority'::text NOT NULL,
  "topic" text NOT NULL,
  "angle" text,
  "brief_data" jsonb,
  "research_raw" text,
  "recent_news_raw" jsonb,
  "trending_tools" jsonb,
  "job_market_note" text,
  "status" text DEFAULT 'ready'::text NOT NULL,
  "written_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."platform_settings" (
  "key" text NOT NULL,
  "value" text NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."platform_snapshots" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "generated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "generated_by" text DEFAULT 'scheduled'::text NOT NULL,
  "raw_data" jsonb NOT NULL,
  "ai_report" jsonb NOT NULL,
  "token_cost" jsonb,
  "duration_ms" integer
);

CREATE TABLE IF NOT EXISTS public."post_likes" (
  "user_id" uuid NOT NULL,
  "post_id" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."product_purchases" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "product_id" uuid,
  "product_name" text NOT NULL,
  "amount_paid" numeric DEFAULT 0 NOT NULL,
  "currency" text DEFAULT 'NGN'::text NOT NULL,
  "reference" text NOT NULL,
  "paystack_data" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public."products" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "tagline" text DEFAULT ''::text NOT NULL,
  "description" text DEFAULT ''::text NOT NULL,
  "price" numeric DEFAULT 0 NOT NULL,
  "currency" text DEFAULT 'USD'::text NOT NULL,
  "image_url" text,
  "category" text DEFAULT 'Playbook'::text NOT NULL,
  "badge" text,
  "cta_label" text DEFAULT ''::text NOT NULL,
  "cta_url" text DEFAULT ''::text NOT NULL,
  "is_featured" boolean DEFAULT false NOT NULL,
  "published" boolean DEFAULT false NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public."profiles" (
  "id" uuid NOT NULL,
  "full_name" text NOT NULL,
  "current_role" text DEFAULT ''::text NOT NULL,
  "industry" text DEFAULT ''::text NOT NULL,
  "goal_role" text DEFAULT ''::text NOT NULL,
  "biggest_challenge" text,
  "time_commitment" text DEFAULT '15min'::text,
  "subscription_status" text DEFAULT 'free'::text,
  "stripe_customer_id" text,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now(),
  "role" text DEFAULT 'member'::text NOT NULL,
  "email" text,
  "referral_code" text,
  "referred_by" text,
  "referral_count" integer DEFAULT 0,
  "subscription_plan" text DEFAULT 'free'::text,
  "subscription_tier" text,
  "subscription_end" timestamp with time zone,
  "payment_method" text,
  "avatar_url" text,
  "onboarding_completed" boolean DEFAULT false NOT NULL,
  "onboarding_completed_at" timestamp with time zone,
  "subscription_start" timestamp with time zone,
  "paystack_customer_id" text,
  "permissions" jsonb,
  "referral_bonus_days" integer DEFAULT 0 NOT NULL,
  "paystack_sub_code" text,
  "card_details" jsonb,
  "whatsapp_phone" text,
  "ascent_stage" text,
  "what_building" text,
  "summit_registered" boolean DEFAULT false
);

CREATE TABLE IF NOT EXISTS public."promo_codes" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "code" text NOT NULL,
  "discount" numeric(3,2) NOT NULL,
  "label" text DEFAULT ''::text,
  "applies_to" text[] DEFAULT ARRAY['basic'::text, 'standard'::text, 'premium'::text],
  "max_uses" integer,
  "current_uses" integer DEFAULT 0,
  "expires_at" timestamp with time zone,
  "active" boolean DEFAULT true,
  "created_by" uuid,
  "created_at" timestamp with time zone DEFAULT now(),
  "auto_apply" boolean DEFAULT false
);

CREATE TABLE IF NOT EXISTS public."public_events" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "slug" text NOT NULL,
  "title" text NOT NULL,
  "tagline" text,
  "description" text,
  "event_date" text,
  "event_date_iso" date,
  "location" text,
  "is_published" boolean DEFAULT false NOT NULL,
  "is_featured" boolean DEFAULT false NOT NULL,
  "cover_color" text DEFAULT '#0F0F0E'::text NOT NULL,
  "registration_open" boolean DEFAULT true NOT NULL,
  "registration_fields" jsonb DEFAULT '["full_name", "email", "whatsapp", "country"]'::jsonb NOT NULL,
  "confirmation_subject" text,
  "confirmation_body" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public."push_events" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "recipient_id" uuid NOT NULL,
  "actor_id" uuid,
  "event_type" text NOT NULL,
  "title" text NOT NULL,
  "body" text NOT NULL,
  "url" text,
  "sent" boolean DEFAULT false,
  "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."push_subscriptions" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "endpoint" text NOT NULL,
  "subscription" jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."rail_billboards" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "slot" integer NOT NULL,
  "title" text NOT NULL,
  "body" text,
  "cta_label" text,
  "cta_url" text,
  "bg_color" text DEFAULT '#161412'::text,
  "accent_color" text DEFAULT '#C8A96E'::text,
  "image_url" text,
  "is_active" boolean DEFAULT true,
  "sort_order" integer DEFAULT 1,
  "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."referrals" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "referrer_id" uuid NOT NULL,
  "referred_id" uuid NOT NULL,
  "referral_code" text NOT NULL,
  "status" text DEFAULT 'signed_up'::text,
  "referrer_reward" text,
  "referred_reward" text,
  "rewarded_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."research_briefs" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "week_number" integer NOT NULL,
  "pillar" text NOT NULL,
  "topic" text NOT NULL,
  "angle" text,
  "brief_data" jsonb,
  "trends_raw" jsonb,
  "news_raw" jsonb,
  "research_raw" text,
  "status" text DEFAULT 'ready'::text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public."scheduled_posts" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "platform" text DEFAULT 'buffer'::text NOT NULL,
  "text" text NOT NULL,
  "hashtags" text[] DEFAULT '{}'::text[],
  "media_urls" text[] DEFAULT '{}'::text[],
  "scheduled_at" timestamp with time zone,
  "buffer_update_ids" text[] DEFAULT '{}'::text[],
  "status" text DEFAULT 'scheduled'::text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."sent_newsletters" (
  "id" uuid DEFAULT uuid_generate_v4() NOT NULL,
  "subject" text NOT NULL,
  "content" text NOT NULL,
  "sent_by" text,
  "subscriber_count" integer DEFAULT 0,
  "status" text DEFAULT 'queued'::text,
  "trigger_run_id" text,
  "sent_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."session_locations" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "ip_address" text NOT NULL,
  "country" text,
  "city" text,
  "latitude" double precision,
  "longitude" double precision,
  "user_agent" text,
  "risk_level" text DEFAULT 'low'::text,
  "blocked" boolean DEFAULT false,
  "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."session_registrations" (
  "id" uuid DEFAULT uuid_generate_v4() NOT NULL,
  "user_id" uuid NOT NULL,
  "session_id" uuid NOT NULL,
  "attended" boolean DEFAULT false,
  "rating" integer,
  "feedback" text,
  "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."social_queue" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "platform" text DEFAULT 'LinkedIn'::text NOT NULL,
  "content" text NOT NULL,
  "pillar" text DEFAULT 'leadership'::text NOT NULL,
  "scheduled_for" timestamp with time zone NOT NULL,
  "status" text DEFAULT 'queued'::text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "image_url" text,
  "buffer_update_id" text
);

CREATE TABLE IF NOT EXISTS public."soundtracks" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "mood" text NOT NULL,
  "file_url" text NOT NULL,
  "duration_s" integer,
  "active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public."subscriptions" (
  "id" uuid DEFAULT uuid_generate_v4() NOT NULL,
  "user_id" uuid NOT NULL,
  "plan" text DEFAULT 'standard'::text NOT NULL,
  "status" text DEFAULT 'trialing'::text NOT NULL,
  "price_cents" integer NOT NULL,
  "currency" text DEFAULT 'USD'::text NOT NULL,
  "promo_code_id" uuid,
  "payment_provider" text,
  "provider_reference" text,
  "trial_starts_at" timestamp with time zone DEFAULT now(),
  "trial_ends_at" timestamp with time zone DEFAULT (now() + '7 days'::interval),
  "current_period_start" timestamp with time zone,
  "current_period_end" timestamp with time zone,
  "refund_eligible_until" timestamp with time zone,
  "cancelled_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now(),
  "lemon_subscription_id" text,
  "lemon_variant_id" text
);

CREATE TABLE IF NOT EXISTS public."summit_donations" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "full_name" text NOT NULL,
  "email" text NOT NULL,
  "phone" text NOT NULL,
  "amount" numeric,
  "currency" text DEFAULT 'NGN'::text,
  "payment_reference" text,
  "payment_provider_tx_id" text,
  "paystack_fee" numeric,
  "status" text DEFAULT 'pending'::text NOT NULL,
  "message" text,
  "paid_at" timestamp with time zone,
  "receipt_email_sent_at" timestamp with time zone,
  "receipt_email_error" text,
  "admin_notified_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public."summit_interest" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "email" text NOT NULL,
  "what_building" text,
  "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."summit_registrations" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "full_name" text NOT NULL,
  "email" text NOT NULL,
  "whatsapp" text NOT NULL,
  "location" text NOT NULL,
  "organisation" text NOT NULL,
  "current_role" text NOT NULL,
  "other_messages" text,
  "consent" boolean DEFAULT false NOT NULL,
  "status" text DEFAULT 'pending'::text NOT NULL,
  "payment_status" text DEFAULT 'pending'::text NOT NULL,
  "payment_reference" text,
  "amount_paid" numeric,
  "currency" text DEFAULT 'NGN'::text,
  "payment_provider_tx_id" text,
  "paid_at" timestamp with time zone,
  "confirmed_at" timestamp with time zone,
  "ticket_type" text,
  "notes" text,
  "user_id" uuid,
  "source" text DEFAULT 'web'::text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "attendance_type" text DEFAULT 'onsite'::text NOT NULL,
  "paystack_fee" numeric,
  "confirmation_email_sent_at" timestamp with time zone,
  "confirmation_email_error" text,
  "admin_notified_paid_at" timestamp with time zone,
  "reminder_sent_at" timestamp with time zone,
  "reminder_count" integer DEFAULT 0 NOT NULL,
  "stream_access_sent_at" timestamp with time zone,
  "event_day_email_sent_at" timestamp with time zone
);

CREATE TABLE IF NOT EXISTS public."survey_analyses" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "survey_id" uuid,
  "insights" jsonb NOT NULL,
  "generated_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."survey_responses" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "survey_id" uuid,
  "user_id" uuid,
  "answers" jsonb NOT NULL,
  "metadata" jsonb,
  "submitted_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."surveys" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "title" text NOT NULL,
  "description" text,
  "slug" text NOT NULL,
  "is_published" boolean DEFAULT false,
  "questions" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "created_by" uuid,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."usage_tracking" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "feature" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."user_commitments" (
  "id" uuid DEFAULT uuid_generate_v4() NOT NULL,
  "user_id" uuid NOT NULL,
  "session_id" uuid,
  "commitment_text" text NOT NULL,
  "due_date" date,
  "completed" boolean DEFAULT false,
  "completed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."user_goals" (
  "id" uuid DEFAULT uuid_generate_v4() NOT NULL,
  "user_id" uuid NOT NULL,
  "goal_text" text NOT NULL,
  "timeframe" text DEFAULT '90 days'::text NOT NULL,
  "milestone_1" text,
  "milestone_2" text,
  "milestone_3" text,
  "progress" integer DEFAULT 0,
  "created_at" timestamp with time zone DEFAULT now(),
  "milestone_1_complete" boolean DEFAULT false,
  "milestone_2_complete" boolean DEFAULT false,
  "milestone_3_complete" boolean DEFAULT false,
  "milestone_1_completed" boolean DEFAULT false NOT NULL,
  "milestone_2_completed" boolean DEFAULT false NOT NULL,
  "milestone_3_completed" boolean DEFAULT false NOT NULL
);

CREATE TABLE IF NOT EXISTS public."user_progress" (
  "id" uuid DEFAULT uuid_generate_v4() NOT NULL,
  "user_id" uuid NOT NULL,
  "lesson_id" uuid NOT NULL,
  "completed" boolean DEFAULT false,
  "watch_percentage" integer DEFAULT 0,
  "quiz_score" integer,
  "completed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now(),
  "last_position" real DEFAULT 0,
  "progress_percent" integer DEFAULT 0,
  "course_id" text,
  "updated_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."video_jobs" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "created_by" uuid,
  "goal" text NOT NULL,
  "key_message" text NOT NULL,
  "narrative_style" text NOT NULL,
  "audience_tier" text NOT NULL,
  "theme" text DEFAULT 'dark'::text NOT NULL,
  "cta_template" text NOT NULL,
  "cta_button_text" text,
  "cta_button_url" text,
  "cta_image_url" text,
  "audio_mode" text DEFAULT 'none'::text NOT NULL,
  "track_mood" text,
  "status" text DEFAULT 'queued'::text NOT NULL,
  "video_url" text,
  "voiceover_url" text,
  "soundtrack_url" text,
  "scenes" jsonb,
  "cta_screen" jsonb,
  "voiceover_script" text,
  "scene_count" integer,
  "total_duration_seconds" numeric(6,1),
  "error_message" text,
  "duration_ms" integer,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "started_at" timestamp with time zone,
  "completed_at" timestamp with time zone,
  "preset_story" jsonb,
  "used_preset" boolean DEFAULT false NOT NULL,
  "client_request_id" text,
  "deleted_at" timestamp with time zone,
  "trigger_run_id" text,
  "cancelled_at" timestamp with time zone,
  "retry_count" integer DEFAULT 0 NOT NULL,
  "cost_usd_claude" numeric(10,6),
  "cost_usd_elevenlabs" numeric(10,6),
  "timings" jsonb,
  "cost_usd_total" numeric(10,6) GENERATED ALWAYS AS ((COALESCE(cost_usd_claude, (0)::numeric) + COALESCE(cost_usd_elevenlabs, (0)::numeric))) STORED
);

CREATE TABLE IF NOT EXISTS public."waitlist_email_events" (
  "id" uuid DEFAULT uuid_generate_v4() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "entry_id" uuid NOT NULL,
  "event_type" text NOT NULL,
  "metadata" jsonb,
  "ip_address" inet
);

CREATE TABLE IF NOT EXISTS public."waitlist_entries" (
  "id" uuid DEFAULT uuid_generate_v4() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "first_name" text NOT NULL,
  "last_name" text NOT NULL,
  "email" text NOT NULL,
  "whatsapp" text NOT NULL,
  "life_stage" text DEFAULT 'builder'::text NOT NULL,
  "country" text,
  "industry" text,
  "referral_source" text,
  "utm_source" text,
  "utm_medium" text,
  "utm_campaign" text,
  "utm_content" text,
  "utm_term" text,
  "position" integer,
  "status" text DEFAULT 'waiting'::text NOT NULL,
  "invited_at" timestamp with time zone,
  "converted_at" timestamp with time zone,
  "email_confirmed" boolean DEFAULT false NOT NULL,
  "confirmation_token" text DEFAULT encode(gen_random_bytes(32), 'hex'::text),
  "confirmed_at" timestamp with time zone,
  "referral_code" text DEFAULT upper(SUBSTRING(encode(gen_random_bytes(4), 'hex'::text) FROM 1 FOR 8)),
  "referred_by_code" text,
  "referral_count" integer DEFAULT 0 NOT NULL,
  "ip_address" inet,
  "user_agent" text,
  "landing_page" text,
  "consent_given" boolean DEFAULT false NOT NULL,
  "consent_at" timestamp with time zone,
  "gdpr_delete_requested" boolean DEFAULT false NOT NULL
);


-- ==========================================================================
-- Column presence (for databases that already have older versions of these tables)
-- ==========================================================================

ALTER TABLE public."audit_logs" ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid();
ALTER TABLE public."audit_logs" ADD COLUMN IF NOT EXISTS "user_id" uuid;
ALTER TABLE public."audit_logs" ADD COLUMN IF NOT EXISTS "action" text;
ALTER TABLE public."audit_logs" ADD COLUMN IF NOT EXISTS "entity_type" text;
ALTER TABLE public."audit_logs" ADD COLUMN IF NOT EXISTS "entity_id" text;
ALTER TABLE public."audit_logs" ADD COLUMN IF NOT EXISTS "details" jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public."audit_logs" ADD COLUMN IF NOT EXISTS "ip_address" text;
ALTER TABLE public."audit_logs" ADD COLUMN IF NOT EXISTS "user_agent" text;
ALTER TABLE public."audit_logs" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now();
ALTER TABLE public."blog_posts" ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT uuid_generate_v4();
ALTER TABLE public."blog_posts" ADD COLUMN IF NOT EXISTS "title" text;
ALTER TABLE public."blog_posts" ADD COLUMN IF NOT EXISTS "slug" text;
ALTER TABLE public."blog_posts" ADD COLUMN IF NOT EXISTS "excerpt" text;
ALTER TABLE public."blog_posts" ADD COLUMN IF NOT EXISTS "content" text;
ALTER TABLE public."blog_posts" ADD COLUMN IF NOT EXISTS "cover_image_url" text;
ALTER TABLE public."blog_posts" ADD COLUMN IF NOT EXISTS "category" text DEFAULT 'General'::text;
ALTER TABLE public."blog_posts" ADD COLUMN IF NOT EXISTS "tags" text[] DEFAULT '{}'::text[];
ALTER TABLE public."blog_posts" ADD COLUMN IF NOT EXISTS "author_id" uuid;
ALTER TABLE public."blog_posts" ADD COLUMN IF NOT EXISTS "author_name" text;
ALTER TABLE public."blog_posts" ADD COLUMN IF NOT EXISTS "is_published" boolean DEFAULT false;
ALTER TABLE public."blog_posts" ADD COLUMN IF NOT EXISTS "published_at" timestamp with time zone;
ALTER TABLE public."blog_posts" ADD COLUMN IF NOT EXISTS "read_time_minutes" integer DEFAULT 5;
ALTER TABLE public."blog_posts" ADD COLUMN IF NOT EXISTS "views" integer DEFAULT 0;
ALTER TABLE public."blog_posts" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now();
ALTER TABLE public."blog_posts" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone DEFAULT now();
ALTER TABLE public."blog_posts" ADD COLUMN IF NOT EXISTS "cover_image" text;
ALTER TABLE public."channel_read_positions" ADD COLUMN IF NOT EXISTS "user_id" uuid;
ALTER TABLE public."channel_read_positions" ADD COLUMN IF NOT EXISTS "channel_slug" text;
ALTER TABLE public."channel_read_positions" ADD COLUMN IF NOT EXISTS "last_read_at" timestamp with time zone DEFAULT now();
ALTER TABLE public."circle_members" ADD COLUMN IF NOT EXISTS "channel_slug" text;
ALTER TABLE public."circle_members" ADD COLUMN IF NOT EXISTS "user_id" uuid;
ALTER TABLE public."circle_members" ADD COLUMN IF NOT EXISTS "joined_at" timestamp with time zone DEFAULT now();
ALTER TABLE public."clip_cta_jobs" ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid();
ALTER TABLE public."clip_cta_jobs" ADD COLUMN IF NOT EXISTS "created_by" uuid;
ALTER TABLE public."clip_cta_jobs" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'queued'::text;
ALTER TABLE public."clip_cta_jobs" ADD COLUMN IF NOT EXISTS "clip_url" text;
ALTER TABLE public."clip_cta_jobs" ADD COLUMN IF NOT EXISTS "clip_duration_s" double precision;
ALTER TABLE public."clip_cta_jobs" ADD COLUMN IF NOT EXISTS "clip_width" integer;
ALTER TABLE public."clip_cta_jobs" ADD COLUMN IF NOT EXISTS "clip_height" integer;
ALTER TABLE public."clip_cta_jobs" ADD COLUMN IF NOT EXISTS "cta_template" text;
ALTER TABLE public."clip_cta_jobs" ADD COLUMN IF NOT EXISTS "cta_duration_s" double precision DEFAULT 8;
ALTER TABLE public."clip_cta_jobs" ADD COLUMN IF NOT EXISTS "cta_image_url" text;
ALTER TABLE public."clip_cta_jobs" ADD COLUMN IF NOT EXISTS "cta_headline" text;
ALTER TABLE public."clip_cta_jobs" ADD COLUMN IF NOT EXISTS "cta_subtitle" text;
ALTER TABLE public."clip_cta_jobs" ADD COLUMN IF NOT EXISTS "cta_button_text" text;
ALTER TABLE public."clip_cta_jobs" ADD COLUMN IF NOT EXISTS "cta_button_url" text;
ALTER TABLE public."clip_cta_jobs" ADD COLUMN IF NOT EXISTS "cta_closing_line" text;
ALTER TABLE public."clip_cta_jobs" ADD COLUMN IF NOT EXISTS "transition_type" text DEFAULT 'fade-black'::text;
ALTER TABLE public."clip_cta_jobs" ADD COLUMN IF NOT EXISTS "video_url" text;
ALTER TABLE public."clip_cta_jobs" ADD COLUMN IF NOT EXISTS "error_message" text;
ALTER TABLE public."clip_cta_jobs" ADD COLUMN IF NOT EXISTS "trigger_run_id" text;
ALTER TABLE public."clip_cta_jobs" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now();
ALTER TABLE public."clip_cta_jobs" ADD COLUMN IF NOT EXISTS "started_at" timestamp with time zone;
ALTER TABLE public."clip_cta_jobs" ADD COLUMN IF NOT EXISTS "completed_at" timestamp with time zone;
ALTER TABLE public."clip_cta_jobs" ADD COLUMN IF NOT EXISTS "duration_ms" integer;
ALTER TABLE public."clip_cta_jobs" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp with time zone;
ALTER TABLE public."coaching_sessions" ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT uuid_generate_v4();
ALTER TABLE public."coaching_sessions" ADD COLUMN IF NOT EXISTS "user_id" uuid;
ALTER TABLE public."coaching_sessions" ADD COLUMN IF NOT EXISTS "session_type" text;
ALTER TABLE public."coaching_sessions" ADD COLUMN IF NOT EXISTS "user_input" text;
ALTER TABLE public."coaching_sessions" ADD COLUMN IF NOT EXISTS "ai_response" jsonb;
ALTER TABLE public."coaching_sessions" ADD COLUMN IF NOT EXISTS "rating" integer;
ALTER TABLE public."coaching_sessions" ADD COLUMN IF NOT EXISTS "user_feedback" text;
ALTER TABLE public."coaching_sessions" ADD COLUMN IF NOT EXISTS "token_usage" jsonb;
ALTER TABLE public."coaching_sessions" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now();
ALTER TABLE public."coaching_sessions" ADD COLUMN IF NOT EXISTS "summary" text;
ALTER TABLE public."coaching_sessions" ADD COLUMN IF NOT EXISTS "key_takeaways" text[] DEFAULT '{}'::text[];
ALTER TABLE public."coaching_sessions" ADD COLUMN IF NOT EXISTS "next_steps" text[] DEFAULT '{}'::text[];
ALTER TABLE public."coaching_sessions" ADD COLUMN IF NOT EXISTS "goals" text[] DEFAULT '{}'::text[];
ALTER TABLE public."coaching_sessions" ADD COLUMN IF NOT EXISTS "messages" jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public."coaching_sessions" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone DEFAULT now();
ALTER TABLE public."cohort_comments" ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT uuid_generate_v4();
ALTER TABLE public."cohort_comments" ADD COLUMN IF NOT EXISTS "post_id" uuid;
ALTER TABLE public."cohort_comments" ADD COLUMN IF NOT EXISTS "user_id" uuid;
ALTER TABLE public."cohort_comments" ADD COLUMN IF NOT EXISTS "content" text;
ALTER TABLE public."cohort_comments" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now();
ALTER TABLE public."cohort_members" ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT uuid_generate_v4();
ALTER TABLE public."cohort_members" ADD COLUMN IF NOT EXISTS "cohort_id" uuid;
ALTER TABLE public."cohort_members" ADD COLUMN IF NOT EXISTS "user_id" uuid;
ALTER TABLE public."cohort_members" ADD COLUMN IF NOT EXISTS "joined_at" timestamp with time zone DEFAULT now();
ALTER TABLE public."cohort_posts" ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT uuid_generate_v4();
ALTER TABLE public."cohort_posts" ADD COLUMN IF NOT EXISTS "cohort_id" uuid;
ALTER TABLE public."cohort_posts" ADD COLUMN IF NOT EXISTS "user_id" uuid;
ALTER TABLE public."cohort_posts" ADD COLUMN IF NOT EXISTS "content" text;
ALTER TABLE public."cohort_posts" ADD COLUMN IF NOT EXISTS "likes_count" integer DEFAULT 0;
ALTER TABLE public."cohort_posts" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now();
ALTER TABLE public."cohort_posts" ADD COLUMN IF NOT EXISTS "reply_count" integer DEFAULT 0;
ALTER TABLE public."cohort_replies" ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid();
ALTER TABLE public."cohort_replies" ADD COLUMN IF NOT EXISTS "post_id" uuid;
ALTER TABLE public."cohort_replies" ADD COLUMN IF NOT EXISTS "user_id" uuid;
ALTER TABLE public."cohort_replies" ADD COLUMN IF NOT EXISTS "content" text;
ALTER TABLE public."cohort_replies" ADD COLUMN IF NOT EXISTS "upvotes" integer DEFAULT 0;
ALTER TABLE public."cohort_replies" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now();
ALTER TABLE public."cohort_votes" ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid();
ALTER TABLE public."cohort_votes" ADD COLUMN IF NOT EXISTS "user_id" uuid;
ALTER TABLE public."cohort_votes" ADD COLUMN IF NOT EXISTS "post_id" uuid;
ALTER TABLE public."cohort_votes" ADD COLUMN IF NOT EXISTS "reply_id" uuid;
ALTER TABLE public."cohort_votes" ADD COLUMN IF NOT EXISTS "vote_type" text DEFAULT 'up'::text;
ALTER TABLE public."cohort_votes" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now();
ALTER TABLE public."cohorts" ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT uuid_generate_v4();
ALTER TABLE public."cohorts" ADD COLUMN IF NOT EXISTS "name" text;
ALTER TABLE public."cohorts" ADD COLUMN IF NOT EXISTS "description" text;
ALTER TABLE public."cohorts" ADD COLUMN IF NOT EXISTS "max_members" integer DEFAULT 12;
ALTER TABLE public."cohorts" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now();
ALTER TABLE public."cohorts" ADD COLUMN IF NOT EXISTS "category" text DEFAULT 'General'::text;
ALTER TABLE public."cohorts" ADD COLUMN IF NOT EXISTS "icon" text DEFAULT '👥'::text;
ALTER TABLE public."cohorts" ADD COLUMN IF NOT EXISTS "member_count" integer DEFAULT 0;
ALTER TABLE public."cohorts" ADD COLUMN IF NOT EXISTS "is_active" boolean DEFAULT true;
ALTER TABLE public."cohorts" ADD COLUMN IF NOT EXISTS "is_public" boolean DEFAULT true;
ALTER TABLE public."cohorts" ADD COLUMN IF NOT EXISTS "is_free" boolean DEFAULT false;
ALTER TABLE public."cohorts" ADD COLUMN IF NOT EXISTS "is_general" boolean DEFAULT false;
ALTER TABLE public."cohorts" ADD COLUMN IF NOT EXISTS "plan_tier" text DEFAULT 'free'::text;
ALTER TABLE public."community_categories" ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid();
ALTER TABLE public."community_categories" ADD COLUMN IF NOT EXISTS "name" text;
ALTER TABLE public."community_categories" ADD COLUMN IF NOT EXISTS "sort_order" integer DEFAULT 0;
ALTER TABLE public."community_categories" ADD COLUMN IF NOT EXISTS "collapsible" boolean DEFAULT true;
ALTER TABLE public."community_categories" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now();
ALTER TABLE public."community_categories" ADD COLUMN IF NOT EXISTS "icon" text;
ALTER TABLE public."community_categories" ADD COLUMN IF NOT EXISTS "color" text;
ALTER TABLE public."community_categories" ADD COLUMN IF NOT EXISTS "default_type" text DEFAULT 'chat'::text;
ALTER TABLE public."community_channels" ADD COLUMN IF NOT EXISTS "slug" text;
ALTER TABLE public."community_channels" ADD COLUMN IF NOT EXISTS "name" text;
ALTER TABLE public."community_channels" ADD COLUMN IF NOT EXISTS "description" text;
ALTER TABLE public."community_channels" ADD COLUMN IF NOT EXISTS "emoji" text;
ALTER TABLE public."community_channels" ADD COLUMN IF NOT EXISTS "sort_order" integer DEFAULT 0;
ALTER TABLE public."community_channels" ADD COLUMN IF NOT EXISTS "category_id" uuid;
ALTER TABLE public."community_channels" ADD COLUMN IF NOT EXISTS "channel_type" text DEFAULT 'chat'::text;
ALTER TABLE public."community_channels" ADD COLUMN IF NOT EXISTS "is_pinned" boolean DEFAULT false;
ALTER TABLE public."community_channels" ADD COLUMN IF NOT EXISTS "member_count" integer DEFAULT 0;
ALTER TABLE public."community_messages" ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid();
ALTER TABLE public."community_messages" ADD COLUMN IF NOT EXISTS "user_id" uuid;
ALTER TABLE public."community_messages" ADD COLUMN IF NOT EXISTS "channel" text DEFAULT 'general'::text;
ALTER TABLE public."community_messages" ADD COLUMN IF NOT EXISTS "content" text;
ALTER TABLE public."community_messages" ADD COLUMN IF NOT EXISTS "flagged" boolean DEFAULT false;
ALTER TABLE public."community_messages" ADD COLUMN IF NOT EXISTS "deleted" boolean DEFAULT false;
ALTER TABLE public."community_messages" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now();
ALTER TABLE public."community_messages" ADD COLUMN IF NOT EXISTS "likes" text[] DEFAULT '{}'::text[];
ALTER TABLE public."community_messages" ADD COLUMN IF NOT EXISTS "reply_to_id" uuid;
ALTER TABLE public."community_messages" ADD COLUMN IF NOT EXISTS "pinned" boolean DEFAULT false;
ALTER TABLE public."community_messages" ADD COLUMN IF NOT EXISTS "dimension_tag" text;
ALTER TABLE public."community_messages" ADD COLUMN IF NOT EXISTS "reply_count" integer DEFAULT 0;
ALTER TABLE public."community_messages" ADD COLUMN IF NOT EXISTS "is_checkin" boolean DEFAULT false;
ALTER TABLE public."community_messages" ADD COLUMN IF NOT EXISTS "checkin_week" date;
ALTER TABLE public."community_prompts" ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid();
ALTER TABLE public."community_prompts" ADD COLUMN IF NOT EXISTS "week_start" date;
ALTER TABLE public."community_prompts" ADD COLUMN IF NOT EXISTS "question" text;
ALTER TABLE public."community_prompts" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now();
ALTER TABLE public."contact_messages" ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid();
ALTER TABLE public."contact_messages" ADD COLUMN IF NOT EXISTS "name" text;
ALTER TABLE public."contact_messages" ADD COLUMN IF NOT EXISTS "email" text;
ALTER TABLE public."contact_messages" ADD COLUMN IF NOT EXISTS "subject" text;
ALTER TABLE public."contact_messages" ADD COLUMN IF NOT EXISTS "message" text;
ALTER TABLE public."contact_messages" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'new'::text;
ALTER TABLE public."contact_messages" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now();
ALTER TABLE public."content_calendar" ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid();
ALTER TABLE public."content_calendar" ADD COLUMN IF NOT EXISTS "week" integer DEFAULT 1;
ALTER TABLE public."content_calendar" ADD COLUMN IF NOT EXISTS "pillar" text DEFAULT 'leadership'::text;
ALTER TABLE public."content_calendar" ADD COLUMN IF NOT EXISTS "type" text DEFAULT 'Blog Post'::text;
ALTER TABLE public."content_calendar" ADD COLUMN IF NOT EXISTS "title" text;
ALTER TABLE public."content_calendar" ADD COLUMN IF NOT EXISTS "platform" text DEFAULT 'LinkedIn'::text;
ALTER TABLE public."content_calendar" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'draft'::text;
ALTER TABLE public."content_calendar" ADD COLUMN IF NOT EXISTS "scheduled_for" timestamp with time zone;
ALTER TABLE public."content_calendar" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now();
ALTER TABLE public."content_calendar" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone DEFAULT now();
ALTER TABLE public."content_calendar" ADD COLUMN IF NOT EXISTS "content_data" jsonb;
ALTER TABLE public."content_calendar" ADD COLUMN IF NOT EXISTS "audience" text DEFAULT 'young_professional'::text;
ALTER TABLE public."content_calendar" ADD COLUMN IF NOT EXISTS "approved_at" timestamp with time zone;
ALTER TABLE public."content_calendar" ADD COLUMN IF NOT EXISTS "scheduled_date" date;
ALTER TABLE public."content_calendar" ADD COLUMN IF NOT EXISTS "publish_notes" text;
ALTER TABLE public."content_calendar" ADD COLUMN IF NOT EXISTS "published_at" timestamp with time zone;
ALTER TABLE public."content_calendar" ADD COLUMN IF NOT EXISTS "triggered_by" text;
ALTER TABLE public."content_calendar" ADD COLUMN IF NOT EXISTS "assigned_to" uuid;
ALTER TABLE public."content_calendar" ADD COLUMN IF NOT EXISTS "assign_note" text;
ALTER TABLE public."course_discussions" ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid();
ALTER TABLE public."course_discussions" ADD COLUMN IF NOT EXISTS "course_id" uuid;
ALTER TABLE public."course_discussions" ADD COLUMN IF NOT EXISTS "user_id" uuid;
ALTER TABLE public."course_discussions" ADD COLUMN IF NOT EXISTS "reply_to_id" uuid;
ALTER TABLE public."course_discussions" ADD COLUMN IF NOT EXISTS "content" text;
ALTER TABLE public."course_discussions" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now();
ALTER TABLE public."course_discussions" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone DEFAULT now();
ALTER TABLE public."course_notes" ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid();
ALTER TABLE public."course_notes" ADD COLUMN IF NOT EXISTS "user_id" uuid;
ALTER TABLE public."course_notes" ADD COLUMN IF NOT EXISTS "lesson_id" uuid;
ALTER TABLE public."course_notes" ADD COLUMN IF NOT EXISTS "course_id" uuid;
ALTER TABLE public."course_notes" ADD COLUMN IF NOT EXISTS "content" text DEFAULT ''::text;
ALTER TABLE public."course_notes" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone DEFAULT now();
ALTER TABLE public."courses" ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT uuid_generate_v4();
ALTER TABLE public."courses" ADD COLUMN IF NOT EXISTS "title" text;
ALTER TABLE public."courses" ADD COLUMN IF NOT EXISTS "description" text;
ALTER TABLE public."courses" ADD COLUMN IF NOT EXISTS "thumbnail_url" text;
ALTER TABLE public."courses" ADD COLUMN IF NOT EXISTS "category" text;
ALTER TABLE public."courses" ADD COLUMN IF NOT EXISTS "difficulty" text;
ALTER TABLE public."courses" ADD COLUMN IF NOT EXISTS "lessons_count" integer DEFAULT 0;
ALTER TABLE public."courses" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now();
ALTER TABLE public."courses" ADD COLUMN IF NOT EXISTS "is_published" boolean DEFAULT true;
ALTER TABLE public."courses" ADD COLUMN IF NOT EXISTS "sort_order" integer DEFAULT 0;
ALTER TABLE public."courses" ADD COLUMN IF NOT EXISTS "video_type" text DEFAULT 'youtube'::text;
ALTER TABLE public."courses" ADD COLUMN IF NOT EXISTS "created_by" uuid;
ALTER TABLE public."courses" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone DEFAULT now();
ALTER TABLE public."courses" ADD COLUMN IF NOT EXISTS "lessons" integer DEFAULT 1;
ALTER TABLE public."courses" ADD COLUMN IF NOT EXISTS "duration" text;
ALTER TABLE public."courses" ADD COLUMN IF NOT EXISTS "emoji" text DEFAULT '📚'::text;
ALTER TABLE public."courses" ADD COLUMN IF NOT EXISTS "video_url" text;
ALTER TABLE public."courses" ADD COLUMN IF NOT EXISTS "youtube_id" text;
ALTER TABLE public."courses" ADD COLUMN IF NOT EXISTS "total_duration_seconds" integer DEFAULT 0;
ALTER TABLE public."courses" ADD COLUMN IF NOT EXISTS "plan_tier" text DEFAULT 'free'::text;
ALTER TABLE public."deletion_requests" ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid();
ALTER TABLE public."deletion_requests" ADD COLUMN IF NOT EXISTS "user_id" uuid;
ALTER TABLE public."deletion_requests" ADD COLUMN IF NOT EXISTS "email" text;
ALTER TABLE public."deletion_requests" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'pending'::text;
ALTER TABLE public."deletion_requests" ADD COLUMN IF NOT EXISTS "requested_at" timestamp with time zone DEFAULT now();
ALTER TABLE public."deletion_requests" ADD COLUMN IF NOT EXISTS "processed_at" timestamp with time zone;
ALTER TABLE public."deletion_requests" ADD COLUMN IF NOT EXISTS "notes" text;
ALTER TABLE public."event_registrations" ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid();
ALTER TABLE public."event_registrations" ADD COLUMN IF NOT EXISTS "event_id" uuid;
ALTER TABLE public."event_registrations" ADD COLUMN IF NOT EXISTS "full_name" text;
ALTER TABLE public."event_registrations" ADD COLUMN IF NOT EXISTS "email" text;
ALTER TABLE public."event_registrations" ADD COLUMN IF NOT EXISTS "whatsapp" text;
ALTER TABLE public."event_registrations" ADD COLUMN IF NOT EXISTS "phone" text;
ALTER TABLE public."event_registrations" ADD COLUMN IF NOT EXISTS "country" text;
ALTER TABLE public."event_registrations" ADD COLUMN IF NOT EXISTS "city" text;
ALTER TABLE public."event_registrations" ADD COLUMN IF NOT EXISTS "current_role" text;
ALTER TABLE public."event_registrations" ADD COLUMN IF NOT EXISTS "organisation" text;
ALTER TABLE public."event_registrations" ADD COLUMN IF NOT EXISTS "industry" text;
ALTER TABLE public."event_registrations" ADD COLUMN IF NOT EXISTS "what_building" text;
ALTER TABLE public."event_registrations" ADD COLUMN IF NOT EXISTS "why_attend" text;
ALTER TABLE public."event_registrations" ADD COLUMN IF NOT EXISTS "how_heard" text;
ALTER TABLE public."event_registrations" ADD COLUMN IF NOT EXISTS "dietary_needs" text;
ALTER TABLE public."event_registrations" ADD COLUMN IF NOT EXISTS "accessibility" text;
ALTER TABLE public."event_registrations" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'pending'::text;
ALTER TABLE public."event_registrations" ADD COLUMN IF NOT EXISTS "ticket_type" text;
ALTER TABLE public."event_registrations" ADD COLUMN IF NOT EXISTS "notes" text;
ALTER TABLE public."event_registrations" ADD COLUMN IF NOT EXISTS "confirmed_at" timestamp with time zone;
ALTER TABLE public."event_registrations" ADD COLUMN IF NOT EXISTS "notified_at" timestamp with time zone;
ALTER TABLE public."event_registrations" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now();
ALTER TABLE public."event_registrations" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone DEFAULT now();
ALTER TABLE public."event_registrations" ADD COLUMN IF NOT EXISTS "user_id" uuid;
ALTER TABLE public."expert_registrations" ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid();
ALTER TABLE public."expert_registrations" ADD COLUMN IF NOT EXISTS "session_id" text;
ALTER TABLE public."expert_registrations" ADD COLUMN IF NOT EXISTS "user_id" uuid;
ALTER TABLE public."expert_registrations" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now();
ALTER TABLE public."expert_sessions" ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT uuid_generate_v4();
ALTER TABLE public."expert_sessions" ADD COLUMN IF NOT EXISTS "title" text;
ALTER TABLE public."expert_sessions" ADD COLUMN IF NOT EXISTS "description" text;
ALTER TABLE public."expert_sessions" ADD COLUMN IF NOT EXISTS "expert_name" text;
ALTER TABLE public."expert_sessions" ADD COLUMN IF NOT EXISTS "expert_bio" text;
ALTER TABLE public."expert_sessions" ADD COLUMN IF NOT EXISTS "expert_photo_url" text;
ALTER TABLE public."expert_sessions" ADD COLUMN IF NOT EXISTS "scheduled_at" timestamp with time zone;
ALTER TABLE public."expert_sessions" ADD COLUMN IF NOT EXISTS "duration_minutes" integer DEFAULT 60;
ALTER TABLE public."expert_sessions" ADD COLUMN IF NOT EXISTS "max_participants" integer DEFAULT 50;
ALTER TABLE public."expert_sessions" ADD COLUMN IF NOT EXISTS "zoom_link" text;
ALTER TABLE public."expert_sessions" ADD COLUMN IF NOT EXISTS "recording_url" text;
ALTER TABLE public."expert_sessions" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'scheduled'::text;
ALTER TABLE public."expert_sessions" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now();
ALTER TABLE public."expert_sessions" ADD COLUMN IF NOT EXISTS "join_url" text;
ALTER TABLE public."expert_sessions" ADD COLUMN IF NOT EXISTS "registration_url" text;
ALTER TABLE public."expert_sessions" ADD COLUMN IF NOT EXISTS "recording_type" text DEFAULT 'youtube'::text;
ALTER TABLE public."expert_sessions" ADD COLUMN IF NOT EXISTS "category" text;
ALTER TABLE public."expert_sessions" ADD COLUMN IF NOT EXISTS "created_by" uuid;
ALTER TABLE public."expert_sessions" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone DEFAULT now();
ALTER TABLE public."expert_sessions" ADD COLUMN IF NOT EXISTS "partner_id" uuid;
ALTER TABLE public."expert_sessions" ADD COLUMN IF NOT EXISTS "plan_tier" text DEFAULT 'free'::text;
ALTER TABLE public."guardsmann_applications" ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid();
ALTER TABLE public."guardsmann_applications" ADD COLUMN IF NOT EXISTS "company" text;
ALTER TABLE public."guardsmann_applications" ADD COLUMN IF NOT EXISTS "title" text;
ALTER TABLE public."guardsmann_applications" ADD COLUMN IF NOT EXISTS "hq" text;
ALTER TABLE public."guardsmann_applications" ADD COLUMN IF NOT EXISTS "salary" text;
ALTER TABLE public."guardsmann_applications" ADD COLUMN IF NOT EXISTS "url" text;
ALTER TABLE public."guardsmann_applications" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'saved'::text;
ALTER TABLE public."guardsmann_applications" ADD COLUMN IF NOT EXISTS "notes" text;
ALTER TABLE public."guardsmann_applications" ADD COLUMN IF NOT EXISTS "applied_at" date;
ALTER TABLE public."guardsmann_applications" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now();
ALTER TABLE public."guardsmann_jobs" ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid();
ALTER TABLE public."guardsmann_jobs" ADD COLUMN IF NOT EXISTS "company" text;
ALTER TABLE public."guardsmann_jobs" ADD COLUMN IF NOT EXISTS "hq" text;
ALTER TABLE public."guardsmann_jobs" ADD COLUMN IF NOT EXISTS "title" text;
ALTER TABLE public."guardsmann_jobs" ADD COLUMN IF NOT EXISTS "salary" text;
ALTER TABLE public."guardsmann_jobs" ADD COLUMN IF NOT EXISTS "url" text;
ALTER TABLE public."guardsmann_jobs" ADD COLUMN IF NOT EXISTS "requirements" jsonb;
ALTER TABLE public."guardsmann_jobs" ADD COLUMN IF NOT EXISTS "fit_note" text;
ALTER TABLE public."guardsmann_jobs" ADD COLUMN IF NOT EXISTS "open_to_international" boolean DEFAULT true;
ALTER TABLE public."guardsmann_jobs" ADD COLUMN IF NOT EXISTS "experience_required" text;
ALTER TABLE public."guardsmann_jobs" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'saved'::text;
ALTER TABLE public."guardsmann_jobs" ADD COLUMN IF NOT EXISTS "notes" text;
ALTER TABLE public."guardsmann_jobs" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now();
ALTER TABLE public."job_applications" ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid();
ALTER TABLE public."job_applications" ADD COLUMN IF NOT EXISTS "job_id" uuid;
ALTER TABLE public."job_applications" ADD COLUMN IF NOT EXISTS "job_title" text;
ALTER TABLE public."job_applications" ADD COLUMN IF NOT EXISTS "department" text;
ALTER TABLE public."job_applications" ADD COLUMN IF NOT EXISTS "full_name" text;
ALTER TABLE public."job_applications" ADD COLUMN IF NOT EXISTS "email" text;
ALTER TABLE public."job_applications" ADD COLUMN IF NOT EXISTS "phone" text;
ALTER TABLE public."job_applications" ADD COLUMN IF NOT EXISTS "location" text;
ALTER TABLE public."job_applications" ADD COLUMN IF NOT EXISTS "linkedin_url" text;
ALTER TABLE public."job_applications" ADD COLUMN IF NOT EXISTS "portfolio_url" text;
ALTER TABLE public."job_applications" ADD COLUMN IF NOT EXISTS "cover_letter" text;
ALTER TABLE public."job_applications" ADD COLUMN IF NOT EXISTS "years_experience" text;
ALTER TABLE public."job_applications" ADD COLUMN IF NOT EXISTS "how_did_you_hear" text;
ALTER TABLE public."job_applications" ADD COLUMN IF NOT EXISTS "cv_url" text;
ALTER TABLE public."job_applications" ADD COLUMN IF NOT EXISTS "cv_filename" text;
ALTER TABLE public."job_applications" ADD COLUMN IF NOT EXISTS "cv_storage_path" text;
ALTER TABLE public."job_applications" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'new'::text;
ALTER TABLE public."job_applications" ADD COLUMN IF NOT EXISTS "admin_notes" text;
ALTER TABLE public."job_applications" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now();
ALTER TABLE public."job_applications" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone DEFAULT now();
ALTER TABLE public."job_listings" ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid();
ALTER TABLE public."job_listings" ADD COLUMN IF NOT EXISTS "title" text;
ALTER TABLE public."job_listings" ADD COLUMN IF NOT EXISTS "department" text DEFAULT 'Engineering'::text;
ALTER TABLE public."job_listings" ADD COLUMN IF NOT EXISTS "location" text DEFAULT 'Remote — Africa'::text;
ALTER TABLE public."job_listings" ADD COLUMN IF NOT EXISTS "type" text DEFAULT 'Full-time'::text;
ALTER TABLE public."job_listings" ADD COLUMN IF NOT EXISTS "mode" text DEFAULT 'Remote'::text;
ALTER TABLE public."job_listings" ADD COLUMN IF NOT EXISTS "description" text DEFAULT ''::text;
ALTER TABLE public."job_listings" ADD COLUMN IF NOT EXISTS "requirements" text[] DEFAULT '{}'::text[];
ALTER TABLE public."job_listings" ADD COLUMN IF NOT EXISTS "nice_to_have" text[] DEFAULT '{}'::text[];
ALTER TABLE public."job_listings" ADD COLUMN IF NOT EXISTS "apply_url" text;
ALTER TABLE public."job_listings" ADD COLUMN IF NOT EXISTS "apply_email" text;
ALTER TABLE public."job_listings" ADD COLUMN IF NOT EXISTS "is_active" boolean DEFAULT false;
ALTER TABLE public."job_listings" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now();
ALTER TABLE public."job_listings" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone DEFAULT now();
ALTER TABLE public."knowledge_chunks" ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid();
ALTER TABLE public."knowledge_chunks" ADD COLUMN IF NOT EXISTS "chunk_id" text;
ALTER TABLE public."knowledge_chunks" ADD COLUMN IF NOT EXISTS "content" text;
ALTER TABLE public."knowledge_chunks" ADD COLUMN IF NOT EXISTS "embedding" vector(1024);
ALTER TABLE public."knowledge_chunks" ADD COLUMN IF NOT EXISTS "namespace" text DEFAULT 'default'::text;
ALTER TABLE public."knowledge_chunks" ADD COLUMN IF NOT EXISTS "metadata" jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public."knowledge_chunks" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now();
ALTER TABLE public."knowledge_chunks" ADD COLUMN IF NOT EXISTS "mentor_id" uuid;
ALTER TABLE public."knowledge_chunks" ADD COLUMN IF NOT EXISTS "mentor_slug" text;
ALTER TABLE public."lead_magnet_downloads" ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid();
ALTER TABLE public."lead_magnet_downloads" ADD COLUMN IF NOT EXISTS "magnet_id" text;
ALTER TABLE public."lead_magnet_downloads" ADD COLUMN IF NOT EXISTS "email" text;
ALTER TABLE public."lead_magnet_downloads" ADD COLUMN IF NOT EXISTS "first_name" text;
ALTER TABLE public."lead_magnet_downloads" ADD COLUMN IF NOT EXISTS "source" text DEFAULT 'direct'::text;
ALTER TABLE public."lead_magnet_downloads" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now();
ALTER TABLE public."lead_magnets" ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid();
ALTER TABLE public."lead_magnets" ADD COLUMN IF NOT EXISTS "name" text;
ALTER TABLE public."lead_magnets" ADD COLUMN IF NOT EXISTS "type" text DEFAULT 'PDF'::text;
ALTER TABLE public."lead_magnets" ADD COLUMN IF NOT EXISTS "downloads" integer DEFAULT 0;
ALTER TABLE public."lead_magnets" ADD COLUMN IF NOT EXISTS "conversions" integer DEFAULT 0;
ALTER TABLE public."lead_magnets" ADD COLUMN IF NOT EXISTS "active" boolean DEFAULT true;
ALTER TABLE public."lead_magnets" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now();
ALTER TABLE public."lead_magnets" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone DEFAULT now();
ALTER TABLE public."lessons" ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT uuid_generate_v4();
ALTER TABLE public."lessons" ADD COLUMN IF NOT EXISTS "course_id" uuid;
ALTER TABLE public."lessons" ADD COLUMN IF NOT EXISTS "title" text;
ALTER TABLE public."lessons" ADD COLUMN IF NOT EXISTS "description" text;
ALTER TABLE public."lessons" ADD COLUMN IF NOT EXISTS "video_url" text;
ALTER TABLE public."lessons" ADD COLUMN IF NOT EXISTS "duration_seconds" integer;
ALTER TABLE public."lessons" ADD COLUMN IF NOT EXISTS "order_index" integer;
ALTER TABLE public."lessons" ADD COLUMN IF NOT EXISTS "key_takeaways" text[];
ALTER TABLE public."lessons" ADD COLUMN IF NOT EXISTS "quiz" jsonb;
ALTER TABLE public."lessons" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now();
ALTER TABLE public."marketing_pages" ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid();
ALTER TABLE public."marketing_pages" ADD COLUMN IF NOT EXISTS "slug" text;
ALTER TABLE public."marketing_pages" ADD COLUMN IF NOT EXISTS "title" text;
ALTER TABLE public."marketing_pages" ADD COLUMN IF NOT EXISTS "route" text;
ALTER TABLE public."marketing_pages" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'draft'::text;
ALTER TABLE public."marketing_pages" ADD COLUMN IF NOT EXISTS "description" text;
ALTER TABLE public."marketing_pages" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now();
ALTER TABLE public."marketing_pages" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone DEFAULT now();
ALTER TABLE public."marketing_repeating_items" ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid();
ALTER TABLE public."marketing_repeating_items" ADD COLUMN IF NOT EXISTS "section_id" uuid;
ALTER TABLE public."marketing_repeating_items" ADD COLUMN IF NOT EXISTS "sort_order" integer DEFAULT 0;
ALTER TABLE public."marketing_repeating_items" ADD COLUMN IF NOT EXISTS "draft_data" jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public."marketing_repeating_items" ADD COLUMN IF NOT EXISTS "published_data" jsonb;
ALTER TABLE public."marketing_repeating_items" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'draft'::text;
ALTER TABLE public."marketing_repeating_items" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone DEFAULT now();
ALTER TABLE public."marketing_repeating_items" ADD COLUMN IF NOT EXISTS "published_at" timestamp with time zone;
ALTER TABLE public."marketing_sections" ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid();
ALTER TABLE public."marketing_sections" ADD COLUMN IF NOT EXISTS "page_id" uuid;
ALTER TABLE public."marketing_sections" ADD COLUMN IF NOT EXISTS "section_key" text;
ALTER TABLE public."marketing_sections" ADD COLUMN IF NOT EXISTS "label" text;
ALTER TABLE public."marketing_sections" ADD COLUMN IF NOT EXISTS "section_type" text;
ALTER TABLE public."marketing_sections" ADD COLUMN IF NOT EXISTS "sort_order" integer DEFAULT 0;
ALTER TABLE public."marketing_sections" ADD COLUMN IF NOT EXISTS "draft_data" jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public."marketing_sections" ADD COLUMN IF NOT EXISTS "published_data" jsonb;
ALTER TABLE public."marketing_sections" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'draft'::text;
ALTER TABLE public."marketing_sections" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone DEFAULT now();
ALTER TABLE public."marketing_sections" ADD COLUMN IF NOT EXISTS "published_at" timestamp with time zone;
ALTER TABLE public."mentor_applications" ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid();
ALTER TABLE public."mentor_applications" ADD COLUMN IF NOT EXISTS "full_name" text;
ALTER TABLE public."mentor_applications" ADD COLUMN IF NOT EXISTS "email" text;
ALTER TABLE public."mentor_applications" ADD COLUMN IF NOT EXISTS "phone" text;
ALTER TABLE public."mentor_applications" ADD COLUMN IF NOT EXISTS "country" text;
ALTER TABLE public."mentor_applications" ADD COLUMN IF NOT EXISTS "role_title" text;
ALTER TABLE public."mentor_applications" ADD COLUMN IF NOT EXISTS "company" text;
ALTER TABLE public."mentor_applications" ADD COLUMN IF NOT EXISTS "years_experience" text;
ALTER TABLE public."mentor_applications" ADD COLUMN IF NOT EXISTS "industry" text;
ALTER TABLE public."mentor_applications" ADD COLUMN IF NOT EXISTS "linkedin_url" text;
ALTER TABLE public."mentor_applications" ADD COLUMN IF NOT EXISTS "career_summary" text;
ALTER TABLE public."mentor_applications" ADD COLUMN IF NOT EXISTS "why_mentor" text;
ALTER TABLE public."mentor_applications" ADD COLUMN IF NOT EXISTS "mentor_style" text;
ALTER TABLE public."mentor_applications" ADD COLUMN IF NOT EXISTS "success_story" text;
ALTER TABLE public."mentor_applications" ADD COLUMN IF NOT EXISTS "availability_hours" text;
ALTER TABLE public."mentor_applications" ADD COLUMN IF NOT EXISTS "has_mentored_before" text;
ALTER TABLE public."mentor_applications" ADD COLUMN IF NOT EXISTS "age_groups" text;
ALTER TABLE public."mentor_applications" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'pending'::text;
ALTER TABLE public."mentor_applications" ADD COLUMN IF NOT EXISTS "notes" text;
ALTER TABLE public."mentor_applications" ADD COLUMN IF NOT EXISTS "applied_at" timestamp with time zone DEFAULT now();
ALTER TABLE public."mentor_applications" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone DEFAULT now();
ALTER TABLE public."mentor_applications" ADD COLUMN IF NOT EXISTS "terms_accepted" boolean DEFAULT false;
ALTER TABLE public."mentor_profiles" ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid();
ALTER TABLE public."mentor_profiles" ADD COLUMN IF NOT EXISTS "slug" text;
ALTER TABLE public."mentor_profiles" ADD COLUMN IF NOT EXISTS "name" text;
ALTER TABLE public."mentor_profiles" ADD COLUMN IF NOT EXISTS "title" text;
ALTER TABLE public."mentor_profiles" ADD COLUMN IF NOT EXISTS "bio" text DEFAULT ''::text;
ALTER TABLE public."mentor_profiles" ADD COLUMN IF NOT EXISTS "background" text;
ALTER TABLE public."mentor_profiles" ADD COLUMN IF NOT EXISTS "dimensions" text[] DEFAULT '{}'::text[];
ALTER TABLE public."mentor_profiles" ADD COLUMN IF NOT EXISTS "active" boolean DEFAULT true;
ALTER TABLE public."mentor_profiles" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now();
ALTER TABLE public."mentor_profiles" ADD COLUMN IF NOT EXISTS "dimension" text;
ALTER TABLE public."mentor_profiles" ADD COLUMN IF NOT EXISTS "category" text;
ALTER TABLE public."mentor_profiles" ADD COLUMN IF NOT EXISTS "avatar_url" text;
ALTER TABLE public."mentor_profiles" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone DEFAULT now();
ALTER TABLE public."newsletter_queue" ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid();
ALTER TABLE public."newsletter_queue" ADD COLUMN IF NOT EXISTS "subject" text;
ALTER TABLE public."newsletter_queue" ADD COLUMN IF NOT EXISTS "preview_text" text;
ALTER TABLE public."newsletter_queue" ADD COLUMN IF NOT EXISTS "body" text;
ALTER TABLE public."newsletter_queue" ADD COLUMN IF NOT EXISTS "pillar" text;
ALTER TABLE public."newsletter_queue" ADD COLUMN IF NOT EXISTS "content_calendar_id" uuid;
ALTER TABLE public."newsletter_queue" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'queued'::text;
ALTER TABLE public."newsletter_queue" ADD COLUMN IF NOT EXISTS "queued_at" timestamp with time zone DEFAULT now();
ALTER TABLE public."newsletter_queue" ADD COLUMN IF NOT EXISTS "sent_at" timestamp with time zone;
ALTER TABLE public."newsletter_subscribers" ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT uuid_generate_v4();
ALTER TABLE public."newsletter_subscribers" ADD COLUMN IF NOT EXISTS "email" text;
ALTER TABLE public."newsletter_subscribers" ADD COLUMN IF NOT EXISTS "first_name" text;
ALTER TABLE public."newsletter_subscribers" ADD COLUMN IF NOT EXISTS "source" text DEFAULT 'website'::text;
ALTER TABLE public."newsletter_subscribers" ADD COLUMN IF NOT EXISTS "is_active" boolean DEFAULT true;
ALTER TABLE public."newsletter_subscribers" ADD COLUMN IF NOT EXISTS "subscribed_at" timestamp with time zone DEFAULT now();
ALTER TABLE public."newsletter_subscribers" ADD COLUMN IF NOT EXISTS "unsubscribed_at" timestamp with time zone;
ALTER TABLE public."notifications" ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid();
ALTER TABLE public."notifications" ADD COLUMN IF NOT EXISTS "user_id" uuid;
ALTER TABLE public."notifications" ADD COLUMN IF NOT EXISTS "type" text DEFAULT 'info'::text;
ALTER TABLE public."notifications" ADD COLUMN IF NOT EXISTS "title" text;
ALTER TABLE public."notifications" ADD COLUMN IF NOT EXISTS "message" text;
ALTER TABLE public."notifications" ADD COLUMN IF NOT EXISTS "link" text;
ALTER TABLE public."notifications" ADD COLUMN IF NOT EXISTS "read" boolean DEFAULT false;
ALTER TABLE public."notifications" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now();
ALTER TABLE public."partner_course_enrollments" ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid();
ALTER TABLE public."partner_course_enrollments" ADD COLUMN IF NOT EXISTS "partner_id" uuid;
ALTER TABLE public."partner_course_enrollments" ADD COLUMN IF NOT EXISTS "course_id" uuid;
ALTER TABLE public."partner_course_enrollments" ADD COLUMN IF NOT EXISTS "user_id" uuid;
ALTER TABLE public."partner_course_enrollments" ADD COLUMN IF NOT EXISTS "enrolled_at" timestamp with time zone DEFAULT now();
ALTER TABLE public."partner_course_enrollments" ADD COLUMN IF NOT EXISTS "completed_at" timestamp with time zone;
ALTER TABLE public."partner_course_enrollments" ADD COLUMN IF NOT EXISTS "progress_pct" integer DEFAULT 0;
ALTER TABLE public."partner_courses" ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid();
ALTER TABLE public."partner_courses" ADD COLUMN IF NOT EXISTS "partner_id" uuid;
ALTER TABLE public."partner_courses" ADD COLUMN IF NOT EXISTS "title" text;
ALTER TABLE public."partner_courses" ADD COLUMN IF NOT EXISTS "description" text;
ALTER TABLE public."partner_courses" ADD COLUMN IF NOT EXISTS "youtube_id" text;
ALTER TABLE public."partner_courses" ADD COLUMN IF NOT EXISTS "thumbnail_url" text;
ALTER TABLE public."partner_courses" ADD COLUMN IF NOT EXISTS "category" text;
ALTER TABLE public."partner_courses" ADD COLUMN IF NOT EXISTS "difficulty" text;
ALTER TABLE public."partner_courses" ADD COLUMN IF NOT EXISTS "duration" text;
ALTER TABLE public."partner_courses" ADD COLUMN IF NOT EXISTS "access_tier" text DEFAULT 'free'::text;
ALTER TABLE public."partner_courses" ADD COLUMN IF NOT EXISTS "is_published" boolean DEFAULT false;
ALTER TABLE public."partner_courses" ADD COLUMN IF NOT EXISTS "sort_order" integer DEFAULT 0;
ALTER TABLE public."partner_courses" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now();
ALTER TABLE public."partner_courses" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone;
ALTER TABLE public."partner_enquiries" ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid();
ALTER TABLE public."partner_enquiries" ADD COLUMN IF NOT EXISTS "name" text;
ALTER TABLE public."partner_enquiries" ADD COLUMN IF NOT EXISTS "email" text;
ALTER TABLE public."partner_enquiries" ADD COLUMN IF NOT EXISTS "organisation" text;
ALTER TABLE public."partner_enquiries" ADD COLUMN IF NOT EXISTS "message" text;
ALTER TABLE public."partner_enquiries" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'new'::text;
ALTER TABLE public."partner_enquiries" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now();
ALTER TABLE public."partner_event_registrations" ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid();
ALTER TABLE public."partner_event_registrations" ADD COLUMN IF NOT EXISTS "event_id" uuid;
ALTER TABLE public."partner_event_registrations" ADD COLUMN IF NOT EXISTS "user_id" uuid;
ALTER TABLE public."partner_event_registrations" ADD COLUMN IF NOT EXISTS "registered_at" timestamp with time zone DEFAULT now();
ALTER TABLE public."partner_events" ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid();
ALTER TABLE public."partner_events" ADD COLUMN IF NOT EXISTS "partner_id" uuid;
ALTER TABLE public."partner_events" ADD COLUMN IF NOT EXISTS "title" text;
ALTER TABLE public."partner_events" ADD COLUMN IF NOT EXISTS "description" text;
ALTER TABLE public."partner_events" ADD COLUMN IF NOT EXISTS "expert_name" text;
ALTER TABLE public."partner_events" ADD COLUMN IF NOT EXISTS "expert_bio" text;
ALTER TABLE public."partner_events" ADD COLUMN IF NOT EXISTS "expert_avatar" text;
ALTER TABLE public."partner_events" ADD COLUMN IF NOT EXISTS "scheduled_at" timestamp with time zone;
ALTER TABLE public."partner_events" ADD COLUMN IF NOT EXISTS "duration_minutes" integer DEFAULT 60;
ALTER TABLE public."partner_events" ADD COLUMN IF NOT EXISTS "max_attendees" integer;
ALTER TABLE public."partner_events" ADD COLUMN IF NOT EXISTS "meeting_url" text;
ALTER TABLE public."partner_events" ADD COLUMN IF NOT EXISTS "recording_url" text;
ALTER TABLE public."partner_events" ADD COLUMN IF NOT EXISTS "topic" text;
ALTER TABLE public."partner_events" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'draft'::text;
ALTER TABLE public."partner_events" ADD COLUMN IF NOT EXISTS "current_attendees" integer DEFAULT 0;
ALTER TABLE public."partner_events" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now();
ALTER TABLE public."partner_events" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone DEFAULT now();
ALTER TABLE public."partner_members" ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid();
ALTER TABLE public."partner_members" ADD COLUMN IF NOT EXISTS "partner_id" uuid;
ALTER TABLE public."partner_members" ADD COLUMN IF NOT EXISTS "user_id" uuid;
ALTER TABLE public."partner_members" ADD COLUMN IF NOT EXISTS "email" text;
ALTER TABLE public."partner_members" ADD COLUMN IF NOT EXISTS "role" text DEFAULT 'member'::text;
ALTER TABLE public."partner_members" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'invited'::text;
ALTER TABLE public."partner_members" ADD COLUMN IF NOT EXISTS "invited_at" timestamp with time zone DEFAULT now();
ALTER TABLE public."partner_members" ADD COLUMN IF NOT EXISTS "joined_at" timestamp with time zone;
ALTER TABLE public."partner_members" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now();
ALTER TABLE public."partner_subscriptions" ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid();
ALTER TABLE public."partner_subscriptions" ADD COLUMN IF NOT EXISTS "partner_id" uuid;
ALTER TABLE public."partner_subscriptions" ADD COLUMN IF NOT EXISTS "plan_tier" text;
ALTER TABLE public."partner_subscriptions" ADD COLUMN IF NOT EXISTS "billing_cycle" text DEFAULT 'monthly'::text;
ALTER TABLE public."partner_subscriptions" ADD COLUMN IF NOT EXISTS "amount_ngn" numeric(12,2);
ALTER TABLE public."partner_subscriptions" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'active'::text;
ALTER TABLE public."partner_subscriptions" ADD COLUMN IF NOT EXISTS "paystack_reference" text;
ALTER TABLE public."partner_subscriptions" ADD COLUMN IF NOT EXISTS "current_period_start" timestamp with time zone DEFAULT now();
ALTER TABLE public."partner_subscriptions" ADD COLUMN IF NOT EXISTS "current_period_end" timestamp with time zone DEFAULT (now() + '1 mon'::interval);
ALTER TABLE public."partner_subscriptions" ADD COLUMN IF NOT EXISTS "cancelled_at" timestamp with time zone;
ALTER TABLE public."partner_subscriptions" ADD COLUMN IF NOT EXISTS "cancel_reason" text;
ALTER TABLE public."partner_subscriptions" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now();
ALTER TABLE public."partner_subscriptions" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone DEFAULT now();
ALTER TABLE public."partner_transactions" ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid();
ALTER TABLE public."partner_transactions" ADD COLUMN IF NOT EXISTS "partner_id" uuid;
ALTER TABLE public."partner_transactions" ADD COLUMN IF NOT EXISTS "user_id" uuid;
ALTER TABLE public."partner_transactions" ADD COLUMN IF NOT EXISTS "amount_ngn" numeric(12,2);
ALTER TABLE public."partner_transactions" ADD COLUMN IF NOT EXISTS "partner_share_ngn" numeric(12,2);
ALTER TABLE public."partner_transactions" ADD COLUMN IF NOT EXISTS "ascentor_fee_ngn" numeric(12,2);
ALTER TABLE public."partner_transactions" ADD COLUMN IF NOT EXISTS "revenue_share_pct" integer;
ALTER TABLE public."partner_transactions" ADD COLUMN IF NOT EXISTS "plan" text;
ALTER TABLE public."partner_transactions" ADD COLUMN IF NOT EXISTS "billing_cycle" text;
ALTER TABLE public."partner_transactions" ADD COLUMN IF NOT EXISTS "paystack_reference" text;
ALTER TABLE public."partner_transactions" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'completed'::text;
ALTER TABLE public."partner_transactions" ADD COLUMN IF NOT EXISTS "paid_at" timestamp with time zone;
ALTER TABLE public."partner_transactions" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now();
ALTER TABLE public."partners" ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid();
ALTER TABLE public."partners" ADD COLUMN IF NOT EXISTS "slug" text;
ALTER TABLE public."partners" ADD COLUMN IF NOT EXISTS "subdomain" text;
ALTER TABLE public."partners" ADD COLUMN IF NOT EXISTS "name" text;
ALTER TABLE public."partners" ADD COLUMN IF NOT EXISTS "owner_id" uuid;
ALTER TABLE public."partners" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'pending'::text;
ALTER TABLE public."partners" ADD COLUMN IF NOT EXISTS "brand" jsonb DEFAULT '{"tagline": null, "bg_color": "#0C0B08", "logo_url": null, "font_body": "Syne", "card_color": "#141310", "text_color": "#D4CFC3", "favicon_url": null, "accent_color": "#C8851A", "font_heading": "Cormorant Garamond", "logo_dark_url": null, "platform_name": "", "primary_color": "#E8A020", "hide_ascentor_branding": false}'::jsonb;
ALTER TABLE public."partners" ADD COLUMN IF NOT EXISTS "paystack_subaccount_code" text;
ALTER TABLE public."partners" ADD COLUMN IF NOT EXISTS "paystack_secret_key" text;
ALTER TABLE public."partners" ADD COLUMN IF NOT EXISTS "revenue_share_percent" integer DEFAULT 70;
ALTER TABLE public."partners" ADD COLUMN IF NOT EXISTS "custom_domain" text;
ALTER TABLE public."partners" ADD COLUMN IF NOT EXISTS "plan_overrides" jsonb;
ALTER TABLE public."partners" ADD COLUMN IF NOT EXISTS "features" jsonb DEFAULT '{"courses": true, "experts": false, "ai_coach": true, "community": true, "referrals": true}'::jsonb;
ALTER TABLE public."partners" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now();
ALTER TABLE public."partners" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone DEFAULT now();
ALTER TABLE public."partners" ADD COLUMN IF NOT EXISTS "onboarded_at" timestamp with time zone;
ALTER TABLE public."partners" ADD COLUMN IF NOT EXISTS "paystack_public_key" text;
ALTER TABLE public."partners" ADD COLUMN IF NOT EXISTS "plan_tier" text;
ALTER TABLE public."partners" ADD COLUMN IF NOT EXISTS "active_member_count" integer DEFAULT 0;
ALTER TABLE public."partners" ADD COLUMN IF NOT EXISTS "ai_config" jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public."password_reset_otps" ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid();
ALTER TABLE public."password_reset_otps" ADD COLUMN IF NOT EXISTS "email" text;
ALTER TABLE public."password_reset_otps" ADD COLUMN IF NOT EXISTS "otp_code" text;
ALTER TABLE public."password_reset_otps" ADD COLUMN IF NOT EXISTS "expires_at" timestamp with time zone;
ALTER TABLE public."password_reset_otps" ADD COLUMN IF NOT EXISTS "used" boolean DEFAULT false;
ALTER TABLE public."password_reset_otps" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now();
ALTER TABLE public."password_reset_otps" ADD COLUMN IF NOT EXISTS "attempts" integer DEFAULT 0;
ALTER TABLE public."payment_attempts" ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid();
ALTER TABLE public."payment_attempts" ADD COLUMN IF NOT EXISTS "user_id" uuid;
ALTER TABLE public."payment_attempts" ADD COLUMN IF NOT EXISTS "reference" text;
ALTER TABLE public."payment_attempts" ADD COLUMN IF NOT EXISTS "plan_id" text;
ALTER TABLE public."payment_attempts" ADD COLUMN IF NOT EXISTS "billing" text;
ALTER TABLE public."payment_attempts" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'pending'::text;
ALTER TABLE public."payment_attempts" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now();
ALTER TABLE public."payment_attempts" ADD COLUMN IF NOT EXISTS "completed_at" timestamp with time zone;
ALTER TABLE public."payment_attempts" ADD COLUMN IF NOT EXISTS "kind" text DEFAULT 'subscription'::text;
ALTER TABLE public."payment_attempts" ADD COLUMN IF NOT EXISTS "registration_id" uuid;
ALTER TABLE public."payment_attempts" ADD COLUMN IF NOT EXISTS "email" text;
ALTER TABLE public."payment_attempts" ADD COLUMN IF NOT EXISTS "amount_kobo" bigint;
ALTER TABLE public."payment_attempts" ADD COLUMN IF NOT EXISTS "currency" text DEFAULT 'NGN'::text;
ALTER TABLE public."payment_attempts" ADD COLUMN IF NOT EXISTS "provider_tx_id" text;
ALTER TABLE public."payment_attempts" ADD COLUMN IF NOT EXISTS "provider_status" text;
ALTER TABLE public."payment_attempts" ADD COLUMN IF NOT EXISTS "failure_reason" text;
ALTER TABLE public."payment_attempts" ADD COLUMN IF NOT EXISTS "paid_at" timestamp with time zone;
ALTER TABLE public."payment_attempts" ADD COLUMN IF NOT EXISTS "abandoned_at" timestamp with time zone;
ALTER TABLE public."payment_attempts" ADD COLUMN IF NOT EXISTS "admin_notified_at" timestamp with time zone;
ALTER TABLE public."payment_attempts" ADD COLUMN IF NOT EXISTS "recovery_sent_at" timestamp with time zone;
ALTER TABLE public."payment_attempts" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone DEFAULT now();
ALTER TABLE public."payment_attempts" ADD COLUMN IF NOT EXISTS "donation_id" uuid;
ALTER TABLE public."payments" ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT uuid_generate_v4();
ALTER TABLE public."payments" ADD COLUMN IF NOT EXISTS "user_id" uuid;
ALTER TABLE public."payments" ADD COLUMN IF NOT EXISTS "subscription_id" uuid;
ALTER TABLE public."payments" ADD COLUMN IF NOT EXISTS "provider" text;
ALTER TABLE public."payments" ADD COLUMN IF NOT EXISTS "provider_reference" text;
ALTER TABLE public."payments" ADD COLUMN IF NOT EXISTS "amount_cents" integer;
ALTER TABLE public."payments" ADD COLUMN IF NOT EXISTS "currency" text DEFAULT 'USD'::text;
ALTER TABLE public."payments" ADD COLUMN IF NOT EXISTS "status" text;
ALTER TABLE public."payments" ADD COLUMN IF NOT EXISTS "promo_code" text;
ALTER TABLE public."payments" ADD COLUMN IF NOT EXISTS "metadata" jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public."payments" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now();
ALTER TABLE public."payments" ADD COLUMN IF NOT EXISTS "reference" text;
ALTER TABLE public."payments" ADD COLUMN IF NOT EXISTS "paystack_data" jsonb;
ALTER TABLE public."payments" ADD COLUMN IF NOT EXISTS "plan_id" text;
ALTER TABLE public."payments" ADD COLUMN IF NOT EXISTS "billing" text;
ALTER TABLE public."payments" ADD COLUMN IF NOT EXISTS "amount" numeric;
ALTER TABLE public."payments" ADD COLUMN IF NOT EXISTS "paid_at" timestamp with time zone;
ALTER TABLE public."personal_brand_briefs" ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid();
ALTER TABLE public."personal_brand_briefs" ADD COLUMN IF NOT EXISTS "week_number" integer;
ALTER TABLE public."personal_brand_briefs" ADD COLUMN IF NOT EXISTS "pillar" text;
ALTER TABLE public."personal_brand_briefs" ADD COLUMN IF NOT EXISTS "intent" text DEFAULT 'authority'::text;
ALTER TABLE public."personal_brand_briefs" ADD COLUMN IF NOT EXISTS "topic" text;
ALTER TABLE public."personal_brand_briefs" ADD COLUMN IF NOT EXISTS "angle" text;
ALTER TABLE public."personal_brand_briefs" ADD COLUMN IF NOT EXISTS "brief_data" jsonb;
ALTER TABLE public."personal_brand_briefs" ADD COLUMN IF NOT EXISTS "research_raw" text;
ALTER TABLE public."personal_brand_briefs" ADD COLUMN IF NOT EXISTS "recent_news_raw" jsonb;
ALTER TABLE public."personal_brand_briefs" ADD COLUMN IF NOT EXISTS "trending_tools" jsonb;
ALTER TABLE public."personal_brand_briefs" ADD COLUMN IF NOT EXISTS "job_market_note" text;
ALTER TABLE public."personal_brand_briefs" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'ready'::text;
ALTER TABLE public."personal_brand_briefs" ADD COLUMN IF NOT EXISTS "written_at" timestamp with time zone;
ALTER TABLE public."personal_brand_briefs" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now();
ALTER TABLE public."platform_settings" ADD COLUMN IF NOT EXISTS "key" text;
ALTER TABLE public."platform_settings" ADD COLUMN IF NOT EXISTS "value" text;
ALTER TABLE public."platform_settings" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone DEFAULT now();
ALTER TABLE public."platform_snapshots" ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid();
ALTER TABLE public."platform_snapshots" ADD COLUMN IF NOT EXISTS "generated_at" timestamp with time zone DEFAULT now();
ALTER TABLE public."platform_snapshots" ADD COLUMN IF NOT EXISTS "generated_by" text DEFAULT 'scheduled'::text;
ALTER TABLE public."platform_snapshots" ADD COLUMN IF NOT EXISTS "raw_data" jsonb;
ALTER TABLE public."platform_snapshots" ADD COLUMN IF NOT EXISTS "ai_report" jsonb;
ALTER TABLE public."platform_snapshots" ADD COLUMN IF NOT EXISTS "token_cost" jsonb;
ALTER TABLE public."platform_snapshots" ADD COLUMN IF NOT EXISTS "duration_ms" integer;
ALTER TABLE public."post_likes" ADD COLUMN IF NOT EXISTS "user_id" uuid;
ALTER TABLE public."post_likes" ADD COLUMN IF NOT EXISTS "post_id" uuid;
ALTER TABLE public."post_likes" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now();
ALTER TABLE public."product_purchases" ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid();
ALTER TABLE public."product_purchases" ADD COLUMN IF NOT EXISTS "user_id" uuid;
ALTER TABLE public."product_purchases" ADD COLUMN IF NOT EXISTS "product_id" uuid;
ALTER TABLE public."product_purchases" ADD COLUMN IF NOT EXISTS "product_name" text;
ALTER TABLE public."product_purchases" ADD COLUMN IF NOT EXISTS "amount_paid" numeric DEFAULT 0;
ALTER TABLE public."product_purchases" ADD COLUMN IF NOT EXISTS "currency" text DEFAULT 'NGN'::text;
ALTER TABLE public."product_purchases" ADD COLUMN IF NOT EXISTS "reference" text;
ALTER TABLE public."product_purchases" ADD COLUMN IF NOT EXISTS "paystack_data" jsonb;
ALTER TABLE public."product_purchases" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now();
ALTER TABLE public."products" ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid();
ALTER TABLE public."products" ADD COLUMN IF NOT EXISTS "name" text;
ALTER TABLE public."products" ADD COLUMN IF NOT EXISTS "tagline" text DEFAULT ''::text;
ALTER TABLE public."products" ADD COLUMN IF NOT EXISTS "description" text DEFAULT ''::text;
ALTER TABLE public."products" ADD COLUMN IF NOT EXISTS "price" numeric DEFAULT 0;
ALTER TABLE public."products" ADD COLUMN IF NOT EXISTS "currency" text DEFAULT 'USD'::text;
ALTER TABLE public."products" ADD COLUMN IF NOT EXISTS "image_url" text;
ALTER TABLE public."products" ADD COLUMN IF NOT EXISTS "category" text DEFAULT 'Playbook'::text;
ALTER TABLE public."products" ADD COLUMN IF NOT EXISTS "badge" text;
ALTER TABLE public."products" ADD COLUMN IF NOT EXISTS "cta_label" text DEFAULT ''::text;
ALTER TABLE public."products" ADD COLUMN IF NOT EXISTS "cta_url" text DEFAULT ''::text;
ALTER TABLE public."products" ADD COLUMN IF NOT EXISTS "is_featured" boolean DEFAULT false;
ALTER TABLE public."products" ADD COLUMN IF NOT EXISTS "published" boolean DEFAULT false;
ALTER TABLE public."products" ADD COLUMN IF NOT EXISTS "sort_order" integer DEFAULT 0;
ALTER TABLE public."products" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now();
ALTER TABLE public."products" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone DEFAULT now();
ALTER TABLE public."profiles" ADD COLUMN IF NOT EXISTS "id" uuid;
ALTER TABLE public."profiles" ADD COLUMN IF NOT EXISTS "full_name" text;
ALTER TABLE public."profiles" ADD COLUMN IF NOT EXISTS "current_role" text DEFAULT ''::text;
ALTER TABLE public."profiles" ADD COLUMN IF NOT EXISTS "industry" text DEFAULT ''::text;
ALTER TABLE public."profiles" ADD COLUMN IF NOT EXISTS "goal_role" text DEFAULT ''::text;
ALTER TABLE public."profiles" ADD COLUMN IF NOT EXISTS "biggest_challenge" text;
ALTER TABLE public."profiles" ADD COLUMN IF NOT EXISTS "time_commitment" text DEFAULT '15min'::text;
ALTER TABLE public."profiles" ADD COLUMN IF NOT EXISTS "subscription_status" text DEFAULT 'free'::text;
ALTER TABLE public."profiles" ADD COLUMN IF NOT EXISTS "stripe_customer_id" text;
ALTER TABLE public."profiles" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now();
ALTER TABLE public."profiles" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone DEFAULT now();
ALTER TABLE public."profiles" ADD COLUMN IF NOT EXISTS "role" text DEFAULT 'member'::text;
ALTER TABLE public."profiles" ADD COLUMN IF NOT EXISTS "email" text;
ALTER TABLE public."profiles" ADD COLUMN IF NOT EXISTS "referral_code" text;
ALTER TABLE public."profiles" ADD COLUMN IF NOT EXISTS "referred_by" text;
ALTER TABLE public."profiles" ADD COLUMN IF NOT EXISTS "referral_count" integer DEFAULT 0;
ALTER TABLE public."profiles" ADD COLUMN IF NOT EXISTS "subscription_plan" text DEFAULT 'free'::text;
ALTER TABLE public."profiles" ADD COLUMN IF NOT EXISTS "subscription_tier" text;
ALTER TABLE public."profiles" ADD COLUMN IF NOT EXISTS "subscription_end" timestamp with time zone;
ALTER TABLE public."profiles" ADD COLUMN IF NOT EXISTS "payment_method" text;
ALTER TABLE public."profiles" ADD COLUMN IF NOT EXISTS "avatar_url" text;
ALTER TABLE public."profiles" ADD COLUMN IF NOT EXISTS "onboarding_completed" boolean DEFAULT false;
ALTER TABLE public."profiles" ADD COLUMN IF NOT EXISTS "onboarding_completed_at" timestamp with time zone;
ALTER TABLE public."profiles" ADD COLUMN IF NOT EXISTS "subscription_start" timestamp with time zone;
ALTER TABLE public."profiles" ADD COLUMN IF NOT EXISTS "paystack_customer_id" text;
ALTER TABLE public."profiles" ADD COLUMN IF NOT EXISTS "permissions" jsonb;
ALTER TABLE public."profiles" ADD COLUMN IF NOT EXISTS "referral_bonus_days" integer DEFAULT 0;
ALTER TABLE public."profiles" ADD COLUMN IF NOT EXISTS "paystack_sub_code" text;
ALTER TABLE public."profiles" ADD COLUMN IF NOT EXISTS "card_details" jsonb;
ALTER TABLE public."profiles" ADD COLUMN IF NOT EXISTS "whatsapp_phone" text;
ALTER TABLE public."profiles" ADD COLUMN IF NOT EXISTS "ascent_stage" text;
ALTER TABLE public."profiles" ADD COLUMN IF NOT EXISTS "what_building" text;
ALTER TABLE public."profiles" ADD COLUMN IF NOT EXISTS "summit_registered" boolean DEFAULT false;
ALTER TABLE public."promo_codes" ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid();
ALTER TABLE public."promo_codes" ADD COLUMN IF NOT EXISTS "code" text;
ALTER TABLE public."promo_codes" ADD COLUMN IF NOT EXISTS "discount" numeric(3,2);
ALTER TABLE public."promo_codes" ADD COLUMN IF NOT EXISTS "label" text DEFAULT ''::text;
ALTER TABLE public."promo_codes" ADD COLUMN IF NOT EXISTS "applies_to" text[] DEFAULT ARRAY['basic'::text, 'standard'::text, 'premium'::text];
ALTER TABLE public."promo_codes" ADD COLUMN IF NOT EXISTS "max_uses" integer;
ALTER TABLE public."promo_codes" ADD COLUMN IF NOT EXISTS "current_uses" integer DEFAULT 0;
ALTER TABLE public."promo_codes" ADD COLUMN IF NOT EXISTS "expires_at" timestamp with time zone;
ALTER TABLE public."promo_codes" ADD COLUMN IF NOT EXISTS "active" boolean DEFAULT true;
ALTER TABLE public."promo_codes" ADD COLUMN IF NOT EXISTS "created_by" uuid;
ALTER TABLE public."promo_codes" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now();
ALTER TABLE public."promo_codes" ADD COLUMN IF NOT EXISTS "auto_apply" boolean DEFAULT false;
ALTER TABLE public."public_events" ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid();
ALTER TABLE public."public_events" ADD COLUMN IF NOT EXISTS "slug" text;
ALTER TABLE public."public_events" ADD COLUMN IF NOT EXISTS "title" text;
ALTER TABLE public."public_events" ADD COLUMN IF NOT EXISTS "tagline" text;
ALTER TABLE public."public_events" ADD COLUMN IF NOT EXISTS "description" text;
ALTER TABLE public."public_events" ADD COLUMN IF NOT EXISTS "event_date" text;
ALTER TABLE public."public_events" ADD COLUMN IF NOT EXISTS "event_date_iso" date;
ALTER TABLE public."public_events" ADD COLUMN IF NOT EXISTS "location" text;
ALTER TABLE public."public_events" ADD COLUMN IF NOT EXISTS "is_published" boolean DEFAULT false;
ALTER TABLE public."public_events" ADD COLUMN IF NOT EXISTS "is_featured" boolean DEFAULT false;
ALTER TABLE public."public_events" ADD COLUMN IF NOT EXISTS "cover_color" text DEFAULT '#0F0F0E'::text;
ALTER TABLE public."public_events" ADD COLUMN IF NOT EXISTS "registration_open" boolean DEFAULT true;
ALTER TABLE public."public_events" ADD COLUMN IF NOT EXISTS "registration_fields" jsonb DEFAULT '["full_name", "email", "whatsapp", "country"]'::jsonb;
ALTER TABLE public."public_events" ADD COLUMN IF NOT EXISTS "confirmation_subject" text;
ALTER TABLE public."public_events" ADD COLUMN IF NOT EXISTS "confirmation_body" text;
ALTER TABLE public."public_events" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now();
ALTER TABLE public."public_events" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone DEFAULT now();
ALTER TABLE public."push_events" ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid();
ALTER TABLE public."push_events" ADD COLUMN IF NOT EXISTS "recipient_id" uuid;
ALTER TABLE public."push_events" ADD COLUMN IF NOT EXISTS "actor_id" uuid;
ALTER TABLE public."push_events" ADD COLUMN IF NOT EXISTS "event_type" text;
ALTER TABLE public."push_events" ADD COLUMN IF NOT EXISTS "title" text;
ALTER TABLE public."push_events" ADD COLUMN IF NOT EXISTS "body" text;
ALTER TABLE public."push_events" ADD COLUMN IF NOT EXISTS "url" text;
ALTER TABLE public."push_events" ADD COLUMN IF NOT EXISTS "sent" boolean DEFAULT false;
ALTER TABLE public."push_events" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now();
ALTER TABLE public."push_subscriptions" ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid();
ALTER TABLE public."push_subscriptions" ADD COLUMN IF NOT EXISTS "user_id" uuid;
ALTER TABLE public."push_subscriptions" ADD COLUMN IF NOT EXISTS "endpoint" text;
ALTER TABLE public."push_subscriptions" ADD COLUMN IF NOT EXISTS "subscription" jsonb;
ALTER TABLE public."push_subscriptions" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now();
ALTER TABLE public."rail_billboards" ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid();
ALTER TABLE public."rail_billboards" ADD COLUMN IF NOT EXISTS "slot" integer;
ALTER TABLE public."rail_billboards" ADD COLUMN IF NOT EXISTS "title" text;
ALTER TABLE public."rail_billboards" ADD COLUMN IF NOT EXISTS "body" text;
ALTER TABLE public."rail_billboards" ADD COLUMN IF NOT EXISTS "cta_label" text;
ALTER TABLE public."rail_billboards" ADD COLUMN IF NOT EXISTS "cta_url" text;
ALTER TABLE public."rail_billboards" ADD COLUMN IF NOT EXISTS "bg_color" text DEFAULT '#161412'::text;
ALTER TABLE public."rail_billboards" ADD COLUMN IF NOT EXISTS "accent_color" text DEFAULT '#C8A96E'::text;
ALTER TABLE public."rail_billboards" ADD COLUMN IF NOT EXISTS "image_url" text;
ALTER TABLE public."rail_billboards" ADD COLUMN IF NOT EXISTS "is_active" boolean DEFAULT true;
ALTER TABLE public."rail_billboards" ADD COLUMN IF NOT EXISTS "sort_order" integer DEFAULT 1;
ALTER TABLE public."rail_billboards" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now();
ALTER TABLE public."referrals" ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid();
ALTER TABLE public."referrals" ADD COLUMN IF NOT EXISTS "referrer_id" uuid;
ALTER TABLE public."referrals" ADD COLUMN IF NOT EXISTS "referred_id" uuid;
ALTER TABLE public."referrals" ADD COLUMN IF NOT EXISTS "referral_code" text;
ALTER TABLE public."referrals" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'signed_up'::text;
ALTER TABLE public."referrals" ADD COLUMN IF NOT EXISTS "referrer_reward" text;
ALTER TABLE public."referrals" ADD COLUMN IF NOT EXISTS "referred_reward" text;
ALTER TABLE public."referrals" ADD COLUMN IF NOT EXISTS "rewarded_at" timestamp with time zone;
ALTER TABLE public."referrals" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now();
ALTER TABLE public."research_briefs" ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid();
ALTER TABLE public."research_briefs" ADD COLUMN IF NOT EXISTS "week_number" integer;
ALTER TABLE public."research_briefs" ADD COLUMN IF NOT EXISTS "pillar" text;
ALTER TABLE public."research_briefs" ADD COLUMN IF NOT EXISTS "topic" text;
ALTER TABLE public."research_briefs" ADD COLUMN IF NOT EXISTS "angle" text;
ALTER TABLE public."research_briefs" ADD COLUMN IF NOT EXISTS "brief_data" jsonb;
ALTER TABLE public."research_briefs" ADD COLUMN IF NOT EXISTS "trends_raw" jsonb;
ALTER TABLE public."research_briefs" ADD COLUMN IF NOT EXISTS "news_raw" jsonb;
ALTER TABLE public."research_briefs" ADD COLUMN IF NOT EXISTS "research_raw" text;
ALTER TABLE public."research_briefs" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'ready'::text;
ALTER TABLE public."research_briefs" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now();
ALTER TABLE public."scheduled_posts" ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid();
ALTER TABLE public."scheduled_posts" ADD COLUMN IF NOT EXISTS "user_id" uuid;
ALTER TABLE public."scheduled_posts" ADD COLUMN IF NOT EXISTS "platform" text DEFAULT 'buffer'::text;
ALTER TABLE public."scheduled_posts" ADD COLUMN IF NOT EXISTS "text" text;
ALTER TABLE public."scheduled_posts" ADD COLUMN IF NOT EXISTS "hashtags" text[] DEFAULT '{}'::text[];
ALTER TABLE public."scheduled_posts" ADD COLUMN IF NOT EXISTS "media_urls" text[] DEFAULT '{}'::text[];
ALTER TABLE public."scheduled_posts" ADD COLUMN IF NOT EXISTS "scheduled_at" timestamp with time zone;
ALTER TABLE public."scheduled_posts" ADD COLUMN IF NOT EXISTS "buffer_update_ids" text[] DEFAULT '{}'::text[];
ALTER TABLE public."scheduled_posts" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'scheduled'::text;
ALTER TABLE public."scheduled_posts" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now();
ALTER TABLE public."scheduled_posts" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone DEFAULT now();
ALTER TABLE public."sent_newsletters" ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT uuid_generate_v4();
ALTER TABLE public."sent_newsletters" ADD COLUMN IF NOT EXISTS "subject" text;
ALTER TABLE public."sent_newsletters" ADD COLUMN IF NOT EXISTS "content" text;
ALTER TABLE public."sent_newsletters" ADD COLUMN IF NOT EXISTS "sent_by" text;
ALTER TABLE public."sent_newsletters" ADD COLUMN IF NOT EXISTS "subscriber_count" integer DEFAULT 0;
ALTER TABLE public."sent_newsletters" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'queued'::text;
ALTER TABLE public."sent_newsletters" ADD COLUMN IF NOT EXISTS "trigger_run_id" text;
ALTER TABLE public."sent_newsletters" ADD COLUMN IF NOT EXISTS "sent_at" timestamp with time zone DEFAULT now();
ALTER TABLE public."session_locations" ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid();
ALTER TABLE public."session_locations" ADD COLUMN IF NOT EXISTS "user_id" uuid;
ALTER TABLE public."session_locations" ADD COLUMN IF NOT EXISTS "ip_address" text;
ALTER TABLE public."session_locations" ADD COLUMN IF NOT EXISTS "country" text;
ALTER TABLE public."session_locations" ADD COLUMN IF NOT EXISTS "city" text;
ALTER TABLE public."session_locations" ADD COLUMN IF NOT EXISTS "latitude" double precision;
ALTER TABLE public."session_locations" ADD COLUMN IF NOT EXISTS "longitude" double precision;
ALTER TABLE public."session_locations" ADD COLUMN IF NOT EXISTS "user_agent" text;
ALTER TABLE public."session_locations" ADD COLUMN IF NOT EXISTS "risk_level" text DEFAULT 'low'::text;
ALTER TABLE public."session_locations" ADD COLUMN IF NOT EXISTS "blocked" boolean DEFAULT false;
ALTER TABLE public."session_locations" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now();
ALTER TABLE public."session_registrations" ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT uuid_generate_v4();
ALTER TABLE public."session_registrations" ADD COLUMN IF NOT EXISTS "user_id" uuid;
ALTER TABLE public."session_registrations" ADD COLUMN IF NOT EXISTS "session_id" uuid;
ALTER TABLE public."session_registrations" ADD COLUMN IF NOT EXISTS "attended" boolean DEFAULT false;
ALTER TABLE public."session_registrations" ADD COLUMN IF NOT EXISTS "rating" integer;
ALTER TABLE public."session_registrations" ADD COLUMN IF NOT EXISTS "feedback" text;
ALTER TABLE public."session_registrations" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now();
ALTER TABLE public."social_queue" ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid();
ALTER TABLE public."social_queue" ADD COLUMN IF NOT EXISTS "platform" text DEFAULT 'LinkedIn'::text;
ALTER TABLE public."social_queue" ADD COLUMN IF NOT EXISTS "content" text;
ALTER TABLE public."social_queue" ADD COLUMN IF NOT EXISTS "pillar" text DEFAULT 'leadership'::text;
ALTER TABLE public."social_queue" ADD COLUMN IF NOT EXISTS "scheduled_for" timestamp with time zone;
ALTER TABLE public."social_queue" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'queued'::text;
ALTER TABLE public."social_queue" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now();
ALTER TABLE public."social_queue" ADD COLUMN IF NOT EXISTS "image_url" text;
ALTER TABLE public."social_queue" ADD COLUMN IF NOT EXISTS "buffer_update_id" text;
ALTER TABLE public."soundtracks" ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid();
ALTER TABLE public."soundtracks" ADD COLUMN IF NOT EXISTS "name" text;
ALTER TABLE public."soundtracks" ADD COLUMN IF NOT EXISTS "mood" text;
ALTER TABLE public."soundtracks" ADD COLUMN IF NOT EXISTS "file_url" text;
ALTER TABLE public."soundtracks" ADD COLUMN IF NOT EXISTS "duration_s" integer;
ALTER TABLE public."soundtracks" ADD COLUMN IF NOT EXISTS "active" boolean DEFAULT true;
ALTER TABLE public."soundtracks" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now();
ALTER TABLE public."subscriptions" ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT uuid_generate_v4();
ALTER TABLE public."subscriptions" ADD COLUMN IF NOT EXISTS "user_id" uuid;
ALTER TABLE public."subscriptions" ADD COLUMN IF NOT EXISTS "plan" text DEFAULT 'standard'::text;
ALTER TABLE public."subscriptions" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'trialing'::text;
ALTER TABLE public."subscriptions" ADD COLUMN IF NOT EXISTS "price_cents" integer;
ALTER TABLE public."subscriptions" ADD COLUMN IF NOT EXISTS "currency" text DEFAULT 'USD'::text;
ALTER TABLE public."subscriptions" ADD COLUMN IF NOT EXISTS "promo_code_id" uuid;
ALTER TABLE public."subscriptions" ADD COLUMN IF NOT EXISTS "payment_provider" text;
ALTER TABLE public."subscriptions" ADD COLUMN IF NOT EXISTS "provider_reference" text;
ALTER TABLE public."subscriptions" ADD COLUMN IF NOT EXISTS "trial_starts_at" timestamp with time zone DEFAULT now();
ALTER TABLE public."subscriptions" ADD COLUMN IF NOT EXISTS "trial_ends_at" timestamp with time zone DEFAULT (now() + '7 days'::interval);
ALTER TABLE public."subscriptions" ADD COLUMN IF NOT EXISTS "current_period_start" timestamp with time zone;
ALTER TABLE public."subscriptions" ADD COLUMN IF NOT EXISTS "current_period_end" timestamp with time zone;
ALTER TABLE public."subscriptions" ADD COLUMN IF NOT EXISTS "refund_eligible_until" timestamp with time zone;
ALTER TABLE public."subscriptions" ADD COLUMN IF NOT EXISTS "cancelled_at" timestamp with time zone;
ALTER TABLE public."subscriptions" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now();
ALTER TABLE public."subscriptions" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone DEFAULT now();
ALTER TABLE public."subscriptions" ADD COLUMN IF NOT EXISTS "lemon_subscription_id" text;
ALTER TABLE public."subscriptions" ADD COLUMN IF NOT EXISTS "lemon_variant_id" text;
ALTER TABLE public."summit_donations" ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid();
ALTER TABLE public."summit_donations" ADD COLUMN IF NOT EXISTS "full_name" text;
ALTER TABLE public."summit_donations" ADD COLUMN IF NOT EXISTS "email" text;
ALTER TABLE public."summit_donations" ADD COLUMN IF NOT EXISTS "phone" text;
ALTER TABLE public."summit_donations" ADD COLUMN IF NOT EXISTS "amount" numeric;
ALTER TABLE public."summit_donations" ADD COLUMN IF NOT EXISTS "currency" text DEFAULT 'NGN'::text;
ALTER TABLE public."summit_donations" ADD COLUMN IF NOT EXISTS "payment_reference" text;
ALTER TABLE public."summit_donations" ADD COLUMN IF NOT EXISTS "payment_provider_tx_id" text;
ALTER TABLE public."summit_donations" ADD COLUMN IF NOT EXISTS "paystack_fee" numeric;
ALTER TABLE public."summit_donations" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'pending'::text;
ALTER TABLE public."summit_donations" ADD COLUMN IF NOT EXISTS "message" text;
ALTER TABLE public."summit_donations" ADD COLUMN IF NOT EXISTS "paid_at" timestamp with time zone;
ALTER TABLE public."summit_donations" ADD COLUMN IF NOT EXISTS "receipt_email_sent_at" timestamp with time zone;
ALTER TABLE public."summit_donations" ADD COLUMN IF NOT EXISTS "receipt_email_error" text;
ALTER TABLE public."summit_donations" ADD COLUMN IF NOT EXISTS "admin_notified_at" timestamp with time zone;
ALTER TABLE public."summit_donations" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now();
ALTER TABLE public."summit_donations" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone DEFAULT now();
ALTER TABLE public."summit_interest" ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid();
ALTER TABLE public."summit_interest" ADD COLUMN IF NOT EXISTS "name" text;
ALTER TABLE public."summit_interest" ADD COLUMN IF NOT EXISTS "email" text;
ALTER TABLE public."summit_interest" ADD COLUMN IF NOT EXISTS "what_building" text;
ALTER TABLE public."summit_interest" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now();
ALTER TABLE public."summit_registrations" ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid();
ALTER TABLE public."summit_registrations" ADD COLUMN IF NOT EXISTS "full_name" text;
ALTER TABLE public."summit_registrations" ADD COLUMN IF NOT EXISTS "email" text;
ALTER TABLE public."summit_registrations" ADD COLUMN IF NOT EXISTS "whatsapp" text;
ALTER TABLE public."summit_registrations" ADD COLUMN IF NOT EXISTS "location" text;
ALTER TABLE public."summit_registrations" ADD COLUMN IF NOT EXISTS "organisation" text;
ALTER TABLE public."summit_registrations" ADD COLUMN IF NOT EXISTS "current_role" text;
ALTER TABLE public."summit_registrations" ADD COLUMN IF NOT EXISTS "other_messages" text;
ALTER TABLE public."summit_registrations" ADD COLUMN IF NOT EXISTS "consent" boolean DEFAULT false;
ALTER TABLE public."summit_registrations" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'pending'::text;
ALTER TABLE public."summit_registrations" ADD COLUMN IF NOT EXISTS "payment_status" text DEFAULT 'pending'::text;
ALTER TABLE public."summit_registrations" ADD COLUMN IF NOT EXISTS "payment_reference" text;
ALTER TABLE public."summit_registrations" ADD COLUMN IF NOT EXISTS "amount_paid" numeric;
ALTER TABLE public."summit_registrations" ADD COLUMN IF NOT EXISTS "currency" text DEFAULT 'NGN'::text;
ALTER TABLE public."summit_registrations" ADD COLUMN IF NOT EXISTS "payment_provider_tx_id" text;
ALTER TABLE public."summit_registrations" ADD COLUMN IF NOT EXISTS "paid_at" timestamp with time zone;
ALTER TABLE public."summit_registrations" ADD COLUMN IF NOT EXISTS "confirmed_at" timestamp with time zone;
ALTER TABLE public."summit_registrations" ADD COLUMN IF NOT EXISTS "ticket_type" text;
ALTER TABLE public."summit_registrations" ADD COLUMN IF NOT EXISTS "notes" text;
ALTER TABLE public."summit_registrations" ADD COLUMN IF NOT EXISTS "user_id" uuid;
ALTER TABLE public."summit_registrations" ADD COLUMN IF NOT EXISTS "source" text DEFAULT 'web'::text;
ALTER TABLE public."summit_registrations" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now();
ALTER TABLE public."summit_registrations" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone DEFAULT now();
ALTER TABLE public."summit_registrations" ADD COLUMN IF NOT EXISTS "attendance_type" text DEFAULT 'onsite'::text;
ALTER TABLE public."summit_registrations" ADD COLUMN IF NOT EXISTS "paystack_fee" numeric;
ALTER TABLE public."summit_registrations" ADD COLUMN IF NOT EXISTS "confirmation_email_sent_at" timestamp with time zone;
ALTER TABLE public."summit_registrations" ADD COLUMN IF NOT EXISTS "confirmation_email_error" text;
ALTER TABLE public."summit_registrations" ADD COLUMN IF NOT EXISTS "admin_notified_paid_at" timestamp with time zone;
ALTER TABLE public."summit_registrations" ADD COLUMN IF NOT EXISTS "reminder_sent_at" timestamp with time zone;
ALTER TABLE public."summit_registrations" ADD COLUMN IF NOT EXISTS "reminder_count" integer DEFAULT 0;
ALTER TABLE public."summit_registrations" ADD COLUMN IF NOT EXISTS "stream_access_sent_at" timestamp with time zone;
ALTER TABLE public."summit_registrations" ADD COLUMN IF NOT EXISTS "event_day_email_sent_at" timestamp with time zone;
ALTER TABLE public."survey_analyses" ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid();
ALTER TABLE public."survey_analyses" ADD COLUMN IF NOT EXISTS "survey_id" uuid;
ALTER TABLE public."survey_analyses" ADD COLUMN IF NOT EXISTS "insights" jsonb;
ALTER TABLE public."survey_analyses" ADD COLUMN IF NOT EXISTS "generated_at" timestamp with time zone DEFAULT now();
ALTER TABLE public."survey_responses" ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid();
ALTER TABLE public."survey_responses" ADD COLUMN IF NOT EXISTS "survey_id" uuid;
ALTER TABLE public."survey_responses" ADD COLUMN IF NOT EXISTS "user_id" uuid;
ALTER TABLE public."survey_responses" ADD COLUMN IF NOT EXISTS "answers" jsonb;
ALTER TABLE public."survey_responses" ADD COLUMN IF NOT EXISTS "metadata" jsonb;
ALTER TABLE public."survey_responses" ADD COLUMN IF NOT EXISTS "submitted_at" timestamp with time zone DEFAULT now();
ALTER TABLE public."surveys" ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid();
ALTER TABLE public."surveys" ADD COLUMN IF NOT EXISTS "title" text;
ALTER TABLE public."surveys" ADD COLUMN IF NOT EXISTS "description" text;
ALTER TABLE public."surveys" ADD COLUMN IF NOT EXISTS "slug" text;
ALTER TABLE public."surveys" ADD COLUMN IF NOT EXISTS "is_published" boolean DEFAULT false;
ALTER TABLE public."surveys" ADD COLUMN IF NOT EXISTS "questions" jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public."surveys" ADD COLUMN IF NOT EXISTS "created_by" uuid;
ALTER TABLE public."surveys" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now();
ALTER TABLE public."surveys" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone DEFAULT now();
ALTER TABLE public."usage_tracking" ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid();
ALTER TABLE public."usage_tracking" ADD COLUMN IF NOT EXISTS "user_id" uuid;
ALTER TABLE public."usage_tracking" ADD COLUMN IF NOT EXISTS "feature" text;
ALTER TABLE public."usage_tracking" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now();
ALTER TABLE public."user_commitments" ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT uuid_generate_v4();
ALTER TABLE public."user_commitments" ADD COLUMN IF NOT EXISTS "user_id" uuid;
ALTER TABLE public."user_commitments" ADD COLUMN IF NOT EXISTS "session_id" uuid;
ALTER TABLE public."user_commitments" ADD COLUMN IF NOT EXISTS "commitment_text" text;
ALTER TABLE public."user_commitments" ADD COLUMN IF NOT EXISTS "due_date" date;
ALTER TABLE public."user_commitments" ADD COLUMN IF NOT EXISTS "completed" boolean DEFAULT false;
ALTER TABLE public."user_commitments" ADD COLUMN IF NOT EXISTS "completed_at" timestamp with time zone;
ALTER TABLE public."user_commitments" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now();
ALTER TABLE public."user_goals" ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT uuid_generate_v4();
ALTER TABLE public."user_goals" ADD COLUMN IF NOT EXISTS "user_id" uuid;
ALTER TABLE public."user_goals" ADD COLUMN IF NOT EXISTS "goal_text" text;
ALTER TABLE public."user_goals" ADD COLUMN IF NOT EXISTS "timeframe" text DEFAULT '90 days'::text;
ALTER TABLE public."user_goals" ADD COLUMN IF NOT EXISTS "milestone_1" text;
ALTER TABLE public."user_goals" ADD COLUMN IF NOT EXISTS "milestone_2" text;
ALTER TABLE public."user_goals" ADD COLUMN IF NOT EXISTS "milestone_3" text;
ALTER TABLE public."user_goals" ADD COLUMN IF NOT EXISTS "progress" integer DEFAULT 0;
ALTER TABLE public."user_goals" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now();
ALTER TABLE public."user_goals" ADD COLUMN IF NOT EXISTS "milestone_1_complete" boolean DEFAULT false;
ALTER TABLE public."user_goals" ADD COLUMN IF NOT EXISTS "milestone_2_complete" boolean DEFAULT false;
ALTER TABLE public."user_goals" ADD COLUMN IF NOT EXISTS "milestone_3_complete" boolean DEFAULT false;
ALTER TABLE public."user_goals" ADD COLUMN IF NOT EXISTS "milestone_1_completed" boolean DEFAULT false;
ALTER TABLE public."user_goals" ADD COLUMN IF NOT EXISTS "milestone_2_completed" boolean DEFAULT false;
ALTER TABLE public."user_goals" ADD COLUMN IF NOT EXISTS "milestone_3_completed" boolean DEFAULT false;
ALTER TABLE public."user_progress" ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT uuid_generate_v4();
ALTER TABLE public."user_progress" ADD COLUMN IF NOT EXISTS "user_id" uuid;
ALTER TABLE public."user_progress" ADD COLUMN IF NOT EXISTS "lesson_id" uuid;
ALTER TABLE public."user_progress" ADD COLUMN IF NOT EXISTS "completed" boolean DEFAULT false;
ALTER TABLE public."user_progress" ADD COLUMN IF NOT EXISTS "watch_percentage" integer DEFAULT 0;
ALTER TABLE public."user_progress" ADD COLUMN IF NOT EXISTS "quiz_score" integer;
ALTER TABLE public."user_progress" ADD COLUMN IF NOT EXISTS "completed_at" timestamp with time zone;
ALTER TABLE public."user_progress" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now();
ALTER TABLE public."user_progress" ADD COLUMN IF NOT EXISTS "last_position" real DEFAULT 0;
ALTER TABLE public."user_progress" ADD COLUMN IF NOT EXISTS "progress_percent" integer DEFAULT 0;
ALTER TABLE public."user_progress" ADD COLUMN IF NOT EXISTS "course_id" text;
ALTER TABLE public."user_progress" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone DEFAULT now();
ALTER TABLE public."video_jobs" ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid();
ALTER TABLE public."video_jobs" ADD COLUMN IF NOT EXISTS "created_by" uuid;
ALTER TABLE public."video_jobs" ADD COLUMN IF NOT EXISTS "goal" text;
ALTER TABLE public."video_jobs" ADD COLUMN IF NOT EXISTS "key_message" text;
ALTER TABLE public."video_jobs" ADD COLUMN IF NOT EXISTS "narrative_style" text;
ALTER TABLE public."video_jobs" ADD COLUMN IF NOT EXISTS "audience_tier" text;
ALTER TABLE public."video_jobs" ADD COLUMN IF NOT EXISTS "theme" text DEFAULT 'dark'::text;
ALTER TABLE public."video_jobs" ADD COLUMN IF NOT EXISTS "cta_template" text;
ALTER TABLE public."video_jobs" ADD COLUMN IF NOT EXISTS "cta_button_text" text;
ALTER TABLE public."video_jobs" ADD COLUMN IF NOT EXISTS "cta_button_url" text;
ALTER TABLE public."video_jobs" ADD COLUMN IF NOT EXISTS "cta_image_url" text;
ALTER TABLE public."video_jobs" ADD COLUMN IF NOT EXISTS "audio_mode" text DEFAULT 'none'::text;
ALTER TABLE public."video_jobs" ADD COLUMN IF NOT EXISTS "track_mood" text;
ALTER TABLE public."video_jobs" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'queued'::text;
ALTER TABLE public."video_jobs" ADD COLUMN IF NOT EXISTS "video_url" text;
ALTER TABLE public."video_jobs" ADD COLUMN IF NOT EXISTS "voiceover_url" text;
ALTER TABLE public."video_jobs" ADD COLUMN IF NOT EXISTS "soundtrack_url" text;
ALTER TABLE public."video_jobs" ADD COLUMN IF NOT EXISTS "scenes" jsonb;
ALTER TABLE public."video_jobs" ADD COLUMN IF NOT EXISTS "cta_screen" jsonb;
ALTER TABLE public."video_jobs" ADD COLUMN IF NOT EXISTS "voiceover_script" text;
ALTER TABLE public."video_jobs" ADD COLUMN IF NOT EXISTS "scene_count" integer;
ALTER TABLE public."video_jobs" ADD COLUMN IF NOT EXISTS "total_duration_seconds" numeric(6,1);
ALTER TABLE public."video_jobs" ADD COLUMN IF NOT EXISTS "error_message" text;
ALTER TABLE public."video_jobs" ADD COLUMN IF NOT EXISTS "duration_ms" integer;
ALTER TABLE public."video_jobs" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now();
ALTER TABLE public."video_jobs" ADD COLUMN IF NOT EXISTS "started_at" timestamp with time zone;
ALTER TABLE public."video_jobs" ADD COLUMN IF NOT EXISTS "completed_at" timestamp with time zone;
ALTER TABLE public."video_jobs" ADD COLUMN IF NOT EXISTS "preset_story" jsonb;
ALTER TABLE public."video_jobs" ADD COLUMN IF NOT EXISTS "used_preset" boolean DEFAULT false;
ALTER TABLE public."video_jobs" ADD COLUMN IF NOT EXISTS "client_request_id" text;
ALTER TABLE public."video_jobs" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp with time zone;
ALTER TABLE public."video_jobs" ADD COLUMN IF NOT EXISTS "trigger_run_id" text;
ALTER TABLE public."video_jobs" ADD COLUMN IF NOT EXISTS "cancelled_at" timestamp with time zone;
ALTER TABLE public."video_jobs" ADD COLUMN IF NOT EXISTS "retry_count" integer DEFAULT 0;
ALTER TABLE public."video_jobs" ADD COLUMN IF NOT EXISTS "cost_usd_claude" numeric(10,6);
ALTER TABLE public."video_jobs" ADD COLUMN IF NOT EXISTS "cost_usd_elevenlabs" numeric(10,6);
ALTER TABLE public."video_jobs" ADD COLUMN IF NOT EXISTS "timings" jsonb;
ALTER TABLE public."video_jobs" ADD COLUMN IF NOT EXISTS "cost_usd_total" numeric(10,6);
ALTER TABLE public."waitlist_email_events" ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT uuid_generate_v4();
ALTER TABLE public."waitlist_email_events" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now();
ALTER TABLE public."waitlist_email_events" ADD COLUMN IF NOT EXISTS "entry_id" uuid;
ALTER TABLE public."waitlist_email_events" ADD COLUMN IF NOT EXISTS "event_type" text;
ALTER TABLE public."waitlist_email_events" ADD COLUMN IF NOT EXISTS "metadata" jsonb;
ALTER TABLE public."waitlist_email_events" ADD COLUMN IF NOT EXISTS "ip_address" inet;
ALTER TABLE public."waitlist_entries" ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT uuid_generate_v4();
ALTER TABLE public."waitlist_entries" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now();
ALTER TABLE public."waitlist_entries" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone DEFAULT now();
ALTER TABLE public."waitlist_entries" ADD COLUMN IF NOT EXISTS "first_name" text;
ALTER TABLE public."waitlist_entries" ADD COLUMN IF NOT EXISTS "last_name" text;
ALTER TABLE public."waitlist_entries" ADD COLUMN IF NOT EXISTS "email" text;
ALTER TABLE public."waitlist_entries" ADD COLUMN IF NOT EXISTS "whatsapp" text;
ALTER TABLE public."waitlist_entries" ADD COLUMN IF NOT EXISTS "life_stage" text DEFAULT 'builder'::text;
ALTER TABLE public."waitlist_entries" ADD COLUMN IF NOT EXISTS "country" text;
ALTER TABLE public."waitlist_entries" ADD COLUMN IF NOT EXISTS "industry" text;
ALTER TABLE public."waitlist_entries" ADD COLUMN IF NOT EXISTS "referral_source" text;
ALTER TABLE public."waitlist_entries" ADD COLUMN IF NOT EXISTS "utm_source" text;
ALTER TABLE public."waitlist_entries" ADD COLUMN IF NOT EXISTS "utm_medium" text;
ALTER TABLE public."waitlist_entries" ADD COLUMN IF NOT EXISTS "utm_campaign" text;
ALTER TABLE public."waitlist_entries" ADD COLUMN IF NOT EXISTS "utm_content" text;
ALTER TABLE public."waitlist_entries" ADD COLUMN IF NOT EXISTS "utm_term" text;
ALTER TABLE public."waitlist_entries" ADD COLUMN IF NOT EXISTS "position" integer;
ALTER TABLE public."waitlist_entries" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'waiting'::text;
ALTER TABLE public."waitlist_entries" ADD COLUMN IF NOT EXISTS "invited_at" timestamp with time zone;
ALTER TABLE public."waitlist_entries" ADD COLUMN IF NOT EXISTS "converted_at" timestamp with time zone;
ALTER TABLE public."waitlist_entries" ADD COLUMN IF NOT EXISTS "email_confirmed" boolean DEFAULT false;
ALTER TABLE public."waitlist_entries" ADD COLUMN IF NOT EXISTS "confirmation_token" text DEFAULT encode(gen_random_bytes(32), 'hex'::text);
ALTER TABLE public."waitlist_entries" ADD COLUMN IF NOT EXISTS "confirmed_at" timestamp with time zone;
ALTER TABLE public."waitlist_entries" ADD COLUMN IF NOT EXISTS "referral_code" text DEFAULT upper(SUBSTRING(encode(gen_random_bytes(4), 'hex'::text) FROM 1 FOR 8));
ALTER TABLE public."waitlist_entries" ADD COLUMN IF NOT EXISTS "referred_by_code" text;
ALTER TABLE public."waitlist_entries" ADD COLUMN IF NOT EXISTS "referral_count" integer DEFAULT 0;
ALTER TABLE public."waitlist_entries" ADD COLUMN IF NOT EXISTS "ip_address" inet;
ALTER TABLE public."waitlist_entries" ADD COLUMN IF NOT EXISTS "user_agent" text;
ALTER TABLE public."waitlist_entries" ADD COLUMN IF NOT EXISTS "landing_page" text;
ALTER TABLE public."waitlist_entries" ADD COLUMN IF NOT EXISTS "consent_given" boolean DEFAULT false;
ALTER TABLE public."waitlist_entries" ADD COLUMN IF NOT EXISTS "consent_at" timestamp with time zone;
ALTER TABLE public."waitlist_entries" ADD COLUMN IF NOT EXISTS "gdpr_delete_requested" boolean DEFAULT false;

-- ==========================================================================
-- Primary keys, unique and check constraints
-- ==========================================================================

DO $$ BEGIN ALTER TABLE public."audit_logs" ADD CONSTRAINT "audit_logs_pkey" PRIMARY KEY (id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."blog_posts" ADD CONSTRAINT "blog_posts_pkey" PRIMARY KEY (id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."channel_read_positions" ADD CONSTRAINT "channel_read_positions_pkey" PRIMARY KEY (user_id, channel_slug); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."circle_members" ADD CONSTRAINT "circle_members_pkey" PRIMARY KEY (channel_slug, user_id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."clip_cta_jobs" ADD CONSTRAINT "clip_cta_jobs_pkey" PRIMARY KEY (id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."coaching_sessions" ADD CONSTRAINT "coaching_sessions_pkey" PRIMARY KEY (id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."cohort_comments" ADD CONSTRAINT "cohort_comments_pkey" PRIMARY KEY (id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."cohort_members" ADD CONSTRAINT "cohort_members_pkey" PRIMARY KEY (id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."cohort_posts" ADD CONSTRAINT "cohort_posts_pkey" PRIMARY KEY (id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."cohort_replies" ADD CONSTRAINT "cohort_replies_pkey" PRIMARY KEY (id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."cohort_votes" ADD CONSTRAINT "cohort_votes_pkey" PRIMARY KEY (id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."cohorts" ADD CONSTRAINT "cohorts_pkey" PRIMARY KEY (id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."community_categories" ADD CONSTRAINT "community_categories_pkey" PRIMARY KEY (id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."community_channels" ADD CONSTRAINT "community_channels_pkey" PRIMARY KEY (slug); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."community_messages" ADD CONSTRAINT "community_messages_pkey" PRIMARY KEY (id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."community_prompts" ADD CONSTRAINT "community_prompts_pkey" PRIMARY KEY (id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."contact_messages" ADD CONSTRAINT "contact_messages_pkey" PRIMARY KEY (id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."content_calendar" ADD CONSTRAINT "content_calendar_pkey" PRIMARY KEY (id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."course_discussions" ADD CONSTRAINT "course_discussions_pkey" PRIMARY KEY (id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."course_notes" ADD CONSTRAINT "course_notes_pkey" PRIMARY KEY (id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."courses" ADD CONSTRAINT "courses_pkey" PRIMARY KEY (id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."deletion_requests" ADD CONSTRAINT "deletion_requests_pkey" PRIMARY KEY (id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."event_registrations" ADD CONSTRAINT "event_registrations_pkey" PRIMARY KEY (id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."expert_registrations" ADD CONSTRAINT "expert_registrations_pkey" PRIMARY KEY (id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."expert_sessions" ADD CONSTRAINT "expert_sessions_pkey" PRIMARY KEY (id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."guardsmann_applications" ADD CONSTRAINT "guardsmann_applications_pkey" PRIMARY KEY (id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."guardsmann_jobs" ADD CONSTRAINT "guardsmann_jobs_pkey" PRIMARY KEY (id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."job_applications" ADD CONSTRAINT "job_applications_pkey" PRIMARY KEY (id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."job_listings" ADD CONSTRAINT "job_listings_pkey" PRIMARY KEY (id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."knowledge_chunks" ADD CONSTRAINT "knowledge_chunks_pkey" PRIMARY KEY (id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."lead_magnet_downloads" ADD CONSTRAINT "lead_magnet_downloads_pkey" PRIMARY KEY (id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."lead_magnets" ADD CONSTRAINT "lead_magnets_pkey" PRIMARY KEY (id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."lessons" ADD CONSTRAINT "lessons_pkey" PRIMARY KEY (id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."marketing_pages" ADD CONSTRAINT "marketing_pages_pkey" PRIMARY KEY (id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."marketing_repeating_items" ADD CONSTRAINT "marketing_repeating_items_pkey" PRIMARY KEY (id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."marketing_sections" ADD CONSTRAINT "marketing_sections_pkey" PRIMARY KEY (id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."mentor_applications" ADD CONSTRAINT "mentor_applications_pkey" PRIMARY KEY (id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."mentor_profiles" ADD CONSTRAINT "mentor_profiles_pkey" PRIMARY KEY (id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."newsletter_queue" ADD CONSTRAINT "newsletter_queue_pkey" PRIMARY KEY (id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."newsletter_subscribers" ADD CONSTRAINT "newsletter_subscribers_pkey" PRIMARY KEY (id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."notifications" ADD CONSTRAINT "notifications_pkey" PRIMARY KEY (id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."partner_course_enrollments" ADD CONSTRAINT "partner_course_enrollments_pkey" PRIMARY KEY (id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."partner_courses" ADD CONSTRAINT "partner_courses_pkey" PRIMARY KEY (id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."partner_enquiries" ADD CONSTRAINT "partner_enquiries_pkey" PRIMARY KEY (id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."partner_event_registrations" ADD CONSTRAINT "partner_event_registrations_pkey" PRIMARY KEY (id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."partner_events" ADD CONSTRAINT "partner_events_pkey" PRIMARY KEY (id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."partner_members" ADD CONSTRAINT "partner_members_pkey" PRIMARY KEY (id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."partner_subscriptions" ADD CONSTRAINT "partner_subscriptions_pkey" PRIMARY KEY (id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."partner_transactions" ADD CONSTRAINT "partner_transactions_pkey" PRIMARY KEY (id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."partners" ADD CONSTRAINT "partners_pkey" PRIMARY KEY (id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."password_reset_otps" ADD CONSTRAINT "password_reset_otps_pkey" PRIMARY KEY (id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."payment_attempts" ADD CONSTRAINT "payment_attempts_pkey" PRIMARY KEY (id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."payments" ADD CONSTRAINT "payments_pkey" PRIMARY KEY (id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."personal_brand_briefs" ADD CONSTRAINT "personal_brand_briefs_pkey" PRIMARY KEY (id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."platform_settings" ADD CONSTRAINT "platform_settings_pkey" PRIMARY KEY (key); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."platform_snapshots" ADD CONSTRAINT "platform_snapshots_pkey" PRIMARY KEY (id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."post_likes" ADD CONSTRAINT "post_likes_pkey" PRIMARY KEY (user_id, post_id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."product_purchases" ADD CONSTRAINT "product_purchases_pkey" PRIMARY KEY (id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."products" ADD CONSTRAINT "products_pkey" PRIMARY KEY (id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."profiles" ADD CONSTRAINT "profiles_pkey" PRIMARY KEY (id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."promo_codes" ADD CONSTRAINT "promo_codes_pkey" PRIMARY KEY (id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."public_events" ADD CONSTRAINT "public_events_pkey" PRIMARY KEY (id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."push_events" ADD CONSTRAINT "push_events_pkey" PRIMARY KEY (id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."push_subscriptions" ADD CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY (id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."rail_billboards" ADD CONSTRAINT "rail_billboards_pkey" PRIMARY KEY (id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."referrals" ADD CONSTRAINT "referrals_pkey" PRIMARY KEY (id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."research_briefs" ADD CONSTRAINT "research_briefs_pkey" PRIMARY KEY (id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."scheduled_posts" ADD CONSTRAINT "scheduled_posts_pkey" PRIMARY KEY (id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."sent_newsletters" ADD CONSTRAINT "sent_newsletters_pkey" PRIMARY KEY (id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."session_locations" ADD CONSTRAINT "session_locations_pkey" PRIMARY KEY (id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."session_registrations" ADD CONSTRAINT "session_registrations_pkey" PRIMARY KEY (id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."social_queue" ADD CONSTRAINT "social_queue_pkey" PRIMARY KEY (id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."soundtracks" ADD CONSTRAINT "soundtracks_pkey" PRIMARY KEY (id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."subscriptions" ADD CONSTRAINT "subscriptions_pkey" PRIMARY KEY (id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."summit_donations" ADD CONSTRAINT "summit_donations_pkey" PRIMARY KEY (id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."summit_interest" ADD CONSTRAINT "summit_interest_pkey" PRIMARY KEY (id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."summit_registrations" ADD CONSTRAINT "summit_registrations_pkey" PRIMARY KEY (id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."survey_analyses" ADD CONSTRAINT "survey_analyses_pkey" PRIMARY KEY (id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."survey_responses" ADD CONSTRAINT "survey_responses_pkey" PRIMARY KEY (id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."surveys" ADD CONSTRAINT "surveys_pkey" PRIMARY KEY (id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."usage_tracking" ADD CONSTRAINT "usage_tracking_pkey" PRIMARY KEY (id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."user_commitments" ADD CONSTRAINT "user_commitments_pkey" PRIMARY KEY (id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."user_goals" ADD CONSTRAINT "user_goals_pkey" PRIMARY KEY (id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."user_progress" ADD CONSTRAINT "user_progress_pkey" PRIMARY KEY (id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."video_jobs" ADD CONSTRAINT "video_jobs_pkey" PRIMARY KEY (id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."waitlist_email_events" ADD CONSTRAINT "waitlist_email_events_pkey" PRIMARY KEY (id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."waitlist_entries" ADD CONSTRAINT "waitlist_entries_pkey" PRIMARY KEY (id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."blog_posts" ADD CONSTRAINT "blog_posts_slug_key" UNIQUE (slug); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."cohort_members" ADD CONSTRAINT "cohort_members_cohort_id_user_id_key" UNIQUE (cohort_id, user_id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."cohort_votes" ADD CONSTRAINT "cohort_votes_user_id_post_id_key" UNIQUE (user_id, post_id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."cohort_votes" ADD CONSTRAINT "cohort_votes_user_id_reply_id_key" UNIQUE (user_id, reply_id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."community_prompts" ADD CONSTRAINT "community_prompts_week_start_key" UNIQUE (week_start); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."course_notes" ADD CONSTRAINT "course_notes_user_id_lesson_id_key" UNIQUE (user_id, lesson_id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."event_registrations" ADD CONSTRAINT "event_registrations_event_id_email_key" UNIQUE (event_id, email); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."expert_registrations" ADD CONSTRAINT "expert_registrations_session_id_user_id_key" UNIQUE (session_id, user_id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."knowledge_chunks" ADD CONSTRAINT "knowledge_chunks_chunk_id_key" UNIQUE (chunk_id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."marketing_pages" ADD CONSTRAINT "marketing_pages_slug_key" UNIQUE (slug); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."marketing_sections" ADD CONSTRAINT "marketing_sections_page_id_section_key_key" UNIQUE (page_id, section_key); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."mentor_applications" ADD CONSTRAINT "mentor_applications_email_key" UNIQUE (email); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."mentor_profiles" ADD CONSTRAINT "mentor_profiles_slug_key" UNIQUE (slug); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."newsletter_subscribers" ADD CONSTRAINT "newsletter_subscribers_email_key" UNIQUE (email); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."partner_course_enrollments" ADD CONSTRAINT "partner_course_enrollments_course_id_user_id_key" UNIQUE (course_id, user_id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."partner_event_registrations" ADD CONSTRAINT "partner_event_registrations_event_id_user_id_key" UNIQUE (event_id, user_id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."partner_members" ADD CONSTRAINT "partner_members_partner_id_email_key" UNIQUE (partner_id, email); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."partner_transactions" ADD CONSTRAINT "partner_transactions_paystack_reference_key" UNIQUE (paystack_reference); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."partners" ADD CONSTRAINT "partners_custom_domain_key" UNIQUE (custom_domain); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."partners" ADD CONSTRAINT "partners_slug_key" UNIQUE (slug); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."partners" ADD CONSTRAINT "partners_subdomain_key" UNIQUE (subdomain); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."payment_attempts" ADD CONSTRAINT "payment_attempts_reference_key" UNIQUE (reference); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."payments" ADD CONSTRAINT "payments_reference_key" UNIQUE (reference); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."payments" ADD CONSTRAINT "payments_reference_unique" UNIQUE (reference); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."product_purchases" ADD CONSTRAINT "product_purchases_reference_key" UNIQUE (reference); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."profiles" ADD CONSTRAINT "profiles_referral_code_key" UNIQUE (referral_code); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."profiles" ADD CONSTRAINT "profiles_referral_code_unique" UNIQUE (referral_code); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."promo_codes" ADD CONSTRAINT "promo_codes_code_key" UNIQUE (code); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."promo_codes" ADD CONSTRAINT "promo_codes_code_unique" UNIQUE (code); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."public_events" ADD CONSTRAINT "public_events_slug_key" UNIQUE (slug); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."push_subscriptions" ADD CONSTRAINT "push_subscriptions_endpoint_key" UNIQUE (endpoint); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."referrals" ADD CONSTRAINT "referrals_referred_id_key" UNIQUE (referred_id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."referrals" ADD CONSTRAINT "referrals_referred_id_unique" UNIQUE (referred_id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."session_registrations" ADD CONSTRAINT "session_registrations_unique" UNIQUE (session_id, user_id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."session_registrations" ADD CONSTRAINT "session_registrations_user_id_session_id_key" UNIQUE (user_id, session_id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."session_registrations" ADD CONSTRAINT "uq_session_registrations_user_session" UNIQUE (session_id, user_id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."subscriptions" ADD CONSTRAINT "subscriptions_user_id_key" UNIQUE (user_id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."summit_donations" ADD CONSTRAINT "summit_donations_payment_reference_key" UNIQUE (payment_reference); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."summit_interest" ADD CONSTRAINT "summit_interest_email_key" UNIQUE (email); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."summit_registrations" ADD CONSTRAINT "summit_registrations_email_key" UNIQUE (email); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."summit_registrations" ADD CONSTRAINT "summit_registrations_payment_reference_key" UNIQUE (payment_reference); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."survey_analyses" ADD CONSTRAINT "survey_analyses_survey_id_key" UNIQUE (survey_id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."surveys" ADD CONSTRAINT "surveys_slug_key" UNIQUE (slug); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."user_progress" ADD CONSTRAINT "user_progress_user_course_unique" UNIQUE (user_id, course_id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."user_progress" ADD CONSTRAINT "user_progress_user_id_lesson_id_key" UNIQUE (user_id, lesson_id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."user_progress" ADD CONSTRAINT "user_progress_user_lesson_unique" UNIQUE (user_id, lesson_id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."waitlist_entries" ADD CONSTRAINT "waitlist_entries_confirmation_token_key" UNIQUE (confirmation_token); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."waitlist_entries" ADD CONSTRAINT "waitlist_entries_email_key" UNIQUE (email); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."waitlist_entries" ADD CONSTRAINT "waitlist_entries_position_key" UNIQUE ("position"); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."waitlist_entries" ADD CONSTRAINT "waitlist_entries_referral_code_key" UNIQUE (referral_code); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."clip_cta_jobs" ADD CONSTRAINT "clip_cta_jobs_status_check" CHECK ((status = ANY (ARRAY['queued'::text, 'processing'::text, 'complete'::text, 'failed'::text]))); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."clip_cta_jobs" ADD CONSTRAINT "clip_cta_jobs_transition_type_check" CHECK ((transition_type = ANY (ARRAY['fade-black'::text, 'crossfade'::text, 'hard-cut'::text]))); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."coaching_sessions" ADD CONSTRAINT "coaching_sessions_rating_check" CHECK (((rating >= 1) AND (rating <= 5))); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."coaching_sessions" ADD CONSTRAINT "coaching_sessions_session_type_check" CHECK ((session_type = ANY (ARRAY['goal_clarity'::text, 'challenge_navigation'::text, 'difficult_conversation'::text, 'weekly_reflection'::text, 'accountability_check'::text]))); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."cohort_votes" ADD CONSTRAINT "cohort_votes_vote_type_check" CHECK ((vote_type = ANY (ARRAY['up'::text, 'down'::text]))); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."cohorts" ADD CONSTRAINT "cohorts_plan_tier_check" CHECK ((plan_tier = ANY (ARRAY['free'::text, 'explorer'::text, 'builder'::text, 'climber'::text]))); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."community_categories" ADD CONSTRAINT "community_categories_default_type_check" CHECK ((default_type = ANY (ARRAY['chat'::text, 'forum'::text, 'circle'::text, 'announce'::text]))); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."community_channels" ADD CONSTRAINT "community_channels_channel_type_check" CHECK ((channel_type = ANY (ARRAY['chat'::text, 'forum'::text, 'circle'::text, 'announce'::text]))); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."community_messages" ADD CONSTRAINT "community_messages_content_check" CHECK (((char_length(content) >= 1) AND (char_length(content) <= 2000))); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."content_calendar" ADD CONSTRAINT "content_calendar_status_check" CHECK ((status = ANY (ARRAY['draft'::text, 'approved'::text, 'scheduled'::text, 'published'::text, 'scheduled_buffer'::text]))); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."courses" ADD CONSTRAINT "courses_difficulty_check" CHECK ((difficulty = ANY (ARRAY['beginner'::text, 'intermediate'::text, 'advanced'::text]))); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."courses" ADD CONSTRAINT "courses_plan_tier_check" CHECK ((plan_tier = ANY (ARRAY['free'::text, 'explorer'::text, 'builder'::text, 'climber'::text]))); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."expert_sessions" ADD CONSTRAINT "expert_sessions_plan_tier_check" CHECK ((plan_tier = ANY (ARRAY['free'::text, 'explorer'::text, 'builder'::text, 'climber'::text]))); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."expert_sessions" ADD CONSTRAINT "expert_sessions_status_check" CHECK ((status = ANY (ARRAY['scheduled'::text, 'live'::text, 'completed'::text, 'cancelled'::text]))); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."job_applications" ADD CONSTRAINT "job_applications_status_check" CHECK ((status = ANY (ARRAY['new'::text, 'reviewing'::text, 'shortlisted'::text, 'rejected'::text, 'hired'::text]))); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."marketing_pages" ADD CONSTRAINT "marketing_pages_status_check" CHECK ((status = ANY (ARRAY['draft'::text, 'published'::text]))); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."marketing_repeating_items" ADD CONSTRAINT "marketing_repeating_items_status_check" CHECK ((status = ANY (ARRAY['draft'::text, 'published'::text]))); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."marketing_sections" ADD CONSTRAINT "marketing_sections_section_type_check" CHECK ((section_type = ANY (ARRAY['prose'::text, 'repeating'::text, 'structured'::text]))); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."marketing_sections" ADD CONSTRAINT "marketing_sections_status_check" CHECK ((status = ANY (ARRAY['draft'::text, 'published'::text]))); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."mentor_applications" ADD CONSTRAINT "mentor_applications_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'active'::text, 'rejected'::text]))); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."mentor_profiles" ADD CONSTRAINT "mentor_profiles_background_check" CHECK ((background = ANY (ARRAY['christian'::text, 'secular'::text, 'african-christian'::text, 'african-secular'::text]))); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."partner_courses" ADD CONSTRAINT "partner_courses_access_tier_check" CHECK ((access_tier = ANY (ARRAY['free'::text, 'explorer'::text, 'builder'::text, 'climber'::text]))); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."partner_courses" ADD CONSTRAINT "partner_courses_difficulty_check" CHECK ((difficulty = ANY (ARRAY['beginner'::text, 'intermediate'::text, 'advanced'::text]))); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."partner_events" ADD CONSTRAINT "partner_events_status_check" CHECK ((status = ANY (ARRAY['draft'::text, 'published'::text, 'cancelled'::text, 'completed'::text]))); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."partner_members" ADD CONSTRAINT "partner_members_role_check" CHECK ((role = ANY (ARRAY['member'::text, 'moderator'::text, 'admin'::text]))); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."partner_members" ADD CONSTRAINT "partner_members_status_check" CHECK ((status = ANY (ARRAY['invited'::text, 'active'::text, 'suspended'::text, 'removed'::text]))); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."partner_subscriptions" ADD CONSTRAINT "partner_subscriptions_billing_cycle_check" CHECK ((billing_cycle = ANY (ARRAY['monthly'::text, 'annual'::text]))); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."partner_subscriptions" ADD CONSTRAINT "partner_subscriptions_plan_tier_check" CHECK ((plan_tier = ANY (ARRAY['starter'::text, 'growth'::text, 'pro'::text]))); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."partner_subscriptions" ADD CONSTRAINT "partner_subscriptions_status_check" CHECK ((status = ANY (ARRAY['active'::text, 'cancelled'::text, 'past_due'::text, 'trial'::text]))); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."partners" ADD CONSTRAINT "partners_plan_tier_check" CHECK ((plan_tier = ANY (ARRAY['starter'::text, 'growth'::text, 'pro'::text]))); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."partners" ADD CONSTRAINT "partners_revenue_share_percent_check" CHECK (((revenue_share_percent >= 0) AND (revenue_share_percent <= 100))); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."partners" ADD CONSTRAINT "partners_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'active'::text, 'suspended'::text, 'churned'::text]))); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."payment_attempts" ADD CONSTRAINT "payment_attempts_billing_check" CHECK ((billing = ANY (ARRAY['monthly'::text, 'annual'::text]))); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."payment_attempts" ADD CONSTRAINT "payment_attempts_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'success'::text, 'failed'::text, 'abandoned'::text, 'duplicate'::text]))); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."payments" ADD CONSTRAINT "payments_provider_check" CHECK ((provider = ANY (ARRAY['paystack'::text, 'selar'::text, 'free'::text]))); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."payments" ADD CONSTRAINT "payments_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'success'::text, 'failed'::text, 'refunded'::text]))); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."profiles" ADD CONSTRAINT "profiles_ascent_stage_check" CHECK ((ascent_stage = ANY (ARRAY['seeker'::text, 'builder'::text, 'leader'::text]))); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."profiles" ADD CONSTRAINT "profiles_role_check" CHECK ((role = ANY (ARRAY['member'::text, 'moderator'::text, 'admin'::text]))); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."profiles" ADD CONSTRAINT "profiles_time_commitment_check" CHECK ((time_commitment = ANY (ARRAY['5min'::text, '15min'::text, '30min'::text]))); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."promo_codes" ADD CONSTRAINT "promo_codes_discount_check" CHECK (((discount >= (0)::numeric) AND (discount <= (1)::numeric))); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."rail_billboards" ADD CONSTRAINT "rail_billboards_slot_check" CHECK (((slot >= 1) AND (slot <= 3))); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."referrals" ADD CONSTRAINT "referrals_status_check" CHECK ((status = ANY (ARRAY['signed_up'::text, 'onboarded'::text, 'subscribed'::text, 'rewarded'::text]))); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."scheduled_posts" ADD CONSTRAINT "scheduled_posts_status_check" CHECK ((status = ANY (ARRAY['scheduled'::text, 'sent'::text, 'failed'::text, 'cancelled'::text]))); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."session_registrations" ADD CONSTRAINT "session_registrations_rating_check" CHECK (((rating >= 1) AND (rating <= 5))); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."social_queue" ADD CONSTRAINT "social_queue_status_check" CHECK ((status = ANY (ARRAY['queued'::text, 'published'::text, 'failed'::text]))); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."subscriptions" ADD CONSTRAINT "subscriptions_payment_provider_check" CHECK ((payment_provider = ANY (ARRAY['paystack'::text, 'selar'::text, 'free'::text]))); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."subscriptions" ADD CONSTRAINT "subscriptions_plan_check" CHECK ((plan = ANY (ARRAY['standard'::text, 'founder'::text, 'tester'::text]))); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."subscriptions" ADD CONSTRAINT "subscriptions_status_check" CHECK ((status = ANY (ARRAY['trialing'::text, 'active'::text, 'past_due'::text, 'cancelled'::text, 'expired'::text]))); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."user_goals" ADD CONSTRAINT "user_goals_progress_check" CHECK (((progress >= 0) AND (progress <= 100))); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."waitlist_email_events" ADD CONSTRAINT "waitlist_email_events_event_type_check" CHECK ((event_type = ANY (ARRAY['confirmation_sent'::text, 'confirmation_opened'::text, 'confirmed'::text, 'launch_invite_sent'::text, 'launch_invite_opened'::text, 'launch_invite_clicked'::text, 'unsubscribed'::text, 'bounced'::text, 'spam_reported'::text]))); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."waitlist_entries" ADD CONSTRAINT "waitlist_entries_country_check" CHECK ((char_length(country) <= 20)); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."waitlist_entries" ADD CONSTRAINT "waitlist_entries_first_name_check" CHECK (((char_length(first_name) >= 1) AND (char_length(first_name) <= 80))); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."waitlist_entries" ADD CONSTRAINT "waitlist_entries_industry_check" CHECK ((industry = ANY (ARRAY['fintech'::text, 'tech'::text, 'consulting'::text, 'healthcare'::text, 'education'::text, 'fmcg'::text, 'media'::text, 'startup'::text, 'government'::text, 'ngo'::text, 'law'::text, 'engineering'::text, 'other'::text]))); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."waitlist_entries" ADD CONSTRAINT "waitlist_entries_last_name_check" CHECK (((char_length(last_name) >= 1) AND (char_length(last_name) <= 80))); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."waitlist_entries" ADD CONSTRAINT "waitlist_entries_life_stage_check" CHECK ((life_stage = ANY (ARRAY['explorer'::text, 'builder'::text, 'climber'::text]))); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."waitlist_entries" ADD CONSTRAINT "waitlist_entries_referral_source_check" CHECK ((referral_source = ANY (ARRAY['instagram'::text, 'tiktok'::text, 'linkedin'::text, 'whatsapp'::text, 'friend'::text, 'organic'::text, 'other'::text]))); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."waitlist_entries" ADD CONSTRAINT "waitlist_entries_status_check" CHECK ((status = ANY (ARRAY['waiting'::text, 'invited'::text, 'converted'::text, 'unsubscribed'::text]))); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."waitlist_entries" ADD CONSTRAINT "waitlist_entries_whatsapp_check" CHECK (((char_length(whatsapp) >= 7) AND (char_length(whatsapp) <= 20))); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;

-- ==========================================================================
-- Foreign keys
-- ==========================================================================

DO $$ BEGIN ALTER TABLE public."audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."channel_read_positions" ADD CONSTRAINT "channel_read_positions_channel_slug_fkey" FOREIGN KEY (channel_slug) REFERENCES community_channels(slug) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."channel_read_positions" ADD CONSTRAINT "channel_read_positions_user_id_fkey" FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."circle_members" ADD CONSTRAINT "circle_members_channel_slug_fkey" FOREIGN KEY (channel_slug) REFERENCES community_channels(slug) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."circle_members" ADD CONSTRAINT "circle_members_user_id_fkey" FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."clip_cta_jobs" ADD CONSTRAINT "clip_cta_jobs_created_by_fkey" FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."coaching_sessions" ADD CONSTRAINT "coaching_sessions_user_id_fkey" FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."cohort_comments" ADD CONSTRAINT "cohort_comments_post_id_fkey" FOREIGN KEY (post_id) REFERENCES cohort_posts(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."cohort_comments" ADD CONSTRAINT "cohort_comments_user_id_fkey" FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."cohort_members" ADD CONSTRAINT "cohort_members_cohort_id_fkey" FOREIGN KEY (cohort_id) REFERENCES cohorts(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."cohort_members" ADD CONSTRAINT "cohort_members_user_id_fkey" FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."cohort_posts" ADD CONSTRAINT "cohort_posts_cohort_id_fkey" FOREIGN KEY (cohort_id) REFERENCES cohorts(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."cohort_posts" ADD CONSTRAINT "cohort_posts_user_id_fkey" FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."cohort_replies" ADD CONSTRAINT "cohort_replies_post_id_fkey" FOREIGN KEY (post_id) REFERENCES cohort_posts(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."cohort_replies" ADD CONSTRAINT "cohort_replies_user_id_fkey" FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."cohort_votes" ADD CONSTRAINT "cohort_votes_post_id_fkey" FOREIGN KEY (post_id) REFERENCES cohort_posts(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."cohort_votes" ADD CONSTRAINT "cohort_votes_reply_id_fkey" FOREIGN KEY (reply_id) REFERENCES cohort_replies(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."cohort_votes" ADD CONSTRAINT "cohort_votes_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."community_channels" ADD CONSTRAINT "community_channels_category_id_fkey" FOREIGN KEY (category_id) REFERENCES community_categories(id) ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."community_messages" ADD CONSTRAINT "community_messages_reply_to_id_fkey" FOREIGN KEY (reply_to_id) REFERENCES community_messages(id) ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."community_messages" ADD CONSTRAINT "community_messages_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."content_calendar" ADD CONSTRAINT "content_calendar_assigned_to_fkey" FOREIGN KEY (assigned_to) REFERENCES profiles(id) ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."course_discussions" ADD CONSTRAINT "course_discussions_course_id_fkey" FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."course_discussions" ADD CONSTRAINT "course_discussions_reply_to_id_fkey" FOREIGN KEY (reply_to_id) REFERENCES course_discussions(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."course_discussions" ADD CONSTRAINT "course_discussions_user_id_fkey" FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."course_notes" ADD CONSTRAINT "course_notes_course_id_fkey" FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."course_notes" ADD CONSTRAINT "course_notes_lesson_id_fkey" FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."course_notes" ADD CONSTRAINT "course_notes_user_id_fkey" FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."courses" ADD CONSTRAINT "courses_created_by_fkey" FOREIGN KEY (created_by) REFERENCES profiles(id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."deletion_requests" ADD CONSTRAINT "deletion_requests_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."event_registrations" ADD CONSTRAINT "event_registrations_event_id_fkey" FOREIGN KEY (event_id) REFERENCES public_events(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."event_registrations" ADD CONSTRAINT "event_registrations_user_id_fkey" FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."expert_registrations" ADD CONSTRAINT "expert_registrations_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."expert_sessions" ADD CONSTRAINT "expert_sessions_partner_id_fkey" FOREIGN KEY (partner_id) REFERENCES partners(id) ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."job_applications" ADD CONSTRAINT "job_applications_job_id_fkey" FOREIGN KEY (job_id) REFERENCES job_listings(id) ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."knowledge_chunks" ADD CONSTRAINT "knowledge_chunks_mentor_id_fkey" FOREIGN KEY (mentor_id) REFERENCES mentor_profiles(id) ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."lessons" ADD CONSTRAINT "lessons_course_id_fkey" FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."marketing_repeating_items" ADD CONSTRAINT "marketing_repeating_items_section_id_fkey" FOREIGN KEY (section_id) REFERENCES marketing_sections(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."marketing_sections" ADD CONSTRAINT "marketing_sections_page_id_fkey" FOREIGN KEY (page_id) REFERENCES marketing_pages(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."newsletter_queue" ADD CONSTRAINT "newsletter_queue_content_calendar_id_fkey" FOREIGN KEY (content_calendar_id) REFERENCES content_calendar(id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."partner_course_enrollments" ADD CONSTRAINT "partner_course_enrollments_course_id_fkey" FOREIGN KEY (course_id) REFERENCES partner_courses(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."partner_course_enrollments" ADD CONSTRAINT "partner_course_enrollments_partner_id_fkey" FOREIGN KEY (partner_id) REFERENCES partners(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."partner_course_enrollments" ADD CONSTRAINT "partner_course_enrollments_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."partner_courses" ADD CONSTRAINT "partner_courses_partner_id_fkey" FOREIGN KEY (partner_id) REFERENCES partners(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."partner_event_registrations" ADD CONSTRAINT "partner_event_registrations_event_id_fkey" FOREIGN KEY (event_id) REFERENCES partner_events(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."partner_event_registrations" ADD CONSTRAINT "partner_event_registrations_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."partner_events" ADD CONSTRAINT "partner_events_partner_id_fkey" FOREIGN KEY (partner_id) REFERENCES partners(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."partner_members" ADD CONSTRAINT "partner_members_partner_id_fkey" FOREIGN KEY (partner_id) REFERENCES partners(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."partner_members" ADD CONSTRAINT "partner_members_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."partner_subscriptions" ADD CONSTRAINT "partner_subscriptions_partner_id_fkey" FOREIGN KEY (partner_id) REFERENCES partners(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."partner_transactions" ADD CONSTRAINT "partner_transactions_partner_id_fkey" FOREIGN KEY (partner_id) REFERENCES partners(id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."partner_transactions" ADD CONSTRAINT "partner_transactions_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."partners" ADD CONSTRAINT "partners_owner_id_fkey" FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."payment_attempts" ADD CONSTRAINT "payment_attempts_user_id_fkey" FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."payments" ADD CONSTRAINT "payments_subscription_id_fkey" FOREIGN KEY (subscription_id) REFERENCES subscriptions(id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."payments" ADD CONSTRAINT "payments_user_id_fkey" FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."post_likes" ADD CONSTRAINT "post_likes_post_id_fkey" FOREIGN KEY (post_id) REFERENCES cohort_posts(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."post_likes" ADD CONSTRAINT "post_likes_user_id_fkey" FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."product_purchases" ADD CONSTRAINT "product_purchases_product_id_fkey" FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."product_purchases" ADD CONSTRAINT "product_purchases_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."profiles" ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."promo_codes" ADD CONSTRAINT "promo_codes_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."push_events" ADD CONSTRAINT "push_events_actor_id_fkey" FOREIGN KEY (actor_id) REFERENCES auth.users(id) ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."push_events" ADD CONSTRAINT "push_events_recipient_id_fkey" FOREIGN KEY (recipient_id) REFERENCES auth.users(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."referrals" ADD CONSTRAINT "referrals_referred_id_fkey" FOREIGN KEY (referred_id) REFERENCES auth.users(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."referrals" ADD CONSTRAINT "referrals_referrer_id_fkey" FOREIGN KEY (referrer_id) REFERENCES auth.users(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."scheduled_posts" ADD CONSTRAINT "scheduled_posts_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."session_locations" ADD CONSTRAINT "session_locations_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."session_registrations" ADD CONSTRAINT "session_registrations_session_id_fkey" FOREIGN KEY (session_id) REFERENCES expert_sessions(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."session_registrations" ADD CONSTRAINT "session_registrations_user_id_fkey" FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."subscriptions" ADD CONSTRAINT "subscriptions_user_id_fkey" FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."survey_analyses" ADD CONSTRAINT "survey_analyses_survey_id_fkey" FOREIGN KEY (survey_id) REFERENCES surveys(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."survey_responses" ADD CONSTRAINT "survey_responses_survey_id_fkey" FOREIGN KEY (survey_id) REFERENCES surveys(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."survey_responses" ADD CONSTRAINT "survey_responses_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."surveys" ADD CONSTRAINT "surveys_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."usage_tracking" ADD CONSTRAINT "usage_tracking_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."user_commitments" ADD CONSTRAINT "user_commitments_session_id_fkey" FOREIGN KEY (session_id) REFERENCES coaching_sessions(id) ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."user_commitments" ADD CONSTRAINT "user_commitments_user_id_fkey" FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."user_goals" ADD CONSTRAINT "user_goals_user_id_fkey" FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."user_progress" ADD CONSTRAINT "user_progress_lesson_id_fkey" FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."user_progress" ADD CONSTRAINT "user_progress_user_id_fkey" FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."video_jobs" ADD CONSTRAINT "video_jobs_created_by_fkey" FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public."waitlist_email_events" ADD CONSTRAINT "waitlist_email_events_entry_id_fkey" FOREIGN KEY (entry_id) REFERENCES waitlist_entries(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ==========================================================================
-- Indexes
-- ==========================================================================

CREATE INDEX IF NOT EXISTS audit_logs_action_idx ON public.audit_logs USING btree (action);
CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx ON public.audit_logs USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS audit_logs_user_id_idx ON public.audit_logs USING btree (user_id);
CREATE INDEX IF NOT EXISTS cd_course_idx ON public.course_discussions USING btree (course_id, created_at);
CREATE INDEX IF NOT EXISTS cd_reply_idx ON public.course_discussions USING btree (reply_to_id);
CREATE INDEX IF NOT EXISTS clip_cta_jobs_created_at ON public.clip_cta_jobs USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS clip_cta_jobs_created_by ON public.clip_cta_jobs USING btree (created_by);
CREATE INDEX IF NOT EXISTS clip_cta_jobs_deleted_at ON public.clip_cta_jobs USING btree (deleted_at) WHERE (deleted_at IS NULL);
CREATE INDEX IF NOT EXISTS clip_cta_jobs_status ON public.clip_cta_jobs USING btree (status);
CREATE INDEX IF NOT EXISTS coaching_sessions_type_idx ON public.coaching_sessions USING btree (session_type);
CREATE INDEX IF NOT EXISTS coaching_sessions_user_id_idx ON public.coaching_sessions USING btree (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS community_messages_channel_idx ON public.community_messages USING btree (channel, created_at DESC) WHERE (deleted = false);
CREATE INDEX IF NOT EXISTS community_messages_checkin_lookup ON public.community_messages USING btree (channel, checkin_week) WHERE is_checkin;
CREATE INDEX IF NOT EXISTS community_messages_flagged_idx ON public.community_messages USING btree (flagged, created_at DESC);
CREATE INDEX IF NOT EXISTS community_messages_reply_idx ON public.community_messages USING btree (reply_to_id) WHERE (reply_to_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS content_calendar_pillar_idx ON public.content_calendar USING btree (pillar);
CREATE INDEX IF NOT EXISTS content_calendar_status_idx ON public.content_calendar USING btree (status);
CREATE INDEX IF NOT EXISTS content_calendar_week_idx ON public.content_calendar USING btree (week);
CREATE INDEX IF NOT EXISTS course_notes_user_lesson ON public.course_notes USING btree (user_id, lesson_id);
CREATE INDEX IF NOT EXISTS crp_user_idx ON public.channel_read_positions USING btree (user_id);
CREATE INDEX IF NOT EXISTS er_email_idx ON public.event_registrations USING btree (email);
CREATE INDEX IF NOT EXISTS er_event_idx ON public.event_registrations USING btree (event_id, created_at);
CREATE INDEX IF NOT EXISTS er_status_idx ON public.event_registrations USING btree (status);
CREATE INDEX IF NOT EXISTS expert_sessions_partner_idx ON public.expert_sessions USING btree (partner_id) WHERE (partner_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS expert_sessions_scheduled_idx ON public.expert_sessions USING btree (scheduled_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs USING btree (action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON public.audit_logs USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON public.audit_logs USING btree (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_blog_posts_published ON public.blog_posts USING btree (is_published, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_coaching_sessions_created ON public.coaching_sessions USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cohort_members_cohort ON public.cohort_members USING btree (cohort_id);
CREATE INDEX IF NOT EXISTS idx_cohort_members_user ON public.cohort_members USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_cohort_posts_cohort ON public.cohort_posts USING btree (cohort_id);
CREATE INDEX IF NOT EXISTS idx_cohort_posts_created ON public.cohort_posts USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cohort_replies_post ON public.cohort_replies USING btree (post_id);
CREATE INDEX IF NOT EXISTS idx_cohort_votes_user ON public.cohort_votes USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_cohorts_plan_tier ON public.cohorts USING btree (plan_tier);
CREATE INDEX IF NOT EXISTS idx_commitments_user ON public.user_commitments USING btree (user_id) WHERE (NOT completed);
CREATE INDEX IF NOT EXISTS idx_community_channels_pinned ON public.community_channels USING btree (is_pinned) WHERE (is_pinned = true);
CREATE INDEX IF NOT EXISTS idx_community_channels_type ON public.community_channels USING btree (channel_type);
CREATE INDEX IF NOT EXISTS idx_community_messages_dim_tag ON public.community_messages USING btree (channel, dimension_tag) WHERE (dimension_tag IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_content_calendar_assigned ON public.content_calendar USING btree (assigned_to) WHERE (assigned_to IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_content_calendar_created ON public.content_calendar USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_content_calendar_status ON public.content_calendar USING btree (status);
CREATE INDEX IF NOT EXISTS idx_content_calendar_type ON public.content_calendar USING btree (type);
CREATE INDEX IF NOT EXISTS idx_content_calendar_week ON public.content_calendar USING btree (week DESC);
CREATE INDEX IF NOT EXISTS idx_courses_category ON public.courses USING btree (category);
CREATE INDEX IF NOT EXISTS idx_courses_plan_tier ON public.courses USING btree (plan_tier);
CREATE INDEX IF NOT EXISTS idx_courses_published ON public.courses USING btree (is_published, sort_order);
CREATE INDEX IF NOT EXISTS idx_deletion_requests_status ON public.deletion_requests USING btree (status, requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_deletion_requests_user_id ON public.deletion_requests USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_email_events_created ON public.waitlist_email_events USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_events_entry ON public.waitlist_email_events USING btree (entry_id);
CREATE INDEX IF NOT EXISTS idx_email_events_type ON public.waitlist_email_events USING btree (event_type);
CREATE INDEX IF NOT EXISTS idx_expert_sessions_plan_tier ON public.expert_sessions USING btree (plan_tier);
CREATE INDEX IF NOT EXISTS idx_expert_sessions_scheduled ON public.expert_sessions USING btree (scheduled_at);
CREATE INDEX IF NOT EXISTS idx_expert_sessions_status ON public.expert_sessions USING btree (status);
CREATE INDEX IF NOT EXISTS idx_expert_sessions_status_date ON public.expert_sessions USING btree (status, scheduled_at) WHERE (status = 'scheduled'::text);
CREATE INDEX IF NOT EXISTS idx_job_applications_created ON public.job_applications USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_job_applications_email ON public.job_applications USING btree (email);
CREATE INDEX IF NOT EXISTS idx_job_applications_job_id ON public.job_applications USING btree (job_id);
CREATE INDEX IF NOT EXISTS idx_job_applications_status ON public.job_applications USING btree (status);
CREATE INDEX IF NOT EXISTS idx_job_listings_is_active ON public.job_listings USING btree (is_active);
CREATE INDEX IF NOT EXISTS idx_marketing_repeating_items_section_id ON public.marketing_repeating_items USING btree (section_id);
CREATE INDEX IF NOT EXISTS idx_marketing_repeating_items_sort ON public.marketing_repeating_items USING btree (section_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_marketing_sections_page_id ON public.marketing_sections USING btree (page_id);
CREATE INDEX IF NOT EXISTS idx_marketing_sections_sort ON public.marketing_sections USING btree (page_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications USING btree (user_id, read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON public.notifications USING btree (user_id, read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON public.notifications USING btree (user_id, read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_partner_course_enrollments_course ON public.partner_course_enrollments USING btree (course_id);
CREATE INDEX IF NOT EXISTS idx_partner_course_enrollments_partner ON public.partner_course_enrollments USING btree (partner_id);
CREATE INDEX IF NOT EXISTS idx_partner_courses_partner_id ON public.partner_courses USING btree (partner_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_partner_members_email ON public.partner_members USING btree (partner_id, email);
CREATE INDEX IF NOT EXISTS idx_partner_members_partner ON public.partner_members USING btree (partner_id);
CREATE INDEX IF NOT EXISTS idx_partner_members_user ON public.partner_members USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_partner_members_user_id ON public.partner_members USING btree (user_id) WHERE (user_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_partner_tx_paid_at ON public.partner_transactions USING btree (partner_id, paid_at);
CREATE INDEX IF NOT EXISTS idx_partner_tx_partner ON public.partner_transactions USING btree (partner_id);
CREATE INDEX IF NOT EXISTS idx_partners_custom_domain ON public.partners USING btree (custom_domain) WHERE (custom_domain IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_partners_owner_id ON public.partners USING btree (owner_id);
CREATE INDEX IF NOT EXISTS idx_partners_status ON public.partners USING btree (status);
CREATE INDEX IF NOT EXISTS idx_partners_subdomain ON public.partners USING btree (subdomain);
CREATE INDEX IF NOT EXISTS idx_password_reset_otps_email_created ON public.password_reset_otps USING btree (email, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_attempts_ref ON public.payment_attempts USING btree (reference);
CREATE INDEX IF NOT EXISTS idx_payment_attempts_reference ON public.payment_attempts USING btree (reference);
CREATE INDEX IF NOT EXISTS idx_payment_attempts_user_id ON public.payment_attempts USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_payments_provider_ref ON public.payments USING btree (provider_reference);
CREATE INDEX IF NOT EXISTS idx_payments_reference ON public.payments USING btree (reference);
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON public.payments USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_pb_briefs_created_at ON public.personal_brand_briefs USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pce_completed ON public.partner_course_enrollments USING btree (completed_at) WHERE (completed_at IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_pce_course_id ON public.partner_course_enrollments USING btree (course_id);
CREATE INDEX IF NOT EXISTS idx_pce_partner_id ON public.partner_course_enrollments USING btree (partner_id);
CREATE INDEX IF NOT EXISTS idx_posts_cohort ON public.cohort_posts USING btree (cohort_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_product_purchases_product ON public.product_purchases USING btree (product_id);
CREATE INDEX IF NOT EXISTS idx_product_purchases_user ON public.product_purchases USING btree (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_products_published_sort ON public.products USING btree (published, sort_order);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles USING btree (email);
CREATE INDEX IF NOT EXISTS idx_profiles_onboarding ON public.profiles USING btree (id, onboarding_completed);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles USING btree (role);
CREATE INDEX IF NOT EXISTS idx_profiles_subscription_status ON public.profiles USING btree (subscription_status);
CREATE INDEX IF NOT EXISTS idx_progress_user ON public.user_progress USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_promo_codes_code ON public.promo_codes USING btree (code);
CREATE INDEX IF NOT EXISTS idx_pt_paid_at ON public.partner_transactions USING btree (paid_at);
CREATE INDEX IF NOT EXISTS idx_pt_partner_id ON public.partner_transactions USING btree (partner_id);
CREATE INDEX IF NOT EXISTS idx_push_events_unsent ON public.push_events USING btree (sent, created_at) WHERE (sent = false);
CREATE INDEX IF NOT EXISTS idx_push_subs_user ON public.push_subscriptions USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON public.push_subscriptions USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_research_briefs_pillar ON public.research_briefs USING btree (pillar);
CREATE INDEX IF NOT EXISTS idx_research_briefs_week ON public.research_briefs USING btree (week_number DESC);
CREATE INDEX IF NOT EXISTS idx_session_locations_user_id ON public.session_locations USING btree (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_session_reg_session ON public.session_registrations USING btree (session_id);
CREATE INDEX IF NOT EXISTS idx_session_reg_user ON public.session_registrations USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_session_registrations_session ON public.session_registrations USING btree (session_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON public.coaching_sessions USING btree (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_social_queue_scheduled ON public.social_queue USING btree (scheduled_for);
CREATE INDEX IF NOT EXISTS idx_social_queue_status ON public.social_queue USING btree (status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON public.subscriptions USING btree (status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON public.subscriptions USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_summit_donations_email ON public.summit_donations USING btree (email);
CREATE INDEX IF NOT EXISTS idx_summit_donations_reference ON public.summit_donations USING btree (payment_reference);
CREATE INDEX IF NOT EXISTS idx_summit_donations_status ON public.summit_donations USING btree (status, created_at);
CREATE INDEX IF NOT EXISTS idx_summit_interest_created ON public.summit_interest USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_summit_interest_email ON public.summit_interest USING btree (email);
CREATE INDEX IF NOT EXISTS idx_summit_registrations_email ON public.summit_registrations USING btree (email);
CREATE INDEX IF NOT EXISTS idx_summit_registrations_email_retry ON public.summit_registrations USING btree (payment_status) WHERE ((confirmation_email_error IS NOT NULL) AND (confirmation_email_sent_at IS NULL));
CREATE INDEX IF NOT EXISTS idx_summit_registrations_payment_reference ON public.summit_registrations USING btree (payment_reference);
CREATE INDEX IF NOT EXISTS idx_usage_tracking_user_feature ON public.usage_tracking USING btree (user_id, feature, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_progress_updated ON public.user_progress USING btree (user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_progress_user_id ON public.user_progress USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_waitlist_country ON public.waitlist_entries USING btree (country);
CREATE INDEX IF NOT EXISTS idx_waitlist_created_at ON public.waitlist_entries USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_waitlist_email ON public.waitlist_entries USING btree (email);
CREATE INDEX IF NOT EXISTS idx_waitlist_life_stage ON public.waitlist_entries USING btree (life_stage);
CREATE INDEX IF NOT EXISTS idx_waitlist_position ON public.waitlist_entries USING btree ("position");
CREATE INDEX IF NOT EXISTS idx_waitlist_referral_code ON public.waitlist_entries USING btree (referral_code);
CREATE INDEX IF NOT EXISTS idx_waitlist_referred_by ON public.waitlist_entries USING btree (referred_by_code);
CREATE INDEX IF NOT EXISTS idx_waitlist_search ON public.waitlist_entries USING gin ((((((first_name || ' '::text) || last_name) || ' '::text) || email)) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_waitlist_status ON public.waitlist_entries USING btree (status);
CREATE INDEX IF NOT EXISTS idx_waitlist_utm_source ON public.waitlist_entries USING btree (utm_source);
CREATE INDEX IF NOT EXISTS job_listings_created_at_idx ON public.job_listings USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS job_listings_department_idx ON public.job_listings USING btree (department);
CREATE INDEX IF NOT EXISTS job_listings_is_active_idx ON public.job_listings USING btree (is_active);
CREATE INDEX IF NOT EXISTS knowledge_chunks_embedding_idx ON public.knowledge_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists='100');
CREATE INDEX IF NOT EXISTS knowledge_chunks_mentor_idx ON public.knowledge_chunks USING btree (mentor_slug) WHERE (mentor_slug IS NOT NULL);
CREATE INDEX IF NOT EXISTS knowledge_chunks_mentor_slug_idx ON public.knowledge_chunks USING btree (((metadata ->> 'mentor_slug'::text)));
CREATE INDEX IF NOT EXISTS knowledge_chunks_metadata_idx ON public.knowledge_chunks USING gin (metadata);
CREATE INDEX IF NOT EXISTS knowledge_chunks_namespace_idx ON public.knowledge_chunks USING btree (namespace);
CREATE INDEX IF NOT EXISTS mentor_applications_applied_at_idx ON public.mentor_applications USING btree (applied_at DESC);
CREATE INDEX IF NOT EXISTS mentor_applications_status_idx ON public.mentor_applications USING btree (status);
CREATE INDEX IF NOT EXISTS notifications_created_idx ON public.notifications USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_read_idx ON public.notifications USING btree (user_id, read);
CREATE INDEX IF NOT EXISTS notifications_user_id_idx ON public.notifications USING btree (user_id);
CREATE INDEX IF NOT EXISTS partner_courses_partner_idx ON public.partner_courses USING btree (partner_id);
CREATE INDEX IF NOT EXISTS partner_courses_published_idx ON public.partner_courses USING btree (partner_id, is_published);
CREATE INDEX IF NOT EXISTS partner_enrollment_course_idx ON public.partner_course_enrollments USING btree (course_id);
CREATE INDEX IF NOT EXISTS partner_enrollment_partner_idx ON public.partner_course_enrollments USING btree (partner_id);
CREATE INDEX IF NOT EXISTS partner_enrollment_user_idx ON public.partner_course_enrollments USING btree (user_id);
CREATE INDEX IF NOT EXISTS partner_event_reg_event_idx ON public.partner_event_registrations USING btree (event_id);
CREATE INDEX IF NOT EXISTS partner_event_reg_user_idx ON public.partner_event_registrations USING btree (user_id);
CREATE INDEX IF NOT EXISTS partner_events_partner_idx ON public.partner_events USING btree (partner_id);
CREATE INDEX IF NOT EXISTS partner_events_scheduled_idx ON public.partner_events USING btree (scheduled_at);
CREATE INDEX IF NOT EXISTS partner_events_status_idx ON public.partner_events USING btree (status);
CREATE INDEX IF NOT EXISTS partner_members_email_idx ON public.partner_members USING btree (email);
CREATE INDEX IF NOT EXISTS partner_members_partner_idx ON public.partner_members USING btree (partner_id);
CREATE INDEX IF NOT EXISTS partner_subs_partner_idx ON public.partner_subscriptions USING btree (partner_id);
CREATE INDEX IF NOT EXISTS partner_subs_period_idx ON public.partner_subscriptions USING btree (current_period_end);
CREATE INDEX IF NOT EXISTS partner_subs_status_idx ON public.partner_subscriptions USING btree (status);
CREATE INDEX IF NOT EXISTS partner_tx_paid_idx ON public.partner_transactions USING btree (paid_at DESC);
CREATE INDEX IF NOT EXISTS partner_tx_partner_idx ON public.partner_transactions USING btree (partner_id);
CREATE INDEX IF NOT EXISTS partner_tx_ref_idx ON public.partner_transactions USING btree (paystack_reference);
CREATE INDEX IF NOT EXISTS partner_tx_user_idx ON public.partner_transactions USING btree (user_id);
CREATE INDEX IF NOT EXISTS partners_custom_domain_idx ON public.partners USING btree (custom_domain) WHERE (status = 'active'::text);
CREATE INDEX IF NOT EXISTS partners_owner_idx ON public.partners USING btree (owner_id);
CREATE INDEX IF NOT EXISTS partners_subdomain_idx ON public.partners USING btree (subdomain) WHERE (status = 'active'::text);
CREATE INDEX IF NOT EXISTS payment_attempts_donation_idx ON public.payment_attempts USING btree (donation_id) WHERE (donation_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS payment_attempts_registration_idx ON public.payment_attempts USING btree (registration_id) WHERE (registration_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS payment_attempts_status_created_idx ON public.payment_attempts USING btree (status, created_at);
CREATE INDEX IF NOT EXISTS payments_reference_idx ON public.payments USING btree (reference);
CREATE INDEX IF NOT EXISTS payments_user_id_idx ON public.payments USING btree (user_id);
CREATE INDEX IF NOT EXISTS pe_published_idx ON public.public_events USING btree (is_published, event_date_iso);
CREATE INDEX IF NOT EXISTS pe_slug_idx ON public.public_events USING btree (slug);
CREATE INDEX IF NOT EXISTS platform_snapshots_generated_at_idx ON public.platform_snapshots USING btree (generated_at DESC);
CREATE INDEX IF NOT EXISTS profiles_email_idx ON public.profiles USING btree (email);
CREATE INDEX IF NOT EXISTS profiles_referral_code_idx ON public.profiles USING btree (referral_code);
CREATE INDEX IF NOT EXISTS promo_codes_active_idx ON public.promo_codes USING btree (active);
CREATE INDEX IF NOT EXISTS promo_codes_auto_apply_idx ON public.promo_codes USING btree (auto_apply);
CREATE INDEX IF NOT EXISTS promo_codes_code_idx ON public.promo_codes USING btree (code);
CREATE INDEX IF NOT EXISTS referrals_referred_id_idx ON public.referrals USING btree (referred_id);
CREATE INDEX IF NOT EXISTS referrals_referrer_id_idx ON public.referrals USING btree (referrer_id);
CREATE INDEX IF NOT EXISTS referrals_status_idx ON public.referrals USING btree (status);
CREATE INDEX IF NOT EXISTS social_queue_platform_idx ON public.social_queue USING btree (platform);
CREATE INDEX IF NOT EXISTS social_queue_scheduled_idx ON public.social_queue USING btree (scheduled_for);
CREATE INDEX IF NOT EXISTS social_queue_status_idx ON public.social_queue USING btree (status);
CREATE INDEX IF NOT EXISTS soundtracks_mood_active_idx ON public.soundtracks USING btree (mood, active);
CREATE INDEX IF NOT EXISTS subscriptions_lemon_id_idx ON public.subscriptions USING btree (lemon_subscription_id) WHERE (lemon_subscription_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS video_jobs_client_req_idx ON public.video_jobs USING btree (client_request_id, created_by, created_at DESC);
CREATE INDEX IF NOT EXISTS video_jobs_created_at_idx ON public.video_jobs USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS video_jobs_created_by_idx ON public.video_jobs USING btree (created_by, created_at DESC);
CREATE INDEX IF NOT EXISTS video_jobs_deleted_at_idx ON public.video_jobs USING btree (deleted_at) WHERE (deleted_at IS NULL);
CREATE INDEX IF NOT EXISTS video_jobs_status_idx ON public.video_jobs USING btree (status);
CREATE INDEX IF NOT EXISTS video_jobs_used_preset_idx ON public.video_jobs USING btree (used_preset, created_at DESC) WHERE (used_preset = true);
CREATE UNIQUE INDEX IF NOT EXISTS community_messages_one_checkin_per_channel_week ON public.community_messages USING btree (user_id, channel, checkin_week) WHERE is_checkin;
CREATE UNIQUE INDEX IF NOT EXISTS event_regs_one_per_email ON public.event_registrations USING btree (event_id, lower(email));
CREATE UNIQUE INDEX IF NOT EXISTS idx_blog_posts_slug ON public.blog_posts USING btree (slug);
CREATE UNIQUE INDEX IF NOT EXISTS idx_newsletter_email ON public.newsletter_subscribers USING btree (email);

-- ==========================================================================
-- Functions
-- ==========================================================================

CREATE OR REPLACE FUNCTION public.assign_waitlist_position()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.position := nextval('waitlist_position_seq');
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.check_profile_role_permissions()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  protected_cols text[] := ARRAY[
    'role', 'permissions',
    'subscription_plan', 'subscription_status', 'subscription_start',
    'subscription_end', 'billing_cycle', 'payment_method', 'card_details',
    'paystack_sub_code', 'paystack_customer_code',
    'referral_count'
    -- referral_code / referred_by are intentionally NOT listed: onboarding and
    -- /api/referral write them with the user's own session.
  ];
  old_j jsonb := to_jsonb(OLD);
  new_j jsonb := to_jsonb(NEW);
  col   text;
BEGIN
  IF current_user IN ('authenticated', 'anon') AND NOT public.is_admin() THEN
    FOREACH col IN ARRAY protected_cols LOOP
      IF (new_j -> col) IS DISTINCT FROM (old_j -> col) THEN
        RAISE EXCEPTION 'Column "%" cannot be modified by clients', col
          USING ERRCODE = '42501';
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.claim_promo_code(p_code text, p_validate_only boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_promo promo_codes%ROWTYPE;
BEGIN
  SELECT * INTO v_promo
  FROM promo_codes
  WHERE code = upper(trim(p_code))
    AND active = true
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid');
  END IF;

  IF v_promo.expires_at IS NOT NULL AND v_promo.expires_at < now() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'expired');
  END IF;

  IF v_promo.max_uses IS NOT NULL AND v_promo.current_uses >= v_promo.max_uses THEN
    RETURN jsonb_build_object('ok', false, 'error', 'limit_reached');
  END IF;

  IF p_validate_only THEN
    RETURN jsonb_build_object('ok', true, 'discount', v_promo.discount, 'label', v_promo.label);
  END IF;

  UPDATE promo_codes
  SET current_uses = current_uses + 1
  WHERE id = v_promo.id;

  RETURN jsonb_build_object('ok', true, 'discount', v_promo.discount, 'label', v_promo.label);
END;
$function$;

CREATE OR REPLACE FUNCTION public.claim_promo_code(p_code text)
 RETURNS json
 LANGUAGE plpgsql
AS $function$
DECLARE
  promo promo_codes%ROWTYPE;
BEGIN
  SELECT * INTO promo FROM promo_codes
    WHERE code = p_code AND active = true
    FOR UPDATE;  -- row-level lock

  IF NOT FOUND THEN
    RETURN json_build_object('error', 'invalid');
  END IF;
  IF promo.expires_at IS NOT NULL AND promo.expires_at < now() THEN
    RETURN json_build_object('error', 'expired');
  END IF;
  IF promo.max_uses IS NOT NULL AND promo.current_uses >= promo.max_uses THEN
    RETURN json_build_object('error', 'limit_reached');
  END IF;

  UPDATE promo_codes SET current_uses = current_uses + 1 WHERE id = promo.id;
  RETURN json_build_object('ok', true, 'discount', promo.discount, 'label', promo.label);
END;
$function$;

CREATE OR REPLACE FUNCTION public.confirm_waitlist_email(p_token text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_entry waitlist_entries%ROWTYPE;
BEGIN
  SELECT * INTO v_entry
  FROM public.waitlist_entries
  WHERE confirmation_token = p_token;

  IF NOT FOUND THEN
    RETURN json_build_object('status', 'error', 'message', 'Invalid or expired token');
  END IF;

  IF v_entry.email_confirmed THEN
    RETURN json_build_object('status', 'already_confirmed', 'position', v_entry.position);
  END IF;

  UPDATE public.waitlist_entries
  SET email_confirmed = TRUE,
      confirmed_at    = NOW()
  WHERE id = v_entry.id;

  RETURN json_build_object(
    'status',   'confirmed',
    'name',     v_entry.first_name,
    'position', v_entry.position
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.count_knowledge_chunks_by_mentor()
 RETURNS TABLE(mentor_slug text, chunk_count bigint)
 LANGUAGE sql
 STABLE
AS $function$
  SELECT
    metadata->>'mentor_slug' AS mentor_slug,
    COUNT(*)                 AS chunk_count
  FROM knowledge_chunks
  WHERE metadata->>'mentor_slug' IS NOT NULL
  GROUP BY metadata->>'mentor_slug'
  ORDER BY chunk_count DESC;
$function$;

CREATE OR REPLACE FUNCTION public.create_profile_on_signup()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  INSERT INTO public.profiles (
    id,
    full_name,
    role,
    subscription_plan,
    subscription_status,
    referral_count,
    created_at,
    updated_at
  ) VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    'member',
    'free',
    'free',
    0,
    NOW(),
    NOW()
  );
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.generate_referral_code()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  prefix text;
  code text;
  exists_check boolean;
BEGIN
  -- Use first 3 chars of name, or 'ASC' as fallback
  prefix := UPPER(LEFT(COALESCE(NEW.full_name, 'ASC'), 3));
  
  -- Generate unique code
  LOOP
    code := prefix || '-' || UPPER(SUBSTRING(md5(random()::text) FROM 1 FOR 4));
    SELECT EXISTS(SELECT 1 FROM profiles WHERE referral_code = code) INTO exists_check;
    EXIT WHEN NOT exists_check;
  END LOOP;
  
  NEW.referral_code := code;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_profile_name(uid uuid)
 RETURNS text
 LANGUAGE sql
 SECURITY DEFINER
AS $function$
  SELECT COALESCE(full_name, 'Someone') FROM profiles WHERE id = uid;
$function$;

CREATE OR REPLACE FUNCTION public.get_session_registrant_count(p_session_id uuid)
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
  SELECT COUNT(*)::int FROM session_registrations WHERE session_id = p_session_id;
$function$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  ref_code text;
  name_part text;
  code_exists boolean;
BEGIN
  -- Generate referral code inline
  name_part := UPPER(LEFT(REGEXP_REPLACE(
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'USR'), '[^a-zA-Z]', '', 'g'
  ), 3));
  IF LENGTH(name_part) < 3 THEN
    name_part := name_part || REPEAT('X', 3 - LENGTH(name_part));
  END IF;

  LOOP
    ref_code := name_part || '-' || LPAD(FLOOR(RANDOM() * 10000)::text, 4, '0');
    SELECT EXISTS(SELECT 1 FROM public.profiles WHERE referral_code = ref_code) INTO code_exists;
    EXIT WHEN NOT code_exists;
  END LOOP;

  -- Insert profile
  INSERT INTO public.profiles (
    id, full_name, email, "current_role", industry, goal_role,
    role, subscription_plan, subscription_status,
    referral_count, referral_code, created_at, updated_at
  ) VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'New User'),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'current_role', ''),
    COALESCE(NEW.raw_user_meta_data->>'industry', ''),
    COALESCE(NEW.raw_user_meta_data->>'goal_role', ''),
    'member',
    'free',
    'free',
    0,
    ref_code,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.increment_post_upvotes(post_id uuid, delta integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  UPDATE cohort_posts
  SET upvotes = GREATEST(0, COALESCE(upvotes, 0) + delta)
  WHERE id = post_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.increment_promo_usage(promo_id_input uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE promo_codes
  SET current_uses = current_uses + 1
  WHERE id = promo_id_input;
END;
$function$;

CREATE OR REPLACE FUNCTION public.increment_referral_count()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.referred_by_code IS NOT NULL THEN
    UPDATE public.waitlist_entries
    SET referral_count = referral_count + 1
    WHERE referral_code = NEW.referred_by_code;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.increment_reply_upvotes(reply_id uuid, delta integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  UPDATE cohort_replies
  SET upvotes = GREATEST(0, COALESCE(upvotes, 0) + delta)
  WHERE id = reply_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$function$;

CREATE OR REPLACE FUNCTION public.is_moderator()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'moderator'
  );
$function$;

CREATE OR REPLACE FUNCTION public.is_moderator_or_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role IN ('admin', 'moderator')
  );
$function$;

CREATE OR REPLACE FUNCTION public.match_chunks(query_embedding vector, match_count integer DEFAULT 20, filter jsonb DEFAULT '{}'::jsonb)
 RETURNS TABLE(id uuid, content text, metadata jsonb, similarity double precision)
 LANGUAGE sql
 STABLE
AS $function$
  select
    id,
    content,
    metadata,
    1 - (embedding <=> query_embedding) as similarity
  from knowledge_chunks
  where metadata @> filter
  order by embedding <=> query_embedding
  limit match_count;
$function$;

CREATE OR REPLACE FUNCTION public.match_knowledge_chunks(query_embedding vector, match_count integer, filter_namespace text DEFAULT NULL::text, filter_metadata jsonb DEFAULT NULL::jsonb)
 RETURNS TABLE(id text, namespace text, text text, metadata jsonb, similarity double precision)
 LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    kc.id,
    kc.namespace,
    kc.text,
    kc.metadata,
    1 - (kc.embedding <=> query_embedding) AS similarity
  FROM knowledge_chunks kc
  WHERE
    (filter_namespace IS NULL OR kc.namespace = filter_namespace)
    AND kc.embedding IS NOT NULL
  ORDER BY kc.embedding <=> query_embedding
  LIMIT match_count;
END;
$function$;

CREATE OR REPLACE FUNCTION public.match_knowledge_chunks(query_embedding vector, match_count integer DEFAULT 10, filter_namespace text DEFAULT NULL::text, filter_metadata jsonb DEFAULT '{}'::jsonb, filter_mentor text DEFAULT NULL::text)
 RETURNS TABLE(chunk_id text, content text, metadata jsonb, namespace text, mentor_slug text, similarity double precision)
 LANGUAGE sql
 STABLE
AS $function$
  select
    kc.chunk_id,
    kc.content,
    kc.metadata,
    kc.namespace,
    kc.mentor_slug,
    1 - (kc.embedding <=> query_embedding) as similarity
  from knowledge_chunks kc
  where
    (filter_namespace is null or kc.namespace = filter_namespace)
    and (filter_metadata = '{}' or kc.metadata @> filter_metadata)
    and (filter_mentor is null or kc.mentor_slug = filter_mentor)
  order by kc.embedding <=> query_embedding
  limit match_count;
$function$;

CREATE OR REPLACE FUNCTION public.notify_new_post()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  actor_name    text;
  cohort_name   text;
  member_record RECORD;
  member_count  int;
BEGIN
  SELECT COUNT(*) INTO member_count
  FROM cohort_members WHERE cohort_id = NEW.cohort_id;

  -- Skip notification blast for very large circles
  IF member_count > 200 THEN RETURN NEW; END IF;

  actor_name  := get_profile_name(NEW.user_id);
  SELECT name INTO cohort_name FROM cohorts WHERE id = NEW.cohort_id;

  -- Notify all members except the poster
  FOR member_record IN
    SELECT user_id FROM cohort_members
    WHERE cohort_id = NEW.cohort_id AND user_id != NEW.user_id
  LOOP
    INSERT INTO push_events (recipient_id, actor_id, event_type, title, body, url)
    VALUES (
      member_record.user_id,
      NEW.user_id,
      'new_post',
      actor_name || ' posted in ' || COALESCE(cohort_name, 'your circle'),
      LEFT(NEW.content, 80) || CASE WHEN LENGTH(NEW.content) > 80 THEN '…' ELSE '' END,
      '/community/' || NEW.cohort_id
    );
  END LOOP;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.notify_new_reply()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  post_record RECORD;
  actor_name  text;
BEGIN
  SELECT * INTO post_record FROM cohort_posts WHERE id = NEW.post_id;
  IF NOT FOUND THEN RETURN NEW; END IF;

  -- Don't notify if user is replying to their own post
  IF post_record.user_id = NEW.user_id THEN RETURN NEW; END IF;

  actor_name := get_profile_name(NEW.user_id);

  INSERT INTO push_events (recipient_id, actor_id, event_type, title, body, url)
  VALUES (
    post_record.user_id,
    NEW.user_id,
    'post_reply',
    actor_name || ' replied to your post',
    LEFT(NEW.content, 80) || CASE WHEN LENGTH(NEW.content) > 80 THEN '…' ELSE '' END,
    '/community/' || post_record.cohort_id
  );

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.notify_post_upvote()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  post_record   RECORD;
  actor_name    text;
  cohort_record RECORD;
BEGIN
  -- Get the post being upvoted
  SELECT * INTO post_record FROM cohort_posts WHERE id = NEW.post_id;
  IF NOT FOUND THEN RETURN NEW; END IF;

  -- Don't notify if user is upvoting their own post
  IF post_record.user_id = NEW.user_id THEN RETURN NEW; END IF;

  actor_name    := get_profile_name(NEW.user_id);
  SELECT name INTO cohort_record FROM cohorts WHERE id = post_record.cohort_id;

  INSERT INTO push_events (recipient_id, actor_id, event_type, title, body, url)
  VALUES (
    post_record.user_id,
    NEW.user_id,
    'post_upvote',
    actor_name || ' liked your post',
    '"' || LEFT(post_record.content, 60) || CASE WHEN LENGTH(post_record.content) > 60 THEN '…' ELSE '' END || '"',
    '/community/' || post_record.cohort_id
  );

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.notify_reply_upvote()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  reply_record  RECORD;
  post_record   RECORD;
  actor_name    text;
BEGIN
  SELECT * INTO reply_record FROM cohort_replies WHERE id = NEW.reply_id;
  IF NOT FOUND THEN RETURN NEW; END IF;
  IF reply_record.user_id = NEW.user_id THEN RETURN NEW; END IF;

  SELECT cohort_id INTO post_record FROM cohort_posts WHERE id = reply_record.post_id;
  actor_name := get_profile_name(NEW.user_id);

  INSERT INTO push_events (recipient_id, actor_id, event_type, title, body, url)
  VALUES (
    reply_record.user_id,
    NEW.user_id,
    'reply_upvote',
    actor_name || ' liked your reply',
    '"' || LEFT(reply_record.content, 60) || CASE WHEN LENGTH(reply_record.content) > 60 THEN '…' ELSE '' END || '"',
    '/community/' || post_record.cohort_id
  );

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.process_referral_reward(referred_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  ref_record referrals%ROWTYPE;
BEGIN
  -- Find the referral
  SELECT * INTO ref_record FROM referrals WHERE referred_id = referred_user_id AND status != 'rewarded' LIMIT 1;
  
  IF NOT FOUND THEN RETURN; END IF;
  
  -- Reward the referrer: extend trial by 7 days
  UPDATE profiles
  SET subscription_end = GREATEST(COALESCE(subscription_end, now()), now()) + interval '7 days'
  WHERE id = ref_record.referrer_id;
  
  -- Reward the referred: extend trial by 7 days
  UPDATE profiles
  SET subscription_end = GREATEST(COALESCE(subscription_end, now()), now()) + interval '7 days'
  WHERE id = referred_user_id;
  
  -- Update referral record
  UPDATE referrals
  SET status = 'rewarded',
      referrer_reward = '7_days_free',
      referred_reward = '7_days_free',
      rewarded_at = now()
  WHERE id = ref_record.id;
  
  -- Increment referrer count
  UPDATE profiles
  SET referral_count = COALESCE(referral_count, 0) + 1
  WHERE id = ref_record.referrer_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.submit_waitlist_entry(p_first_name text, p_last_name text, p_email text, p_whatsapp text, p_life_stage text DEFAULT 'builder'::text, p_country text DEFAULT NULL::text, p_industry text DEFAULT NULL::text, p_referral_source text DEFAULT NULL::text, p_utm_source text DEFAULT NULL::text, p_utm_medium text DEFAULT NULL::text, p_utm_campaign text DEFAULT NULL::text, p_referred_by text DEFAULT NULL::text, p_ip_address inet DEFAULT NULL::inet, p_user_agent text DEFAULT NULL::text, p_landing_page text DEFAULT NULL::text, p_consent boolean DEFAULT false)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_entry   waitlist_entries%ROWTYPE;
  v_exists  BOOLEAN;
BEGIN
  -- Normalise email
  p_email := lower(trim(p_email));

  -- Check duplicate
  SELECT EXISTS (
    SELECT 1 FROM public.waitlist_entries WHERE email = p_email
  ) INTO v_exists;

  IF v_exists THEN
    SELECT * INTO v_entry FROM public.waitlist_entries WHERE email = p_email;
    RETURN json_build_object(
      'status',    'duplicate',
      'message',   'You are already on the waitlist!',
      'position',  v_entry.position
    );
  END IF;

  -- Insert new entry
  INSERT INTO public.waitlist_entries (
    first_name, last_name, email, whatsapp,
    life_stage, country, industry,
    referral_source,
    utm_source, utm_medium, utm_campaign,
    referred_by_code,
    ip_address, user_agent, landing_page,
    consent_given, consent_at
  ) VALUES (
    p_first_name, p_last_name, p_email, p_whatsapp,
    p_life_stage, p_country, p_industry,
    p_referral_source,
    p_utm_source, p_utm_medium, p_utm_campaign,
    p_referred_by,
    p_ip_address, p_user_agent, p_landing_page,
    p_consent, CASE WHEN p_consent THEN NOW() ELSE NULL END
  )
  RETURNING * INTO v_entry;

  RETURN json_build_object(
    'status',           'success',
    'message',          'Welcome to the waitlist!',
    'position',         v_entry.position,
    'referral_code',    v_entry.referral_code,
    'confirmation_token', v_entry.confirmation_token
  );

EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object(
    'status',  'error',
    'message', SQLERRM
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.sync_cohort_member_count()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  affected_cohort_id uuid;
BEGIN
  -- On INSERT use NEW, on DELETE use OLD
  affected_cohort_id := COALESCE(NEW.cohort_id, OLD.cohort_id);

  UPDATE cohorts
  SET member_count = (
    SELECT COUNT(*)::int
    FROM cohort_members
    WHERE cohort_id = affected_cohort_id
  )
  WHERE id = affected_cohort_id;

  RETURN NULL; -- AFTER trigger, return value is ignored
END;
$function$;

CREATE OR REPLACE FUNCTION public.sync_partner_member_count()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    UPDATE partners
    SET active_member_count = (
      SELECT COUNT(*) FROM partner_members
      WHERE partner_id = NEW.partner_id AND status = 'active'
    )
    WHERE id = NEW.partner_id;
  END IF;
  IF TG_OP = 'DELETE' THEN
    UPDATE partners
    SET active_member_count = (
      SELECT COUNT(*) FROM partner_members
      WHERE partner_id = OLD.partner_id AND status = 'active'
    )
    WHERE id = OLD.partner_id;
  END IF;
  RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.sync_profile_email()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  UPDATE profiles SET email = NEW.email WHERE id = NEW.id;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_cohort_member_count()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE cohorts
    SET member_count = COALESCE(member_count, 0) + 1
    WHERE id = NEW.cohort_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE cohorts
    SET member_count = GREATEST(COALESCE(member_count, 0) - 1, 0)
    WHERE id = OLD.cohort_id;
  END IF;
  RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_post_reply_count()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE cohort_posts SET reply_count = reply_count + 1 WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE cohort_posts SET reply_count = GREATEST(0, reply_count - 1) WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_products_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END
$function$;

CREATE OR REPLACE FUNCTION public.use_promo_code(input_code text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  UPDATE promo_codes
  SET current_uses = current_uses + 1
  WHERE code = UPPER(input_code);
END;
$function$;

CREATE OR REPLACE FUNCTION public.validate_promo_code(input_code text)
 RETURNS TABLE(promo_id uuid, code text, discount_percent integer, promo_type text, is_valid boolean, error_message text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  promo RECORD;
BEGIN
  SELECT * INTO promo
  FROM promo_codes pc
  WHERE UPPER(pc.code) = UPPER(input_code)
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN QUERY SELECT NULL::UUID, input_code, 0, ''::TEXT, FALSE, 'Invalid promo code'::TEXT;
    RETURN;
  END IF;

  IF NOT promo.is_active THEN
    RETURN QUERY SELECT promo.id, promo.code, 0, promo.promo_type, FALSE, 'This promo code is no longer active'::TEXT;
    RETURN;
  END IF;

  IF promo.expires_at IS NOT NULL AND promo.expires_at < NOW() THEN
    RETURN QUERY SELECT promo.id, promo.code, 0, promo.promo_type, FALSE, 'This promo code has expired'::TEXT;
    RETURN;
  END IF;

  IF promo.max_uses IS NOT NULL AND promo.current_uses >= promo.max_uses THEN
    RETURN QUERY SELECT promo.id, promo.code, 0, promo.promo_type, FALSE, 'This promo code has reached its usage limit'::TEXT;
    RETURN;
  END IF;

  RETURN QUERY SELECT promo.id, promo.code, promo.discount_percent, promo.promo_type, TRUE, NULL::TEXT;
END;
$function$;

CREATE OR REPLACE FUNCTION public.validate_promo_code(input_code text, plan_id text DEFAULT 'standard'::text)
 RETURNS TABLE(valid boolean, discount numeric, label text, is_free boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    true AS valid,
    pc.discount,
    pc.label,
    (pc.discount >= 1.0) AS is_free
  FROM promo_codes pc
  WHERE pc.code = UPPER(input_code)
    AND pc.active = true
    AND (pc.max_uses IS NULL OR pc.current_uses < pc.max_uses)
    AND (pc.expires_at IS NULL OR pc.expires_at > now())
    AND plan_id = ANY(pc.applies_to);

  -- If no rows returned, return invalid
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 0::decimal, ''::text, false;
  END IF;
END;
$function$;


-- ==========================================================================
-- Views
-- ==========================================================================

CREATE OR REPLACE VIEW public."job_applications_with_listing" AS  SELECT a.id,
    a.job_id,
    a.job_title,
    a.department,
    a.full_name,
    a.email,
    a.phone,
    a.location,
    a.linkedin_url,
    a.portfolio_url,
    a.cover_letter,
    a.years_experience,
    a.how_did_you_hear,
    a.cv_url,
    a.cv_filename,
    a.cv_storage_path,
    a.status,
    a.admin_notes,
    a.created_at,
    a.updated_at,
    j.title AS listing_title,
    j.department AS listing_department,
    j.is_active AS listing_is_active
   FROM job_applications a
     LEFT JOIN job_listings j ON j.id = a.job_id
  ORDER BY a.created_at DESC;

CREATE OR REPLACE VIEW public."waitlist_by_country" AS  SELECT country,
    count(*) AS total,
    count(*) FILTER (WHERE life_stage = 'explorer'::text) AS explorers,
    count(*) FILTER (WHERE life_stage = 'builder'::text) AS builders,
    count(*) FILTER (WHERE life_stage = 'climber'::text) AS climbers,
    round(count(*)::numeric / sum(count(*)) OVER () * 100::numeric, 1) AS pct
   FROM waitlist_entries
  WHERE gdpr_delete_requested = false
  GROUP BY country
  ORDER BY (count(*)) DESC;

CREATE OR REPLACE VIEW public."waitlist_by_source" AS  SELECT COALESCE(utm_source, referral_source, 'direct'::text) AS source,
    utm_medium,
    utm_campaign,
    count(*) AS signups,
    count(*) FILTER (WHERE email_confirmed = true) AS confirmed,
    count(*) FILTER (WHERE status = 'converted'::text) AS converted,
    round(count(*) FILTER (WHERE status = 'converted'::text)::numeric / NULLIF(count(*), 0)::numeric * 100::numeric, 1) AS conversion_rate_pct
   FROM waitlist_entries
  WHERE gdpr_delete_requested = false
  GROUP BY (COALESCE(utm_source, referral_source, 'direct'::text)), utm_medium, utm_campaign
  ORDER BY (count(*)) DESC;

CREATE OR REPLACE VIEW public."waitlist_daily_signups" AS  SELECT date_trunc('day'::text, created_at)::date AS signup_date,
    count(*) AS new_signups,
    sum(count(*)) OVER (ORDER BY (date_trunc('day'::text, created_at))) AS cumulative_total
   FROM waitlist_entries
  WHERE gdpr_delete_requested = false
  GROUP BY (date_trunc('day'::text, created_at))
  ORDER BY (date_trunc('day'::text, created_at)::date) DESC;

CREATE OR REPLACE VIEW public."waitlist_stats" AS  SELECT count(*) AS total_signups,
    count(*) FILTER (WHERE status = 'waiting'::text) AS waiting,
    count(*) FILTER (WHERE status = 'invited'::text) AS invited,
    count(*) FILTER (WHERE status = 'converted'::text) AS converted,
    count(*) FILTER (WHERE email_confirmed = true) AS email_confirmed,
    count(*) FILTER (WHERE whatsapp IS NOT NULL) AS has_whatsapp,
    count(*) FILTER (WHERE life_stage = 'explorer'::text) AS explorers,
    count(*) FILTER (WHERE life_stage = 'builder'::text) AS builders,
    count(*) FILTER (WHERE life_stage = 'climber'::text) AS climbers,
    count(*) FILTER (WHERE created_at > (now() - '24:00:00'::interval)) AS signups_24h,
    count(*) FILTER (WHERE created_at > (now() - '7 days'::interval)) AS signups_7d,
    count(*) FILTER (WHERE created_at > (now() - '30 days'::interval)) AS signups_30d,
    round(count(*) FILTER (WHERE status = 'converted'::text)::numeric / NULLIF(count(*), 0)::numeric * 100::numeric, 1) AS conversion_rate_pct
   FROM waitlist_entries
  WHERE gdpr_delete_requested = false;

CREATE OR REPLACE VIEW public."waitlist_top_referrers" AS  SELECT (first_name || ' '::text) || last_name AS name,
    email,
    referral_code,
    referral_count,
    "position",
    life_stage
   FROM waitlist_entries w
  WHERE referral_count > 0 AND gdpr_delete_requested = false
  ORDER BY referral_count DESC
 LIMIT 50;


-- ==========================================================================
-- Triggers
-- ==========================================================================

DROP TRIGGER IF EXISTS "on_auth_user_created" ON auth."users";
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION sync_profile_email();
DROP TRIGGER IF EXISTS "on_auth_user_email_updated" ON auth."users";
CREATE TRIGGER on_auth_user_email_updated AFTER UPDATE OF email ON auth.users FOR EACH ROW EXECUTE FUNCTION sync_profile_email();
DROP TRIGGER IF EXISTS "set_updated_at" ON public."blog_posts";
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.blog_posts FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS "set_updated_at" ON public."coaching_sessions";
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.coaching_sessions FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS "on_cohort_member_change" ON public."cohort_members";
CREATE TRIGGER on_cohort_member_change AFTER INSERT OR DELETE ON public.cohort_members FOR EACH ROW EXECUTE FUNCTION update_cohort_member_count();
DROP TRIGGER IF EXISTS "trg_cohort_member_count" ON public."cohort_members";
CREATE TRIGGER trg_cohort_member_count AFTER INSERT OR DELETE ON public.cohort_members FOR EACH ROW EXECUTE FUNCTION update_cohort_member_count();
DROP TRIGGER IF EXISTS "trg_sync_cohort_member_count" ON public."cohort_members";
CREATE TRIGGER trg_sync_cohort_member_count AFTER INSERT OR DELETE ON public.cohort_members FOR EACH ROW EXECUTE FUNCTION sync_cohort_member_count();
DROP TRIGGER IF EXISTS "trg_notify_new_post" ON public."cohort_posts";
CREATE TRIGGER trg_notify_new_post AFTER INSERT ON public.cohort_posts FOR EACH ROW EXECUTE FUNCTION notify_new_post();
DROP TRIGGER IF EXISTS "on_reply_change" ON public."cohort_replies";
CREATE TRIGGER on_reply_change AFTER INSERT OR DELETE ON public.cohort_replies FOR EACH ROW EXECUTE FUNCTION update_post_reply_count();
DROP TRIGGER IF EXISTS "trg_notify_reply" ON public."cohort_replies";
CREATE TRIGGER trg_notify_reply AFTER INSERT ON public.cohort_replies FOR EACH ROW EXECUTE FUNCTION notify_new_reply();
DROP TRIGGER IF EXISTS "trg_notify_post_upvote" ON public."cohort_votes";
CREATE TRIGGER trg_notify_post_upvote AFTER INSERT ON public.cohort_votes FOR EACH ROW WHEN ((new.post_id IS NOT NULL)) EXECUTE FUNCTION notify_post_upvote();
DROP TRIGGER IF EXISTS "trg_notify_reply_upvote" ON public."cohort_votes";
CREATE TRIGGER trg_notify_reply_upvote AFTER INSERT ON public.cohort_votes FOR EACH ROW WHEN ((new.reply_id IS NOT NULL)) EXECUTE FUNCTION notify_reply_upvote();
DROP TRIGGER IF EXISTS "set_updated_at" ON public."event_registrations";
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.event_registrations FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS "job_applications_updated_at" ON public."job_applications";
CREATE TRIGGER job_applications_updated_at BEFORE UPDATE ON public.job_applications FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS "job_listings_updated_at" ON public."job_listings";
CREATE TRIGGER job_listings_updated_at BEFORE UPDATE ON public.job_listings FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS "set_updated_at" ON public."marketing_pages";
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.marketing_pages FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS "trg_marketing_pages_updated_at" ON public."marketing_pages";
CREATE TRIGGER trg_marketing_pages_updated_at BEFORE UPDATE ON public.marketing_pages FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS "set_updated_at" ON public."marketing_repeating_items";
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.marketing_repeating_items FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS "trg_marketing_repeating_items_updated_at" ON public."marketing_repeating_items";
CREATE TRIGGER trg_marketing_repeating_items_updated_at BEFORE UPDATE ON public.marketing_repeating_items FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS "set_updated_at" ON public."marketing_sections";
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.marketing_sections FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS "trg_marketing_sections_updated_at" ON public."marketing_sections";
CREATE TRIGGER trg_marketing_sections_updated_at BEFORE UPDATE ON public.marketing_sections FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS "mentor_applications_updated_at" ON public."mentor_applications";
CREATE TRIGGER mentor_applications_updated_at BEFORE UPDATE ON public.mentor_applications FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS "set_updated_at" ON public."mentor_profiles";
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.mentor_profiles FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS "set_updated_at" ON public."newsletter_queue";
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.newsletter_queue FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS "partner_courses_updated_at" ON public."partner_courses";
CREATE TRIGGER partner_courses_updated_at BEFORE UPDATE ON public.partner_courses FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS "partner_events_updated_at" ON public."partner_events";
CREATE TRIGGER partner_events_updated_at BEFORE UPDATE ON public.partner_events FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS "partner_members_count_sync" ON public."partner_members";
CREATE TRIGGER partner_members_count_sync AFTER INSERT OR DELETE OR UPDATE ON public.partner_members FOR EACH ROW EXECUTE FUNCTION sync_partner_member_count();
DROP TRIGGER IF EXISTS "partner_subs_updated_at" ON public."partner_subscriptions";
CREATE TRIGGER partner_subs_updated_at BEFORE UPDATE ON public.partner_subscriptions FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS "partners_updated_at" ON public."partners";
CREATE TRIGGER partners_updated_at BEFORE UPDATE ON public.partners FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS "trg_products_updated_at" ON public."products";
CREATE TRIGGER trg_products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION update_products_updated_at();
DROP TRIGGER IF EXISTS "check_profile_role_permissions" ON public."profiles";
CREATE TRIGGER check_profile_role_permissions BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION check_profile_role_permissions();
DROP TRIGGER IF EXISTS "profiles_updated_at" ON public."profiles";
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS "set_updated_at" ON public."public_events";
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.public_events FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS "scheduled_posts_updated_at" ON public."scheduled_posts";
CREATE TRIGGER scheduled_posts_updated_at BEFORE UPDATE ON public.scheduled_posts FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS "user_progress_updated_at" ON public."user_progress";
CREATE TRIGGER user_progress_updated_at BEFORE UPDATE ON public.user_progress FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS "trg_assign_position" ON public."waitlist_entries";
CREATE TRIGGER trg_assign_position BEFORE INSERT ON public.waitlist_entries FOR EACH ROW EXECUTE FUNCTION assign_waitlist_position();
DROP TRIGGER IF EXISTS "trg_referral_count" ON public."waitlist_entries";
CREATE TRIGGER trg_referral_count AFTER INSERT ON public.waitlist_entries FOR EACH ROW EXECUTE FUNCTION increment_referral_count();
DROP TRIGGER IF EXISTS "trg_updated_at" ON public."waitlist_entries";
CREATE TRIGGER trg_updated_at BEFORE UPDATE ON public.waitlist_entries FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ==========================================================================
-- Row Level Security
-- ==========================================================================

ALTER TABLE public."audit_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."blog_posts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."channel_read_positions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."circle_members" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."clip_cta_jobs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."coaching_sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."cohort_comments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."cohort_members" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."cohort_posts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."cohort_replies" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."cohort_votes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."cohorts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."community_categories" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."community_channels" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."community_messages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."community_prompts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."contact_messages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."content_calendar" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."course_discussions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."course_notes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."courses" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."deletion_requests" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."event_registrations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."expert_registrations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."expert_sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."guardsmann_applications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."guardsmann_jobs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."job_applications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."job_listings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."knowledge_chunks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."lead_magnet_downloads" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."lead_magnets" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."lessons" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."marketing_pages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."marketing_repeating_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."marketing_sections" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."mentor_applications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."mentor_profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."newsletter_queue" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."newsletter_subscribers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."notifications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."partner_course_enrollments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."partner_courses" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."partner_enquiries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."partner_event_registrations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."partner_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."partner_members" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."partner_subscriptions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."partner_transactions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."partners" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."password_reset_otps" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."payment_attempts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."payments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."personal_brand_briefs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."platform_settings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."platform_snapshots" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."post_likes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."product_purchases" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."products" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."promo_codes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."public_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."push_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."push_subscriptions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."rail_billboards" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."referrals" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."research_briefs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."scheduled_posts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."sent_newsletters" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."session_locations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."session_registrations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."social_queue" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."soundtracks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."subscriptions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."summit_donations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."summit_interest" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."summit_registrations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."survey_analyses" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."survey_responses" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."surveys" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."usage_tracking" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."user_commitments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."user_goals" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."user_progress" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."video_jobs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."waitlist_email_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."waitlist_entries" ENABLE ROW LEVEL SECURITY;

-- ==========================================================================
-- Policies
-- ==========================================================================

DROP POLICY IF EXISTS "Admins can read audit logs" ON public."audit_logs";
CREATE POLICY "Admins can read audit logs" ON public."audit_logs" AS PERMISSIVE FOR SELECT TO public USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))));
DROP POLICY IF EXISTS "Users read own audit logs" ON public."audit_logs";
CREATE POLICY "Users read own audit logs" ON public."audit_logs" AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "admin_all" ON public."audit_logs";
CREATE POLICY "admin_all" ON public."audit_logs" AS PERMISSIVE FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "admin_audit_logs_select" ON public."audit_logs";
CREATE POLICY "admin_audit_logs_select" ON public."audit_logs" AS PERMISSIVE FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['admin'::text, 'moderator'::text, 'root_admin'::text]))))));
DROP POLICY IF EXISTS "audit_logs_insert_own" ON public."audit_logs";
CREATE POLICY "audit_logs_insert_own" ON public."audit_logs" AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));
DROP POLICY IF EXISTS "admin_all" ON public."blog_posts";
CREATE POLICY "admin_all" ON public."blog_posts" AS PERMISSIVE FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "blog_posts_anon_read" ON public."blog_posts";
CREATE POLICY "blog_posts_anon_read" ON public."blog_posts" AS PERMISSIVE FOR SELECT TO anon USING ((is_published = true));
DROP POLICY IF EXISTS "blog_posts_create" ON public."blog_posts";
CREATE POLICY "blog_posts_create" ON public."blog_posts" AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((( SELECT profiles.role
   FROM profiles
  WHERE (profiles.id = auth.uid())) = ANY (ARRAY['admin'::text, 'moderator'::text])));
DROP POLICY IF EXISTS "blog_posts_destroy" ON public."blog_posts";
CREATE POLICY "blog_posts_destroy" ON public."blog_posts" AS PERMISSIVE FOR DELETE TO authenticated USING ((( SELECT profiles.role
   FROM profiles
  WHERE (profiles.id = auth.uid())) = 'admin'::text));
DROP POLICY IF EXISTS "blog_posts_modify" ON public."blog_posts";
CREATE POLICY "blog_posts_modify" ON public."blog_posts" AS PERMISSIVE FOR UPDATE TO authenticated USING ((( SELECT profiles.role
   FROM profiles
  WHERE (profiles.id = auth.uid())) = ANY (ARRAY['admin'::text, 'moderator'::text])));
DROP POLICY IF EXISTS "blog_posts_read" ON public."blog_posts";
CREATE POLICY "blog_posts_read" ON public."blog_posts" AS PERMISSIVE FOR SELECT TO authenticated USING (((is_published = true) OR (( SELECT profiles.role
   FROM profiles
  WHERE (profiles.id = auth.uid())) = ANY (ARRAY['admin'::text, 'moderator'::text]))));
DROP POLICY IF EXISTS "public_read" ON public."blog_posts";
CREATE POLICY "public_read" ON public."blog_posts" AS PERMISSIVE FOR SELECT TO anon, authenticated USING ((is_published = true));
DROP POLICY IF EXISTS "admin_all" ON public."channel_read_positions";
CREATE POLICY "admin_all" ON public."channel_read_positions" AS PERMISSIVE FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "crp_select" ON public."channel_read_positions";
CREATE POLICY "crp_select" ON public."channel_read_positions" AS PERMISSIVE FOR SELECT TO authenticated USING ((user_id = auth.uid()));
DROP POLICY IF EXISTS "crp_update" ON public."channel_read_positions";
CREATE POLICY "crp_update" ON public."channel_read_positions" AS PERMISSIVE FOR UPDATE TO authenticated USING ((user_id = auth.uid()));
DROP POLICY IF EXISTS "crp_upsert" ON public."channel_read_positions";
CREATE POLICY "crp_upsert" ON public."channel_read_positions" AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));
DROP POLICY IF EXISTS "admin_all" ON public."circle_members";
CREATE POLICY "admin_all" ON public."circle_members" AS PERMISSIVE FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "cm_join" ON public."circle_members";
CREATE POLICY "cm_join" ON public."circle_members" AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));
DROP POLICY IF EXISTS "cm_leave" ON public."circle_members";
CREATE POLICY "cm_leave" ON public."circle_members" AS PERMISSIVE FOR DELETE TO authenticated USING ((user_id = auth.uid()));
DROP POLICY IF EXISTS "cm_read" ON public."circle_members";
CREATE POLICY "cm_read" ON public."circle_members" AS PERMISSIVE FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "admin_all" ON public."clip_cta_jobs";
CREATE POLICY "admin_all" ON public."clip_cta_jobs" AS PERMISSIVE FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "admins_own_clip_cta_jobs" ON public."clip_cta_jobs";
CREATE POLICY "admins_own_clip_cta_jobs" ON public."clip_cta_jobs" AS PERMISSIVE FOR ALL TO public USING (((created_by = auth.uid()) AND (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text))))));
DROP POLICY IF EXISTS "admin_all" ON public."coaching_sessions";
CREATE POLICY "admin_all" ON public."coaching_sessions" AS PERMISSIVE FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "coaching_read" ON public."coaching_sessions";
CREATE POLICY "coaching_read" ON public."coaching_sessions" AS PERMISSIVE FOR SELECT TO authenticated USING (((auth.uid() = user_id) OR (( SELECT profiles.role
   FROM profiles
  WHERE (profiles.id = auth.uid())) = ANY (ARRAY['admin'::text, 'moderator'::text]))));
DROP POLICY IF EXISTS "cs_insert" ON public."coaching_sessions";
CREATE POLICY "cs_insert" ON public."coaching_sessions" AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));
DROP POLICY IF EXISTS "cs_select" ON public."coaching_sessions";
CREATE POLICY "cs_select" ON public."coaching_sessions" AS PERMISSIVE FOR SELECT TO authenticated USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "cs_update" ON public."coaching_sessions";
CREATE POLICY "cs_update" ON public."coaching_sessions" AS PERMISSIVE FOR UPDATE TO authenticated USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "own_all" ON public."coaching_sessions";
CREATE POLICY "own_all" ON public."coaching_sessions" AS PERMISSIVE FOR ALL TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));
DROP POLICY IF EXISTS "sessions_insert" ON public."coaching_sessions";
CREATE POLICY "sessions_insert" ON public."coaching_sessions" AS PERMISSIVE FOR INSERT TO public WITH CHECK ((auth.uid() = user_id));
DROP POLICY IF EXISTS "sessions_select" ON public."coaching_sessions";
CREATE POLICY "sessions_select" ON public."coaching_sessions" AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "sessions_update" ON public."coaching_sessions";
CREATE POLICY "sessions_update" ON public."coaching_sessions" AS PERMISSIVE FOR UPDATE TO public USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "admin_all" ON public."cohort_comments";
CREATE POLICY "admin_all" ON public."cohort_comments" AS PERMISSIVE FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "comments_insert" ON public."cohort_comments";
CREATE POLICY "comments_insert" ON public."cohort_comments" AS PERMISSIVE FOR INSERT TO public WITH CHECK ((auth.uid() = user_id));
DROP POLICY IF EXISTS "comments_select" ON public."cohort_comments";
CREATE POLICY "comments_select" ON public."cohort_comments" AS PERMISSIVE FOR SELECT TO public USING ((post_id IN ( SELECT cohort_posts.id
   FROM cohort_posts
  WHERE (cohort_posts.cohort_id IN ( SELECT cohort_members.cohort_id
           FROM cohort_members
          WHERE (cohort_members.user_id = auth.uid()))))));
DROP POLICY IF EXISTS "admin_all" ON public."cohort_members";
CREATE POLICY "admin_all" ON public."cohort_members" AS PERMISSIVE FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "cohort_members_delete" ON public."cohort_members";
CREATE POLICY "cohort_members_delete" ON public."cohort_members" AS PERMISSIVE FOR DELETE TO authenticated USING (((user_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['admin'::text, 'moderator'::text])))))));
DROP POLICY IF EXISTS "cohort_members_insert" ON public."cohort_members";
CREATE POLICY "cohort_members_insert" ON public."cohort_members" AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));
DROP POLICY IF EXISTS "cohort_members_select" ON public."cohort_members";
CREATE POLICY "cohort_members_select" ON public."cohort_members" AS PERMISSIVE FOR SELECT TO authenticated USING (((user_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM cohort_members cm2
  WHERE ((cm2.cohort_id = cohort_members.cohort_id) AND (cm2.user_id = auth.uid())))) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['admin'::text, 'moderator'::text, 'root_admin'::text])))))));
DROP POLICY IF EXISTS "admin_all" ON public."cohort_posts";
CREATE POLICY "admin_all" ON public."cohort_posts" AS PERMISSIVE FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "cohort_posts_delete" ON public."cohort_posts";
CREATE POLICY "cohort_posts_delete" ON public."cohort_posts" AS PERMISSIVE FOR DELETE TO authenticated USING (((user_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['admin'::text, 'moderator'::text])))))));
DROP POLICY IF EXISTS "cohort_posts_insert" ON public."cohort_posts";
CREATE POLICY "cohort_posts_insert" ON public."cohort_posts" AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((user_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM cohort_members cm
  WHERE ((cm.cohort_id = cohort_posts.cohort_id) AND (cm.user_id = auth.uid()))))));
DROP POLICY IF EXISTS "cohort_posts_select" ON public."cohort_posts";
CREATE POLICY "cohort_posts_select" ON public."cohort_posts" AS PERMISSIVE FOR SELECT TO authenticated USING (((user_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM cohort_members cm
  WHERE ((cm.cohort_id = cohort_posts.cohort_id) AND (cm.user_id = auth.uid())))) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['admin'::text, 'moderator'::text, 'root_admin'::text])))))));
DROP POLICY IF EXISTS "cohort_posts_update" ON public."cohort_posts";
CREATE POLICY "cohort_posts_update" ON public."cohort_posts" AS PERMISSIVE FOR UPDATE TO authenticated USING ((user_id = auth.uid()));
DROP POLICY IF EXISTS "admin_all" ON public."cohort_replies";
CREATE POLICY "admin_all" ON public."cohort_replies" AS PERMISSIVE FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "cohort_replies_delete" ON public."cohort_replies";
CREATE POLICY "cohort_replies_delete" ON public."cohort_replies" AS PERMISSIVE FOR DELETE TO authenticated USING (((user_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['admin'::text, 'moderator'::text])))))));
DROP POLICY IF EXISTS "cohort_replies_insert" ON public."cohort_replies";
CREATE POLICY "cohort_replies_insert" ON public."cohort_replies" AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));
DROP POLICY IF EXISTS "cohort_replies_select" ON public."cohort_replies";
CREATE POLICY "cohort_replies_select" ON public."cohort_replies" AS PERMISSIVE FOR SELECT TO authenticated USING (((user_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM (cohort_posts cp
     JOIN cohort_members cm ON ((cm.cohort_id = cp.cohort_id)))
  WHERE ((cp.id = cohort_replies.post_id) AND (cm.user_id = auth.uid())))) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['admin'::text, 'moderator'::text, 'root_admin'::text])))))));
DROP POLICY IF EXISTS "Users read own votes" ON public."cohort_votes";
CREATE POLICY "Users read own votes" ON public."cohort_votes" AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "admin_all" ON public."cohort_votes";
CREATE POLICY "admin_all" ON public."cohort_votes" AS PERMISSIVE FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "admin_read_votes" ON public."cohort_votes";
CREATE POLICY "admin_read_votes" ON public."cohort_votes" AS PERMISSIVE FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "cohort_votes_delete" ON public."cohort_votes";
CREATE POLICY "cohort_votes_delete" ON public."cohort_votes" AS PERMISSIVE FOR DELETE TO public USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "cohort_votes_insert" ON public."cohort_votes";
CREATE POLICY "cohort_votes_insert" ON public."cohort_votes" AS PERMISSIVE FOR INSERT TO public WITH CHECK ((auth.uid() = user_id));
DROP POLICY IF EXISTS "cohort_votes_select" ON public."cohort_votes";
CREATE POLICY "cohort_votes_select" ON public."cohort_votes" AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "cv_delete" ON public."cohort_votes";
CREATE POLICY "cv_delete" ON public."cohort_votes" AS PERMISSIVE FOR DELETE TO authenticated USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "cv_insert" ON public."cohort_votes";
CREATE POLICY "cv_insert" ON public."cohort_votes" AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));
DROP POLICY IF EXISTS "cv_select" ON public."cohort_votes";
CREATE POLICY "cv_select" ON public."cohort_votes" AS PERMISSIVE FOR SELECT TO authenticated USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Admins can write cohorts" ON public."cohorts";
CREATE POLICY "Admins can write cohorts" ON public."cohorts" AS PERMISSIVE FOR ALL TO public USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))));
DROP POLICY IF EXISTS "Anyone can read cohorts" ON public."cohorts";
CREATE POLICY "Anyone can read cohorts" ON public."cohorts" AS PERMISSIVE FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "admin_all" ON public."cohorts";
CREATE POLICY "admin_all" ON public."cohorts" AS PERMISSIVE FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "cohorts_delete" ON public."cohorts";
CREATE POLICY "cohorts_delete" ON public."cohorts" AS PERMISSIVE FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['admin'::text, 'moderator'::text]))))));
DROP POLICY IF EXISTS "cohorts_insert" ON public."cohorts";
CREATE POLICY "cohorts_insert" ON public."cohorts" AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['admin'::text, 'moderator'::text]))))));
DROP POLICY IF EXISTS "cohorts_select" ON public."cohorts";
CREATE POLICY "cohorts_select" ON public."cohorts" AS PERMISSIVE FOR SELECT TO authenticated USING (((is_public = true) OR (EXISTS ( SELECT 1
   FROM cohort_members cm
  WHERE ((cm.cohort_id = cohorts.id) AND (cm.user_id = auth.uid())))) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['admin'::text, 'moderator'::text, 'root_admin'::text])))))));
DROP POLICY IF EXISTS "cohorts_update" ON public."cohorts";
CREATE POLICY "cohorts_update" ON public."cohorts" AS PERMISSIVE FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['admin'::text, 'moderator'::text]))))));
DROP POLICY IF EXISTS "admin_all" ON public."community_categories";
CREATE POLICY "admin_all" ON public."community_categories" AS PERMISSIVE FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "public read" ON public."community_categories";
CREATE POLICY "public read" ON public."community_categories" AS PERMISSIVE FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "admin_all" ON public."community_channels";
CREATE POLICY "admin_all" ON public."community_channels" AS PERMISSIVE FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "admin_all" ON public."community_messages";
CREATE POLICY "admin_all" ON public."community_messages" AS PERMISSIVE FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "members can delete own messages" ON public."community_messages";
CREATE POLICY "members can delete own messages" ON public."community_messages" AS PERMISSIVE FOR UPDATE TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));
DROP POLICY IF EXISTS "members can insert messages" ON public."community_messages";
CREATE POLICY "members can insert messages" ON public."community_messages" AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));
DROP POLICY IF EXISTS "members can read messages" ON public."community_messages";
CREATE POLICY "members can read messages" ON public."community_messages" AS PERMISSIVE FOR SELECT TO authenticated USING ((deleted = false));
DROP POLICY IF EXISTS "moderators can pin messages" ON public."community_messages";
CREATE POLICY "moderators can pin messages" ON public."community_messages" AS PERMISSIVE FOR UPDATE TO authenticated USING (is_moderator_or_admin()) WITH CHECK (is_moderator_or_admin());
DROP POLICY IF EXISTS "admin_all" ON public."community_prompts";
CREATE POLICY "admin_all" ON public."community_prompts" AS PERMISSIVE FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "cp_read" ON public."community_prompts";
CREATE POLICY "cp_read" ON public."community_prompts" AS PERMISSIVE FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "admin_all" ON public."contact_messages";
CREATE POLICY "admin_all" ON public."contact_messages" AS PERMISSIVE FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "public_insert" ON public."contact_messages";
CREATE POLICY "public_insert" ON public."contact_messages" AS PERMISSIVE FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "service role only" ON public."contact_messages";
CREATE POLICY "service role only" ON public."contact_messages" AS PERMISSIVE FOR ALL TO public USING (false);
DROP POLICY IF EXISTS "Admins and mods can manage content_calendar" ON public."content_calendar";
CREATE POLICY "Admins and mods can manage content_calendar" ON public."content_calendar" AS PERMISSIVE FOR ALL TO public USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'moderator'::text])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'moderator'::text]))))));
DROP POLICY IF EXISTS "admin_all" ON public."content_calendar";
CREATE POLICY "admin_all" ON public."content_calendar" AS PERMISSIVE FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "admins_full_access" ON public."content_calendar";
CREATE POLICY "admins_full_access" ON public."content_calendar" AS PERMISSIVE FOR ALL TO public USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'moderator'::text])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'moderator'::text]))))));
DROP POLICY IF EXISTS "allow_insert" ON public."content_calendar";
CREATE POLICY "allow_insert" ON public."content_calendar" AS PERMISSIVE FOR INSERT TO public WITH CHECK (true);
DROP POLICY IF EXISTS "admin_all" ON public."course_discussions";
CREATE POLICY "admin_all" ON public."course_discussions" AS PERMISSIVE FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "cd_delete" ON public."course_discussions";
CREATE POLICY "cd_delete" ON public."course_discussions" AS PERMISSIVE FOR DELETE TO authenticated USING ((user_id = auth.uid()));
DROP POLICY IF EXISTS "cd_insert" ON public."course_discussions";
CREATE POLICY "cd_insert" ON public."course_discussions" AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));
DROP POLICY IF EXISTS "cd_select" ON public."course_discussions";
CREATE POLICY "cd_select" ON public."course_discussions" AS PERMISSIVE FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "cd_update" ON public."course_discussions";
CREATE POLICY "cd_update" ON public."course_discussions" AS PERMISSIVE FOR UPDATE TO authenticated USING ((user_id = auth.uid()));
DROP POLICY IF EXISTS "admin_all" ON public."course_notes";
CREATE POLICY "admin_all" ON public."course_notes" AS PERMISSIVE FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "cn_delete" ON public."course_notes";
CREATE POLICY "cn_delete" ON public."course_notes" AS PERMISSIVE FOR DELETE TO authenticated USING ((user_id = auth.uid()));
DROP POLICY IF EXISTS "cn_insert" ON public."course_notes";
CREATE POLICY "cn_insert" ON public."course_notes" AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));
DROP POLICY IF EXISTS "cn_select" ON public."course_notes";
CREATE POLICY "cn_select" ON public."course_notes" AS PERMISSIVE FOR SELECT TO authenticated USING ((user_id = auth.uid()));
DROP POLICY IF EXISTS "cn_update" ON public."course_notes";
CREATE POLICY "cn_update" ON public."course_notes" AS PERMISSIVE FOR UPDATE TO authenticated USING ((user_id = auth.uid()));
DROP POLICY IF EXISTS "admin_all" ON public."courses";
CREATE POLICY "admin_all" ON public."courses" AS PERMISSIVE FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "courses_create" ON public."courses";
CREATE POLICY "courses_create" ON public."courses" AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((( SELECT profiles.role
   FROM profiles
  WHERE (profiles.id = auth.uid())) = ANY (ARRAY['admin'::text, 'moderator'::text])));
DROP POLICY IF EXISTS "courses_destroy" ON public."courses";
CREATE POLICY "courses_destroy" ON public."courses" AS PERMISSIVE FOR DELETE TO authenticated USING ((( SELECT profiles.role
   FROM profiles
  WHERE (profiles.id = auth.uid())) = 'admin'::text));
DROP POLICY IF EXISTS "courses_modify" ON public."courses";
CREATE POLICY "courses_modify" ON public."courses" AS PERMISSIVE FOR UPDATE TO authenticated USING ((( SELECT profiles.role
   FROM profiles
  WHERE (profiles.id = auth.uid())) = ANY (ARRAY['admin'::text, 'moderator'::text])));
DROP POLICY IF EXISTS "courses_read" ON public."courses";
CREATE POLICY "courses_read" ON public."courses" AS PERMISSIVE FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "Users can request own deletion" ON public."deletion_requests";
CREATE POLICY "Users can request own deletion" ON public."deletion_requests" AS PERMISSIVE FOR INSERT TO public WITH CHECK ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users can view own deletion request" ON public."deletion_requests";
CREATE POLICY "Users can view own deletion request" ON public."deletion_requests" AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "admin_all" ON public."deletion_requests";
CREATE POLICY "admin_all" ON public."deletion_requests" AS PERMISSIVE FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "admin_all" ON public."event_registrations";
CREATE POLICY "admin_all" ON public."event_registrations" AS PERMISSIVE FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "admin_all_event_registrations" ON public."event_registrations";
CREATE POLICY "admin_all_event_registrations" ON public."event_registrations" AS PERMISSIVE FOR ALL TO authenticated USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'moderator'::text])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'moderator'::text]))))));
DROP POLICY IF EXISTS "er_insert" ON public."event_registrations";
CREATE POLICY "er_insert" ON public."event_registrations" AS PERMISSIVE FOR INSERT TO public WITH CHECK (true);
DROP POLICY IF EXISTS "er_select_own" ON public."event_registrations";
CREATE POLICY "er_select_own" ON public."event_registrations" AS PERMISSIVE FOR SELECT TO authenticated USING ((email = (( SELECT users.email
   FROM auth.users
  WHERE (users.id = auth.uid())))::text));
DROP POLICY IF EXISTS "Users can register" ON public."expert_registrations";
CREATE POLICY "Users can register" ON public."expert_registrations" AS PERMISSIVE FOR INSERT TO public WITH CHECK ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users can unregister" ON public."expert_registrations";
CREATE POLICY "Users can unregister" ON public."expert_registrations" AS PERMISSIVE FOR DELETE TO public USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users can view own registrations" ON public."expert_registrations";
CREATE POLICY "Users can view own registrations" ON public."expert_registrations" AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "admin_all" ON public."expert_registrations";
CREATE POLICY "admin_all" ON public."expert_registrations" AS PERMISSIVE FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "Admins and mods can write expert_sessions" ON public."expert_sessions";
CREATE POLICY "Admins and mods can write expert_sessions" ON public."expert_sessions" AS PERMISSIVE FOR ALL TO public USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'moderator'::text])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'moderator'::text]))))));
DROP POLICY IF EXISTS "Anyone can read published expert sessions" ON public."expert_sessions";
CREATE POLICY "Anyone can read published expert sessions" ON public."expert_sessions" AS PERMISSIVE FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "admin_all" ON public."expert_sessions";
CREATE POLICY "admin_all" ON public."expert_sessions" AS PERMISSIVE FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "expert_sessions_create" ON public."expert_sessions";
CREATE POLICY "expert_sessions_create" ON public."expert_sessions" AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((( SELECT profiles.role
   FROM profiles
  WHERE (profiles.id = auth.uid())) = ANY (ARRAY['admin'::text, 'moderator'::text])));
DROP POLICY IF EXISTS "expert_sessions_destroy" ON public."expert_sessions";
CREATE POLICY "expert_sessions_destroy" ON public."expert_sessions" AS PERMISSIVE FOR DELETE TO authenticated USING ((( SELECT profiles.role
   FROM profiles
  WHERE (profiles.id = auth.uid())) = 'admin'::text));
DROP POLICY IF EXISTS "expert_sessions_modify" ON public."expert_sessions";
CREATE POLICY "expert_sessions_modify" ON public."expert_sessions" AS PERMISSIVE FOR UPDATE TO authenticated USING ((( SELECT profiles.role
   FROM profiles
  WHERE (profiles.id = auth.uid())) = ANY (ARRAY['admin'::text, 'moderator'::text])));
DROP POLICY IF EXISTS "expert_sessions_read" ON public."expert_sessions";
CREATE POLICY "expert_sessions_read" ON public."expert_sessions" AS PERMISSIVE FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "expert_sessions_select" ON public."expert_sessions";
CREATE POLICY "expert_sessions_select" ON public."expert_sessions" AS PERMISSIVE FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admin full access to guardsmann_applications" ON public."guardsmann_applications";
CREATE POLICY "Admin full access to guardsmann_applications" ON public."guardsmann_applications" AS PERMISSIVE FOR ALL TO public USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))));
DROP POLICY IF EXISTS "admin_all" ON public."guardsmann_applications";
CREATE POLICY "admin_all" ON public."guardsmann_applications" AS PERMISSIVE FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "admin_all" ON public."guardsmann_jobs";
CREATE POLICY "admin_all" ON public."guardsmann_jobs" AS PERMISSIVE FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "Admins can delete job applications" ON public."job_applications";
CREATE POLICY "Admins can delete job applications" ON public."job_applications" AS PERMISSIVE FOR DELETE TO public USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'root_admin'::text]))))));
DROP POLICY IF EXISTS "Admins can read all job applications" ON public."job_applications";
CREATE POLICY "Admins can read all job applications" ON public."job_applications" AS PERMISSIVE FOR SELECT TO public USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'root_admin'::text]))))));
DROP POLICY IF EXISTS "Admins can update job applications" ON public."job_applications";
CREATE POLICY "Admins can update job applications" ON public."job_applications" AS PERMISSIVE FOR UPDATE TO public USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'root_admin'::text]))))));
DROP POLICY IF EXISTS "Anyone can submit a job application" ON public."job_applications";
CREATE POLICY "Anyone can submit a job application" ON public."job_applications" AS PERMISSIVE FOR INSERT TO public WITH CHECK (true);
DROP POLICY IF EXISTS "admin_all" ON public."job_applications";
CREATE POLICY "admin_all" ON public."job_applications" AS PERMISSIVE FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "public_insert" ON public."job_applications";
CREATE POLICY "public_insert" ON public."job_applications" AS PERMISSIVE FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Admins can manage all jobs" ON public."job_listings";
CREATE POLICY "Admins can manage all jobs" ON public."job_listings" AS PERMISSIVE FOR ALL TO public USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'moderator'::text]))))));
DROP POLICY IF EXISTS "Admins can manage job listings" ON public."job_listings";
CREATE POLICY "Admins can manage job listings" ON public."job_listings" AS PERMISSIVE FOR ALL TO public USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'root_admin'::text]))))));
DROP POLICY IF EXISTS "Public can read active job listings" ON public."job_listings";
CREATE POLICY "Public can read active job listings" ON public."job_listings" AS PERMISSIVE FOR SELECT TO public USING ((is_active = true));
DROP POLICY IF EXISTS "Public can read active jobs" ON public."job_listings";
CREATE POLICY "Public can read active jobs" ON public."job_listings" AS PERMISSIVE FOR SELECT TO public USING ((is_active = true));
DROP POLICY IF EXISTS "admin_all" ON public."job_listings";
CREATE POLICY "admin_all" ON public."job_listings" AS PERMISSIVE FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "public_read" ON public."job_listings";
CREATE POLICY "public_read" ON public."job_listings" AS PERMISSIVE FOR SELECT TO anon, authenticated USING ((is_active = true));
DROP POLICY IF EXISTS "admin_all_knowledge_chunks" ON public."knowledge_chunks";
CREATE POLICY "admin_all_knowledge_chunks" ON public."knowledge_chunks" AS PERMISSIVE FOR ALL TO authenticated USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'moderator'::text])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'moderator'::text]))))));
DROP POLICY IF EXISTS "admin_read" ON public."knowledge_chunks";
CREATE POLICY "admin_read" ON public."knowledge_chunks" AS PERMISSIVE FOR SELECT TO authenticated USING (is_admin());
DROP POLICY IF EXISTS "authenticated_read_knowledge_chunks" ON public."knowledge_chunks";
CREATE POLICY "authenticated_read_knowledge_chunks" ON public."knowledge_chunks" AS PERMISSIVE FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admins can read lead_magnet_downloads" ON public."lead_magnet_downloads";
CREATE POLICY "Admins can read lead_magnet_downloads" ON public."lead_magnet_downloads" AS PERMISSIVE FOR SELECT TO public USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))));
DROP POLICY IF EXISTS "admin_all" ON public."lead_magnet_downloads";
CREATE POLICY "admin_all" ON public."lead_magnet_downloads" AS PERMISSIVE FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "Admins manage lead magnets" ON public."lead_magnets";
CREATE POLICY "Admins manage lead magnets" ON public."lead_magnets" AS PERMISSIVE FOR ALL TO public USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'moderator'::text]))))));
DROP POLICY IF EXISTS "admin_all" ON public."lead_magnets";
CREATE POLICY "admin_all" ON public."lead_magnets" AS PERMISSIVE FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "admin_all" ON public."lessons";
CREATE POLICY "admin_all" ON public."lessons" AS PERMISSIVE FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "lessons_read" ON public."lessons";
CREATE POLICY "lessons_read" ON public."lessons" AS PERMISSIVE FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "admin_all" ON public."marketing_pages";
CREATE POLICY "admin_all" ON public."marketing_pages" AS PERMISSIVE FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "public read marketing_pages" ON public."marketing_pages";
CREATE POLICY "public read marketing_pages" ON public."marketing_pages" AS PERMISSIVE FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "public_read" ON public."marketing_pages";
CREATE POLICY "public_read" ON public."marketing_pages" AS PERMISSIVE FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "service role full access marketing_pages" ON public."marketing_pages";
CREATE POLICY "service role full access marketing_pages" ON public."marketing_pages" AS PERMISSIVE FOR ALL TO public USING ((auth.role() = 'service_role'::text));
DROP POLICY IF EXISTS "admin_all" ON public."marketing_repeating_items";
CREATE POLICY "admin_all" ON public."marketing_repeating_items" AS PERMISSIVE FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "public read marketing_repeating_items" ON public."marketing_repeating_items";
CREATE POLICY "public read marketing_repeating_items" ON public."marketing_repeating_items" AS PERMISSIVE FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "public_read" ON public."marketing_repeating_items";
CREATE POLICY "public_read" ON public."marketing_repeating_items" AS PERMISSIVE FOR SELECT TO anon, authenticated USING ((status = 'published'::text));
DROP POLICY IF EXISTS "service role full access marketing_repeating_items" ON public."marketing_repeating_items";
CREATE POLICY "service role full access marketing_repeating_items" ON public."marketing_repeating_items" AS PERMISSIVE FOR ALL TO public USING ((auth.role() = 'service_role'::text));
DROP POLICY IF EXISTS "admin_all" ON public."marketing_sections";
CREATE POLICY "admin_all" ON public."marketing_sections" AS PERMISSIVE FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "public read marketing_sections" ON public."marketing_sections";
CREATE POLICY "public read marketing_sections" ON public."marketing_sections" AS PERMISSIVE FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "public_read" ON public."marketing_sections";
CREATE POLICY "public_read" ON public."marketing_sections" AS PERMISSIVE FOR SELECT TO anon, authenticated USING ((status = 'published'::text));
DROP POLICY IF EXISTS "service role full access marketing_sections" ON public."marketing_sections";
CREATE POLICY "service role full access marketing_sections" ON public."marketing_sections" AS PERMISSIVE FOR ALL TO public USING ((auth.role() = 'service_role'::text));
DROP POLICY IF EXISTS "Admin delete" ON public."mentor_applications";
CREATE POLICY "Admin delete" ON public."mentor_applications" AS PERMISSIVE FOR DELETE TO public USING ((auth.role() = 'authenticated'::text));
DROP POLICY IF EXISTS "Admin read" ON public."mentor_applications";
CREATE POLICY "Admin read" ON public."mentor_applications" AS PERMISSIVE FOR SELECT TO public USING ((auth.role() = 'authenticated'::text));
DROP POLICY IF EXISTS "Admin update" ON public."mentor_applications";
CREATE POLICY "Admin update" ON public."mentor_applications" AS PERMISSIVE FOR UPDATE TO public USING ((auth.role() = 'authenticated'::text));
DROP POLICY IF EXISTS "Anyone can apply" ON public."mentor_applications";
CREATE POLICY "Anyone can apply" ON public."mentor_applications" AS PERMISSIVE FOR INSERT TO public WITH CHECK (true);
DROP POLICY IF EXISTS "admin_all" ON public."mentor_applications";
CREATE POLICY "admin_all" ON public."mentor_applications" AS PERMISSIVE FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "public_insert" ON public."mentor_applications";
CREATE POLICY "public_insert" ON public."mentor_applications" AS PERMISSIVE FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "admin_all" ON public."mentor_profiles";
CREATE POLICY "admin_all" ON public."mentor_profiles" AS PERMISSIVE FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "admin_all_mentor_profiles" ON public."mentor_profiles";
CREATE POLICY "admin_all_mentor_profiles" ON public."mentor_profiles" AS PERMISSIVE FOR ALL TO authenticated USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'moderator'::text])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'moderator'::text]))))));
DROP POLICY IF EXISTS "authenticated_read" ON public."mentor_profiles";
CREATE POLICY "authenticated_read" ON public."mentor_profiles" AS PERMISSIVE FOR SELECT TO authenticated USING ((active = true));
DROP POLICY IF EXISTS "admin_all" ON public."newsletter_queue";
CREATE POLICY "admin_all" ON public."newsletter_queue" AS PERMISSIVE FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "admin_all" ON public."newsletter_subscribers";
CREATE POLICY "admin_all" ON public."newsletter_subscribers" AS PERMISSIVE FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "newsletter_admin_delete" ON public."newsletter_subscribers";
CREATE POLICY "newsletter_admin_delete" ON public."newsletter_subscribers" AS PERMISSIVE FOR DELETE TO authenticated USING ((( SELECT profiles.role
   FROM profiles
  WHERE (profiles.id = auth.uid())) = 'admin'::text));
DROP POLICY IF EXISTS "newsletter_admin_read" ON public."newsletter_subscribers";
CREATE POLICY "newsletter_admin_read" ON public."newsletter_subscribers" AS PERMISSIVE FOR SELECT TO authenticated USING ((( SELECT profiles.role
   FROM profiles
  WHERE (profiles.id = auth.uid())) = ANY (ARRAY['admin'::text, 'moderator'::text])));
DROP POLICY IF EXISTS "newsletter_admin_update" ON public."newsletter_subscribers";
CREATE POLICY "newsletter_admin_update" ON public."newsletter_subscribers" AS PERMISSIVE FOR UPDATE TO authenticated USING ((( SELECT profiles.role
   FROM profiles
  WHERE (profiles.id = auth.uid())) = ANY (ARRAY['admin'::text, 'moderator'::text])));
DROP POLICY IF EXISTS "newsletter_sub_anon" ON public."newsletter_subscribers";
CREATE POLICY "newsletter_sub_anon" ON public."newsletter_subscribers" AS PERMISSIVE FOR INSERT TO anon WITH CHECK (true);
DROP POLICY IF EXISTS "newsletter_sub_auth" ON public."newsletter_subscribers";
CREATE POLICY "newsletter_sub_auth" ON public."newsletter_subscribers" AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "public_insert" ON public."newsletter_subscribers";
CREATE POLICY "public_insert" ON public."newsletter_subscribers" AS PERMISSIVE FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Users can delete own notifications" ON public."notifications";
CREATE POLICY "Users can delete own notifications" ON public."notifications" AS PERMISSIVE FOR DELETE TO public USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users can read own notifications" ON public."notifications";
CREATE POLICY "Users can read own notifications" ON public."notifications" AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users can update own notifications" ON public."notifications";
CREATE POLICY "Users can update own notifications" ON public."notifications" AS PERMISSIVE FOR UPDATE TO public USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users can view own notifications" ON public."notifications";
CREATE POLICY "Users can view own notifications" ON public."notifications" AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users delete own notifications" ON public."notifications";
CREATE POLICY "Users delete own notifications" ON public."notifications" AS PERMISSIVE FOR DELETE TO public USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users read own notifications" ON public."notifications";
CREATE POLICY "Users read own notifications" ON public."notifications" AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users update own notifications" ON public."notifications";
CREATE POLICY "Users update own notifications" ON public."notifications" AS PERMISSIVE FOR UPDATE TO public USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "admin_all" ON public."notifications";
CREATE POLICY "admin_all" ON public."notifications" AS PERMISSIVE FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "notifications_insert_own" ON public."notifications";
CREATE POLICY "notifications_insert_own" ON public."notifications" AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));
DROP POLICY IF EXISTS "admin_all" ON public."partner_course_enrollments";
CREATE POLICY "admin_all" ON public."partner_course_enrollments" AS PERMISSIVE FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "enrollment_owner" ON public."partner_course_enrollments";
CREATE POLICY "enrollment_owner" ON public."partner_course_enrollments" AS PERMISSIVE FOR ALL TO public USING ((partner_id IN ( SELECT partners.id
   FROM partners
  WHERE (partners.owner_id = auth.uid()))));
DROP POLICY IF EXISTS "enrollment_self" ON public."partner_course_enrollments";
CREATE POLICY "enrollment_self" ON public."partner_course_enrollments" AS PERMISSIVE FOR ALL TO public USING ((user_id = auth.uid()));
DROP POLICY IF EXISTS "member_insert_own_enrollments" ON public."partner_course_enrollments";
CREATE POLICY "member_insert_own_enrollments" ON public."partner_course_enrollments" AS PERMISSIVE FOR INSERT TO public WITH CHECK ((user_id = auth.uid()));
DROP POLICY IF EXISTS "member_read_own_enrollments" ON public."partner_course_enrollments";
CREATE POLICY "member_read_own_enrollments" ON public."partner_course_enrollments" AS PERMISSIVE FOR SELECT TO public USING ((user_id = auth.uid()));
DROP POLICY IF EXISTS "member_update_own_enrollments" ON public."partner_course_enrollments";
CREATE POLICY "member_update_own_enrollments" ON public."partner_course_enrollments" AS PERMISSIVE FOR UPDATE TO public USING ((user_id = auth.uid()));
DROP POLICY IF EXISTS "partner_enrollment_owner_select" ON public."partner_course_enrollments";
CREATE POLICY "partner_enrollment_owner_select" ON public."partner_course_enrollments" AS PERMISSIVE FOR SELECT TO public USING ((EXISTS ( SELECT 1
   FROM partners
  WHERE ((partners.id = partner_course_enrollments.partner_id) AND (partners.owner_id = auth.uid())))));
DROP POLICY IF EXISTS "partner_enrollment_user_insert" ON public."partner_course_enrollments";
CREATE POLICY "partner_enrollment_user_insert" ON public."partner_course_enrollments" AS PERMISSIVE FOR INSERT TO public WITH CHECK ((user_id = auth.uid()));
DROP POLICY IF EXISTS "partner_enrollment_user_select" ON public."partner_course_enrollments";
CREATE POLICY "partner_enrollment_user_select" ON public."partner_course_enrollments" AS PERMISSIVE FOR SELECT TO public USING ((user_id = auth.uid()));
DROP POLICY IF EXISTS "partner_owner_read_enrollments" ON public."partner_course_enrollments";
CREATE POLICY "partner_owner_read_enrollments" ON public."partner_course_enrollments" AS PERMISSIVE FOR SELECT TO public USING ((partner_id IN ( SELECT partners.id
   FROM partners
  WHERE (partners.owner_id = auth.uid()))));
DROP POLICY IF EXISTS "admin_all" ON public."partner_courses";
CREATE POLICY "admin_all" ON public."partner_courses" AS PERMISSIVE FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "partner_courses_member_select" ON public."partner_courses";
CREATE POLICY "partner_courses_member_select" ON public."partner_courses" AS PERMISSIVE FOR SELECT TO public USING (((is_published = true) AND (EXISTS ( SELECT 1
   FROM partner_members
  WHERE ((partner_members.partner_id = partner_courses.partner_id) AND (partner_members.email = (( SELECT users.email
           FROM auth.users
          WHERE (users.id = auth.uid())))::text) AND (partner_members.status = 'active'::text))))));
DROP POLICY IF EXISTS "partner_courses_owner_select" ON public."partner_courses";
CREATE POLICY "partner_courses_owner_select" ON public."partner_courses" AS PERMISSIVE FOR SELECT TO public USING ((EXISTS ( SELECT 1
   FROM partners
  WHERE ((partners.id = partner_courses.partner_id) AND (partners.owner_id = auth.uid())))));
DROP POLICY IF EXISTS "partner_member_courses" ON public."partner_courses";
CREATE POLICY "partner_member_courses" ON public."partner_courses" AS PERMISSIVE FOR SELECT TO public USING (((is_published = true) AND (partner_id IN ( SELECT partner_members.partner_id
   FROM partner_members
  WHERE ((partner_members.email = (( SELECT users.email
           FROM auth.users
          WHERE (users.id = auth.uid())))::text) AND (partner_members.status = 'active'::text))))));
DROP POLICY IF EXISTS "partner_owner_courses" ON public."partner_courses";
CREATE POLICY "partner_owner_courses" ON public."partner_courses" AS PERMISSIVE FOR ALL TO public USING ((partner_id IN ( SELECT partners.id
   FROM partners
  WHERE (partners.owner_id = auth.uid()))));
DROP POLICY IF EXISTS "admin_all" ON public."partner_enquiries";
CREATE POLICY "admin_all" ON public."partner_enquiries" AS PERMISSIVE FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "public_insert" ON public."partner_enquiries";
CREATE POLICY "public_insert" ON public."partner_enquiries" AS PERMISSIVE FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "admin_all" ON public."partner_event_registrations";
CREATE POLICY "admin_all" ON public."partner_event_registrations" AS PERMISSIVE FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "partner_event_reg_owner_select" ON public."partner_event_registrations";
CREATE POLICY "partner_event_reg_owner_select" ON public."partner_event_registrations" AS PERMISSIVE FOR SELECT TO public USING ((EXISTS ( SELECT 1
   FROM (partner_events pe
     JOIN partners p ON ((p.id = pe.partner_id)))
  WHERE ((pe.id = partner_event_registrations.event_id) AND (p.owner_id = auth.uid())))));
DROP POLICY IF EXISTS "partner_event_reg_user_insert" ON public."partner_event_registrations";
CREATE POLICY "partner_event_reg_user_insert" ON public."partner_event_registrations" AS PERMISSIVE FOR INSERT TO public WITH CHECK ((user_id = auth.uid()));
DROP POLICY IF EXISTS "partner_event_reg_user_select" ON public."partner_event_registrations";
CREATE POLICY "partner_event_reg_user_select" ON public."partner_event_registrations" AS PERMISSIVE FOR SELECT TO public USING ((user_id = auth.uid()));
DROP POLICY IF EXISTS "admin_all" ON public."partner_events";
CREATE POLICY "admin_all" ON public."partner_events" AS PERMISSIVE FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "partner_events_member_select" ON public."partner_events";
CREATE POLICY "partner_events_member_select" ON public."partner_events" AS PERMISSIVE FOR SELECT TO public USING (((status = 'published'::text) AND (EXISTS ( SELECT 1
   FROM partner_members
  WHERE ((partner_members.partner_id = partner_events.partner_id) AND (partner_members.email = (( SELECT users.email
           FROM auth.users
          WHERE (users.id = auth.uid())))::text) AND (partner_members.status = 'active'::text))))));
DROP POLICY IF EXISTS "partner_events_owner_select" ON public."partner_events";
CREATE POLICY "partner_events_owner_select" ON public."partner_events" AS PERMISSIVE FOR SELECT TO public USING ((EXISTS ( SELECT 1
   FROM partners
  WHERE ((partners.id = partner_events.partner_id) AND (partners.owner_id = auth.uid())))));
DROP POLICY IF EXISTS "Members see their own record" ON public."partner_members";
CREATE POLICY "Members see their own record" ON public."partner_members" AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Partner owners see their members" ON public."partner_members";
CREATE POLICY "Partner owners see their members" ON public."partner_members" AS PERMISSIVE FOR SELECT TO public USING ((EXISTS ( SELECT 1
   FROM partners
  WHERE ((partners.id = partner_members.partner_id) AND (partners.owner_id = auth.uid())))));
DROP POLICY IF EXISTS "admin_all" ON public."partner_members";
CREATE POLICY "admin_all" ON public."partner_members" AS PERMISSIVE FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "partner_members_owner_select" ON public."partner_members";
CREATE POLICY "partner_members_owner_select" ON public."partner_members" AS PERMISSIVE FOR SELECT TO public USING ((EXISTS ( SELECT 1
   FROM partners
  WHERE ((partners.id = partner_members.partner_id) AND (partners.owner_id = auth.uid())))));
DROP POLICY IF EXISTS "partner_members_self_select" ON public."partner_members";
CREATE POLICY "partner_members_self_select" ON public."partner_members" AS PERMISSIVE FOR SELECT TO public USING ((email = (( SELECT users.email
   FROM auth.users
  WHERE (users.id = auth.uid())))::text));
DROP POLICY IF EXISTS "admin_all" ON public."partner_subscriptions";
CREATE POLICY "admin_all" ON public."partner_subscriptions" AS PERMISSIVE FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "partner_subs_owner_select" ON public."partner_subscriptions";
CREATE POLICY "partner_subs_owner_select" ON public."partner_subscriptions" AS PERMISSIVE FOR SELECT TO public USING ((EXISTS ( SELECT 1
   FROM partners
  WHERE ((partners.id = partner_subscriptions.partner_id) AND (partners.owner_id = auth.uid())))));
DROP POLICY IF EXISTS "Partner owners see their transactions" ON public."partner_transactions";
CREATE POLICY "Partner owners see their transactions" ON public."partner_transactions" AS PERMISSIVE FOR SELECT TO public USING ((EXISTS ( SELECT 1
   FROM partners
  WHERE ((partners.id = partner_transactions.partner_id) AND (partners.owner_id = auth.uid())))));
DROP POLICY IF EXISTS "admin_all" ON public."partner_transactions";
CREATE POLICY "admin_all" ON public."partner_transactions" AS PERMISSIVE FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "partner_owner_read_transactions" ON public."partner_transactions";
CREATE POLICY "partner_owner_read_transactions" ON public."partner_transactions" AS PERMISSIVE FOR SELECT TO public USING ((partner_id IN ( SELECT partners.id
   FROM partners
  WHERE (partners.owner_id = auth.uid()))));
DROP POLICY IF EXISTS "partner_tx_owner_select" ON public."partner_transactions";
CREATE POLICY "partner_tx_owner_select" ON public."partner_transactions" AS PERMISSIVE FOR SELECT TO public USING ((EXISTS ( SELECT 1
   FROM partners
  WHERE ((partners.id = partner_transactions.partner_id) AND (partners.owner_id = auth.uid())))));
DROP POLICY IF EXISTS "Partners read own record" ON public."partners";
CREATE POLICY "Partners read own record" ON public."partners" AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = owner_id));
DROP POLICY IF EXISTS "Partners update own record" ON public."partners";
CREATE POLICY "Partners update own record" ON public."partners" AS PERMISSIVE FOR UPDATE TO public USING ((auth.uid() = owner_id));
DROP POLICY IF EXISTS "admin_all" ON public."partners";
CREATE POLICY "admin_all" ON public."partners" AS PERMISSIVE FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "partners_owner_select" ON public."partners";
CREATE POLICY "partners_owner_select" ON public."partners" AS PERMISSIVE FOR SELECT TO public USING ((owner_id = auth.uid()));
DROP POLICY IF EXISTS "Users view own attempts" ON public."payment_attempts";
CREATE POLICY "Users view own attempts" ON public."payment_attempts" AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "admin_all" ON public."payment_attempts";
CREATE POLICY "admin_all" ON public."payment_attempts" AS PERMISSIVE FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "service_role_all_attempts" ON public."payment_attempts";
CREATE POLICY "service_role_all_attempts" ON public."payment_attempts" AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "users_read_own_attempts" ON public."payment_attempts";
CREATE POLICY "users_read_own_attempts" ON public."payment_attempts" AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Admins can view all payments" ON public."payments";
CREATE POLICY "Admins can view all payments" ON public."payments" AS PERMISSIVE FOR SELECT TO public USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))));
DROP POLICY IF EXISTS "Service role can manage payments" ON public."payments";
CREATE POLICY "Service role can manage payments" ON public."payments" AS PERMISSIVE FOR ALL TO public USING ((auth.role() = 'service_role'::text));
DROP POLICY IF EXISTS "Users can view own payments" ON public."payments";
CREATE POLICY "Users can view own payments" ON public."payments" AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users see own payments" ON public."payments";
CREATE POLICY "Users see own payments" ON public."payments" AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "admin_all" ON public."payments";
CREATE POLICY "admin_all" ON public."payments" AS PERMISSIVE FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "pay_all_service" ON public."payments";
CREATE POLICY "pay_all_service" ON public."payments" AS PERMISSIVE FOR ALL TO public USING ((auth.role() = 'service_role'::text));
DROP POLICY IF EXISTS "pay_select" ON public."payments";
CREATE POLICY "pay_select" ON public."payments" AS PERMISSIVE FOR SELECT TO authenticated USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "service_role_all_payments" ON public."payments";
CREATE POLICY "service_role_all_payments" ON public."payments" AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "users_read_own_payments" ON public."payments";
CREATE POLICY "users_read_own_payments" ON public."payments" AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Admin full access to personal_brand_briefs" ON public."personal_brand_briefs";
CREATE POLICY "Admin full access to personal_brand_briefs" ON public."personal_brand_briefs" AS PERMISSIVE FOR ALL TO public USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))));
DROP POLICY IF EXISTS "admin_all" ON public."personal_brand_briefs";
CREATE POLICY "admin_all" ON public."personal_brand_briefs" AS PERMISSIVE FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "admin_all" ON public."platform_settings";
CREATE POLICY "admin_all" ON public."platform_settings" AS PERMISSIVE FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "public read" ON public."platform_settings";
CREATE POLICY "public read" ON public."platform_settings" AS PERMISSIVE FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "Admins can insert snapshots" ON public."platform_snapshots";
CREATE POLICY "Admins can insert snapshots" ON public."platform_snapshots" AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'moderator'::text]))))));
DROP POLICY IF EXISTS "Admins can read snapshots" ON public."platform_snapshots";
CREATE POLICY "Admins can read snapshots" ON public."platform_snapshots" AS PERMISSIVE FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'moderator'::text]))))));
DROP POLICY IF EXISTS "Service role can insert snapshots" ON public."platform_snapshots";
CREATE POLICY "Service role can insert snapshots" ON public."platform_snapshots" AS PERMISSIVE FOR INSERT TO service_role WITH CHECK (true);
DROP POLICY IF EXISTS "admin_all" ON public."platform_snapshots";
CREATE POLICY "admin_all" ON public."platform_snapshots" AS PERMISSIVE FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "admin_all" ON public."post_likes";
CREATE POLICY "admin_all" ON public."post_likes" AS PERMISSIVE FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "likes_all" ON public."post_likes";
CREATE POLICY "likes_all" ON public."post_likes" AS PERMISSIVE FOR ALL TO public USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Admins can view all purchases" ON public."product_purchases";
CREATE POLICY "Admins can view all purchases" ON public."product_purchases" AS PERMISSIVE FOR SELECT TO public USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))));
DROP POLICY IF EXISTS "Users can view own purchases" ON public."product_purchases";
CREATE POLICY "Users can view own purchases" ON public."product_purchases" AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "admin_all" ON public."product_purchases";
CREATE POLICY "admin_all" ON public."product_purchases" AS PERMISSIVE FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "Anyone can view published products" ON public."products";
CREATE POLICY "Anyone can view published products" ON public."products" AS PERMISSIVE FOR SELECT TO public USING ((published = true));
DROP POLICY IF EXISTS "Staff can manage products" ON public."products";
CREATE POLICY "Staff can manage products" ON public."products" AS PERMISSIVE FOR ALL TO public USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'moderator'::text]))))));
DROP POLICY IF EXISTS "admin_all" ON public."products";
CREATE POLICY "admin_all" ON public."products" AS PERMISSIVE FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "public_read" ON public."products";
CREATE POLICY "public_read" ON public."products" AS PERMISSIVE FOR SELECT TO anon, authenticated USING ((published = true));
DROP POLICY IF EXISTS "admin_all" ON public."profiles";
CREATE POLICY "admin_all" ON public."profiles" AS PERMISSIVE FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "admin_select_all_profiles" ON public."profiles";
CREATE POLICY "admin_select_all_profiles" ON public."profiles" AS PERMISSIVE FOR SELECT TO authenticated USING ((auth.uid() = id));
DROP POLICY IF EXISTS "profiles_admin_update" ON public."profiles";
CREATE POLICY "profiles_admin_update" ON public."profiles" AS PERMISSIVE FOR UPDATE TO authenticated USING ((( SELECT profiles_1.role
   FROM profiles profiles_1
  WHERE (profiles_1.id = auth.uid())) = 'admin'::text)) WITH CHECK ((( SELECT profiles_1.role
   FROM profiles profiles_1
  WHERE (profiles_1.id = auth.uid())) = 'admin'::text));
DROP POLICY IF EXISTS "profiles_insert" ON public."profiles";
CREATE POLICY "profiles_insert" ON public."profiles" AS PERMISSIVE FOR INSERT TO public WITH CHECK ((auth.uid() = id));
DROP POLICY IF EXISTS "profiles_moderator_read" ON public."profiles";
CREATE POLICY "profiles_moderator_read" ON public."profiles" AS PERMISSIVE FOR SELECT TO authenticated USING (is_moderator());
DROP POLICY IF EXISTS "profiles_own_read" ON public."profiles";
CREATE POLICY "profiles_own_read" ON public."profiles" AS PERMISSIVE FOR SELECT TO authenticated USING ((id = auth.uid()));
DROP POLICY IF EXISTS "profiles_own_update" ON public."profiles";
CREATE POLICY "profiles_own_update" ON public."profiles" AS PERMISSIVE FOR UPDATE TO authenticated USING ((id = auth.uid())) WITH CHECK ((id = auth.uid()));
DROP POLICY IF EXISTS "profiles_read" ON public."profiles";
CREATE POLICY "profiles_read" ON public."profiles" AS PERMISSIVE FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "profiles_select" ON public."profiles";
CREATE POLICY "profiles_select" ON public."profiles" AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = id));
DROP POLICY IF EXISTS "profiles_self_update" ON public."profiles";
CREATE POLICY "profiles_self_update" ON public."profiles" AS PERMISSIVE FOR UPDATE TO authenticated USING ((auth.uid() = id)) WITH CHECK ((auth.uid() = id));
DROP POLICY IF EXISTS "profiles_update" ON public."profiles";
CREATE POLICY "profiles_update" ON public."profiles" AS PERMISSIVE FOR UPDATE TO public USING ((auth.uid() = id));
DROP POLICY IF EXISTS "Admins manage promo codes" ON public."promo_codes";
CREATE POLICY "Admins manage promo codes" ON public."promo_codes" AS PERMISSIVE FOR ALL TO public USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))));
DROP POLICY IF EXISTS "Public can read active promo codes" ON public."promo_codes";
CREATE POLICY "Public can read active promo codes" ON public."promo_codes" AS PERMISSIVE FOR SELECT TO public USING ((active = true));
DROP POLICY IF EXISTS "Service can read promo codes" ON public."promo_codes";
CREATE POLICY "Service can read promo codes" ON public."promo_codes" AS PERMISSIVE FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "admin_all" ON public."promo_codes";
CREATE POLICY "admin_all" ON public."promo_codes" AS PERMISSIVE FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "admin_all" ON public."public_events";
CREATE POLICY "admin_all" ON public."public_events" AS PERMISSIVE FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "admin_all_public_events" ON public."public_events";
CREATE POLICY "admin_all_public_events" ON public."public_events" AS PERMISSIVE FOR ALL TO authenticated USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'moderator'::text])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'moderator'::text]))))));
DROP POLICY IF EXISTS "pe_select_published" ON public."public_events";
CREATE POLICY "pe_select_published" ON public."public_events" AS PERMISSIVE FOR SELECT TO public USING ((is_published = true));
DROP POLICY IF EXISTS "public_read" ON public."public_events";
CREATE POLICY "public_read" ON public."public_events" AS PERMISSIVE FOR SELECT TO anon, authenticated USING ((is_published = true));
DROP POLICY IF EXISTS "admin_all" ON public."push_events";
CREATE POLICY "admin_all" ON public."push_events" AS PERMISSIVE FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "Users manage own push subscriptions" ON public."push_subscriptions";
CREATE POLICY "Users manage own push subscriptions" ON public."push_subscriptions" AS PERMISSIVE FOR ALL TO public USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));
DROP POLICY IF EXISTS "admin_all" ON public."push_subscriptions";
CREATE POLICY "admin_all" ON public."push_subscriptions" AS PERMISSIVE FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "push_subs_delete" ON public."push_subscriptions";
CREATE POLICY "push_subs_delete" ON public."push_subscriptions" AS PERMISSIVE FOR DELETE TO public USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "push_subs_insert" ON public."push_subscriptions";
CREATE POLICY "push_subs_insert" ON public."push_subscriptions" AS PERMISSIVE FOR INSERT TO public WITH CHECK ((auth.uid() = user_id));
DROP POLICY IF EXISTS "push_subs_select" ON public."push_subscriptions";
CREATE POLICY "push_subs_select" ON public."push_subscriptions" AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "admin_all" ON public."rail_billboards";
CREATE POLICY "admin_all" ON public."rail_billboards" AS PERMISSIVE FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "admin_full_access" ON public."rail_billboards";
CREATE POLICY "admin_full_access" ON public."rail_billboards" AS PERMISSIVE FOR ALL TO public USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'moderator'::text])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'moderator'::text]))))));
DROP POLICY IF EXISTS "member_read" ON public."rail_billboards";
CREATE POLICY "member_read" ON public."rail_billboards" AS PERMISSIVE FOR SELECT TO authenticated USING ((is_active = true));
DROP POLICY IF EXISTS "users_read_active" ON public."rail_billboards";
CREATE POLICY "users_read_active" ON public."rail_billboards" AS PERMISSIVE FOR SELECT TO public USING ((is_active = true));
DROP POLICY IF EXISTS "Users can see own referrals" ON public."referrals";
CREATE POLICY "Users can see own referrals" ON public."referrals" AS PERMISSIVE FOR SELECT TO public USING (((auth.uid() = referrer_id) OR (auth.uid() = referred_id)));
DROP POLICY IF EXISTS "Users can view own referrals" ON public."referrals";
CREATE POLICY "Users can view own referrals" ON public."referrals" AS PERMISSIVE FOR SELECT TO public USING (((auth.uid() = referrer_id) OR (auth.uid() = referred_id)));
DROP POLICY IF EXISTS "admin_all" ON public."referrals";
CREATE POLICY "admin_all" ON public."referrals" AS PERMISSIVE FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "referrals_insert_as_referred" ON public."referrals";
CREATE POLICY "referrals_insert_as_referred" ON public."referrals" AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((referred_id = auth.uid()));
DROP POLICY IF EXISTS "referrals_update_participant" ON public."referrals";
CREATE POLICY "referrals_update_participant" ON public."referrals" AS PERMISSIVE FOR UPDATE TO authenticated USING (((auth.uid() = referrer_id) OR (auth.uid() = referred_id))) WITH CHECK (((auth.uid() = referrer_id) OR (auth.uid() = referred_id)));
DROP POLICY IF EXISTS "Admins can manage research briefs" ON public."research_briefs";
CREATE POLICY "Admins can manage research briefs" ON public."research_briefs" AS PERMISSIVE FOR ALL TO public USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))));
DROP POLICY IF EXISTS "Admins manage research briefs" ON public."research_briefs";
CREATE POLICY "Admins manage research briefs" ON public."research_briefs" AS PERMISSIVE FOR ALL TO public USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))));
DROP POLICY IF EXISTS "admin_all" ON public."research_briefs";
CREATE POLICY "admin_all" ON public."research_briefs" AS PERMISSIVE FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "admin_all" ON public."scheduled_posts";
CREATE POLICY "admin_all" ON public."scheduled_posts" AS PERMISSIVE FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "admin_all" ON public."sent_newsletters";
CREATE POLICY "admin_all" ON public."sent_newsletters" AS PERMISSIVE FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "newsletter_log_read" ON public."sent_newsletters";
CREATE POLICY "newsletter_log_read" ON public."sent_newsletters" AS PERMISSIVE FOR SELECT TO authenticated USING ((( SELECT profiles.role
   FROM profiles
  WHERE (profiles.id = auth.uid())) = ANY (ARRAY['admin'::text, 'moderator'::text])));
DROP POLICY IF EXISTS "newsletter_log_write" ON public."sent_newsletters";
CREATE POLICY "newsletter_log_write" ON public."sent_newsletters" AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((( SELECT profiles.role
   FROM profiles
  WHERE (profiles.id = auth.uid())) = ANY (ARRAY['admin'::text, 'moderator'::text])));
DROP POLICY IF EXISTS "Admins can view all session locations" ON public."session_locations";
CREATE POLICY "Admins can view all session locations" ON public."session_locations" AS PERMISSIVE FOR SELECT TO public USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))));
DROP POLICY IF EXISTS "Users can view own session locations" ON public."session_locations";
CREATE POLICY "Users can view own session locations" ON public."session_locations" AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "admin_all" ON public."session_locations";
CREATE POLICY "admin_all" ON public."session_locations" AS PERMISSIVE FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "admin_all" ON public."session_registrations";
CREATE POLICY "admin_all" ON public."session_registrations" AS PERMISSIVE FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "registrations_all" ON public."session_registrations";
CREATE POLICY "registrations_all" ON public."session_registrations" AS PERMISSIVE FOR ALL TO public USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "session_reg_delete_own" ON public."session_registrations";
CREATE POLICY "session_reg_delete_own" ON public."session_registrations" AS PERMISSIVE FOR DELETE TO authenticated USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "session_reg_insert_own" ON public."session_registrations";
CREATE POLICY "session_reg_insert_own" ON public."session_registrations" AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));
DROP POLICY IF EXISTS "session_reg_select_all_counts" ON public."session_registrations";
CREATE POLICY "session_reg_select_all_counts" ON public."session_registrations" AS PERMISSIVE FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "session_reg_select_own" ON public."session_registrations";
CREATE POLICY "session_reg_select_own" ON public."session_registrations" AS PERMISSIVE FOR SELECT TO authenticated USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "sr_create" ON public."session_registrations";
CREATE POLICY "sr_create" ON public."session_registrations" AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));
DROP POLICY IF EXISTS "sr_read" ON public."session_registrations";
CREATE POLICY "sr_read" ON public."session_registrations" AS PERMISSIVE FOR SELECT TO authenticated USING (((auth.uid() = user_id) OR (( SELECT profiles.role
   FROM profiles
  WHERE (profiles.id = auth.uid())) = ANY (ARRAY['admin'::text, 'moderator'::text]))));
DROP POLICY IF EXISTS "sr_remove" ON public."session_registrations";
CREATE POLICY "sr_remove" ON public."session_registrations" AS PERMISSIVE FOR DELETE TO authenticated USING (((auth.uid() = user_id) OR (( SELECT profiles.role
   FROM profiles
  WHERE (profiles.id = auth.uid())) = 'admin'::text)));
DROP POLICY IF EXISTS "Admins and mods can manage social_queue" ON public."social_queue";
CREATE POLICY "Admins and mods can manage social_queue" ON public."social_queue" AS PERMISSIVE FOR ALL TO public USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'moderator'::text])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'moderator'::text]))))));
DROP POLICY IF EXISTS "Admins manage social queue" ON public."social_queue";
CREATE POLICY "Admins manage social queue" ON public."social_queue" AS PERMISSIVE FOR ALL TO public USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))));
DROP POLICY IF EXISTS "admin_all" ON public."social_queue";
CREATE POLICY "admin_all" ON public."social_queue" AS PERMISSIVE FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "Admin full access to soundtracks" ON public."soundtracks";
CREATE POLICY "Admin full access to soundtracks" ON public."soundtracks" AS PERMISSIVE FOR ALL TO authenticated USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))));
DROP POLICY IF EXISTS "Authenticated users can read active soundtracks" ON public."soundtracks";
CREATE POLICY "Authenticated users can read active soundtracks" ON public."soundtracks" AS PERMISSIVE FOR SELECT TO authenticated USING ((active = true));
DROP POLICY IF EXISTS "Read active soundtracks" ON public."soundtracks";
CREATE POLICY "Read active soundtracks" ON public."soundtracks" AS PERMISSIVE FOR SELECT TO public USING ((active = true));
DROP POLICY IF EXISTS "admin_all" ON public."soundtracks";
CREATE POLICY "admin_all" ON public."soundtracks" AS PERMISSIVE FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "Service role can manage subscriptions" ON public."subscriptions";
CREATE POLICY "Service role can manage subscriptions" ON public."subscriptions" AS PERMISSIVE FOR ALL TO public USING ((auth.role() = 'service_role'::text));
DROP POLICY IF EXISTS "Users see own subscription" ON public."subscriptions";
CREATE POLICY "Users see own subscription" ON public."subscriptions" AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "admin_all" ON public."subscriptions";
CREATE POLICY "admin_all" ON public."subscriptions" AS PERMISSIVE FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "sub_all_service" ON public."subscriptions";
CREATE POLICY "sub_all_service" ON public."subscriptions" AS PERMISSIVE FOR ALL TO public USING ((auth.role() = 'service_role'::text));
DROP POLICY IF EXISTS "sub_select" ON public."subscriptions";
CREATE POLICY "sub_select" ON public."subscriptions" AS PERMISSIVE FOR SELECT TO authenticated USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "admin_all" ON public."summit_donations";
CREATE POLICY "admin_all" ON public."summit_donations" AS PERMISSIVE FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "Admins can view summit interest" ON public."summit_interest";
CREATE POLICY "Admins can view summit interest" ON public."summit_interest" AS PERMISSIVE FOR SELECT TO public USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))));
DROP POLICY IF EXISTS "Anyone can register summit interest" ON public."summit_interest";
CREATE POLICY "Anyone can register summit interest" ON public."summit_interest" AS PERMISSIVE FOR INSERT TO public WITH CHECK (true);
DROP POLICY IF EXISTS "admin_all" ON public."summit_interest";
CREATE POLICY "admin_all" ON public."summit_interest" AS PERMISSIVE FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "Admins manage analysis" ON public."survey_analyses";
CREATE POLICY "Admins manage analysis" ON public."survey_analyses" AS PERMISSIVE FOR ALL TO public USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'moderator'::text]))))));
DROP POLICY IF EXISTS "admin_all" ON public."survey_analyses";
CREATE POLICY "admin_all" ON public."survey_analyses" AS PERMISSIVE FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "Admins read responses" ON public."survey_responses";
CREATE POLICY "Admins read responses" ON public."survey_responses" AS PERMISSIVE FOR SELECT TO public USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'moderator'::text]))))));
DROP POLICY IF EXISTS "Anyone can submit responses" ON public."survey_responses";
CREATE POLICY "Anyone can submit responses" ON public."survey_responses" AS PERMISSIVE FOR INSERT TO public WITH CHECK (true);
DROP POLICY IF EXISTS "admin_all" ON public."survey_responses";
CREATE POLICY "admin_all" ON public."survey_responses" AS PERMISSIVE FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "Admins manage surveys" ON public."surveys";
CREATE POLICY "Admins manage surveys" ON public."surveys" AS PERMISSIVE FOR ALL TO public USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'moderator'::text]))))));
DROP POLICY IF EXISTS "Public anon can read published surveys" ON public."surveys";
CREATE POLICY "Public anon can read published surveys" ON public."surveys" AS PERMISSIVE FOR SELECT TO anon, authenticated USING ((is_published = true));
DROP POLICY IF EXISTS "admin_all" ON public."surveys";
CREATE POLICY "admin_all" ON public."surveys" AS PERMISSIVE FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "Users can view own usage" ON public."usage_tracking";
CREATE POLICY "Users can view own usage" ON public."usage_tracking" AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users view own usage" ON public."usage_tracking";
CREATE POLICY "Users view own usage" ON public."usage_tracking" AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "admin_all" ON public."usage_tracking";
CREATE POLICY "admin_all" ON public."usage_tracking" AS PERMISSIVE FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "usage_delete_own" ON public."usage_tracking";
CREATE POLICY "usage_delete_own" ON public."usage_tracking" AS PERMISSIVE FOR DELETE TO authenticated USING ((user_id = auth.uid()));
DROP POLICY IF EXISTS "usage_insert_own" ON public."usage_tracking";
CREATE POLICY "usage_insert_own" ON public."usage_tracking" AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));
DROP POLICY IF EXISTS "admin_all" ON public."user_commitments";
CREATE POLICY "admin_all" ON public."user_commitments" AS PERMISSIVE FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "commitments_all" ON public."user_commitments";
CREATE POLICY "commitments_all" ON public."user_commitments" AS PERMISSIVE FOR ALL TO public USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "uc_all" ON public."user_commitments";
CREATE POLICY "uc_all" ON public."user_commitments" AS PERMISSIVE FOR ALL TO authenticated USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "admin_all" ON public."user_goals";
CREATE POLICY "admin_all" ON public."user_goals" AS PERMISSIVE FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "goals_all" ON public."user_goals";
CREATE POLICY "goals_all" ON public."user_goals" AS PERMISSIVE FOR ALL TO public USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users can insert own progress" ON public."user_progress";
CREATE POLICY "Users can insert own progress" ON public."user_progress" AS PERMISSIVE FOR INSERT TO public WITH CHECK ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users can update own progress" ON public."user_progress";
CREATE POLICY "Users can update own progress" ON public."user_progress" AS PERMISSIVE FOR UPDATE TO public USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users can view own progress" ON public."user_progress";
CREATE POLICY "Users can view own progress" ON public."user_progress" AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users read own progress" ON public."user_progress";
CREATE POLICY "Users read own progress" ON public."user_progress" AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Users write own progress" ON public."user_progress";
CREATE POLICY "Users write own progress" ON public."user_progress" AS PERMISSIVE FOR ALL TO public USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));
DROP POLICY IF EXISTS "admin_all" ON public."user_progress";
CREATE POLICY "admin_all" ON public."user_progress" AS PERMISSIVE FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "progress_all" ON public."user_progress";
CREATE POLICY "progress_all" ON public."user_progress" AS PERMISSIVE FOR ALL TO public USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "up_all" ON public."user_progress";
CREATE POLICY "up_all" ON public."user_progress" AS PERMISSIVE FOR ALL TO authenticated USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "up_select" ON public."user_progress";
CREATE POLICY "up_select" ON public."user_progress" AS PERMISSIVE FOR SELECT TO authenticated USING (((auth.uid() = user_id) OR is_moderator_or_admin()));
DROP POLICY IF EXISTS "Admin full access to video_jobs" ON public."video_jobs";
CREATE POLICY "Admin full access to video_jobs" ON public."video_jobs" AS PERMISSIVE FOR ALL TO authenticated USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))));
DROP POLICY IF EXISTS "Admins can read video_jobs" ON public."video_jobs";
CREATE POLICY "Admins can read video_jobs" ON public."video_jobs" AS PERMISSIVE FOR SELECT TO public USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))));
DROP POLICY IF EXISTS "admin_all" ON public."video_jobs";
CREATE POLICY "admin_all" ON public."video_jobs" AS PERMISSIVE FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "admin_all" ON public."waitlist_email_events";
CREATE POLICY "admin_all" ON public."waitlist_email_events" AS PERMISSIVE FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "admin_manage_email_events" ON public."waitlist_email_events";
CREATE POLICY "admin_manage_email_events" ON public."waitlist_email_events" AS PERMISSIVE FOR ALL TO authenticated USING ((( SELECT profiles.role
   FROM profiles
  WHERE (profiles.id = auth.uid())) = ANY (ARRAY['admin'::text, 'moderator'::text])));
DROP POLICY IF EXISTS "service_insert_email_events" ON public."waitlist_email_events";
CREATE POLICY "service_insert_email_events" ON public."waitlist_email_events" AS PERMISSIVE FOR INSERT TO service_role WITH CHECK (true);
DROP POLICY IF EXISTS "admin_all" ON public."waitlist_entries";
CREATE POLICY "admin_all" ON public."waitlist_entries" AS PERMISSIVE FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "admin_delete_waitlist" ON public."waitlist_entries";
CREATE POLICY "admin_delete_waitlist" ON public."waitlist_entries" AS PERMISSIVE FOR DELETE TO authenticated USING ((( SELECT profiles.role
   FROM profiles
  WHERE (profiles.id = auth.uid())) = 'admin'::text));
DROP POLICY IF EXISTS "admin_read_waitlist" ON public."waitlist_entries";
CREATE POLICY "admin_read_waitlist" ON public."waitlist_entries" AS PERMISSIVE FOR SELECT TO authenticated USING ((( SELECT profiles.role
   FROM profiles
  WHERE (profiles.id = auth.uid())) = ANY (ARRAY['admin'::text, 'moderator'::text])));
DROP POLICY IF EXISTS "admin_update_waitlist" ON public."waitlist_entries";
CREATE POLICY "admin_update_waitlist" ON public."waitlist_entries" AS PERMISSIVE FOR UPDATE TO authenticated USING ((( SELECT profiles.role
   FROM profiles
  WHERE (profiles.id = auth.uid())) = 'admin'::text));
DROP POLICY IF EXISTS "public_insert" ON public."waitlist_entries";
CREATE POLICY "public_insert" ON public."waitlist_entries" AS PERMISSIVE FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "public_insert_waitlist" ON public."waitlist_entries";
CREATE POLICY "public_insert_waitlist" ON public."waitlist_entries" AS PERMISSIVE FOR INSERT TO anon, authenticated WITH CHECK (true);
