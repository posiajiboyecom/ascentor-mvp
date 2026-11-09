'use server';
// Meetups: plan one in a city group you belong to, RSVP, cancel your own (staff can cancel any), report one.
import { revalidatePath } from 'next/cache';
import { requireMember, getMe, fail } from '@/lib/rx/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { cleanText } from '@/lib/rx/safety';
import { zonedTimeToUtc } from '@/lib/rx/dates';

type R<T = object> = ({ ok: true } & T) | { ok: false; error: string };
const UUID = /^[0-9a-f-]{36}$/i;

async function inGroup(groupId: string, userId: string) {
  const { data } = await supabaseAdmin.from('rx_group_members').select('group_id').eq('group_id', groupId).eq('user_id', userId).maybeSingle();
  return !!data;
}

export async function createMeetup(input: { groupId: string; title: string; description: string; area: string; venue: string; date: string; start: string; end: string }): Promise<R<{ id: string }>> {
  try {
    const { userId } = await requireMember();
    const me = await getMe();
    if (!UUID.test(input.groupId)) throw new Error('Choose a city.');
    const { data: g } = await supabaseAdmin.from('rx_groups').select('id, slug, is_city, status').eq('id', input.groupId).maybeSingle();
    if (!g || !g.is_city || g.status !== 'active') throw new Error('Choose one of your city groups.');
    if (!(await inGroup(g.id as string, userId))) throw new Error('Join this city group first.');

    const title = cleanText(input.title, 120); const area = cleanText(input.area, 120); const venue = cleanText(input.venue, 200);
    const description = cleanText(input.description, 2000);
    if (title.length < 3) throw new Error('Give the meetup a short title.');
    if (area.length < 2) throw new Error('Add the area, for example “Yaba”.');
    if (venue.length < 2) throw new Error('Add the exact place. Only people going will see it.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date) || !/^\d{2}:\d{2}$/.test(input.start) || !/^\d{2}:\d{2}$/.test(input.end)) throw new Error('Pick a date, start time and end time.');
    const tz = me?.tz || 'Africa/Lagos';
    const starts = zonedTimeToUtc(input.date, input.start, tz);
    const ends = zonedTimeToUtc(input.date, input.end, tz);
    if (ends <= starts) throw new Error('The end time must be after the start time.');
    if (starts.getTime() < Date.now() + 30 * 60_000) throw new Error('Pick a time at least 30 minutes from now.');
    if (starts.getTime() > Date.now() + 120 * 86_400_000) throw new Error('Meetups can be planned up to four months ahead.');

    // A light brake on spam: three upcoming meetups per host at a time.
    const { count } = await supabaseAdmin.from('rx_meetups').select('id', { count: 'exact', head: true }).eq('host_id', userId).eq('status', 'scheduled').gt('ends_at', new Date().toISOString());
    if ((count ?? 0) >= 3) throw new Error('You already have three upcoming meetups. Hold one of those first.');

    const { data, error } = await supabaseAdmin.from('rx_meetups').insert({
      group_id: g.id, host_id: userId, title, description, area, venue, starts_at: starts.toISOString(), ends_at: ends.toISOString(),
    }).select('id').single();
    if (error || !data) throw new Error('We couldn’t save the meetup. Try again.');
    await supabaseAdmin.from('rx_meetup_rsvps').upsert({ meetup_id: data.id, user_id: userId, status: 'going', updated_at: new Date().toISOString() });
    revalidatePath('/community/meetups'); revalidatePath('/community/cities');
    return { ok: true, id: data.id as string };
  } catch (e) { return fail(e, 'We couldn’t save the meetup.'); }
}

export async function setRsvp(meetupId: string, status: 'going' | 'maybe' | 'no'): Promise<R<{ venue: string | null }>> {
  try {
    const { userId } = await requireMember();
    if (!UUID.test(meetupId) || !['going', 'maybe', 'no'].includes(status)) throw new Error('That didn’t work.');
    const { data: m } = await supabaseAdmin.from('rx_meetups').select('group_id, venue, status, ends_at, host_id').eq('id', meetupId).maybeSingle();
    if (!m) throw new Error('This meetup no longer exists.');
    if (m.status !== 'scheduled') throw new Error('This meetup was cancelled.');
    if (new Date(m.ends_at as string).getTime() < Date.now()) throw new Error('This meetup has already happened.');
    if (!(await inGroup(m.group_id as string, userId))) throw new Error('Join the city group to RSVP.');
    const { error } = await supabaseAdmin.from('rx_meetup_rsvps').upsert({ meetup_id: meetupId, user_id: userId, status, updated_at: new Date().toISOString() });
    if (error) throw new Error('We couldn’t save that. Try again.');
    revalidatePath(`/community/meetups/${meetupId}`);
    return { ok: true, venue: status === 'going' || m.host_id === userId ? (m.venue as string) : null };
  } catch (e) { return fail(e, 'We couldn’t save that.'); }
}

export async function cancelMeetup(meetupId: string): Promise<R> {
  try {
    const { userId } = await requireMember();
    const me = await getMe();
    if (!UUID.test(meetupId)) throw new Error('That didn’t work.');
    const { data: m } = await supabaseAdmin.from('rx_meetups').select('host_id, status').eq('id', meetupId).maybeSingle();
    if (!m) throw new Error('This meetup no longer exists.');
    if (m.host_id !== userId && !me?.isStaff) throw new Error('Only the host can cancel this meetup.');
    await supabaseAdmin.from('rx_meetups').update({ status: 'cancelled', updated_at: new Date().toISOString() }).eq('id', meetupId);
    revalidatePath(`/community/meetups/${meetupId}`); revalidatePath('/community/meetups'); revalidatePath('/community/cities');
    return { ok: true };
  } catch (e) { return fail(e, 'We couldn’t cancel it.'); }
}

export async function reportMeetup(meetupId: string, reason?: string): Promise<R> {
  try {
    const { userId } = await requireMember();
    if (!UUID.test(meetupId)) throw new Error('That can’t be reported here.');
    const { error } = await supabaseAdmin.from('rx_reports').insert({ reporter_id: userId, kind: 'meetup', ref_id: meetupId, reason: cleanText(reason, 500) || null });
    if (error) throw new Error('We couldn’t send that report.');
    return { ok: true };
  } catch (e) { return fail(e, 'We couldn’t send that report.'); }
}
