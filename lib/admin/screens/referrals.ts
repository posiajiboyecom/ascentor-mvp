// lib/admin/screens/referrals.ts
// Revenue · Referrals, over the referrals table. Approving a reward reuses rewardReferral from lib/paymentSettlement.ts
// (7 extra days to both people, claimed exactly once). Flagging uses referrals.flagged_at (migration 20261024p).
import 'server-only';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { rewardReferral } from '@/lib/paymentSettlement';
import { shortDate } from '@/lib/admin/revenue-util';
import type { ScreenModule, ScreenSpec, ActionResult } from '@/lib/admin/types';

export const spec: ScreenSpec = {
  area: "referrals",
  group: "Revenue",
  title: "Referrals",
  sub: "When a friend subscribes after their trial, both get 7 extra days.",
  cols: [
    "Member",
    "Friend",
    "Joined",
    "Subscribed",
    "Reward",
    "Status"
  ],
  statusCol: 5,
  actions: [
    {
      id: "approve-reward",
      label: "Approve reward",
      col: 5,
      to: "Rewarded"
    },
    {
      id: "flag-as-abuse",
      label: "Flag as abuse",
      col: 5,
      to: "Flagged"
    }
  ],
  buttons: [
    { id: "credits", label: "Credits", needs: "view", href: "/admin/c/referrals/credits" }
  ]
};

type Ref = { id: string; referrer_id: string; referred_id: string; status: string; referrer_reward: string | null; rewarded_at: string | null; created_at: string; flagged_at?: string | null };

const statusOf = (r: Ref) => (r.flagged_at ? 'Flagged' : r.rewarded_at || r.status === 'rewarded' ? 'Rewarded' : 'Joined');

async function fetchRefs(): Promise<Ref[]> {
  const base = 'id, referrer_id, referred_id, status, referrer_reward, rewarded_at, created_at';
  const r = await supabaseAdmin.from('referrals').select(`${base}, flagged_at`).order('created_at', { ascending: false }).limit(200);
  if (!r.error) return (r.data ?? []) as Ref[];
  const r2 = await supabaseAdmin.from('referrals').select(base).order('created_at', { ascending: false }).limit(200);
  if (r2.error) throw new Error(r2.error.message);
  return (r2.data ?? []) as Ref[];
}

const screen: ScreenModule = {
  spec,
  async load() {
    const refs = await fetchRefs();
    const ids = Array.from(new Set(refs.flatMap((r) => [r.referrer_id, r.referred_id]).filter(Boolean)));
    const names: Record<string, string> = {};
    if (ids.length) {
      const { data } = await supabaseAdmin.from('profiles').select('id, full_name, email').in('id', ids);
      for (const p of data ?? []) names[p.id] = p.full_name || p.email || '\-';
    }
    return {
      rows: refs.map((r) => ({
        id: r.id,
        cells: [
          names[r.referrer_id] || '\-',
          names[r.referred_id] || '\-',
          shortDate(r.created_at),
          r.status === 'subscribed' || r.status === 'rewarded' || r.rewarded_at ? 'Yes' : 'No',
          r.referrer_reward || '\-',
          statusOf(r),
        ],
      })),
      note: refs.length >= 200 ? 'Showing the 200 newest referrals.' : undefined,
    };
  },

  async act(_ctx, actionId, rowId): Promise<ActionResult> {
    const { data: row } = await supabaseAdmin.from('referrals').select('*').eq('id', rowId).maybeSingle();
    if (!row) return { ok: false, error: 'That referral no longer exists.' };
    const rewarded = !!row.rewarded_at || row.status === 'rewarded';

    if (actionId === 'approve-reward') {
      if (rewarded) return { ok: false, error: 'This reward was already given.' };
      if (row.referrer_id === row.referred_id) return { ok: false, error: 'A member cannot refer themselves.' };
      if (row.flagged_at) await supabaseAdmin.from('referrals').update({ flagged_at: null }).eq('id', rowId);
      await rewardReferral(row.referred_id);
      const { data: after } = await supabaseAdmin.from('referrals').select('rewarded_at').eq('id', rowId).maybeSingle();
      if (!after?.rewarded_at) return { ok: false, error: 'The reward could not be given. Please try again.' };
      return { ok: true, message: 'Reward approved: both members got 7 extra days.' };
    }

    if (actionId === 'flag-as-abuse') {
      if (rewarded) return { ok: false, error: 'This reward was already given, so it cannot be flagged here.' };
      if (row.flagged_at) return { ok: false, error: 'This referral is already flagged.' };
      const { error } = await supabaseAdmin.from('referrals').update({ flagged_at: new Date().toISOString() }).eq('id', rowId);
      if (error) return { ok: false, error: /flagged_at/i.test(error.message) ? 'Flagging is not available yet: the database update (20261024p_refunds_and_flags.sql) has not been applied.' : 'We could not flag this referral.' };
      return { ok: true, message: 'Flagged as abuse. No reward will be given unless you approve it.' };
    }
    return { ok: false, error: 'Unknown action.' };
  },
};

export default screen;
