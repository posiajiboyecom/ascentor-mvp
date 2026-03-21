export const dynamic = 'force-dynamic';

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import GuardsmannShell from './GuardsmannShell';

export default async function GuardsmannLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role')
    .eq('id', user.id)
    .single();

  if (!profile || !['admin', 'moderator'].includes(profile.role)) {
    redirect('/dashboard');
  }

  return (
    <GuardsmannShell name={profile.full_name || user.email || 'Posi'}>
      {children}
    </GuardsmannShell>
  );
}
