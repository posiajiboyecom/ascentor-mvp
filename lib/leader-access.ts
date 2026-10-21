// lib/leader-access.ts
// Server-only. The Leader plan is not for everyone: a person can choose it only if the team made them a Leader
// (Members > Make Leader, which sets member_profile.is_facilitator), or they already hold it.
import 'server-only';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function canChooseLeader(userId: string | null | undefined): Promise<boolean> {
  if (!userId) return false;
  try {
    const [{ data: mp }, { data: pr }] = await Promise.all([
      supabaseAdmin.from('member_profile').select('is_facilitator').eq('user_id', userId).maybeSingle(),
      supabaseAdmin.from('profiles').select('subscription_plan').eq('id', userId).maybeSingle(),
    ]);
    return !!mp?.is_facilitator || ['leader', 'climber'].includes((pr?.subscription_plan as string | null) ?? '');
  } catch {
    return false;
  }
}
