// lib/admin/screens/meetups.ts
// Spec copied from the admin prototype (Community · Meetups). Reads member_meetups (migration 20261024e_meetups.sql).
import { supabaseAdmin } from '@/lib/supabase/admin';
import type { ScreenModule, ScreenSpec } from '@/lib/admin/types';

export const spec: ScreenSpec = {
  area: "meetups",
  group: "Community",
  title: "Meetups",
  sub: "Member-organised meetups. New ones need approval before they show.",
  cols: ["Meetup", "City", "Host", "Date", "Going", "Status"],
  statusCol: 5,
  actions: [
    { id: "approve", label: "Approve", col: 5, to: "Approved", when: "Pending" },
    { id: "remove", label: "Remove", col: 5, to: "Removed by admin", confirm: "The host and anyone going get a message." }
  ],
  quick: 0
};

const NOTE = 'Members cannot host meetups yet, so this list is empty until that is built.';
const TZ = 'Africa/Lagos';
const LABEL: Record<string, string> = { pending: 'Pending', approved: 'Approved', removed: 'Removed by admin', reported: 'Reported' };
const missing = (e: { message?: string; code?: string } | null) => !!e && (e.code === '42P01' || e.code === 'PGRST205' || /does not exist|schema cache/i.test(e.message ?? ''));

interface M { id: string; title: string; city_group_id: string | null; host_id: string | null; starts_at: string | null; going_count: number; status: string }

const screen: ScreenModule = {
  spec,
  async load() {
    const { data, error } = await supabaseAdmin.from('member_meetups').select('id, title, city_group_id, host_id, starts_at, going_count, status').order('created_at', { ascending: false }).limit(200);
    if (error) {
      if (missing(error)) return { rows: [], note: NOTE };
      throw error;
    }
    const list = (data ?? []) as M[];
    const cityIds = [...new Set(list.map((m) => m.city_group_id).filter(Boolean))] as string[];
    const hostIds = [...new Set(list.map((m) => m.host_id).filter(Boolean))] as string[];
    const [{ data: cities }, { data: hosts }] = await Promise.all([
      cityIds.length ? supabaseAdmin.from('rx_groups').select('id, name').in('id', cityIds) : Promise.resolve({ data: [] }),
      hostIds.length ? supabaseAdmin.from('profiles').select('id, full_name').in('id', hostIds) : Promise.resolve({ data: [] }),
    ]);
    const cityName = new Map(((cities ?? []) as { id: string; name: string }[]).map((c) => [c.id, c.name]));
    const hostName = new Map(((hosts ?? []) as { id: string; full_name: string | null }[]).map((h) => [h.id, h.full_name ?? '-']));
    const rows = list.map((m) => ({
      id: m.id,
      cells: [
        m.title,
        (m.city_group_id && cityName.get(m.city_group_id)) || '-',
        (m.host_id && hostName.get(m.host_id)) || '-',
        m.starts_at ? new Date(m.starts_at).toLocaleDateString('en-GB', { timeZone: TZ, weekday: 'short', day: 'numeric', month: 'short' }) : '-',
        String(m.going_count ?? 0),
        LABEL[m.status] ?? m.status,
      ],
    }));
    return { rows, note: rows.length ? undefined : NOTE };
  },

  async act(_ctx, actionId, rowId) {
    const { data: m, error: e0 } = await supabaseAdmin.from('member_meetups').select('id, title, host_id, status').eq('id', rowId).maybeSingle();
    if (e0 || !m) return { ok: false, error: 'That meetup no longer exists.' };
    if (actionId === 'approve') {
      if (m.status !== 'pending') return { ok: false, error: 'Only a pending meetup can be approved.' };
      const { error } = await supabaseAdmin.from('member_meetups').update({ status: 'approved' }).eq('id', rowId);
      if (error) return { ok: false, error: 'We could not approve that meetup.' };
      return { ok: true, message: `${m.title} approved.` };
    }
    if (actionId === 'remove') {
      if (m.status === 'removed') return { ok: false, error: 'It is already removed.' };
      const { error } = await supabaseAdmin.from('member_meetups').update({ status: 'removed' }).eq('id', rowId);
      if (error) return { ok: false, error: 'We could not remove that meetup.' };
      if (m.host_id) await supabaseAdmin.from('notifications').insert({ user_id: m.host_id, type: 'community', title: 'Your meetup was removed', message: `${m.title} was taken down by the team.`, link: '/community' });
      return { ok: true, message: `${m.title} removed. The host got a message.` };
    }
    return { ok: false, error: 'Unknown action.' };
  },
};

export default screen;
