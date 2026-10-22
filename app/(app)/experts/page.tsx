// app/(app)/experts/page.tsx
// Server Component - fetches expert sessions, the user's registrations,
// and their plan, then hands off to ExpertsClient.
//
// Schema notes - confirmed via prior live-codebase reads, NOT the stale
// database.ts types (which say `is_published`/`session_date`, neither
// of which exist on the real table):
//   expert_sessions: id, title, expert_name, expert_bio, expert_avatar,
//     status ('scheduled'|'live'), scheduled_at, duration_minutes,
//     dimension (text, e.g. 'Mind'/'Vocation'), plan_tier (PlanTier,
//     gates access via lib/planTier.ts canAccess), meeting_url,
//     registration_url, max_attendees, current_attendees.
//   session_registrations: id, session_id, user_id, registered_at.
//
// Route is /experts (not /sessions) - the desktop rail just labels the
// nav item "Sessions".

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { effectivePlanForUser } from '@/lib/access';
import { ExpertsClient } from './ExpertsClient';

export const dynamic = 'force-dynamic';

// The table has existed in two shapes (see database/migrations/20261005_member_features.sql).
// Older rows only carry category / join_url / zoom_link / max_participants / expert_photo_url;
// this maps either shape onto the one the client renders, so the page works before and after
// the migration is applied.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normaliseSession(row: any) {
  return {
    ...row,
    expert_avatar: row.expert_avatar ?? row.expert_photo_url ?? null,
    dimension: row.dimension ?? row.category ?? null,
    meeting_url: row.meeting_url ?? row.join_url ?? row.zoom_link ?? null,
    max_attendees: row.max_attendees ?? row.max_participants ?? null,
    current_attendees: row.current_attendees ?? null,
  };
}

export default async function ExpertsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const [sessionsRes, regsRes, profileRes] = await Promise.all([
    supabase
      .from('expert_sessions')
      .select('*')
      .in('status', ['scheduled', 'live'])
      .order('scheduled_at', { ascending: true }),

    supabase
      .from('session_registrations')
      .select('session_id')
      .eq('user_id', user.id),

    supabase
      .from('profiles')
      .select('subscription_plan, subscription_status, subscription_end')
      .eq('id', user.id)
      .single(),
  ]);

  if (sessionsRes.error) {
    console.error('[experts/page] sessions query failed:', sessionsRes.error.message);
  }

  return (
    <ExpertsClient
      sessions={(sessionsRes.data ?? []).map(normaliseSession)}
      registeredIds={regsRes.data?.map((r) => r.session_id) ?? []}
      userPlan={await effectivePlanForUser(user.id, profileRes.data)}
      userId={user.id}
    />
  );
}
