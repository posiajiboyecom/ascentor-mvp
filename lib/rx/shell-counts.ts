import 'server-only';
// lib/rx/shell-counts.ts
// Small numbers the member shell shows: unread announcements, pending message requests, the member's city group.

import { createClient } from '@/lib/supabase/server';
import { getMe } from './server';
import { getMemberAnnouncements } from './announcements';

export interface ShellCounts {
  unreadAnnouncements: number;
  messageRequests: number;
  cityGroupSlug: string | null;
  cityName: string | null;
  latest: { id: string; title: string; posted: string; isNew: boolean }[];
}

export function slugify(s: string): string {
  return s.toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_]+/g, '-');
}

export async function getShellCounts(): Promise<ShellCounts> {
  const me = await getMe();
  if (!me) return { unreadAnnouncements: 0, messageRequests: 0, cityGroupSlug: null, cityName: null, latest: [] };
  const db = await createClient();
  const [anns, req, city] = await Promise.all([
    getMemberAnnouncements().catch(() => []),
    db.from('dm_threads').select('id', { count: 'exact', head: true }).eq('status', 'request').neq('requested_by', me.userId),
    me.profile?.city
      ? db.from('rx_groups').select('slug, name').eq('slug', `city-${slugify(me.profile.city)}`).eq('is_city', true).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const live = anns.filter((a) => a.effective === 'Live');
  return {
    unreadAnnouncements: live.filter((a) => !a.isRead).length,
    messageRequests: req.count ?? 0,
    cityGroupSlug: (city.data as { slug: string } | null)?.slug ?? null,
    cityName: (city.data as { name: string } | null)?.name ?? me.profile?.city ?? null,
    latest: live.slice(0, 5).map((a) => ({ id: a.id, title: a.title, posted: a.posted, isNew: !a.isRead })),
  };
}
