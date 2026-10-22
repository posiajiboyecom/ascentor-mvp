// lib/leader-access.ts
// Server-only. The Leader plan is not for everyone. A member may choose it if ANY of these is true:
//  - the team marked them Leader (Members > Make Leader, or they accepted a Leader invite: both set member_profile.is_facilitator)
//  - onboarding placed them at the Leading stage (member_profile.stage)
//  - they already hold the Leader plan
// Leader stays a paid plan in every case. The pure rule is leaderEligible() in lib/leader-invite-core.ts.
import 'server-only';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { leaderEligible } from '@/lib/leader-invite-core';

export async function canChooseLeader(userId: string | null | undefined): Promise<boolean> {
  if (!userId) return false;
  try {
    const [{ data: mp }, { data: pr }] = await Promise.all([
      supabaseAdmin.from('member_profile').select('is_facilitator, stage').eq('user_id', userId).maybeSingle(),
      supabaseAdmin.from('profiles').select('subscription_plan').eq('id', userId).maybeSingle(),
    ]);
    return leaderEligible({ isMarkedLeader: mp?.is_facilitator, stage: mp?.stage as string | null, plan: pr?.subscription_plan as string | null });
  } catch {
    return false;
  }
}
