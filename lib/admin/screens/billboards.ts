// lib/admin/screens/billboards.ts
// Spec copied from the admin prototype (Marketing · Billboards). The loader below is a placeholder until it reads real data.
import 'server-only';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { shortDate, count } from '@/lib/admin/revenue-util';
import type { ScreenModule, ScreenSpec, ActionResult } from '@/lib/admin/types';

export const spec: ScreenSpec = {
  area: "billboards",
  group: "Marketing",
  title: "Billboards",
  sub: "Promo cards in the app’s side rail, up to three slots.",
  cols: [
    "Title",
    "Slot",
    "Colour",
    "Button",
    "Status"
  ],
  statusCol: 4,
  actions: [
    {
      id: "publish",
      label: "Publish",
      col: 4,
      to: "Live"
    },
    {
      id: "take-down",
      label: "Take down",
      col: 4,
      to: "Draft"
    }
  ],
  buttons: [
    {
      id: "new-billboard",
      href: "/admin/billboards",
      label: "New billboard"
    }
  ]
};

const COLOUR: Record<string, string> = { '#161412': 'Gold', '#0d1f14': 'Emerald', '#0d1629': 'Sapphire', '#1f0d0d': 'Crimson', '#111827': 'Slate' };

const screen: ScreenModule = {
  spec,
  async load() {
    const { data, error } = await supabaseAdmin.from('rail_billboards')
      .select('id, slot, title, cta_label, bg_color, is_active, sort_order')
      .order('slot', { ascending: true }).order('sort_order', { ascending: true }).limit(200);
    if (error) throw new Error(error.message);
    return {
      rows: (data ?? []).map((r: any) => ({
        id: String(r.id),
        cells: [r.title || '-', r.slot != null ? String(r.slot) : '-', COLOUR[String(r.bg_color || '').toLowerCase()] ?? (r.bg_color || '-'), r.cta_label || '-', r.is_active ? 'Live' : 'Draft'],
      })),
    };
  },
  async act(_ctx, actionId, rowId): Promise<ActionResult> {
    if (actionId !== 'publish' && actionId !== 'take-down') return { ok: false, error: 'Unknown action.' };
    const { data: row } = await supabaseAdmin.from('rail_billboards').select('id, title, is_active').eq('id', rowId).maybeSingle();
    if (!row) return { ok: false, error: 'That billboard no longer exists.' };
    const live = actionId === 'publish';
    if (!!row.is_active === live) return { ok: false, error: live ? 'This billboard is already live.' : 'This billboard is already down.' };
    const { error } = await supabaseAdmin.from('rail_billboards').update({ is_active: live }).eq('id', rowId);
    if (error) return { ok: false, error: 'We could not update this billboard.' };
    return { ok: true, message: live ? `${row.title} is live.` : `${row.title} is taken down.` };
  },
};

export default screen;
