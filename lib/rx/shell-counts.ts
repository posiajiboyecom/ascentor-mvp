import 'server-only';
// lib/rx/shell-counts.ts
// Small numbers the member shell shows: unread announcements, pending message requests, the member's city group.

import { createClient } from '@/lib/supabase/server';
import { getMe } from './server';
import { getMemberAnnouncements } from './announcements';
import { getPinnedNotice } from './broadcasts';
import type { NoticeData } from './notice-types';
import { countUnreadDms } from './messages';

export interface ShellCounts {
  unreadAnnouncements: number;
  messageRequests: number;
  /** Direct conversations with something new from the other person (0 until dm_reads exists). */
  unreadMessages: number;
  cityGroupSlug: string | null;
  cityName: string | null;
  latest: { id: string; title: string; posted: string; isNew: boolean }[];
  /** The one card shown in the sidebar and the menu drawer: a pinned team message, else the featured announcement. */
  notice: NoticeData | null;
}

export function slugify(s: string): string {
  return s.toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_]+/g, '-');
}

export async function getShellCounts(): Promise<ShellCounts> {
  const me = await getMe();
  if (!me) return { unreadAnnouncements: 0, messageRequests: 0, unreadMessages: 0, cityGroupSlug: null, cityName: null, latest: [], notice: null };
  const db = await createClient();
  const [anns, req, unreadMessages, city] = await Promise.all([
    getMemberAnnouncements().catch(() => []),
    db.from('dm_threads').select('id', { count: 'exact', head: true }).eq('status', 'request').neq('requested_by', me.userId),
    countUnreadDms(db, me.userId),
    me.profile?.city
      ? db.from('rx_groups').select('slug, name').eq('slug', `city-${slugify(me.profile.city)}`).eq('is_city', true).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const live = anns.filter((a) => a.effective === 'Live');

  // A pinned message from the team wins. Otherwise the featured live announcement (The Elevation Summit, for example).
  let notice: NoticeData | null = null;
  try {
    const { data: seats } = await db.from('circle_seats').select('circle_id').eq('user_id', me.userId);
    notice = await getPinnedNotice({ id: me.userId, stage: me.profile?.stage, city: me.profile?.city, language: me.profile?.language, circleIds: ((seats ?? []) as { circle_id: string }[]).map((s) => s.circle_id) });
  } catch { notice = null; }
  if (!notice) {
    const featured = live.find((a) => a.featured) ?? null;
    if (featured) notice = { id: `announcement:${featured.id}`, source: 'announcement', title: featured.title, line: featured.line, href: `/announcements?focus=${featured.id}`, actionLabel: featured.btn_label ?? 'Learn more' };
  }

  return {
    unreadAnnouncements: live.filter((a) => !a.isRead).length,
    messageRequests: req.count ?? 0,
    unreadMessages,
    cityGroupSlug: (city.data as { slug: string } | null)?.slug ?? null,
    cityName: (city.data as { name: string } | null)?.name ?? me.profile?.city ?? null,
    latest: live.slice(0, 5).map((a) => ({ id: a.id, title: a.title, posted: a.posted, isNew: !a.isRead })),
    notice,
  };
}
