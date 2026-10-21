// lib/admin/screens/events.ts
// Spec copied from the admin prototype (Marketing · Public events). The loader below is a placeholder until it reads real data.
import 'server-only';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { shortDate, count } from '@/lib/admin/revenue-util';
import type { ScreenModule, ScreenSpec, ActionResult } from '@/lib/admin/types';

export const spec: ScreenSpec = {
  area: "events",
  group: "Marketing",
  title: "Public events",
  sub: "Events anyone can register for on the website.",
  cols: [
    "Event",
    "Date",
    "City",
    "Registrations",
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
      id: "close-registration",
      label: "Close registration",
      col: 4,
      to: "Ended"
    }
  ],
  buttons: [
    {
      id: "new-event",
      href: "/admin/events",
      label: "New event"
    }
  ]
};

// Live = published with registration open, Ended = published with registration closed, Draft = not published.
const statusOf = (r: { is_published: boolean | null; registration_open: boolean | null }) =>
  !r.is_published ? 'Draft' : r.registration_open ? 'Live' : 'Ended';

const screen: ScreenModule = {
  spec,
  async load() {
    const { data, error } = await supabaseAdmin.from('public_events')
      .select('id, title, event_date, event_date_iso, location, is_published, registration_open')
      .order('event_date_iso', { ascending: true }).limit(200);
    if (error) throw new Error(error.message);
    const regs: Record<string, number> = {};
    const { data: g } = await supabaseAdmin.from('event_registrations').select('event_id').limit(50000);
    (g ?? []).forEach((x: any) => { if (x.event_id) regs[x.event_id] = (regs[x.event_id] || 0) + 1; });
    return {
      rows: (data ?? []).map((r: any) => ({
        id: String(r.id),
        cells: [r.title || '-', r.event_date_iso ? shortDate(r.event_date_iso) : r.event_date || '-', r.location || '-', regs[r.id] ? count(regs[r.id]) : '-', statusOf(r)],
      })),
    };
  },
  async act(_ctx, actionId, rowId): Promise<ActionResult> {
    if (actionId !== 'publish' && actionId !== 'close-registration') return { ok: false, error: 'Unknown action.' };
    const { data: row } = await supabaseAdmin.from('public_events').select('id, title, is_published, registration_open').eq('id', rowId).maybeSingle();
    if (!row) return { ok: false, error: 'That event no longer exists.' };
    const st = statusOf(row);
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (actionId === 'publish') {
      if (st === 'Live') return { ok: false, error: 'This event is already live.' };
      patch.is_published = true;
      patch.registration_open = true;
    } else {
      if (st !== 'Live') return { ok: false, error: 'Only a live event has registration to close.' };
      patch.registration_open = false;
    }
    const { error } = await supabaseAdmin.from('public_events').update(patch).eq('id', rowId);
    if (error) return { ok: false, error: 'We could not update this event.' };
    return { ok: true, message: actionId === 'publish' ? `${row.title} is live.` : `Registration closed for ${row.title}.` };
  },
};

export default screen;
