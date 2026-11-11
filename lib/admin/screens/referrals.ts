// lib/admin/screens/referrals.ts
// Revenue · Referrals, over the referrals table. Rewards are Billing v2 credit: the inviter earns credit worth 20% of their
// monthly price 14 days after the friend's first real payment (lib/billing/engine.ts, referrals.credit_earned_at). It is
// automatic, so there is nothing to approve here. Flagging (referrals.flagged_at) stops credit from being earned.
import 'server-only';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { shortDate } from '@/lib/admin/revenue-util';
import type { ScreenModule, ScreenSpec, ActionResult } from '@/lib/admin/types';

export const spec: ScreenSpec = {
  area: "referrals",
  group: "Revenue",
  title: "Referrals",
  sub: "When a friend’s first payment clears, the member who invited them earns credit (20% of their monthly price) after 14 days.",
  cols: [
    "Member",
    "Friend",
    "Joined",
    "Credit earned",
    "Status"
  ],
  statusCol: 4,
  actions: [
    {
      id: "flag-as-abuse",
      label: "Flag as abuse",
      col: 4,
      to: "Flagged"
    }
  ],
  buttons: [
    { id: "credits", label: "Credits", needs: "view", href: "/admin/c/referrals/credits" }
  ]
};

type Ref = { id: string; referrer_id: string; referred_id: string; status: string; credit_earned_at: string | null; created_at: string; flagged_at?: string | null };

const statusOf = (r: Ref) => (r.flagged_at ? 'Flagged' : r.credit_earned_at ? 'Credit earned' : 'Joined');

async function fetchRefs(): Promise<Ref[]> {
  const base = 'id, referrer_id, referred_id, status, credit_earned_at, created_at';
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
          r.credit_earned_at ? shortDate(r.credit_earned_at) : '\-',
          statusOf(r),
        ],
      })),
      note: refs.length >= 200 ? 'Showing the 200 newest referrals.' : undefined,
    };
  },

  async act(_ctx, actionId, rowId): Promise<ActionResult> {
    const { data: row } = await supabaseAdmin.from('referrals').select('*').eq('id', rowId).maybeSingle();
    if (!row) return { ok: false, error: 'That referral no longer exists.' };
    const rewarded = !!row.credit_earned_at;

    if (actionId === 'flag-as-abuse') {
      if (rewarded) return { ok: false, error: 'Credit was already earned for this referral, so it cannot be flagged here.' };
      if (row.flagged_at) return { ok: false, error: 'This referral is already flagged.' };
      const { error } = await supabaseAdmin.from('referrals').update({ flagged_at: new Date().toISOString() }).eq('id', rowId);
      if (error) return { ok: false, error: /flagged_at/i.test(error.message) ? 'Flagging is not available yet: the database update (20261024p_refunds_and_flags.sql) has not been applied.' : 'We could not flag this referral.' };
      return { ok: true, message: 'Flagged as abuse. No credit will be earned for it.' };
    }
    return { ok: false, error: 'Unknown action.' };
  },
};

export default screen;
