import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import DashboardClient from './DashboardClient';

// ─────────────────────────────────────────────────────────────────────────────
// P1 FIX: All 5 DB queries now run in parallel via Promise.all.
// Before: 5 sequential awaits = 400–600ms minimum on a 100ms connection.
// After:  All fire simultaneously — total time = slowest single query (~100ms).
// ─────────────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // All independent queries fire in parallel — not sequentially
  const [
    profileRes,
    goalRes,
    sessionsRes,
    commitmentsRes,
    expertRes,
  ] = await Promise.all([
    supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single(),

    supabase
      .from('user_goals')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single(),

    supabase
      .from('coaching_sessions')
      .select('id')
      .eq('user_id', user.id)
      .gte('created_at', new Date(Date.now() - 7 * 86_400_000).toISOString()),

    supabase
      .from('user_commitments')
      .select('*')
      .eq('user_id', user.id)
      .eq('completed', false)
      .order('due_date')
      .limit(5),

    supabase
      .from('expert_sessions')
      .select('*')
      .eq('status', 'scheduled')
      .gte('scheduled_at', new Date().toISOString())
      .order('scheduled_at')
      .limit(1),
  ]);

  return (
    <DashboardClient
      profile={profileRes.data}
      goal={goalRes.data}
      sessionsThisWeek={sessionsRes.data?.length ?? 0}
      commitments={commitmentsRes.data ?? []}
      nextExpert={expertRes.data?.[0] ?? null}
    />
  );
}
