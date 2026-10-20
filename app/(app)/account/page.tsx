import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import AccountClient from './AccountClient';

// Members: the old Account page is now Settings, so /account?section=plan keeps working by redirecting to /settings?tab=plan.
// The partner sub-site (app/p/[subdomain]) still renders this page directly, with no search params, and keeps the old screen.
const TAB: Record<string, string> = { account: 'account', profile: 'profile', security: 'security', plan: 'plan', notifications: 'alerts', alerts: 'alerts' };

export default async function AccountPage({ searchParams }: { searchParams?: Promise<{ section?: string }> }) {
  if (searchParams) {
    const { section } = await searchParams;
    redirect(`/settings?tab=${TAB[section ?? ''] ?? 'account'}`);
  }
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
