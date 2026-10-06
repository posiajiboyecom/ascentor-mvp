import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import AccountClient from './AccountClient';

export default async function AccountPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [profileRes, notifRes] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('notification_preferences').select('*').eq('user_id', user.id).single(),
  ]);

  return (
    <AccountClient
      profile={profileRes.data}
      email={user.email || ''}
      authProvider={user.app_metadata?.provider || 'email'}
      providers={[...new Set([...((user.app_metadata?.providers as string[] | undefined) ?? []), user.app_metadata?.provider as string | undefined].filter((p): p is string => Boolean(p)))]}
      memberSince={user.created_at}
      userId={user.id}
      notifications={notifRes.data}
    />
  );
}
