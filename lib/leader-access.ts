// lib/leader-access.ts
// Server-only. The Leader plan is not for everyone. A member may choose it if ANY of these is true:
//  - the team marked them Leader (Members > Make Leader, member_profile.is_facilitator)
//  - they accepted a Leader invite (sets is_facilitator and profiles.leader_free)
//  - onboarding placed them at the Leading stage (member_profile.stage)
// Leaders lead for free; the Leader plan is never purchasable at checkout. The pure rule is leaderEligible().
import 'server-only';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { leaderEligible } from '@/lib/leader-invite-core';

export async function hasFreeLeaderAccess(userId: string | null | undefined): Promise<boolean> {
  if (!userId) return false;
  try {
    const [{ data: mp }, pr] = await Promise.all([
      supabaseAdmin.from('member_profile').select('is_facilitator, stage').eq('user_id', userId).maybeSingle(),
      // leader_free arrives with the 20261025b migration; until then this query errors and counts as false.
      supabaseAdmin.from('profiles').select('leader_free').eq('id', userId).maybeSingle(),
    ]);
    return leaderEligible({ isMarkedLeader: mp?.is_facilitator, stage: mp?.stage as string | null, leaderFree: (pr.data as { leader_free?: boolean } | null)?.leader_free });
  } catch {
    return false;
  }
}
