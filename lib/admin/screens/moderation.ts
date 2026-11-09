// lib/admin/screens/moderation.ts
// Spec copied from the admin prototype (Community · Moderation). The loader below is a placeholder until it reads real data.
// Prototype developer note: Matches resolveItem, removeContent and setMessagingBlocked in app/admin/moderation/actions.ts.
// Prototype KPI tiles to compute for real: Open reports (sample "4"); Resolved this week (sample "19"); Messaging blocked (sample "2"); Average time to act (sample "3 h")
import { supabaseAdmin } from '@/lib/supabase/admin';
import type { ScreenModule, ScreenSpec } from '@/lib/admin/types';
import { modAuthorOf, parseModId, removeModContent, resolveModItem, setModMessagingBlocked, type ModSource } from '@/lib/admin/moderation-actions';

export const spec: ScreenSpec = {
  area: "moderation",
  group: "Community",
  title: "Moderation",
  sub: "Reports from members. Remove content, dismiss, or block someone from messaging.",
  cols: [
    "Reported item",
    "Type",
    "Reported by",
    "Reason",
    "When",
    "Status"
  ],
  statusCol: 5,
  actions: [
    {
      id: "remove-content",
      label: "Remove content",
      col: 5,
      to: "Removed by admin",
      when: "Open",
      confirm: "The content is hidden for everyone. The author is told why."
    },
    {
      id: "block-messaging",
      label: "Block messaging",
      col: 5,
      to: "Messaging blocked",
      when: "Open",
      confirm: "The author can read, but can’t send messages until you restore it."
    },
    {
      id: "dismiss",
      label: "Dismiss",
      col: 5,
      to: "Resolved",
      when: "Open"
    }
  ],
  quick: 2
};

const TZ = 'Africa/Lagos';
const TYPE_LABEL: Record<string, string> = { post: 'Post', comment: 'Comment', dm: 'Direct message', circle: 'Circle message', group: 'Group message', meetup: 'Meetup' };
const TABLE: Record<string, string> = { post: 'feed_posts', comment: 'feed_replies', dm: 'dm_messages', circle: 'circle_messages', group: 'rx_group_messages', meetup: 'rx_meetups' };

interface Raw { source: ModSource; id: string; kind: string; ref_id: string | null; user_id: string | null; reporter_id: string | null; reason: string | null; status: string; created_at: string }

function when(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { timeZone: TZ, day: 'numeric', month: 'short' });
}

function snippet(t: string): string {
  const s = t.replace(/\s+/g, ' ').trim();
  return s.length > 60 ? `${s.slice(0, 57)}...` : s || '-';
}

async function names(ids: string[]): Promise<Map<string, string>> {
  const uniq = [...new Set(ids.filter(Boolean))];
  const out = new Map<string, string>();
  if (!uniq.length) return out;
  const { data } = await supabaseAdmin.from('member_directory').select('id, full_name').in('id', uniq);
  for (const r of data ?? []) out.set(r.id as string, ((r.full_name as string | null) ?? '').trim() || 'Member');
  return out;
}

async function fetchRaw(): Promise<Raw[]> {
  const [f, r] = await Promise.all([
    supabaseAdmin.from('rx_flags').select('id, kind, ref_id, user_id, reason, status, created_at').order('created_at', { ascending: false }).limit(200),
    supabaseAdmin.from('rx_reports').select('id, kind, ref_id, reporter_id, reason, status, created_at').order('created_at', { ascending: false }).limit(200),
  ]);
  const out: Raw[] = [];
  for (const x of (f.data ?? []) as unknown as Record<string, string | null>[]) out.push({ source: 'flag', id: x.id!, kind: x.kind ?? '', ref_id: x.ref_id, user_id: x.user_id, reporter_id: null, reason: x.reason, status: x.status ?? 'open', created_at: x.created_at! });
  for (const x of (r.data ?? []) as unknown as Record<string, string | null>[]) out.push({ source: 'report', id: x.id!, kind: x.kind ?? '', ref_id: x.ref_id, user_id: null, reporter_id: x.reporter_id, reason: x.reason, status: x.status ?? 'open', created_at: x.created_at! });
  return out.sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 200);
}

async function kpis(raws: Raw[]) {
  const open = raws.filter((r) => r.status === 'open').length;
  const weekAgo = Date.now() - 7 * 864e5;
  const resolvedWeek = raws.filter((r) => r.status !== 'open' && new Date(r.created_at).getTime() >= weekAgo).length;
  let blockedCount = 0;
  try {
    const { count } = await supabaseAdmin.from('member_profile').select('user_id', { count: 'exact', head: true }).eq('messaging_blocked', true);
    blockedCount = count ?? 0;
  } catch { /* column may be missing */ }
  return [
    { label: 'Open reports', value: String(open) },
    { label: 'Resolved this week', value: String(resolvedWeek), note: 'By the date the report was made' },
    { label: 'Messaging blocked', value: String(blockedCount) },
    { label: 'Average time to act', value: '-', note: 'Reports do not record when they were handled yet' },
  ];
}

const screen: ScreenModule = {
  spec,
  async load() {
    const raws = await fetchRaw();
    if (!raws.length) return { rows: [], kpis: await kpis([]), note: 'No reports or flags yet.' };

    const byKind = new Map<string, string[]>();
    for (const r of raws) if (r.ref_id && TABLE[r.kind]) byKind.set(r.kind, [...(byKind.get(r.kind) ?? []), r.ref_id]);
    const bodies = new Map<string, string>();
    const authors = new Map<string, string>();
    const hidden = new Set<string>();
    await Promise.all([...byKind.entries()].map(async ([kind, ids]) => {
      const sel = kind === 'post' ? 'id, body, user_id, deleted' : kind === 'dm' ? 'id, body, sender_id' : kind === 'meetup' ? 'id, title, area, host_id, status' : 'id, body, user_id';
      const { data } = await supabaseAdmin.from(TABLE[kind]).select(sel).in('id', ids);
      const found = new Set<string>();
      for (const d of (data ?? []) as unknown as Record<string, unknown>[]) {
        found.add(d.id as string);
        bodies.set(d.id as string, kind === 'meetup' ? `${d.title as string} (${d.area as string})` : (d.body as string) ?? '');
        const a = (d.user_id ?? d.sender_id ?? d.host_id) as string | undefined;
        if (a) authors.set(d.id as string, a);
        if (d.deleted || d.status === 'cancelled') hidden.add(d.id as string);
      }
      if (kind === 'comment') for (const id of ids) if (!found.has(id)) hidden.add(id);
    }));

    const authorOf = async (r: Raw): Promise<string | null> => {
      if (r.source === 'flag') return r.user_id;
      if (r.kind !== 'dm' && r.ref_id && authors.has(r.ref_id)) return authors.get(r.ref_id)!;
      return modAuthorOf('report', r);
    };
    const authorIds = await Promise.all(raws.map(authorOf));
    const idList = [...new Set(authorIds.filter(Boolean) as string[])];
    const { data: blockedRows } = idList.length ? await supabaseAdmin.from('member_profile').select('user_id').eq('messaging_blocked', true).in('user_id', idList) : { data: [] };
    const blocked = new Set((blockedRows ?? []).map((b) => b.user_id as string));
    const nm = await names(raws.map((r) => r.reporter_id ?? '').concat(authorIds.map((a) => a ?? '')));

    const rows = raws.map((r, i) => {
      const author = authorIds[i];
      let st = 'Open';
      if (r.status === 'dismissed') st = 'Resolved';
      else if (r.status !== 'open') {
        if ((r.kind === 'post' || r.kind === 'comment' || r.kind === 'meetup') && r.ref_id && hidden.has(r.ref_id)) st = 'Removed by admin';
        else if (author && blocked.has(author)) st = 'Messaging blocked';
        else st = 'Resolved';
      }
      const body = r.ref_id ? bodies.get(r.ref_id) : undefined;
      const who = author ? nm.get(author) ?? 'Member' : null;
      const item = r.kind === 'dm' ? `Direct conversation${who ? ` with ${who}` : ''}` : body !== undefined ? `${who ? `${who}: ` : ''}“${snippet(body)}”` : 'No longer available';
      return {
        id: `${r.source}:${r.id}`,
        cells: [item, TYPE_LABEL[r.kind] ?? (r.kind || '-'), r.source === 'flag' ? 'Automatic filter' : nm.get(r.reporter_id ?? '') ?? 'Member', (r.reason ?? '').trim() || 'Reported', when(r.created_at), st],
      };
    });
    return { rows, kpis: await kpis(raws), note: raws.length >= 200 ? 'Showing the 200 newest items.' : undefined };
  },

  async act(_ctx, actionId, rowId) {
    const p = parseModId(rowId);
    if (!p) return { ok: false, error: 'That item is no longer available.' };
    const { data } = await supabaseAdmin.from(p.source === 'flag' ? 'rx_flags' : 'rx_reports').select('*').eq('id', p.id).maybeSingle();
    if (!data) return { ok: false, error: 'That item is no longer available.' };
    const row = data as { kind: string; ref_id: string | null; user_id?: string | null; reporter_id?: string | null; status: string };
    if (row.status !== 'open') return { ok: false, error: 'Someone has already handled this item.' };
    try {
      if (actionId === 'dismiss') {
        await resolveModItem(p.source, p.id, 'dismissed');
        return { ok: true, message: 'Dismissed.' };
      }
      if (actionId === 'remove-content') {
        if (!row.ref_id) return { ok: false, error: 'That item is no longer available.' };
        await removeModContent(row.kind, row.ref_id);
        await resolveModItem(p.source, p.id, 'actioned');
        return { ok: true, message: 'Content removed.' };
      }
      if (actionId === 'block-messaging') {
        const author = await modAuthorOf(p.source, row);
        if (!author) return { ok: false, error: 'Could not tell who wrote this, so nobody was blocked.' };
        await setModMessagingBlocked(author, true);
        await resolveModItem(p.source, p.id, 'actioned');
        return { ok: true, message: 'Messaging blocked for that member.' };
      }
    } catch (e) {
      return { ok: false, error: (e as Error).message || 'Something went wrong.' };
    }
    return { ok: false, error: 'Unknown action.' };
  },

  async badge() {
    const [f, r] = await Promise.all([
      supabaseAdmin.from('rx_flags').select('id', { count: 'exact', head: true }).eq('status', 'open'),
      supabaseAdmin.from('rx_reports').select('id', { count: 'exact', head: true }).eq('status', 'open'),
    ]);
    return (f.count ?? 0) + (r.count ?? 0);
  },
};

export default screen;
