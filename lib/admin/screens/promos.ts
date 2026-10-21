// lib/admin/screens/promos.ts
// Revenue · Promo codes, over the promo_codes table (the same one /admin/promo-codes edits).
import 'server-only';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { shortDate, count } from '@/lib/admin/revenue-util';
import type { ScreenModule, ScreenSpec, ActionResult } from '@/lib/admin/types';

export const spec: ScreenSpec = {
  area: "promos",
  group: "Revenue",
  title: "Promo codes",
  sub: "Discounts for campaigns and partners.",
  cols: [
    "Code",
    "Discount",
    "Applies to",
    "Used",
    "Expires",
    "Status"
  ],
  statusCol: 5,
  actions: [
    {
      id: "pause",
      label: "Pause",
      col: 5,
      to: "Paused"
    },
    {
      id: "activate",
      label: "Activate",
      col: 5,
      to: "Active"
    }
  ],
  buttons: [
    {
      id: "new-code",
      label: "New code",
      href: "/admin/promo-codes"
    }
  ]
};

const PLAN_NAME: Record<string, string> = { explorer: 'Seeker', builder: 'Builder', leader: 'Leader', climber: 'Climber' };

function appliesTo(arr: unknown): string {
  const list = Array.isArray(arr) ? (arr as string[]) : [];
  if (!list.length || ['explorer', 'builder', 'leader'].every((p) => list.includes(p))) return 'All plans';
  return list.map((p) => PLAN_NAME[p] ?? p).join(', ');
}

function statusOf(r: { active: boolean; expires_at: string | null; max_uses: number | null; current_uses: number | null }): string {
  if (r.expires_at && new Date(r.expires_at).getTime() < Date.now()) return 'Expired';
  if (r.max_uses != null && (r.current_uses ?? 0) >= r.max_uses) return 'Expired';
  return r.active ? 'Active' : 'Paused';
}

const screen: ScreenModule = {
  spec,
  async load() {
    const { data, error } = await supabaseAdmin.from('promo_codes')
      .select('id, code, discount, applies_to, max_uses, current_uses, expires_at, active')
      .order('created_at', { ascending: false }).limit(200);
    if (error) throw new Error(error.message);
    return {
      rows: (data ?? []).map((r: any) => ({
        id: String(r.id),
        cells: [
          r.code,
          `${Math.round(Number(r.discount) * 100)}%`,
          appliesTo(r.applies_to),
          r.max_uses != null ? `${count(r.current_uses ?? 0)} of ${count(r.max_uses)}` : count(r.current_uses ?? 0),
          r.expires_at ? shortDate(r.expires_at) : 'Never',
          statusOf(r),
        ],
      })),
      note: (data?.length ?? 0) >= 200 ? 'Showing the 200 newest codes.' : undefined,
    };
  },

  async act(_ctx, actionId, rowId): Promise<ActionResult> {
    const { data: row } = await supabaseAdmin.from('promo_codes').select('id, code, active, expires_at, max_uses, current_uses').eq('id', rowId).maybeSingle();
    if (!row) return { ok: false, error: 'That code no longer exists.' };
    const active = actionId === 'activate';
    if (actionId !== 'activate' && actionId !== 'pause') return { ok: false, error: 'Unknown action.' };
    if (active && statusOf(row) === 'Expired') return { ok: false, error: 'This code has expired or reached its limit. Create a new code instead.' };
    if (row.active === active) return { ok: false, error: active ? 'This code is already active.' : 'This code is already paused.' };
    const { error } = await supabaseAdmin.from('promo_codes').update({ active }).eq('id', rowId);
    if (error) return { ok: false, error: 'We could not update this code.' };
    return { ok: true, message: active ? `${row.code} is active.` : `${row.code} is paused.` };
  },
};

export default screen;
