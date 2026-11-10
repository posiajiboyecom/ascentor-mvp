import 'server-only';
// lib/rx/search.ts
// One search for the member app: the command palette (/api/search) and the Search page both call runSearch().
// It runs as the signed-in member, so row-level security decides what comes back. People are read from the
// member_directory view, which exposes only id, name and avatar; never email or anything private.

import { createClient } from '@/lib/supabase/server';
import { relTime } from './dates';

export type SearchKey = 'lessons' | 'groups' | 'people' | 'posts' | 'sessions';
export interface SearchItem { title: string; meta: string; mark: string; href: string }
export interface SearchSection { key: SearchKey; label: string; items: SearchItem[] }

/** Strips characters that would break a PostgREST filter, and caps the length. */
export const cleanQuery = (s: string) => s.replace(/[%*,()\:"'_]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);

const first = (s: string) => (s.trim().charAt(0) || '?').toUpperCase();
const ini = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p.charAt(0).toUpperCase()).join('') || '?';
const snippet = (t: string) => { const x = t.replace(/\s+/g, ' ').trim(); return x.length > 90 ? `${x.slice(0, 87)}…` : x; };

export async function runSearch(raw: string, perSection = 20): Promise<SearchSection[]> {
  const q = cleanQuery(raw);
  if (q.length < 2) return [];
  const like = `%${q}%`;
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return [];

  const [courses, sessions, groups, people, posts] = await Promise.all([
    db.from('rx_lessons').select('slug, title, dimension').eq('published', true).ilike('title', like).limit(perSection),
    db.from('expert_sessions').select('id, title, expert_name, scheduled_at').eq('status', 'scheduled').or(`title.ilike.${like},expert_name.ilike.${like}`).order('scheduled_at', { ascending: true }).limit(perSection),
    db.from('rx_groups').select('slug, name, description, is_city, is_facilitators').eq('status', 'active').eq('is_facilitators', false).or(`name.ilike.${like},description.ilike.${like}`).limit(perSection),
    db.from('member_directory').select('id, full_name').ilike('full_name', like).neq('id', user.id).limit(perSection),
    db.from('feed_posts').select('id, body, created_at').eq('deleted', false).ilike('body', like).order('created_at', { ascending: false }).limit(perSection),
  ]);

  const out: SearchSection[] = [];
  const lessons: SearchItem[] = ((courses.data ?? []) as { slug: string; title: string; dimension: string | null }[])
    .map((c) => ({ title: c.title, meta: `Lesson${c.dimension ? ` · ${c.dimension}` : ''}`, mark: 'L', href: `/learn/lesson/${c.slug}` }));
  if (lessons.length) out.push({ key: 'lessons', label: 'Lessons', items: lessons });

  const grp: SearchItem[] = ((groups.data ?? []) as { slug: string; name: string; description: string | null; is_city: boolean }[])
    .map((g) => ({ title: g.name, meta: `${g.is_city ? 'City group' : 'Group'}${g.description ? ` · ${snippet(g.description)}` : ''}`, mark: 'G', href: `/community/groups/${g.slug}` }));
  if (grp.length) out.push({ key: 'groups', label: 'Groups', items: grp });

  const ppl: SearchItem[] = ((people.data ?? []) as { id: string; full_name: string | null }[])
    .filter((p) => p.full_name)
    .map((p) => ({ title: p.full_name as string, meta: 'Member', mark: ini(p.full_name as string), href: `/messages?to=${p.id}` }));
  if (ppl.length) out.push({ key: 'people', label: 'People', items: ppl });

  const pst: SearchItem[] = ((posts.data ?? []) as { id: string; body: string; created_at: string }[])
    .map((p) => ({ title: snippet(p.body), meta: `Post · ${relTime(p.created_at)}`, mark: 'P', href: `/community/post/${p.id}` }));
  if (pst.length) out.push({ key: 'posts', label: 'Posts', items: pst });

  const ses: SearchItem[] = ((sessions.data ?? []) as { id: string; title: string; expert_name: string | null; scheduled_at: string | null }[])
    .map((s) => ({
      title: s.title,
      meta: ['Expert session', s.expert_name, s.scheduled_at ? new Date(s.scheduled_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'Africa/Lagos' }) : null].filter(Boolean).join(' · '),
      mark: first(s.title), href: '/experts',
    }));
  if (ses.length) out.push({ key: 'sessions', label: 'Sessions', items: ses });
  return out;
}
