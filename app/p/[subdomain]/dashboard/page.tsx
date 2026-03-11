import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import DashboardClient from './DashboardClient';

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ subdomain: string }>;
}) {
  const { subdomain } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/p/${subdomain}/login`);

  const [profileRes, goalRes, sessionsRes, commitmentsRes, expertRes] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('user_goals').select('*').eq('user_id', user.id)
      .order('created_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('coaching_sessions').select('id')
      .eq('user_id', user.id)
      .gte('created_at', new Date(Date.now() - 7 * 86400000).toISOString()),
    supabase.from('user_commitments').select('*').eq('user_id', user.id)
      .eq('completed', false).order('due_date').limit(5),
    supabase.from('expert_sessions').select('*')
      .eq('status', 'scheduled')
      .gte('scheduled_at', new Date().toISOString())
      .order('scheduled_at').limit(1),
  ]);

  return (
    <DashboardClient
      profile={profileRes.data}
      goal={goalRes.data}
      sessionsThisWeek={sessionsRes.data?.length || 0}
      commitments={commitmentsRes.data || []}
      nextExpert={expertRes.data?.[0] || null}
    />
  );
}
