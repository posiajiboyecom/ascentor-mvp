// lib/admin/screens/cities.ts
// Spec copied from the admin prototype (Community · City groups). City groups are rx_groups rows with is_city = true;
// requests are rx_group_requests rows whose text starts "City group: " (see requestGroup), grouped here by city.
import { supabaseAdmin } from '@/lib/supabase/admin';
import type { ScreenModule, ScreenSpec } from '@/lib/admin/types';

export const spec: ScreenSpec = {
  area: "cities",
  group: "Community",
  title: "City groups",
  sub: "One chat per city. Members can ask for a new city.",
  cols: ["City", "Country", "Members", "Next meetup", "Status"],
  statusCol: 4,
  actions: [
    { id: "open-this-city", label: "Open this city", col: 4, to: "Open", when: "Requested", done: "City group opened. Members who asked get a note." },
    { id: "pause", label: "Pause", col: 4, to: "Paused" }
  ],
  quick: 0
};

// Same list as lib/rx/cities.ts (that file does not export it).
const COUNTRY: Record<string, string> = {
  lagos: 'Nigeria', abuja: 'Nigeria', 'port-harcourt': 'Nigeria', ibadan: 'Nigeria',
  accra: 'Ghana', nairobi: 'Kenya', london: 'United Kingdom', kano: 'Nigeria', kigali: 'Rwanda',
};
const PREFIX = /^city group:\s*/i;
const slugify = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_]+/g, '-');
const titleCase = (s: string) => s.trim().replace(/\s+/g, ' ').split(' ').map((w) => (w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w)).join(' ');

interface Req { user_id: string; text: string }
interface Ask { slug: string; name: string; country: string; users: Set<string> }

function parseRequests(reqs: Req[]): Map<string, Ask> {
  const out = new Map<string, Ask>();
  for (const r of reqs) {
    if (!PREFIX.test(r.text)) continue;
    const raw = r.text.replace(PREFIX, '').trim();
    const [cityRaw, ...rest] = raw.split(',');
    const slug = slugify(cityRaw ?? '');
    if (!slug) continue;
    const a = out.get(slug) ?? { slug, name: titleCase(cityRaw), country: COUNTRY[slug] ?? (rest.join(',').trim() ? titleCase(rest.join(',')) : '-'), users: new Set<string>() };
    a.users.add(r.user_id);
    out.set(slug, a);
  }
  return out;
}

async function requests(): Promise<Map<string, Ask>> {
  const { data } = await supabaseAdmin.from('rx_group_requests').select('user_id, text').ilike('text', 'City group:%').order('created_at', { ascending: false }).limit(2000);
  return parseRequests((data ?? []) as Req[]);
}

interface G { id: string; slug: string; name: string; status: string }

const screen: ScreenModule = {
  spec,
  async load() {
    const [{ data: groups }, asks] = await Promise.all([
      supabaseAdmin.from('rx_groups').select('id, slug, name, status').eq('is_city', true).order('created_at'),
      requests(),
    ]);
    const list = (groups ?? []) as G[];
    const counts = await Promise.all(list.map((g) => supabaseAdmin.from('rx_group_members').select('user_id', { count: 'exact', head: true }).eq('group_id', g.id)));
    const rows = list.map((g, i) => ({
      id: g.id,
      cells: [g.name, COUNTRY[g.slug.replace(/^city-/, '')] ?? '-', (counts[i].count ?? 0).toLocaleString('en-GB'), '-', g.status === 'active' ? 'Open' : 'Paused'],
    }));
    const have = new Set(list.map((g) => g.slug.replace(/^city-/, '')));
    for (const a of [...asks.values()].sort((x, y) => y.users.size - x.users.size)) {
      if (have.has(a.slug)) continue;
      rows.push({ id: `req:${a.slug}`, cells: [a.name, a.country, `${a.users.size} asking`, '-', 'Requested'] });
    }
    return { rows, note: 'Next meetup shows a dash until members can host meetups. Pause hides a city from members; there is no resume button yet.' };
  },

  async act(_ctx, actionId, rowId) {
    if (actionId === 'open-this-city') {
      if (!rowId.startsWith('req:')) return { ok: false, error: 'Only a requested city can be opened.' };
      const slug = rowId.slice(4);
      const ask = (await requests()).get(slug);
      if (!ask) return { ok: false, error: 'That request no longer exists.' };
      const groupSlug = `city-${slug}`;
      const { data: clash } = await supabaseAdmin.from('rx_groups').select('id').eq('slug', groupSlug).maybeSingle();
      if (clash) return { ok: false, error: 'That city already has a group.' };
      const { error } = await supabaseAdmin.from('rx_groups').insert({
        slug: groupSlug, name: ask.name, description: `Members in ${ask.name}.`, dimension: 'Community', is_city: true,
        prompt: 'Introduce yourself and what you are building.',
      });
      if (error) return { ok: false, error: 'We could not open that city.' };
      const notes = [...ask.users].map((user_id) => ({ user_id, type: 'community', title: `${ask.name} is now open`, message: `You asked for a ${ask.name} group. It is open, so come and say hello.`, link: '/community/cities' }));
      if (notes.length) await supabaseAdmin.from('notifications').insert(notes);
      return { ok: true, message: `${ask.name} opened. ${ask.users.size} member${ask.users.size === 1 ? '' : 's'} who asked got a note.` };
    }
    if (actionId === 'pause') {
      if (rowId.startsWith('req:')) return { ok: false, error: 'This city is only requested. Nothing to pause.' };
      const { data: g } = await supabaseAdmin.from('rx_groups').select('id, name, status, is_city').eq('id', rowId).maybeSingle();
      if (!g || !g.is_city) return { ok: false, error: 'That city no longer exists.' };
      if (g.status !== 'active') return { ok: false, error: 'It is already paused.' };
      // rx_groups.status only allows active or archived, so a paused city is stored as archived.
      const { error } = await supabaseAdmin.from('rx_groups').update({ status: 'archived' }).eq('id', rowId);
      if (error) return { ok: false, error: 'We could not pause that city.' };
      return { ok: true, message: `${g.name} paused. Members no longer see it.` };
    }
    return { ok: false, error: 'Unknown action.' };
  },
};

export default screen;
