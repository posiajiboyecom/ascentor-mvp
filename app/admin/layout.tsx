export const dynamic = 'force-dynamic';

import AdminShell from '@/components/AdminShell';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import type { Permission } from '@/lib/permissions';

// ═══════════════════════════════════════════════════════════
// Admin layout
// Drop in: app/admin/layout.tsx
//
// Auth gate for every /admin/* route.
//   1. Must be logged in              → otherwise /login
//   2. Must be admin or moderator     → otherwise /dashboard
//   3. Hydrates AdminShell with name, role, and permissions
//
// Previously there were two versions floating around:
//   • An older one that wrapped the permissions fetch in a
//     try/catch (swallowed errors if the column didn't exist)
//   • A newer one that assumed the column existed (would crash
//     on environments where the permissions migration hadn't run)
//
// This version is a single SELECT with `permissions` included
// in the same query — if the column is missing, the overall
// query errors and we fall back to a second, minimal query.
// Clean in the happy path, safe in the unmigrated path.
// ═══════════════════════════════════════════════════════════
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Try the full query first (includes permissions).
  let profile: { full_name: string | null; role: string; permissions: Permission[] | null } | null = null;

  const fullQuery = await supabase
    .from('profiles')
    .select('full_name, role, permissions')
    .eq('id', user.id)
    .single();

  if (fullQuery.error) {
    // Most likely: permissions column doesn't exist yet in this env.
    // Retry with the core columns only so the app still renders.
    const fallback = await supabase
      .from('profiles')
      .select('full_name, role')
      .eq('id', user.id)
      .single();

    if (fallback.data) {
      profile = { ...fallback.data, permissions: null };
    }
  } else {
    profile = fullQuery.data;
  }

  if (!profile || !['admin', 'moderator'].includes(profile.role)) {
    redirect('/dashboard');
  }

  return (
    <AdminShell
      name={profile.full_name || user.email || 'Admin'}
      role={profile.role}
      userPermissions={profile.permissions}
    >
      <div className="admin-wrapper">
        <style>{`
          .admin-wrapper table { display: block; overflow-x: auto; -webkit-overflow-scrolling: touch; }
          .admin-wrapper .grid-cols-12 { min-width: 700px; }
          @media (max-width: 768px) {
            .admin-wrapper { padding: 0 4px; }
            .admin-wrapper h1 { font-size: 1.25rem !important; }
            .admin-wrapper button { white-space: nowrap; font-size: 0.75rem; }
            .admin-wrapper select { font-size: 0.75rem; }
          }
        `}</style>
        {children}
      </div>
    </AdminShell>
  );
}
