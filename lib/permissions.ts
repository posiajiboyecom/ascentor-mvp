// ============================================================
// ASCENTOR · Permissions System · v2.0
// Roles: admin (root), moderator (mentor), member
//
// Key design:
//  - Admin has root access to everything, including the ability
//    to grant/revoke individual permissions per moderator.
//  - Moderators start with a default set, then admin can add/remove.
//  - Per-user permission overrides are stored in profiles.permissions (jsonb).
//    If null, the role defaults apply.
// ============================================================

export type UserRole = 'admin' | 'moderator' | 'member';

export type Permission =
  // Admin
  | 'admin.access'
  | 'admin.view_stats'
  | 'admin.manage_permissions'   // Only admin: grant/revoke permissions to moderators
  | 'admin.master_dashboard'     // Marketing KPIs, agents, social queue
  // Users
  | 'users.view'
  | 'users.edit_role'
  | 'users.delete'
  | 'users.export'
  // Blog
  | 'content.blog.create'
  | 'content.blog.edit_own'      // Can edit posts they authored
  | 'content.blog.edit_any'      // Can edit any post (admin only)
  | 'content.blog.delete'
  | 'content.blog.publish'
  // Courses
  | 'content.courses.create'
  | 'content.courses.edit'
  | 'content.courses.delete'
  | 'content.courses.publish'
  // Expert Events
  | 'experts.create'
  | 'experts.edit_own'
  | 'experts.edit_any'
  | 'experts.delete'
  // Cohorts
  | 'community.cohorts.create'
  | 'community.cohorts.edit_own'   // Edit cohorts they created
  | 'community.cohorts.edit_any'   // Edit any cohort
  | 'community.cohorts.delete'
  | 'community.cohorts.view_members_own'  // View members of own cohort
  | 'community.cohorts.view_members_any'  // View members of any cohort
  | 'community.posts.moderate'
  | 'community.posts.delete'
  // Newsletter
  | 'newsletter.compose'
  | 'newsletter.send'
  | 'newsletter.manage_subscribers'
  // Mentors
  | 'mentors.view'
  | 'mentors.approve'
  // Audit & Reports
  | 'audit.view_logs'
  | 'reports.generate'
  | 'reports.export'
  // Payments
  | 'payments.view'
  | 'payments.refund'
  // Promo codes
  | 'promos.manage';

// ── Default permissions per role ─────────────────────────────
// These are the DEFAULTS. Admin can override per-user via profiles.permissions.
export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  admin: [
    // Root: full access to everything
    'admin.access', 'admin.view_stats', 'admin.manage_permissions', 'admin.master_dashboard',
    'users.view', 'users.edit_role', 'users.delete', 'users.export',
    'content.blog.create', 'content.blog.edit_own', 'content.blog.edit_any',
    'content.blog.delete', 'content.blog.publish',
    'content.courses.create', 'content.courses.edit', 'content.courses.delete', 'content.courses.publish',
    'experts.create', 'experts.edit_own', 'experts.edit_any', 'experts.delete',
    'community.cohorts.create', 'community.cohorts.edit_own', 'community.cohorts.edit_any',
    'community.cohorts.delete', 'community.cohorts.view_members_own', 'community.cohorts.view_members_any',
    'community.posts.moderate', 'community.posts.delete',
    'newsletter.compose', 'newsletter.send', 'newsletter.manage_subscribers',
    'mentors.view', 'mentors.approve',
    'audit.view_logs', 'reports.generate', 'reports.export',
    'payments.view', 'payments.refund',
    'promos.manage',
  ],

  moderator: [
    // Mentor defaults — admin can expand or restrict per person
    'admin.access',
    'content.blog.create', 'content.blog.edit_own',   // Write about their expertise
    'experts.create', 'experts.edit_own',              // Create & manage their own expert events
    'community.cohorts.create', 'community.cohorts.edit_own', // Create & manage own cohorts
    'community.cohorts.view_members_own',              // See who's in their cohorts
  ],

  member: [],
};

// ── Human-readable labels for each permission ────────────────
export const PERMISSION_LABELS: Record<Permission, { label: string; description: string; group: string }> = {
  'admin.access':                      { group: 'Admin',     label: 'Admin Access',               description: 'Access the admin panel at all' },
  'admin.view_stats':                  { group: 'Admin',     label: 'View Stats',                  description: 'See overview stats on the admin home' },
  'admin.manage_permissions':          { group: 'Admin',     label: 'Manage Permissions',          description: 'Grant or revoke permissions for other moderators (admin only)' },
  'admin.master_dashboard':            { group: 'Admin',     label: 'Master Dashboard',            description: 'Access marketing KPIs, AI agents, social queue' },
  'users.view':                        { group: 'Users',     label: 'View Users',                  description: 'See the users list and profiles' },
  'users.edit_role':                   { group: 'Users',     label: 'Edit User Roles',             description: 'Promote or demote users' },
  'users.delete':                      { group: 'Users',     label: 'Delete Users',                description: 'Permanently delete user accounts' },
  'users.export':                      { group: 'Users',     label: 'Export Users',                description: 'Download the user list as CSV' },
  'content.blog.create':               { group: 'Blog',      label: 'Create Posts',                description: 'Write and submit new blog posts' },
  'content.blog.edit_own':             { group: 'Blog',      label: 'Edit Own Posts',              description: 'Edit posts authored by themselves' },
  'content.blog.edit_any':             { group: 'Blog',      label: 'Edit Any Post',               description: 'Edit any blog post regardless of author' },
  'content.blog.delete':               { group: 'Blog',      label: 'Delete Posts',                description: 'Permanently delete blog posts' },
  'content.blog.publish':              { group: 'Blog',      label: 'Publish Posts',               description: 'Set a post to published (live on site)' },
  'content.courses.create':            { group: 'Courses',   label: 'Create Courses',              description: 'Add new courses to the platform' },
  'content.courses.edit':              { group: 'Courses',   label: 'Edit Courses',                description: 'Edit any course' },
  'content.courses.delete':            { group: 'Courses',   label: 'Delete Courses',              description: 'Remove courses from the platform' },
  'content.courses.publish':           { group: 'Courses',   label: 'Publish Courses',             description: 'Make courses visible to members' },
  'experts.create':                    { group: 'Experts',   label: 'Create Expert Events',        description: 'Schedule new expert sessions' },
  'experts.edit_own':                  { group: 'Experts',   label: 'Edit Own Events',             description: 'Edit expert sessions they created' },
  'experts.edit_any':                  { group: 'Experts',   label: 'Edit Any Event',              description: 'Edit any expert session' },
  'experts.delete':                    { group: 'Experts',   label: 'Delete Events',               description: 'Remove expert sessions' },
  'community.cohorts.create':          { group: 'Cohorts',   label: 'Create Cohorts',              description: 'Start new community cohorts' },
  'community.cohorts.edit_own':        { group: 'Cohorts',   label: 'Edit Own Cohorts',            description: 'Edit cohorts they created' },
  'community.cohorts.edit_any':        { group: 'Cohorts',   label: 'Edit Any Cohort',             description: 'Edit any cohort on the platform' },
  'community.cohorts.delete':          { group: 'Cohorts',   label: 'Delete Cohorts',              description: 'Remove cohorts' },
  'community.cohorts.view_members_own':{ group: 'Cohorts',   label: 'View Own Cohort Members',    description: 'See the member list for cohorts they created' },
  'community.cohorts.view_members_any':{ group: 'Cohorts',   label: 'View Any Cohort Members',    description: 'See member lists for any cohort' },
  'community.posts.moderate':          { group: 'Community', label: 'Moderate Posts',              description: 'Hide or flag community posts' },
  'community.posts.delete':            { group: 'Community', label: 'Delete Posts',                description: 'Permanently delete community posts' },
  'newsletter.compose':                { group: 'Newsletter',label: 'Compose Newsletters',         description: 'Draft newsletter content' },
  'newsletter.send':                   { group: 'Newsletter',label: 'Send Newsletters',            description: 'Send newsletters to subscriber list' },
  'newsletter.manage_subscribers':     { group: 'Newsletter',label: 'Manage Subscribers',          description: 'Add, remove, or tag newsletter subscribers' },
  'mentors.view':                      { group: 'Mentors',   label: 'View Applications',           description: 'See the mentor application list' },
  'mentors.approve':                   { group: 'Mentors',   label: 'Approve Mentors',             description: 'Approve, reject, or activate mentor applications' },
  'audit.view_logs':                   { group: 'Security',  label: 'View Audit Logs',             description: 'Read the admin audit trail' },
  'reports.generate':                  { group: 'Reports',   label: 'Generate Reports',            description: 'Run platform analytics reports' },
  'reports.export':                    { group: 'Reports',   label: 'Export Reports',              description: 'Download reports as CSV/PDF' },
  'payments.view':                     { group: 'Payments',  label: 'View Payments',               description: 'See subscription and payment data' },
  'payments.refund':                   { group: 'Payments',  label: 'Issue Refunds',               description: 'Process refunds for subscribers' },
  'promos.manage':                     { group: 'Promos',    label: 'Manage Promo Codes',          description: 'Create and manage discount codes' },
};

// ── Nav access map — which permission gates each nav section ─
// Used by AdminShell to show/hide nav items per role/user
export const NAV_PERMISSION: Record<string, Permission> = {
  '/admin':            'admin.view_stats',
  '/admin/users':      'users.view',
  '/admin/cohorts':    'community.cohorts.create',
  '/admin/experts':    'experts.create',
  '/admin/courses':    'content.courses.create',
  '/admin/coaching':   'admin.view_stats',
  '/admin/blog':       'content.blog.create',
  '/admin/newsletter': 'newsletter.compose',
  '/admin/mentors':    'mentors.view',
  '/admin/promo-codes':'promos.manage',
  '/admin/logs':       'audit.view_logs',
  '/admin/reports':    'reports.generate',
  '/admin/master':     'admin.master_dashboard',
  '/admin/permissions':'admin.manage_permissions',
};

// ── Core permission checking ──────────────────────────────────

export function hasPermission(
  role: UserRole,
  permission: Permission,
  overrides?: Permission[] | null
): boolean {
  // If the user has explicit per-user overrides stored (admin-granted), use those
  if (overrides && overrides.length > 0) {
    return overrides.includes(permission);
  }
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function hasAllPermissions(role: UserRole, permissions: Permission[], overrides?: Permission[] | null): boolean {
  return permissions.every(p => hasPermission(role, p, overrides));
}

export function hasAnyPermission(role: UserRole, permissions: Permission[], overrides?: Permission[] | null): boolean {
  return permissions.some(p => hasPermission(role, p, overrides));
}

export function getPermissions(role: UserRole, overrides?: Permission[] | null): Permission[] {
  if (overrides && overrides.length > 0) return overrides;
  return ROLE_PERMISSIONS[role] || [];
}

export function getRoleDescription(role: UserRole): string {
  switch (role) {
    case 'admin':     return 'Root access. Full control over all platform features, users, payments, security, and permissions.';
    case 'moderator': return 'Mentor access. Can create cohorts, expert events, and blog posts by default. Admin can grant additional permissions.';
    case 'member':    return 'Standard member. Platform access only — no admin panel.';
    default:          return 'Unknown role.';
  }
}

// ── Server-side permission check for API routes ───────────────
export async function checkPermissionServer(
  supabase: any,
  userId: string,
  permission: Permission
): Promise<{ allowed: boolean; error?: string; role?: UserRole }> {
  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, permissions')
      .eq('id', userId)
      .single();

    const role      = (profile?.role as UserRole) || 'member';
    const overrides = profile?.permissions as Permission[] | null;
    const allowed   = hasPermission(role, permission, overrides);

    return {
      allowed,
      role,
      error: allowed ? undefined : `Insufficient permissions. Required: ${permission}. Your role: ${role}.`,
    };
  } catch {
    return { allowed: false, error: 'Failed to verify permissions.' };
  }
}

// ── SQL migration ─────────────────────────────────────────────
export const PERMISSIONS_SQL = `
-- Add permissions jsonb column to profiles (stores per-user overrides)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS permissions jsonb DEFAULT NULL;

-- Update role constraint
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('member', 'moderator', 'admin'));

-- Index for permission lookups
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);

-- View: all staff with their effective permissions
CREATE OR REPLACE VIEW admin_staff_view AS
SELECT
  p.id, p.full_name, p.email, p.role,
  p.permissions as custom_permissions,
  p.created_at,
  (SELECT COUNT(*) FROM audit_logs al WHERE al.user_id = p.id) as action_count
FROM profiles p
WHERE p.role IN ('admin', 'moderator')
ORDER BY p.role, p.full_name;
`;
