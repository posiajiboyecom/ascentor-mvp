import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

// Admin-only route guard — moderators are redirected to /admin
export default async function AdminOnlyLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'admin') redirect('/admin');

  return <>{children}</>;
}
