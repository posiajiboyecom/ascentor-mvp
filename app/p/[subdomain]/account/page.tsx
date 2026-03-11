// ============================================================
// app/p/[subdomain]/account/page.tsx
// Standalone partner account page — NO Tailwind dependency.
// All styles inline. Works in the partner isolated layout.
// ============================================================

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import PartnerAccountClient from './PartnerAccountClient';

export default async function PartnerAccountPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('login');

  const [profileRes, notifRes] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('notification_preferences').select('*').eq('user_id', user.id).single(),
  ]);

  return (
    <PartnerAccountClient
      profile={profileRes.data}
      email={user.email || ''}
      authProvider={user.app_metadata?.provider || 'email'}
      userId={user.id}
      notifications={notifRes.data}
    />
  );
}
