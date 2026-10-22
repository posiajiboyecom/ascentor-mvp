import 'server-only';
// lib/rx/quorum.ts
// Call quorum for a Circle or mentor call (the handoff rule, replacing the old fixed "6 members"):
//   a call holds when at least 60% of the Circle's ACTIVE members confirm, rounded up, minimum 3, the mentor always present.
//   4 or fewer active members: 3 are needed and the Circle is offered a merge (a flag for the facilitator and admins, never automatic).
// Active = trial, paying or inside the 7 day grace period (and cancelled members until the end of the period they paid for).
// A member who lapsed and has not reactivated drops out of the count; reactivating counts again at once, because the
// state is read from member_subscriptions every time. A member WITHOUT a v2 row (legacy, demo, free Leader) counts as active.
// The numbers come from lib/billing/rules.ts (quorum), the state mapping from lib/billing/access.ts.
//
// Exports
//   activeCircleMembers(circleId)   -> { ids: Set<string>, count }   active member seats (role member) of the Circle
//   circleQuorum(circleId)          -> { needed, offerMerge, active, ids }

import { supabaseAdmin } from '@/lib/supabase/admin';
import { quorum, type QuorumResult, type SubState } from '@/lib/billing/rules';
import { accessFromSubscription } from '@/lib/billing/access';
import type { Tier } from '@/lib/billing/catalog';

export async function activeCircleMembers(circleId: string, now: Date = new Date()): Promise<{ ids: Set<string>; count: number }> {
  const { data: seats } = await supabaseAdmin.from('circle_seats').select('user_id').eq('circle_id', circleId).eq('role', 'member');
  const all = ((seats ?? []) as { user_id: string }[]).map((s) => s.user_id);
  if (!all.length) return { ids: new Set(), count: 0 };
  const [{ data: subs }, { data: profs }] = await Promise.all([
    supabaseAdmin.from('member_subscriptions').select('user_id, state, tier, period_end, trial_ends_at').in('user_id', all),
    supabaseAdmin.from('profiles').select('id, leader_free').in('id', all),
  ]);
  const byUser = new Map(((subs ?? []) as { user_id: string; state: SubState; tier: Tier; period_end: string | null; trial_ends_at: string | null }[]).map((s) => [s.user_id, s]));
  const free = new Set(((profs ?? []) as { id: string; leader_free: boolean | null }[]).filter((p) => p.leader_free).map((p) => p.id));
  const ids = new Set<string>();
  for (const id of all) {
    const s = byUser.get(id);
    const a = accessFromSubscription(
      s ? { state: s.state, tier: s.tier, periodEnd: s.period_end ? new Date(s.period_end) : null, trialEndsAt: s.trial_ends_at ? new Date(s.trial_ends_at) : null } : null,
      free.has(id), now,
    );
    if (a.level === 'full') ids.add(id);
  }
  return { ids, count: ids.size };
}

export async function circleQuorum(circleId: string, now: Date = new Date()): Promise<QuorumResult & { ids: Set<string> }> {
  const { ids, count } = await activeCircleMembers(circleId, now);
  return { ...quorum(count), ids };
}
