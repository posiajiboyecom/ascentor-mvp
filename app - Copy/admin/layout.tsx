export const dynamic = 'force-dynamic';

import AdminShell from '@/components/AdminShell';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Select core fields first — always exists
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role')
    .eq('id', user.id)
    .single();

  if (!profile || !['admin', 'moderator'].includes(profile.role)) {
    redirect('/dashboard');
  }

  // Permissions column may not exist yet — fetch separately and swallow error
  let userPermissions: string[] | null = null;
  try {
    const { data: permRow } = await supabase
      .from('profiles')
      .select('permissions')
      .eq('id', user.id)
      .single();
    userPermissions = (permRow?.permissions as string[] | null) ?? null;
  } catch {
    // Column doesn't exist yet — permissions system not migrated, skip silently
  }

  return (
    <AdminShell
      name={profile.full_name || user.email || 'Admin'}
      role={profile.role}
      userPermissions={userPermissions}
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
