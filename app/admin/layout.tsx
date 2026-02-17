import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import AdminShell from './AdminShell';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  // Check role
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role')
    .eq('id', user.id)
    .single();

  if (!profile || !['admin', 'moderator'].includes(profile.role)) {
    redirect('/dashboard');
  }

  return (
    <AdminShell
      name={profile.full_name || 'Admin'}
      role={profile.role}
    >
      {children}
    </AdminShell>
  );
}
