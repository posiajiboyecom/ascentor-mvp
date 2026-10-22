import 'server-only';
// lib/billing/group-hint.ts
// ─────────────────────────────────────────────────────────────────────────────
// groupCircleHint(userId): the Circle a member who joined with a billing group should be placed in, or null.
// Contract (shared with lib/billing/groups.ts from the member billing work): `groupCircleHint(userId: string): Promise<string | null>`.
// Rule (owner answer: friends who join as a group are placed in the same Circle for now): the Circle of the group's
// earliest-placed ACTIVE member, when it has space (CIRCLE_MAX seats), else null and normal placement runs.
// Reads billing_group_members, member_subscriptions, circle_seats and circles; never writes. Never throws.
// lib/rx/server.ts assignCircle() calls this. The decision itself is the pure pickGroupCircle() in rules.ts.
// ─────────────────────────────────────────────────────────────────────────────

import { supabaseAdmin } from '@/lib/supabase/admin';
import { CIRCLE_MAX } from '@/lib/rx/constants';
import { isActiveState, pickGroupCircle, type SubState } from './rules';

export async function groupCircleHint(userId: string): Promise<string | null> {
  try {
    const { data: mine } = await supabaseAdmin.from('billing_group_members').select('group_id').eq('user_id', userId).is('left_at', null).maybeSingle();
    const groupId = (mine as { group_id: string } | null)?.group_id;
    if (!groupId) return null;
    const { data: others } = await supabaseAdmin.from('billing_group_members').select('user_id').eq('group_id', groupId).is('left_at', null).neq('user_id', userId);
    const ids = ((others ?? []) as { user_id: string }[]).map((o) => o.user_id);
    if (!ids.length) return null;

    const [{ data: subs }, { data: profs }, { data: seats }] = await Promise.all([
      supabaseAdmin.from('member_subscriptions').select('user_id, state').in('user_id', ids),
      supabaseAdmin.from('profiles').select('id, leader_free').in('id', ids),
      supabaseAdmin.from('circle_seats').select('user_id, circle_id, joined_at').in('user_id', ids).eq('role', 'member').order('joined_at', { ascending: true }),
    ]);
    const free = new Set(((profs ?? []) as { id: string; leader_free: boolean | null }[]).filter((p) => p.leader_free).map((p) => p.id));
    const active = new Set(((subs ?? []) as { user_id: string; state: SubState }[]).filter((s) => isActiveState(s.state) && !free.has(s.user_id)).map((s) => s.user_id));

    // Each member's earliest member seat is their home Circle.
    const home = new Map<string, { userId: string; circleId: string; joinedAt: Date }>();
    for (const s of (seats ?? []) as { user_id: string; circle_id: string; joined_at: string }[]) {
      if (!home.has(s.user_id)) home.set(s.user_id, { userId: s.user_id, circleId: s.circle_id, joinedAt: new Date(s.joined_at) });
    }
    const placed = [...home.values()];
    if (!placed.length) return null;

    const circleIds = [...new Set(placed.map((p) => p.circleId))];
    const [{ data: circles }, { data: taken }] = await Promise.all([
      supabaseAdmin.from('circles').select('id, status, is_demo').in('id', circleIds),
      supabaseAdmin.from('circle_seats').select('circle_id').in('circle_id', circleIds).eq('role', 'member'),
    ]);
    const usable = new Set(((circles ?? []) as { id: string; status: string; is_demo: boolean }[]).filter((c) => c.status !== 'completed' && !c.is_demo).map((c) => c.id));
    const seatsTaken = new Map<string, number>();
    for (const t of (taken ?? []) as { circle_id: string }[]) seatsTaken.set(t.circle_id, (seatsTaken.get(t.circle_id) ?? 0) + 1);

    return pickGroupCircle({ placed, active, seatsTaken, usable, maxSeats: CIRCLE_MAX });
  } catch (e) {
    console.error('[billing/group-hint] failed:', e instanceof Error ? e.message : 'unknown');
    return null;
  }
}
