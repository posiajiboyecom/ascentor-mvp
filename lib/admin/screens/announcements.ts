// lib/admin/screens/announcements.ts
// Spec copied from the admin prototype (Community · Announcements). Reads the announcements table, as app/admin/announcements does.
import { supabaseAdmin } from '@/lib/supabase/admin';
import type { ScreenModule, ScreenSpec } from '@/lib/admin/types';

export const spec: ScreenSpec = {
  area: "announcements",
  group: "Community",
  title: "Announcements",
  sub: "News for members. One can be featured as a banner on Today.",
  cols: ["Title", "Audience", "Banner on Today", "Dates", "Status"],
  statusCol: 4,
  actions: [
    { id: "publish-now", label: "Publish now", col: 4, to: "Live" },
    { id: "end", label: "End", col: 4, to: "Ended" }
  ],
  buttons: [{ id: "new-announcement", label: "New announcement", href: "/admin/announcements" }]
};

const TZ = 'Africa/Lagos';
const todayStr = () => new Date().toLocaleDateString('en-CA', { timeZone: TZ });

interface A { id: string; title: string; audience: string; aud_value: string | null; banner: boolean; starts_on: string | null; ends_on: string | null; status: string }

const parts = (d: string) => {
  const dt = new Date(`${d}T12:00:00Z`);
  return { day: String(dt.getUTCDate()), mon: dt.toLocaleDateString('en-GB', { timeZone: 'UTC', month: 'short' }) };
};
const full = (d: string) => { const p = parts(d); return `${p.day} ${p.mon}`; };

function dates(a: A): string {
  if (a.starts_on && a.ends_on) {
    const s = parts(a.starts_on); const e = parts(a.ends_on);
    return s.mon === e.mon ? `${s.day} to ${e.day} ${e.mon}` : `${full(a.starts_on)} to ${full(a.ends_on)}`;
  }
  if (a.starts_on) return `From ${full(a.starts_on)}`;
  if (a.ends_on) return `Until ${full(a.ends_on)}`;
  return '-';
}

function effective(a: A, today: string): string {
  if (a.status === 'Draft') return 'Draft';
  if (a.status === 'Ended' || (a.ends_on && a.ends_on < today)) return 'Ended';
  if (a.starts_on && a.starts_on > today) return 'Scheduled';
  return 'Live';
}

const COLS = 'id, title, audience, aud_value, banner, starts_on, ends_on, status';

const screen: ScreenModule = {
  spec,
  async load() {
    const { data } = await supabaseAdmin.from('announcements').select(COLS).order('created_at', { ascending: false }).limit(200);
    const today = todayStr();
    const rows = ((data ?? []) as A[]).map((a) => ({
      id: a.id,
      cells: [a.title, a.aud_value ? `${a.audience}: ${a.aud_value}` : a.audience, a.banner ? 'Yes' : 'No', dates(a), effective(a, today)],
    }));
    return { rows };
  },

  async act(_ctx, actionId, rowId) {
    const { data } = await supabaseAdmin.from('announcements').select(COLS).eq('id', rowId).maybeSingle();
    const a = data as A | null;
    if (!a) return { ok: false, error: 'That announcement no longer exists.' };
    const today = todayStr();
    const now = effective(a, today);
    if (actionId === 'publish-now') {
      if (now === 'Live') return { ok: false, error: 'It is already live.' };
      const patch: Record<string, unknown> = { status: 'Live' };
      if (!a.starts_on || a.starts_on > today) patch.starts_on = today;
      if (a.ends_on && a.ends_on < today) patch.ends_on = null;
      const { error } = await supabaseAdmin.from('announcements').update(patch).eq('id', rowId);
      if (error) return { ok: false, error: 'We could not publish that announcement.' };
      return { ok: true, message: `${a.title} is live now.` };
    }
    if (actionId === 'end') {
      if (now === 'Ended') return { ok: false, error: 'It has already ended.' };
      const patch: Record<string, unknown> = { status: 'Ended' };
      if (!a.ends_on || a.ends_on > today) patch.ends_on = today;
      if (a.starts_on && a.starts_on > today) patch.starts_on = today;
      const { error } = await supabaseAdmin.from('announcements').update(patch).eq('id', rowId);
      if (error) return { ok: false, error: 'We could not end that announcement.' };
      return { ok: true, message: `${a.title} has ended.` };
    }
    return { ok: false, error: 'Unknown action.' };
  },
};

export default screen;
