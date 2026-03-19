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
  | 'content.pipeline.view'
  | 'content.pipeline.approve'
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
    'content.pipeline.view', 'content.pipeline.approve', // Content pipeline access
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


// ─────────────────────────────────────────────────────────────────────────────
// PERMISSION_LABELS
// Human-readable metadata for every permission.
// Used by the /admin/permissions UI to show labels, descriptions, groups,
// and which admin page the permission controls access to.
// ─────────────────────────────────────────────────────────────────────────────
export interface PermissionMeta {
  label:       string;   // Short display name
  description: string;   // What it lets the user do
  group:       string;   // Section header in the UI
  page?:       string;   // Admin page route it primarily gates
}

export const PERMISSION_LABELS: Record<Permission, PermissionMeta> = {
  // ── Admin Dashboard ──────────────────────────────────────────────────────
  'admin.access': {
    label: 'Admin access',
    description: 'Can log into /admin and see the dashboard overview',
    group: 'Admin Dashboard',
    page: '/admin',
  },
  'admin.view_stats': {
    label: 'View platform stats',
    description: 'Can see user counts, session totals, and growth metrics on the dashboard',
    group: 'Admin Dashboard',
    page: '/admin',
  },

  // ── User Management ───────────────────────────────────────────────────────
  'users.view': {
    label: 'View users',
    description: 'Can open /admin/users and see the full user list with profiles',
    group: 'User Management',
    page: '/admin/users',
  },
  'users.edit_role': {
    label: 'Edit user roles',
    description: 'Can change a user from member → moderator or admin (admin only)',
    group: 'User Management',
    page: '/admin/users',
  },
  'users.delete': {
    label: 'Delete users',
    description: 'Can permanently delete a user account (admin only)',
    group: 'User Management',
    page: '/admin/users',
  },
  'users.export': {
    label: 'Export user data',
    description: 'Can download the full user list as CSV (admin only)',
    group: 'User Management',
    page: '/admin/users',
  },

  // ── Content Pipeline ─────────────────────────────────────────────────────
  'content.pipeline.view': {
    label: 'View content pipeline',
    description: 'Can open /admin/content and see all scheduled and draft content items',
    group: 'Content Pipeline',
    page: '/admin/content',
  },
  'content.pipeline.approve': {
    label: 'Approve & schedule content',
    description: 'Can approve content items, schedule posts to Buffer, and push to blog/newsletter queue',
    group: 'Content Pipeline',
    page: '/admin/content',
  },

  // ── Content — Blog ────────────────────────────────────────────────────────
  'content.blog.create': {
    label: 'Write blog posts',
    description: 'Can create new blog post drafts in /admin/blog',
    group: 'Blog',
    page: '/admin/blog',
  },
  'content.blog.edit': {
    label: 'Edit blog posts',
    description: 'Can edit existing blog post drafts and published posts',
    group: 'Blog',
    page: '/admin/blog',
  },
  'content.blog.delete': {
    label: 'Delete blog posts',
    description: 'Can permanently delete blog posts (admin only)',
    group: 'Blog',
    page: '/admin/blog',
  },
  'content.blog.publish': {
    label: 'Publish blog posts',
    description: 'Can set a blog post to published and make it live',
    group: 'Blog',
    page: '/admin/blog',
  },

  // ── Content — Courses ─────────────────────────────────────────────────────
  'content.courses.create': {
    label: 'Create courses',
    description: 'Can create new courses and lessons in /admin/courses',
    group: 'Courses',
    page: '/admin/courses',
  },
  'content.courses.edit': {
    label: 'Edit courses',
    description: 'Can edit existing course content and lessons',
    group: 'Courses',
    page: '/admin/courses',
  },
  'content.courses.delete': {
    label: 'Delete courses',
    description: 'Can permanently delete courses (admin only)',
    group: 'Courses',
    page: '/admin/courses',
  },
  'content.courses.publish': {
    label: 'Publish courses',
    description: 'Can make a course live for all users (admin only)',
    group: 'Courses',
    page: '/admin/courses',
  },

  // ── Expert Sessions ───────────────────────────────────────────────────────
  'experts.create': {
    label: 'Create expert sessions',
    description: 'Can schedule new expert/mentor sessions in /admin/experts',
    group: 'Expert Sessions',
    page: '/admin/experts',
  },
  'experts.edit': {
    label: 'Edit expert sessions',
    description: 'Can edit session details, dates, and speaker info',
    group: 'Expert Sessions',
    page: '/admin/experts',
  },
  'experts.delete': {
    label: 'Delete expert sessions',
    description: 'Can permanently cancel and remove sessions (admin only)',
    group: 'Expert Sessions',
    page: '/admin/experts',
  },

  // ── Community ─────────────────────────────────────────────────────────────
  'community.cohorts.create': {
    label: 'Create cohorts',
    description: 'Can create new peer cohort groups in /admin/cohorts',
    group: 'Community',
    page: '/admin/cohorts',
  },
  'community.cohorts.edit': {
    label: 'Edit cohorts',
    description: 'Can edit cohort name, description, and members',
    group: 'Community',
    page: '/admin/cohorts',
  },
  'community.cohorts.delete': {
    label: 'Delete cohorts',
    description: 'Can permanently delete a cohort and its posts (admin only)',
    group: 'Community',
    page: '/admin/cohorts',
  },
  'community.posts.moderate': {
    label: 'Moderate community posts',
    description: 'Can hide or flag inappropriate posts in /admin/community',
    group: 'Community',
    page: '/admin/community',
  },
  'community.posts.delete': {
    label: 'Delete community posts',
    description: 'Can permanently delete posts and replies from any cohort',
    group: 'Community',
    page: '/admin/community',
  },

  // ── Newsletter ────────────────────────────────────────────────────────────
  'newsletter.compose': {
    label: 'Compose newsletters',
    description: 'Can write and save newsletter drafts in /admin/newsletter',
    group: 'Newsletter',
    page: '/admin/newsletter',
  },
  'newsletter.send': {
    label: 'Send newsletters',
    description: 'Can send a newsletter to subscribers (admin only)',
    group: 'Newsletter',
    page: '/admin/newsletter',
  },
  'newsletter.manage_subscribers': {
    label: 'Manage subscribers',
    description: 'Can view, sync, and manage the subscriber list (admin only)',
    group: 'Newsletter',
    page: '/admin/newsletter',
  },

  // ── Reports ───────────────────────────────────────────────────────────────
  'reports.generate': {
    label: 'Generate reports',
    description: 'Can run platform analytics reports in /admin/intel',
    group: 'Reports & Analytics',
    page: '/admin/intel',
  },
  'reports.export': {
    label: 'Export reports',
    description: 'Can download report data as CSV (admin only)',
    group: 'Reports & Analytics',
    page: '/admin/intel',
  },

  // ── Audit & Security ──────────────────────────────────────────────────────
  'audit.view_logs': {
    label: 'View audit logs',
    description: 'Can see admin action history in /admin/logs (admin only)',
    group: 'Security',
    page: '/admin/logs',
  },
  'security.view_sessions': {
    label: 'View active sessions',
    description: 'Can see all active user sessions (admin only)',
    group: 'Security',
    page: '/admin/logs',
  },

  // ── Payments ──────────────────────────────────────────────────────────────
  'payments.view': {
    label: 'View payments',
    description: 'Can see payment history and subscription data (admin only)',
    group: 'Payments',
    page: '/admin/master',
  },
  'payments.refund': {
    label: 'Issue refunds',
    description: 'Can process refunds through Paystack (admin only)',
    group: 'Payments',
    page: '/admin/master',
  },
};

// ── Helper: get effective permissions for a user ─────────────────────────────
// If user has custom permissions set, use those. Otherwise use role defaults.
export function getEffectivePermissions(
  role: UserRole,
  customPermissions: Permission[] | null
): Permission[] {
  if (customPermissions && customPermissions.length > 0) return customPermissions;
  return ROLE_PERMISSIONS[role] || [];
}

// ── Helper: check if a user can access an admin nav route ────────────────────
export function canAccessAdminRoute(
  role: UserRole,
  customPermissions: Permission[] | null,
  route: string
): boolean {
  if (role === 'admin') return true; // admins always have full access
  const effective = getEffectivePermissions(role, customPermissions);
  // Find any permission that maps to this route
  return Object.entries(PERMISSION_LABELS).some(([perm, meta]) =>
    meta.page === route && effective.includes(perm as Permission)
  );
}

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
