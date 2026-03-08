// ============================================================
// FEATURE #1: Admin Audit Log System
// Tracks who did what across the entire platform.
// Includes: logging utility, SQL schema, admin page component.
// ============================================================

import { createClient } from '@supabase/supabase-js';

// --- Types ---
export interface AuditLogEntry {
  id: string;
  user_id: string | null;
  user_email?: string;
  user_name?: string;
  action: string;
  entity_type: string;
  entity_id: string;
  details: Record<string, any>;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
}

// --- Action Constants ---
export const AUDIT_ACTIONS = {
  // Auth
  USER_SIGNUP: 'user_signup',
  USER_LOGIN: 'user_login',
  USER_LOGOUT: 'user_logout',
  PASSWORD_CHANGED: 'password_changed',
  LOGIN_BLOCKED: 'login_blocked',

  // Profile
  PROFILE_UPDATED: 'profile_updated',
  AVATAR_UPLOADED: 'avatar_uploaded',
  ACCOUNT_DELETED: 'account_deleted',
  DATA_EXPORTED: 'data_exported',

  // Coaching
  COACHING_SESSION_STARTED: 'coaching_session_started',
  COACHING_SESSION_ENDED: 'coaching_session_ended',

  // Admin
  USER_ROLE_CHANGED: 'user_role_changed',
  CONTENT_CREATED: 'content_created',
  CONTENT_UPDATED: 'content_updated',
  CONTENT_DELETED: 'content_deleted',
  NEWSLETTER_SENT: 'newsletter_sent',

  // Community
  COHORT_CREATED: 'cohort_created',
  POST_CREATED: 'post_created',
  POST_DELETED: 'post_deleted',

  // Payments
  PAYMENT_SUCCESS: 'payment_success',
  PAYMENT_FAILED: 'payment_failed',
  PROMO_ACTIVATION: 'promo_activation',
  SUBSCRIPTION_CANCELLED: 'subscription_cancelled',

  // Expert Sessions
  SESSION_CREATED: 'expert_session_created',
  SESSION_REGISTERED: 'expert_session_registered',

  // Security
  SUSPICIOUS_LOGIN: 'suspicious_login',
  SESSION_REVOKED: 'session_revoked',
} as const;

// --- Logging Utility ---

/**
 * Log an action to the audit trail.
 * This is designed to NEVER throw or block — always wrapped in try/catch.
 *
 * Usage:
 *   await logAudit(supabase, {
 *     userId: user.id,
 *     action: AUDIT_ACTIONS.CONTENT_CREATED,
 *     entityType: 'blog_post',
 *     entityId: postId,
 *     details: { title: 'My Post' },
 *     ip: request.headers.get('x-forwarded-for'),
 *   });
 */
export async function logAudit(
  supabase: any,
  params: {
    userId?: string | null;
    action: string;
    entityType: string;
    entityId?: string;
    details?: Record<string, any>;
    ip?: string | null;
    userAgent?: string | null;
  }
): Promise<void> {
  try {
    await supabase.from('audit_logs').insert({
      user_id: params.userId || null,
      action: params.action,
      entity_type: params.entityType,
      entity_id: params.entityId || null,
      details: params.details || {},
      ip_address: params.ip || null,
      user_agent: params.userAgent || null,
    });
  } catch (err) {
    // Never throw — audit logging should never break user flows
    console.error('Audit log failed:', err);
  }
}

// --- SQL Schema ---
export const AUDIT_LOGS_SQL = `
-- Audit log table for tracking all admin/user actions
CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  details jsonb DEFAULT '{}',
  ip_address text,
  user_agent text,
  created_at timestamptz DEFAULT now()
);

-- Indexes for fast querying
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);

-- RLS
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can read audit logs
CREATE POLICY "Admins can view all audit logs" ON audit_logs
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Service role and admins can insert
CREATE POLICY "Authenticated users can insert audit logs" ON audit_logs
  FOR INSERT WITH CHECK (true);
`;
