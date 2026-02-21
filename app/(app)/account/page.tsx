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
      userId={user.id}
      notifications={notifRes.data}
    />
  );
}
