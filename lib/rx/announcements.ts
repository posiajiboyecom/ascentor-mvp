import 'server-only';
// lib/rx/announcements.ts
// Announcements a member can see: status and dates resolved, audience matched, read state attached.

import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import { getMe, getMyCircle } from './server';
import { shortDate } from './dates';

export interface AnnouncementRow {
  id: string;
  title: string;
  text: string | null;
  date_label: string | null;
  time_label: string | null;
  location: string | null;
  btn_label: string | null;
  link: string | null;
  image_url: string | null;
  audience: string;
  aud_value: string | null;
  banner: boolean;
  featured: boolean;
  starts_on: string | null;
  ends_on: string | null;
  status: 'Draft' | 'Scheduled' | 'Live' | 'Ended';
  created_at: string;
}

export interface AnnouncementView extends AnnouncementRow {
  effective: 'Live' | 'Ended';
  isRead: boolean;
  posted: string;
  line: string;
}

export function lineOf(a: Pick<AnnouncementRow, 'date_label' | 'time_label' | 'location' | 'text'>): string {
  const when = a.date_label ? a.date_label + (a.time_label ? `, ${a.time_label}` : '') : '';
  return [when, a.location].filter(Boolean).join(' · ') || a.text || '';
}

/** Live and ended announcements for this member, newest first. */
export const getMemberAnnouncements = cache(async (): Promise<AnnouncementView[]> => {
  const me = await getMe();
  if (!me) return [];
  const db = await createClient();
  const [{ data: rows }, { data: reads }, circle] = await Promise.all([
    db.from('announcements').select('*').in('status', ['Live', 'Ended', 'Scheduled']).order('created_at', { ascending: false }),
    db.from('announcement_reads').select('announcement_id').eq('user_id', me.userId),
    getMyCircle(),
  ]);
  const readSet = new Set((reads ?? []).map((r: { announcement_id: string }) => r.announcement_id));
  const today = me.today;
  const out: AnnouncementView[] = [];

  for (const a of (rows ?? []) as AnnouncementRow[]) {
    const started = !a.starts_on || a.starts_on <= today;
    const over = a.status === 'Ended' || (!!a.ends_on && a.ends_on < today);
    let effective: 'Live' | 'Ended' | null = null;
    if (over) effective = 'Ended';
    else if ((a.status === 'Live' || a.status === 'Scheduled') && started) effective = 'Live';
    if (!effective) continue;

    // audience
    const v = (a.aud_value ?? '').trim().toLowerCase();
    let match = true;
    if (a.audience === 'By stage') match = !!v && (me.profile?.stage ?? '').toLowerCase() === v;
    else if (a.audience === 'By city') match = !!v && (me.profile?.city ?? '').toLowerCase() === v;
    else if (a.audience === 'By language') match = !!v && (me.profile?.language ?? '').toLowerCase() === v;
    else if (a.audience === 'By Circle') match = !!v && !!circle && (`circle ${circle.circle.number}` === v || circle.circle.name.toLowerCase() === v);
    if (!match) continue;

    out.push({
      ...a,
      effective,
      isRead: readSet.has(a.id),
      posted: shortDate((a.starts_on ?? a.created_at.slice(0, 10))),
      line: lineOf(a),
    });
  }
  out.sort((x, y) => (y.starts_on ?? y.created_at).localeCompare(x.starts_on ?? x.created_at));
  return out;
});

export async function getUnreadAnnouncementCount(): Promise<number> {
  const all = await getMemberAnnouncements();
  return all.filter((a) => a.effective === 'Live' && !a.isRead).length;
}

/** The banner shown on Today: a live banner announcement, featured first. */
export async function getBannerAnnouncement(): Promise<AnnouncementView | null> {
  const all = await getMemberAnnouncements();
  const live = all.filter((a) => a.effective === 'Live' && a.banner);
  return live.find((a) => a.featured) ?? live[0] ?? null;
}
