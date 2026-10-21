// lib/admin/screens/mentors.ts
// People · Mentors, backed by human_mentors. That table has no application state, so a mentor is Active (active = true) or Paused.
import 'server-only';
import { supabaseAdmin } from '@/lib/supabase/admin';
import type { ScreenModule, ScreenSpec } from '@/lib/admin/types';

export const spec: ScreenSpec = {
  area: "mentors",
  group: "People",
  title: "Mentors",
  sub: "Mentors give their time free. Circles vote for one, then book from their free times.",
  cols: [
    "Mentor",
    "Field",
    "Circles",
    "Sessions this month",
    "Languages",
    "Status"
  ],
  statusCol: 5,
  actions: [
    {
      id: "approve",
      label: "Approve",
      col: 5,
      to: "Active",
      when: "Pending"
    },
    {
      id: "pause",
      label: "Pause",
      col: 5,
      to: "Paused"
    },
    {
      id: "reject",
      label: "Reject",
      col: 5,
      to: "Rejected",
      when: "Pending",
      confirm: "They’ll get a polite email. You can invite them again later."
    }
  ],
  quick: 0,
  buttons: [
    {
      id: "invite-a-mentor",
      label: "Invite a mentor",
      href: "/admin/human-mentors"
    }
  ]
};

const CURRENT = ['requested', 'scheduling', 'active', 'paused'];

function monthStartLagos(): string {
  const ym = new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Lagos' }).slice(0, 7);
  return new Date(`${ym}-01T00:00:00+01:00`).toISOString();
}

const screen: ScreenModule = {
  spec,
  async load() {
    const { data: mentors, error } = await supabaseAdmin.from('human_mentors').select('id, name, headline, langs, active').order('created_at', { ascending: false }).limit(200);
    if (error) throw error;
    const [{ data: links }, { data: sessions }] = await Promise.all([
      supabaseAdmin.from('circle_mentors').select('mentor_id').in('status', CURRENT),
      supabaseAdmin.from('circle_mentor_sessions').select('mentor_id').gte('starts_at', monthStartLagos()).neq('status', 'cancelled'),
    ]);
    const circles = new Map<string, number>();
    for (const l of (links ?? []) as { mentor_id: string }[]) circles.set(l.mentor_id, (circles.get(l.mentor_id) ?? 0) + 1);
    const month = new Map<string, number>();
    for (const x of (sessions ?? []) as { mentor_id: string }[]) month.set(x.mentor_id, (month.get(x.mentor_id) ?? 0) + 1);
    const rows = ((mentors ?? []) as { id: string; name: string; headline: string | null; langs: string[] | null; active: boolean }[]).map((m) => ({
      id: m.id,
      cells: [m.name || '-', m.headline || '-', String(circles.get(m.id) ?? 0), String(month.get(m.id) ?? 0), (m.langs ?? []).join(', ') || '-', m.active ? 'Active' : 'Paused'],
    }));
    return { rows };
  },
  async act(_ctx, actionId, rowId) {
    const { data: m } = await supabaseAdmin.from('human_mentors').select('id, active').eq('id', rowId).maybeSingle();
    if (!m) return { ok: false, error: 'We could not find that mentor.' };
    if (actionId === 'approve' || actionId === 'pause') {
      const on = actionId === 'approve';
      if (!!m.active === on) return { ok: false, error: on ? 'They are already active.' : 'They are already paused.' };
      const { error } = await supabaseAdmin.from('human_mentors').update({ active: on }).eq('id', rowId);
      return error ? { ok: false, error: 'We could not save that. Please try again.' } : { ok: true };
    }
    if (actionId === 'reject') return { ok: false, error: 'Mentors are added by an admin, so there are no applications to reject. Use Pause instead.' };
    return { ok: false, error: 'Unknown action.' };
  },
  // human_mentors has no application state, so nothing is ever Pending.
  async badge() { return 0; },
};

export default screen;
