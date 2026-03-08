// ============================================================
// FEATURE #2: Role-Based Permissions System
// Defines roles: admin, moderator, member
// Controls what each role can access and modify.
// ============================================================

// --- Role Definitions ---
export type UserRole = 'admin' | 'moderator' | 'member';

export type Permission =
  // Admin Dashboard
  | 'admin.access'
  | 'admin.view_stats'
  // User Management
  | 'users.view'
  | 'users.edit_role'
  | 'users.delete'
  | 'users.export'
  // Content Management
  | 'content.blog.create'
  | 'content.blog.edit'
  | 'content.blog.delete'
  | 'content.blog.publish'
  | 'content.courses.create'
  | 'content.courses.edit'
  | 'content.courses.delete'
  | 'content.courses.publish'
  // Expert Sessions
  | 'experts.create'
  | 'experts.edit'
  | 'experts.delete'
  // Community
  | 'community.cohorts.create'
  | 'community.cohorts.edit'
  | 'community.cohorts.delete'
  | 'community.posts.moderate'
  | 'community.posts.delete'
  // Newsletter
  | 'newsletter.compose'
  | 'newsletter.send'
  | 'newsletter.manage_subscribers'
  // Audit & Security
  | 'audit.view_logs'
  | 'security.view_sessions'
  // Reports
  | 'reports.generate'
  | 'reports.export'
  // Payments
  | 'payments.view'
  | 'payments.refund';

// --- Permission Map ---
const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  admin: [
    // Admins can do everything
    'admin.access', 'admin.view_stats',
    'users.view', 'users.edit_role', 'users.delete', 'users.export',
    'content.blog.create', 'content.blog.edit', 'content.blog.delete', 'content.blog.publish',
    'content.courses.create', 'content.courses.edit', 'content.courses.delete', 'content.courses.publish',
    'experts.create', 'experts.edit', 'experts.delete',
    'community.cohorts.create', 'community.cohorts.edit', 'community.cohorts.delete',
    'community.posts.moderate', 'community.posts.delete',
    'newsletter.compose', 'newsletter.send', 'newsletter.manage_subscribers',
    'audit.view_logs', 'security.view_sessions',
    'reports.generate', 'reports.export',
    'payments.view', 'payments.refund',
  ],

  moderator: [
    // Moderators: content management + community moderation, NO user management or payments
    'admin.access', 'admin.view_stats',
    'users.view', // Can view users but NOT edit roles or delete
    'content.blog.create', 'content.blog.edit', // Can create/edit but NOT delete/publish
    'content.courses.create', 'content.courses.edit',
    'experts.create', 'experts.edit', // Can manage sessions but not delete
    'community.cohorts.edit',
    'community.posts.moderate', 'community.posts.delete',
    'newsletter.compose', // Can compose but NOT send
    'reports.generate', // Can generate but NOT export
  ],

  member: [
    // Regular users — no admin access
  ],
};

// --- Permission Checking ---

/**
 * Check if a role has a specific permission.
 */
export function hasPermission(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

/**
 * Check if a role has ALL of the specified permissions.
 */
export function hasAllPermissions(role: UserRole, permissions: Permission[]): boolean {
  return permissions.every(p => hasPermission(role, p));
}

/**
 * Check if a role has ANY of the specified permissions.
 */
export function hasAnyPermission(role: UserRole, permissions: Permission[]): boolean {
  return permissions.some(p => hasPermission(role, p));
}

/**
 * Get all permissions for a role.
 */
export function getPermissions(role: UserRole): Permission[] {
  return ROLE_PERMISSIONS[role] || [];
}

/**
 * Get a human-readable description of what a role can/cannot do.
 */
export function getRoleDescription(role: UserRole): string {
  switch (role) {
    case 'admin':
      return 'Full access to all platform features, user management, payments, and security settings.';
    case 'moderator':
      return 'Can manage content (blog, courses, expert sessions), moderate community posts, and compose newsletters. Cannot manage users, send newsletters, access payments, or delete content.';
    case 'member':
      return 'Standard platform access. Can use coaching, join community, attend expert sessions, and access courses.';
    default:
      return 'Unknown role.';
  }
}

// --- React Hook for Client-Side Permission Checking ---
export const PERMISSION_HOOK_CODE = `
'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { hasPermission, type Permission, type UserRole } from '@/lib/permissions';

export function usePermission(permission: Permission): { allowed: boolean; loading: boolean; role: UserRole | null } {
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();
        setRole((profile?.role as UserRole) || 'member');
      }
      setLoading(false);
    });
  }, []);

  return {
    allowed: role ? hasPermission(role, permission) : false,
    loading,
    role,
  };
}
`;

// --- Middleware Helper ---

/**
 * Server-side permission check for API routes.
 * Usage in API route:
 *   const check = await checkPermissionServer(supabase, userId, 'content.blog.publish');
 *   if (!check.allowed) return NextResponse.json({ error: check.error }, { status: 403 });
 */
export async function checkPermissionServer(
  supabase: any,
  userId: string,
  permission: Permission
): Promise<{ allowed: boolean; error?: string; role?: UserRole }> {
  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single();

    const role = (profile?.role as UserRole) || 'member';
    const allowed = hasPermission(role, permission);

    return {
      allowed,
      role,
      error: allowed ? undefined : `Insufficient permissions. Required: ${permission}. Your role: ${role}.`,
    };
  } catch {
    return { allowed: false, error: 'Failed to verify permissions.' };
  }
}

// --- SQL: Update profiles role enum ---
export const PERMISSIONS_SQL = `
-- Add 'moderator' as a valid role (in addition to 'member' and 'admin')
-- If using a check constraint:
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check 
  CHECK (role IN ('member', 'moderator', 'admin'));

-- Create a permissions audit view for easy querying
CREATE OR REPLACE VIEW admin_permissions_view AS
SELECT
  p.id,
  p.full_name,
  p.role,
  p.created_at,
  (SELECT COUNT(*) FROM audit_logs al WHERE al.user_id = p.id) as action_count,
  (SELECT MAX(al.created_at) FROM audit_logs al WHERE al.user_id = p.id) as last_action
FROM profiles p
WHERE p.role IN ('admin', 'moderator')
ORDER BY p.role, p.full_name;
`;
