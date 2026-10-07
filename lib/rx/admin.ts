import 'server-only';
// lib/rx/admin.ts
// Staff-side reads and guards for groups, announcements, Circles and mentors.

import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getMe, type Me } from './server';
import { INTEREST_GROUPS, dimensionOf } from './constants';

export async function requireAdmin(): Promise<Me> {
  const me = await getMe();
  if (!me || me.role !== 'admin') throw new Error('Admins only.');
  return me;
}

export interface Suggestion {
  key: string; name: string; description: string; dimension: string; dimLabel: string;
  picks: number; posts: number; requests: number; fitN: number; size: string; fit: string[];
}

const sizeFor = (n: number) => (n < 15 ? '10 to 30' : n < 40 ? '30 to 60' : n < 80 ? '40 to 80' : '50 to 100');

/**
 * Groups worth opening, from member signals only: interests chosen in onboarding, dimension/sub tags on posts,
 * and group requests. Never from Sage conversations or survey answers. An interest that no active group covers
 * and that someone has chosen becomes a suggestion until an admin creates it or dismisses it.
 */
export async function computeSuggestions(): Promise<Suggestion[]> {
  const [{ data: groups }, { data: members }, { data: posts }, { data: reqs }, { data: state }] = await Promise.all([
    supabaseAdmin.from('rx_groups').select('fit, status'),
    supabaseAdmin.from('member_profile').select('interests'),
    supabaseAdmin.from('feed_posts').select('sub, dimension').eq('deleted', false).gte('created_at', new Date(Date.now() - 90 * 86400000).toISOString()),
    supabaseAdmin.from('rx_group_requests').select('text'),
    supabaseAdmin.from('rx_group_suggestion_state').select('key'),
  ]);
  const covered = new Set(((groups ?? []) as { fit: string[]; status: string }[]).filter((g) => g.status === 'active').flatMap((g) => g.fit.map((x) => x.toLowerCase())));
  const decided = new Set(((state ?? []) as { key: string }[]).map((s) => s.key.toLowerCase()));
  const interests = ((members ?? []) as { interests: string[] }[]).flatMap((m) => m.interests);
  const subs = ((posts ?? []) as { sub: string | null }[]).map((p) => (p.sub ?? '').toLowerCase()).filter(Boolean);
  const requests = ((reqs ?? []) as { text: string }[]).map((r) => r.text.toLowerCase());

  const out: Suggestion[] = [];
  for (const g of INTEREST_GROUPS) {
    for (const item of g.items) {
      const k = item.toLowerCase();
      if (covered.has(k) || decided.has(k)) continue;
      const picks = interests.filter((i) => i.toLowerCase() === k).length;
      const postsN = subs.filter((s) => s === k || s.includes(k)).length;
      const requestsN = requests.filter((r) => r.includes(k)).length;
      if (picks + postsN + requestsN === 0) continue;
      const dim = dimensionOf(item) ?? 'Community';
      out.push({
        key: item, name: item, description: `Members who want to grow in ${item.toLowerCase()}, together.`, dimension: dim,
        dimLabel: `${dim} · ${item}`, picks, posts: postsN, requests: requestsN, fitN: picks, size: sizeFor(picks), fit: [item],
      });
    }
  }
  return out.sort((a, b) => b.picks + b.posts * 2 + b.requests * 3 - (a.picks + a.posts * 2 + a.requests * 3));
}

export interface AdminGroupRow {
  id: string; slug: string; name: string; members: number; posts7d: number; last: string | null; isNew: boolean; quiet: boolean; status: string; isFacilitators: boolean; isCity: boolean;
}

export async function adminGroups(): Promise<AdminGroupRow[]> {
  const db = await createClient();
  const [{ data: groups }, { data: stats }] = await Promise.all([
    db.from('rx_groups').select('id, slug, name, is_new, status, is_facilitators, is_city, created_at').order('created_at'),
    db.from('rx_group_stats').select('group_id, member_count, posts_7d, last_active'),
  ]);
  const st = new Map(((stats ?? []) as { group_id: string; member_count: number; posts_7d: number; last_active: string | null }[]).map((s) => [s.group_id, s]));
  return ((groups ?? []) as { id: string; slug: string; name: string; is_new: boolean; status: string; is_facilitators: boolean; is_city: boolean; created_at: string }[]).map((g) => {
    const s = st.get(g.id);
    const fresh = g.is_new && Date.now() - new Date(g.created_at).getTime() < 14 * 86400000;
    return { id: g.id, slug: g.slug, name: g.name, members: s?.member_count ?? 0, posts7d: s?.posts_7d ?? 0, last: s?.last_active ?? null, isNew: fresh, quiet: !fresh && g.status === 'active' && (s?.posts_7d ?? 0) < 5, status: g.status, isFacilitators: g.is_facilitators, isCity: g.is_city };
  });
}
