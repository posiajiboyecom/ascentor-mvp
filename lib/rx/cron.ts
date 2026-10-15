import 'server-only';
// lib/rx/cron.ts
// Daily jobs for the reimagined member app. Each returns a small summary and never throws on one bad row.
//   1. announcements: Scheduled -> Live on their start date, Live -> Ended after their end date
//   2. practice reminders: one gentle nudge to members with a plan this week who have not checked in today
//   3. quiet members: tell a Circle's facilitator when someone has had no check-in for 5 days (never what they wrote)

import { supabaseAdmin } from '@/lib/supabase/admin';
import { notify } from '@/lib/notify';
import { rxNotify } from './notifications';
import { buildDigest, isDigestMoment, isEveningNudge, isMorningNudge } from './digest';
import { circleCardsFor, circleTitle } from './circles';
import { addDays, cycleWeek, diffDays, localISODate, mondayOfISO, whenLabel } from './dates';
import { circleWindow, MENTOR_CALL_MINUTES } from './calls';
import { MIN_GOING } from './cmentor';

export async function syncAnnouncementStatus(): Promise<{ started: number; ended: number }> {
  const today = localISODate('Africa/Lagos');
  const { data: start } = await supabaseAdmin.from('announcements').update({ status: 'Live' }).eq('status', 'Scheduled').lte('starts_on', today).select('id');
  const { data: end } = await supabaseAdmin.from('announcements').update({ status: 'Ended' }).eq('status', 'Live').lt('ends_on', today).select('id');
  return { started: start?.length ?? 0, ended: end?.length ?? 0 };
}

/**
 * The daily practice nudge, sent in each member's own morning (and evening for those who chose two a day). Runs every hour, so
 * each member matches once. It is skipped when reminders are paused, when no plan is set, or when they already checked in.
 */
export async function sendPracticeReminders(now: Date = new Date()): Promise<{ checked: number; sent: number }> {
  const { data: members } = await supabaseAdmin.from('member_profile').select('user_id, timezone, max_per_day, reminders_paused_until').not('onboarded_at', 'is', null).eq('is_demo', false);
  const rows = (members ?? []) as { user_id: string; timezone: string | null; max_per_day: number | null; reminders_paused_until: string | null }[];
  let sent = 0; let checked = 0;
  for (const m of rows) {
    try {
      const tz = m.timezone || 'Africa/Lagos';
      const morning = isMorningNudge(tz, now);
      const evening = isEveningNudge(tz, now) && (m.max_per_day ?? 1) >= 2;
      if (!morning && !evening) continue;
      checked++;
      if (m.reminders_paused_until && new Date(m.reminders_paused_until) > now) continue;
      const today = localISODate(tz, now);
      const { data: plan } = await supabaseAdmin.from('practices').select('id, cue, action').eq('user_id', m.user_id).eq('week_start', mondayOfISO(today)).maybeSingle();
      if (!plan) continue;
      const { data: done } = await supabaseAdmin.from('practice_checkins').select('id').eq('user_id', m.user_id).eq('day', today).maybeSingle();
      if (done) continue;
      // Never twice in the same hour, even if the job is retried.
      const { data: recent } = await supabaseAdmin.from('notifications').select('id').eq('user_id', m.user_id).eq('kind', 'practice_reminder').gte('created_at', new Date(now.getTime() - 3 * 3600000).toISOString()).limit(1).maybeSingle();
      if (recent) continue;
      await rxNotify(m.user_id, {
        kind: 'practice_reminder', entityId: plan.id as string, url: '/dashboard',
        title: evening ? 'There is still time today' : 'Today’s practice',
        body: `After I ${plan.cue}, I will ${plan.action}.`,
      });
      sent++;
    } catch (e) { console.error('[rx/cron] practice reminder failed', e instanceof Error ? e.message : e); }
  }
  return { checked, sent };
}

async function digestFor(m: { user_id: string; timezone: string | null }, now: Date): Promise<boolean> {
  const tz = m.timezone || 'Africa/Lagos';
  const uid = m.user_id;
  const today = localISODate(tz, now);
  const monday = mondayOfISO(today);
  const lastMonday = addDays(monday, -7);
  const sixDaysAgo = new Date(now.getTime() - 6 * 86400000).toISOString();

  const { data: already } = await supabaseAdmin.from('notifications').select('id').eq('user_id', uid).eq('kind', 'weekly_digest').gte('created_at', sixDaysAgo).limit(1).maybeSingle();
  if (already) return false;

  const [{ data: lastPlan }, { data: thisPlan }, { data: checks }, { data: home }, { data: myPosts }, { data: prof }, { count: unread }, cards] = await Promise.all([
    supabaseAdmin.from('practices').select('id').eq('user_id', uid).eq('week_start', lastMonday).maybeSingle(),
    supabaseAdmin.from('practices').select('id').eq('user_id', uid).eq('week_start', monday).maybeSingle(),
    supabaseAdmin.from('practice_checkins').select('status').eq('user_id', uid).gte('day', lastMonday).lt('day', monday),
    supabaseAdmin.from('circle_seats').select('circles(cycle_start)').eq('user_id', uid).eq('role', 'member').order('joined_at', { ascending: true }).limit(1).maybeSingle(),
    supabaseAdmin.from('feed_posts').select('id').eq('user_id', uid).eq('deleted', false).order('created_at', { ascending: false }).limit(50),
    supabaseAdmin.from('profiles').select('full_name').eq('id', uid).maybeSingle(),
    supabaseAdmin.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', uid).eq('read', false),
    circleCardsFor(uid, tz, supabaseAdmin),
  ]);

  const rowsC = (checks ?? []) as { status: string }[];
  const cycleStart = ((home as unknown as { circles: { cycle_start: string | null } | null } | null)?.circles?.cycle_start) ?? null;
  const week = cycleWeek(cycleStart, today);
  const { data: lesson } = week ? await supabaseAdmin.from('rx_lessons').select('title').eq('week_no', week).eq('published', true).maybeSingle() : { data: null };
  const postIds = ((myPosts ?? []) as { id: string }[]).map((p) => p.id);
  const { count: newComments } = postIds.length
    ? await supabaseAdmin.from('feed_replies').select('id', { count: 'exact', head: true }).in('post_id', postIds).neq('user_id', uid).gte('created_at', new Date(now.getTime() - 7 * 86400000).toISOString())
    : { count: 0 };

  const d = buildDigest({
    firstName: (((prof?.full_name as string | undefined) ?? '').split(/\s+/)[0]) || 'there',
    lastWeek: lastPlan ? { kept: rowsC.filter((r) => r.status === 'kept').length, checkedIn: rowsC.length } : null,
    lessonTitle: (lesson?.title as string | undefined) ?? null, lessonWeek: week,
    circleLines: cards.filter((c) => c.role === 'member').map((c) => `${circleTitle(c)}: ${c.state.headline}.`),
    newComments: newComments ?? 0, unread: unread ?? 0, practiceSetThisWeek: !!thisPlan,
  });
  await rxNotify(uid, { kind: 'weekly_digest', url: '/dashboard', title: d.title, body: d.body, lines: d.lines });
  return true;
}

/** The Monday summary, sent at 8 in the morning where each member is. Runs every hour and is safe to repeat. */
export async function sendWeeklyDigests(now: Date = new Date()): Promise<{ checked: number; sent: number }> {
  const { data: members } = await supabaseAdmin.from('member_profile').select('user_id, timezone').not('onboarded_at', 'is', null).eq('is_demo', false);
  const due = ((members ?? []) as { user_id: string; timezone: string | null }[]).filter((m) => isDigestMoment(m.timezone || 'Africa/Lagos', now));
  let sent = 0;
  // A handful at a time, so a big Monday morning still finishes inside the job's time limit.
  for (let i = 0; i < due.length; i += 8) {
    const results = await Promise.allSettled(due.slice(i, i + 8).map((m) => digestFor(m, now)));
    for (const r of results) { if (r.status === 'fulfilled' && r.value) sent++; else if (r.status === 'rejected') console.error('[rx/cron] weekly digest failed', r.reason instanceof Error ? r.reason.message : r.reason); }
  }
  return { checked: due.length, sent };
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


async function circleAudience(circleId: string): Promise<string[]> {
  const { data } = await supabaseAdmin.from('circle_seats').select('user_id').eq('circle_id', circleId);
  return ((data ?? []) as { user_id: string }[]).map((s) => s.user_id);
}

/** A reminder the day before each weekly Circle call and each mentor session. */
export async function sendCallReminders(): Promise<{ circle: number; mentor: number }> {
  let circleN = 0; let mentorN = 0;
  const now = new Date();
  const horizon = new Date(now.getTime() + 24 * 3600000);

  const { data: circles } = await supabaseAdmin.from('circles').select('id, name, number, meeting_dow, meeting_time, timezone, interest').eq('status', 'active').eq('is_demo', false);
  for (const c of (circles ?? []) as { id: string; name: string; number: number; meeting_dow: number; meeting_time: string; timezone: string | null; interest: string | null }[]) {
    const w = circleWindow(c, now);
    if (w.startsAt > now && w.startsAt <= horizon) {
      const aud = await circleAudience(c.id);
      await rxNotify(aud, { kind: 'call_tomorrow', entityId: c.id, url: `/circle?c=${c.id}`, title: 'Circle call tomorrow', body: `${c.interest ?? c.name} · Circle ${c.number}, ${whenLabel(w.startsAt, c.timezone)}. Audio by default, 15 minutes.` });
      circleN += aud.length;
    }
  }

  const { data: sessions } = await supabaseAdmin.from('circle_mentor_sessions').select('id, circle_id, starts_at, mentor_id').eq('status', 'scheduled').gt('starts_at', now.toISOString()).lte('starts_at', horizon.toISOString());
  for (const s of (sessions ?? []) as { id: string; circle_id: string; starts_at: string; mentor_id: string }[]) {
    const ids = await circleAudience(s.circle_id);
    const { data: m } = await supabaseAdmin.from('human_mentors').select('user_id').eq('id', s.mentor_id).maybeSingle();
    if (m?.user_id) ids.push(m.user_id as string);
    await rxNotify(ids, { kind: 'call_tomorrow', entityId: s.id, url: `/sessions?c=${s.circle_id}`, title: 'Mentor session tomorrow', body: `${whenLabel(s.starts_at, 'Africa/Lagos')} (WAT). ${MENTOR_CALL_MINUTES} minutes, audio by default. Say whether you are going.` });
    mentorN += ids.length;
  }
  return { circle: circleN, mentor: mentorN };
}

/**
 * The RSVP rule: a mentor session runs only if MIN_GOING or more members are going a day before. If not, the session and the
 * rest of the series are cancelled, the Circle goes back to choosing a time from the mentor's open slots, and everyone is told.
 * Also marks finished sessions as held.
 */
export async function enforceMentorSessionRules(): Promise<{ cancelled: number; held: number }> {
  const now = new Date();
  const horizon = new Date(now.getTime() + 24 * 3600000);
  let cancelled = 0; let held = 0;

  const { data: ended } = await supabaseAdmin.from('circle_mentor_sessions').select('id, starts_at, duration_min').eq('status', 'scheduled').lt('starts_at', now.toISOString());
  for (const s of (ended ?? []) as { id: string; starts_at: string; duration_min: number }[]) {
    if (new Date(s.starts_at).getTime() + s.duration_min * 60000 < now.getTime()) { await supabaseAdmin.from('circle_mentor_sessions').update({ status: 'held' }).eq('id', s.id); held++; }
  }

  const { data: soon } = await supabaseAdmin.from('circle_mentor_sessions').select('id, circle_id, circle_mentor_id, mentor_id, starts_at').eq('status', 'scheduled').gt('starts_at', now.toISOString()).lte('starts_at', horizon.toISOString());
  for (const s of (soon ?? []) as { id: string; circle_id: string; circle_mentor_id: string; mentor_id: string; starts_at: string }[]) {
    const { data: dc } = await supabaseAdmin.from('circles').select('is_demo').eq('id', s.circle_id).maybeSingle();
    if (dc?.is_demo) continue; // demo Circles are never moved by the RSVP rule
    const { count } = await supabaseAdmin.from('session_rsvps').select('user_id', { count: 'exact', head: true }).eq('session_id', s.id).eq('status', 'going');
    if ((count ?? 0) >= MIN_GOING) continue;
    await supabaseAdmin.from('circle_mentor_sessions').update({ status: 'cancelled', cancel_reason: 'low_rsvp' }).eq('circle_mentor_id', s.circle_mentor_id).eq('status', 'scheduled').gte('starts_at', now.toISOString());
    await supabaseAdmin.from('slot_marks').delete().eq('circle_mentor_id', s.circle_mentor_id);
    await supabaseAdmin.from('circle_mentors').update({ status: 'scheduling' }).eq('id', s.circle_mentor_id).eq('status', 'active');
    const ids = await circleAudience(s.circle_id);
    const { data: m } = await supabaseAdmin.from('human_mentors').select('user_id').eq('id', s.mentor_id).maybeSingle();
    if (m?.user_id) ids.push(m.user_id as string);
    await rxNotify(ids, { kind: 'session_moved', entityId: s.circle_mentor_id, url: `/sessions?c=${s.circle_id}`, title: 'Tomorrow’s mentor session is moved', body: `Fewer than ${MIN_GOING} members were going. Mark the times you can attend and your Circle will pick a new one.` });
    cancelled++;
  }
  return { cancelled, held };
}
