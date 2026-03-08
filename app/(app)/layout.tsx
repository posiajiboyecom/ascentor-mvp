import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import AppShell from '@/components/AppShell';

// Coach page needs chatLayout so the input bar doesn't overlap the bottom nav
export default async function CoachLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role')
    .eq('id', user.id)
    .single();

  const initials = (profile?.full_name || 'U')
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase();

  const isAdmin = ['admin', 'moderator'].includes(profile?.role || '');

  return (
    <AppShell initials={initials} isAdmin={isAdmin}>
      {children}
    </AppShell>
  );
}
