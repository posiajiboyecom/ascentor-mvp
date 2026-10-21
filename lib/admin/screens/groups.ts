// lib/admin/screens/groups.ts
// Spec copied from the admin prototype (Community · Groups). Interest groups only: city groups have their own screen.
import { supabaseAdmin } from '@/lib/supabase/admin';
import type { ScreenModule, ScreenSpec } from '@/lib/admin/types';

export const spec: ScreenSpec = {
  area: "groups",
  group: "Community",
  title: "Groups",
  sub: "Interest groups. Quiet groups (under 5 posts in 7 days) can be merged or archived.",
  cols: ["Group", "Members", "Posts, 7 days", "Last active", "Status"],
  statusCol: 4,
  actions: [
    { id: "archive", label: "Archive", col: 4, to: "Archived", confirm: "Members keep their messages and get a note pointing to the nearest active group." },
    { id: "mark-active", label: "Mark active", col: 4, to: "Active" }
  ],
  buttons: [
    { id: "group-suggestions", label: "Group suggestions", href: "/admin/groups" },
    { id: "create-group", label: "Create group", href: "/admin/groups" }
  ]
};

const TZ = 'Africa/Lagos';
const dayKey = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: TZ });
const n = (v: number) => v.toLocaleString('en-GB');
const fresh14 = (iso: string) => Date.now() - new Date(iso).getTime() < 14 * 86400000;

function lastActive(iso: string | null, createdIso: string): string {
  if (!iso) return fresh14(createdIso) ? 'Just created' : 'No posts yet';
  const diff = Math.round((Date.parse(dayKey(new Date())) - Date.parse(dayKey(new Date(iso)))) / 86400000);
  if (diff <= 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return `${diff} days ago`;
}

interface G { id: string; name: string; status: string; is_new: boolean; created_at: string }

async function statsFor(g: G) {
  const since = new Date(Date.now() - 7 * 86400000).toISOString();
  const [m, p, l] = await Promise.all([
    supabaseAdmin.from('rx_group_members').select('user_id', { count: 'exact', head: true }).eq('group_id', g.id),
    supabaseAdmin.from('rx_group_messages').select('id', { count: 'exact', head: true }).eq('group_id', g.id).gte('created_at', since),
    supabaseAdmin.from('rx_group_messages').select('created_at').eq('group_id', g.id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
  ]);
  const posts = p.count ?? 0;
  const last = (l.data?.created_at as string | undefined) ?? null;
  const isNew = g.is_new && !last && fresh14(g.created_at);
  const status = g.status === 'archived' ? 'Archived' : isNew ? 'New' : posts < 5 ? 'Quiet' : 'Active';
  return { id: g.id, cells: [g.name, n(m.count ?? 0), n(posts), lastActive(last, g.created_at), status] };
}

const screen: ScreenModule = {
  spec,
  async load() {
    const { data } = await supabaseAdmin.from('rx_groups').select('id, name, status, is_new, created_at').eq('is_city', false).order('created_at').limit(200);
    const rows = await Promise.all(((data ?? []) as G[]).map(statsFor));
    return { rows, note: 'Posts are messages in the group chat in the last 7 days.' };
  },

  async act(_ctx, actionId, rowId) {
    const { data: g } = await supabaseAdmin.from('rx_groups').select('id, name, status, is_general, is_city, is_facilitators').eq('id', rowId).maybeSingle();
    if (!g || g.is_city) return { ok: false, error: 'That group no longer exists.' };
    if (actionId === 'archive') {
      if (g.is_general || g.is_facilitators) return { ok: false, error: 'This group cannot be archived.' };
      if (g.status === 'archived') return { ok: false, error: 'It is already archived.' };
      const { data: members } = await supabaseAdmin.from('rx_group_members').select('user_id').eq('group_id', rowId);
      const notes = ((members ?? []) as { user_id: string }[]).map((m) => ({ user_id: m.user_id, type: 'community', title: `${g.name} has been archived`, message: 'It was quiet, so we closed it. Your messages are kept. Browse Groups to find an active one.', link: '/community/groups' }));
      if (notes.length) await supabaseAdmin.from('notifications').insert(notes);
      const { error } = await supabaseAdmin.from('rx_groups').update({ status: 'archived' }).eq('id', rowId);
      if (error) return { ok: false, error: 'We could not archive that group.' };
      return { ok: true, message: `${g.name} archived. Members got a note.` };
    }
    if (actionId === 'mark-active') {
      if (g.status === 'active') return { ok: false, error: 'It is already active. Quiet and New are worked out from recent posts.' };
      const { error } = await supabaseAdmin.from('rx_groups').update({ status: 'active' }).eq('id', rowId);
      if (error) return { ok: false, error: 'We could not update that group.' };
      return { ok: true, message: `${g.name} is active again.` };
    }
    return { ok: false, error: 'Unknown action.' };
  },
};

export default screen;
