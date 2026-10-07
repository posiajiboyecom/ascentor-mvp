'use server';

import { revalidatePath } from 'next/cache';
import { fail } from '@/lib/rx/server';
import type { ActionResult } from '@/lib/rx/types';
import { requireAdmin } from '@/lib/rx/admin';
import { createClient } from '@/lib/supabase/server';
import { cleanText } from '@/lib/rx/safety';
import { AUDIENCES } from '@/lib/rx/constants';
import { isOwnMediaUrl } from '@/lib/rx/media';

export interface AnnouncementInput {
  id?: string;
  title: string; text: string; date_label: string; time_label: string; location: string;
  btn_label: string; link: string; image_url: string | null;
  audience: string; aud_value: string; banner: boolean; featured: boolean;
  starts_on: string; ends_on: string; status: 'Draft' | 'Scheduled' | 'Live' | 'Ended';
}

const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);

export async function saveAnnouncement(i: AnnouncementInput): Promise<ActionResult<{ id: string }>> {
  try {
    const me = await requireAdmin();
    const title = cleanText(i.title, 120);
    if (!title) throw new Error('Give it a title.');
    if (!(AUDIENCES as readonly string[]).includes(i.audience)) throw new Error('Choose an audience.');
    if (i.audience !== 'All members' && !cleanText(i.aud_value, 80)) throw new Error('Say which members it is for.');
    const link = cleanText(i.link, 300);
    if (link && !/^(https?:\/\/|\/)/i.test(link)) throw new Error('The link must start with https:// or /.');
    if (i.starts_on && !isDate(i.starts_on)) throw new Error('The start date isn’t valid.');
    if (i.ends_on && !isDate(i.ends_on)) throw new Error('The end date isn’t valid.');
    if (i.starts_on && i.ends_on && i.ends_on < i.starts_on) throw new Error('The end date is before the start date.');
    if (!['Draft', 'Scheduled', 'Live', 'Ended'].includes(i.status)) throw new Error('Choose a status.');
    if (i.image_url && !isOwnMediaUrl(i.image_url)) throw new Error('That image isn’t allowed. Upload it again.');

    const row = {
      title, text: cleanText(i.text, 500) || null, date_label: cleanText(i.date_label, 60) || null, time_label: cleanText(i.time_label, 40) || null,
      location: cleanText(i.location, 160) || null, btn_label: cleanText(i.btn_label, 40) || null, link: link || null, image_url: i.image_url || null,
      audience: i.audience, aud_value: i.audience === 'All members' ? null : cleanText(i.aud_value, 80), banner: !!i.banner, featured: !!i.featured,
      starts_on: i.starts_on || null, ends_on: i.ends_on || null, status: i.status,
    };
    const db = await createClient();
    let id = i.id;
    if (id) {
      const { error } = await db.from('announcements').update(row).eq('id', id);
      if (error) throw error;
    } else {
      const { data, error } = await db.from('announcements').insert({ ...row, created_by: me.userId }).select('id').single();
      if (error) throw error;
      id = data.id as string;
    }
    // One featured announcement at a time.
    if (row.featured) await db.from('announcements').update({ featured: false }).neq('id', id as string).eq('featured', true);
    revalidatePath('/admin/announcements');
    revalidatePath('/announcements');
    revalidatePath('/dashboard');
    return { ok: true, id: id as string };
  } catch (e) { return fail(e, 'We couldn’t save that announcement.'); }
}
