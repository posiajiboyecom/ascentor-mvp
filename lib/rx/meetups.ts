import 'server-only';
// lib/rx/meetups.ts
// Member meetups in city groups (rx_meetups, rx_meetup_rsvps). Everything goes through the service role, so every read
// here checks that the member belongs to the meetup's city group. The exact venue is only returned to the host and to
// people who said they're going; everyone else sees the area.
import { supabaseAdmin } from '@/lib/supabase/admin';

export type Rsvp = 'going' | 'maybe' | 'no';
export interface MeetupCard {
  id: string; title: string; area: string; startsAt: string; endsAt: string; cityName: string; citySlug: string;
  going: number; mine: Rsvp | null; cancelled: boolean;
}
export interface MeetupDetail extends MeetupCard {
  description: string; venue: string | null; groupId: string; hostId: string | null; hostName: string;
  isHost: boolean; maybe: number; people: { id: string; name: string; avatarUrl: string | null }[];
}

const db = () => supabaseAdmin;

/** City groups this member has joined: id → { name, slug }. */
export async function myCityGroups(userId: string): Promise<Map<string, { name: string; slug: string }>> {
  const { data: mem } = await db().from('rx_group_members').select('group_id').eq('user_id', userId);
  const ids = (mem ?? []).map((m) => m.group_id as string);
  const out = new Map<string, { name: string; slug: string }>();
  if (!ids.length) return out;
  const { data } = await db().from('rx_groups').select('id, name, slug').in('id', ids).eq('is_city', true).eq('status', 'active');
  for (const g of data ?? []) out.set(g.id as string, { name: g.name as string, slug: g.slug as string });
  return out;
}

async function counts(ids: string[], userId: string) {
  const going = new Map<string, number>(); const maybe = new Map<string, number>(); const mine = new Map<string, Rsvp>();
  if (!ids.length) return { going, maybe, mine };
  const { data } = await db().from('rx_meetup_rsvps').select('meetup_id, user_id, status').in('meetup_id', ids);
  for (const r of data ?? []) {
    const id = r.meetup_id as string;
    if (r.status === 'going') going.set(id, (going.get(id) ?? 0) + 1);
    if (r.status === 'maybe') maybe.set(id, (maybe.get(id) ?? 0) + 1);
    if (r.user_id === userId) mine.set(id, r.status as Rsvp);
  }
  return { going, maybe, mine };
}

/** Upcoming meetups (not yet ended) in the member's city groups, soonest first. Pass a group id to narrow to one city. */
export async function upcomingMeetups(userId: string, onlyGroupId?: string, limit = 30): Promise<MeetupCard[]> {
  const cities = await myCityGroups(userId);
  const groupIds = onlyGroupId ? (cities.has(onlyGroupId) ? [onlyGroupId] : []) : [...cities.keys()];
  if (!groupIds.length) return [];
  const { data } = await db().from('rx_meetups').select('id, group_id, title, area, starts_at, ends_at, status')
    .in('group_id', groupIds).eq('status', 'scheduled').gt('ends_at', new Date().toISOString()).order('starts_at').limit(limit);
  const rows = data ?? [];
  const c = await counts(rows.map((r) => r.id as string), userId);
  return rows.map((r) => {
    const city = cities.get(r.group_id as string)!;
    return {
      id: r.id as string, title: r.title as string, area: r.area as string, startsAt: r.starts_at as string, endsAt: r.ends_at as string,
      cityName: city.name, citySlug: city.slug, going: c.going.get(r.id as string) ?? 0, mine: c.mine.get(r.id as string) ?? null, cancelled: false,
    };
  });
}

/** One meetup, or null when it doesn't exist or the member isn't in its city group (staff can always see it). */
export async function getMeetup(id: string, userId: string, isStaff: boolean): Promise<MeetupDetail | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data: m } = await db().from('rx_meetups').select('*').eq('id', id).maybeSingle();
  if (!m) return null;
  const { data: g } = await db().from('rx_groups').select('id, name, slug').eq('id', m.group_id).maybeSingle();
  if (!g) return null;
  if (!isStaff) {
    const { data: mem } = await db().from('rx_group_members').select('group_id').eq('group_id', g.id).eq('user_id', userId).maybeSingle();
    if (!mem) return null;
  }
  const c = await counts([id], userId);
  const { data: goers } = await db().from('rx_meetup_rsvps').select('user_id').eq('meetup_id', id).eq('status', 'going').order('updated_at').limit(12);
  const ids = [...new Set([m.host_id as string | null, ...(goers ?? []).map((r) => r.user_id as string)].filter((x): x is string => !!x))];
  const names = new Map<string, { name: string; avatarUrl: string | null }>();
  if (ids.length) {
    const { data: ps } = await db().from('profiles').select('id, full_name, avatar_url').in('id', ids);
    for (const p of ps ?? []) names.set(p.id as string, { name: ((p.full_name as string | null) ?? '').trim() || 'Member', avatarUrl: (p.avatar_url as string | null) ?? null });
  }
  const isHost = m.host_id === userId;
  const mine = c.mine.get(id) ?? null;
  return {
    id, title: m.title, area: m.area, startsAt: m.starts_at, endsAt: m.ends_at, cityName: g.name as string, citySlug: g.slug as string,
    going: c.going.get(id) ?? 0, maybe: c.maybe.get(id) ?? 0, mine, cancelled: m.status === 'cancelled',
    description: m.description ?? '', venue: isHost || mine === 'going' || isStaff ? m.venue : null, groupId: g.id as string,
    hostId: m.host_id, hostName: (m.host_id && names.get(m.host_id)?.name) || 'A member', isHost,
    people: (goers ?? []).map((r) => ({ id: r.user_id as string, ...(names.get(r.user_id as string) ?? { name: 'Member', avatarUrl: null }) })),
  };
}

/** "Sat 24 Oct · 10:00 AM to 1:00 PM WAT" in the member's own time zone. */
export function whenLabel(startIso: string, endIso: string, tz?: string | null): string {
  const zone = tz || 'Africa/Lagos';
  const opt = (o: Intl.DateTimeFormatOptions) => { try { return new Intl.DateTimeFormat('en-GB', { ...o, timeZone: zone }); } catch { return new Intl.DateTimeFormat('en-GB', { ...o, timeZone: 'Africa/Lagos' }); } };
  const s = new Date(startIso); const e = new Date(endIso);
  const day = opt({ weekday: 'short', day: 'numeric', month: 'short' }).format(s);
  const t = opt({ hour: 'numeric', minute: '2-digit', hour12: true });
  const zoneName = opt({ timeZoneName: 'short' }).formatToParts(s).find((p) => p.type === 'timeZoneName')?.value ?? '';
  return `${day} · ${t.format(s)} to ${t.format(e)}${zoneName ? ` ${zoneName}` : ''}`;
}
