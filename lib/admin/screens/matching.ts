// lib/admin/screens/matching.ts
// Circles · Waiting for a Circle. A waiting member finished onboarding (member_profile.onboarded_at) and has no member seat in
// circle_seats. Placement reuses assignCircle (the rx_assign_circle database function that onboarding uses): it picks the
// forming or recent Circle with a free seat that best matches stage, weekly times and time zone, in the member's language,
// and creates a new Circle when none fits.
import 'server-only';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { assignCircle } from '@/lib/rx/server';
import { count, shortDate } from '@/lib/admin/revenue-util';
import type { ScreenModule, ScreenSpec, ActionResult } from '@/lib/admin/types';

export const spec: ScreenSpec = {
  area: "matching",
  group: "Circles",
  title: "Waiting for a Circle",
  sub: "New members waiting to be placed. Match by stage, goal and weekly times.",
  cols: [
    "Member",
    "Stage",
    "Goal",
    "Weekly times",
    "Waiting since",
    "Status"
  ],
  statusCol: 5,
  actions: [
    {
      id: "place-in-circle-25",
      label: "Place in Circle 25",
      col: 5,
      to: "Matched",
      when: "Waiting",
      done: "Placed in Port Harcourt · Circle 25. They can chat now."
    },
    {
      id: "place-in-circle-33",
      label: "Place in Circle 33",
      col: 5,
      to: "Matched",
      when: "Waiting"
    }
  ],
  quick: 0,
  buttons: [
    {
      id: "auto-match-all",
      label: "Auto-match all"
    }
  ]
};

const AUTO_CAP = 50;
const LIST_CAP = 200;

interface Waiting { user_id: string; stage: string | null; slots: string[] | null; onboarded_at: string }

/** Onboarded, non-demo members with no member seat, oldest first. */
async function waiting(limit: number): Promise<Waiting[]> {
  const [{ data: seats }, { data: mps, error }] = await Promise.all([
    supabaseAdmin.from('circle_seats').select('user_id').eq('role', 'member').limit(100000),
    supabaseAdmin.from('member_profile').select('user_id, stage, slots, onboarded_at').not('onboarded_at', 'is', null).eq('is_demo', false).order('onboarded_at').limit(100000),
  ]);
  if (error) throw error;
  const seated = new Set(((seats ?? []) as { user_id: string }[]).map((s) => s.user_id));
  return ((mps ?? []) as Waiting[]).filter((m) => !seated.has(m.user_id)).slice(0, limit);
}

const circleLabel = async (circleId: string) => {
  const { data } = await supabaseAdmin.from('circles').select('name, number, interest').eq('id', circleId).maybeSingle();
  return data ? `${(data.interest as string | null) || (data.name as string)} · Circle ${data.number}` : 'a Circle';
};

const screen: ScreenModule = {
  spec,

  async load() {
    const ws = await waiting(LIST_CAP);
    if (!ws.length) return { rows: [], kpis: [{ label: 'Waiting', value: '0' }], note: 'Nobody is waiting. Members are placed in a Circle as they finish onboarding.' };
    const ids = ws.map((w) => w.user_id);
    const { data: ps } = await supabaseAdmin.from('profiles').select('id, full_name, what_building').in('id', ids);
    const by = new Map(((ps ?? []) as { id: string; full_name: string | null; what_building: string | null }[]).map((p) => [p.id, p]));
    return {
      rows: ws.map((w) => {
        const p = by.get(w.user_id);
        return { id: w.user_id, cells: [p?.full_name?.trim() || 'Member', w.stage || '-', p?.what_building?.trim() || '-', (w.slots ?? []).join(', ') || '-', shortDate(w.onboarded_at), 'Waiting'] };
      }),
      kpis: [{ label: 'Waiting', value: count(ws.length) }],
    };
  },

  async act(_ctx, actionId, rowId): Promise<ActionResult> {
    if (actionId !== 'place-in-circle-25' && actionId !== 'place-in-circle-33') return { ok: false, error: 'Unknown action.' };
    const { data: seat } = await supabaseAdmin.from('circle_seats').select('circle_id').eq('user_id', rowId).eq('role', 'member').limit(1).maybeSingle();
    if (seat) return { ok: false, error: `Already in ${await circleLabel(seat.circle_id as string)}.` };
    const { data: mp } = await supabaseAdmin.from('member_profile').select('onboarded_at').eq('user_id', rowId).maybeSingle();
    if (!mp?.onboarded_at) return { ok: false, error: 'This member has not finished onboarding yet.' };
    const cid = await assignCircle(rowId);
    if (!cid) return { ok: false, error: 'No Circle has a free seat right now. Try again in a moment.' };
    return { ok: true, message: `Placed in ${await circleLabel(cid)}. They can chat now.` };
  },

  async button(_ctx, buttonId): Promise<ActionResult> {
    if (buttonId !== 'auto-match-all') return { ok: false, error: 'Unknown button.' };
    const ws = await waiting(AUTO_CAP);
    if (!ws.length) return { ok: true, message: 'Nobody is waiting.', refresh: true };
    let placed = 0;
    for (const w of ws) if (await assignCircle(w.user_id)) placed++;
    return { ok: true, message: `Placed ${placed} ${placed === 1 ? 'member' : 'members'}`, refresh: true };
  },

  async badge() {
    return (await waiting(100000)).length;
  },
};

export default screen;
