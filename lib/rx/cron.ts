import 'server-only';
// lib/rx/cron.ts
// Daily jobs for the reimagined member app. Each returns a small summary and never throws on one bad row.
//   1. announcements: Scheduled -> Live on their start date, Live -> Ended after their end date
//   2. practice reminders: one gentle nudge to members with a plan this week who have not checked in today
//   3. quiet members: tell a Circle's facilitator when someone has had no check-in for 5 days (never what they wrote)

import { supabaseAdmin } from '@/lib/supabase/admin';
import { notify } from '@/lib/notify';
import { diffDays, localISODate, mondayOfISO } from './dates';

export async function syncAnnouncementStatus(): Promise<{ started: number; ended: number }> {
  const today = localISODate('Africa/Lagos');
  const { data: start } = await supabaseAdmin.from('announcements').update({ status: 'Live' }).eq('status', 'Scheduled').lte('starts_on', today).select('id');
  const { data: end } = await supabaseAdmin.from('announcements').update({ status: 'Ended' }).eq('status', 'Live').lt('ends_on', today).select('id');
  return { started: start?.length ?? 0, ended: end?.length ?? 0 };
}

function localHour(tz: string): number {
  try { return Number(new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', hourCycle: 'h23' }).format(new Date())); } catch { return 12; }
}

export async function sendPracticeReminders(): Promise<{ checked: number; sent: number }> {
  const { data: members } = await supabaseAdmin.from('member_profile').select('user_id, timezone, notif, quiet_hours, reminders_paused_until').not('onboarded_at', 'is', null);
  let sent = 0;
  const rows = (members ?? []) as { user_id: string; timezone: string | null; notif: Record<string, boolean> | null; quiet_hours: boolean; reminders_paused_until: string | null }[];
  for (const m of rows) {
    try {
      if (m.notif && m.notif['Practice reminders'] === false) continue;
      if (m.reminders_paused_until && new Date(m.reminders_paused_until) > new Date()) continue;
      const tz = m.timezone || 'Africa/Lagos';
      const h = localHour(tz);
      if (m.quiet_hours && (h < 7 || h >= 22)) continue;
      const today = localISODate(tz);
      const { data: plan } = await supabaseAdmin.from('practices').select('id, cue, action').eq('user_id', m.user_id).eq('week_start', mondayOfISO(today)).maybeSingle();
      if (!plan) continue;
      const { data: done } = await supabaseAdmin.from('practice_checkins').select('id').eq('user_id', m.user_id).eq('day', today).maybeSingle();
      if (done) continue;
      await notify(m.user_id, { title: 'Today’s practice', body: `After I ${plan.cue}, I will ${plan.action}.`, url: '/dashboard', tag: 'practice' });
      sent++;
    } catch (e) { console.error('[rx/cron] practice reminder failed', e instanceof Error ? e.message : e); }
  }
  return { checked: rows.length, sent };
}

export async function notifyFacilitatorsOfQuietMembers(): Promise<{ notices: number }> {
  const { data: circles } = await supabaseAdmin.from('circles').select('id, facilitator_id, timezone').eq('status', 'active').not('facilitator_id', 'is', null);
  let notices = 0;
  for (const c of (circles ?? []) as { id: string; facilitator_id: string; timezone: string | null }[]) {
    try {
      const today = localISODate(c.timezone || 'Africa/Lagos');
      const { data: seats } = await supabaseAdmin.from('circle_seats').select('user_id').eq('circle_id', c.id).eq('role', 'member');
      for (const s of (seats ?? []) as { user_id: string }[]) {
        const { data: last } = await supabaseAdmin.from('practice_checkins').select('day').eq('user_id', s.user_id).order('day', { ascending: false }).limit(1).maybeSingle();
        // Only members who have started checking in can "go quiet".
        if (!last) continue;
        const gap = diffDays(today, last.day as string);
        if (gap < 5) continue;
        const { data: name } = await supabaseAdmin.from('member_directory').select('full_name').eq('id', s.user_id).maybeSingle();
        const first = ((name?.full_name as string | undefined) ?? 'A member').split(/\s+/)[0];
        const title = `${first} has been quiet for ${gap} days`;
        const since = new Date(Date.now() - 5 * 86400000).toISOString();
        const { data: dup } = await supabaseAdmin.from('notifications').select('id').eq('user_id', c.facilitator_id).eq('title', title).gte('created_at', since).maybeSingle();
        const { data: dup2 } = await supabaseAdmin.from('notifications').select('id').eq('user_id', c.facilitator_id).like('title', `${first} has been quiet%`).gte('created_at', since).maybeSingle();
        if (dup || dup2) continue;
        await supabaseAdmin.from('notifications').insert({ user_id: c.facilitator_id, type: 'community', title, message: 'A personal note often helps more than a reminder.', link: '/circle/facilitator' });
        await notify(c.facilitator_id, { title, body: 'A personal note often helps more than a reminder.', url: '/circle/facilitator', tag: `quiet-${s.user_id}` });
        notices++;
      }
    } catch (e) { console.error('[rx/cron] quiet-member notice failed', e instanceof Error ? e.message : e); }
  }
  return { notices };
}
