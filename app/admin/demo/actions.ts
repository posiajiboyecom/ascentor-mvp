'use server';

// The Demo lab: staff-only controls for the demo Circles, so the vote, scheduling, congratulations and call can be tried
// without waiting for real people or for Thursday evening. Every action refuses to touch a Circle that is not a demo.

import { revalidatePath } from 'next/cache';
import { fail } from '@/lib/rx/server';
import type { ActionResult } from '@/lib/rx/types';
import { requireAdmin } from '@/lib/rx/admin';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { addDemoMember, resetDemo, seedDemo } from '@/lib/rx/demo-seed';
import { MIN_GOING, SESSIONS_PLANNED, SESSION_GAP_DAYS, openRound, settleRound } from '@/lib/rx/cmentor';
import { MENTOR_CALL_MINUTES } from '@/lib/rx/calls';
import { rxNotify, circleAudience } from '@/lib/rx/notifications';
import { seedDemoCommunity } from '@/lib/rx/demo-community';
import { excerpt } from '@/lib/rx/richtext';

async function demoCircle(circleId: string) {
  await requireAdmin();
  const { data } = await supabaseAdmin.from('circles').select('id, name, number, interest, is_demo, status').eq('id', circleId).maybeSingle();
  if (!data || !data.is_demo) throw new Error('The Demo lab only works on demo Circles.');
  return data as { id: string; name: string; number: number; interest: string | null; is_demo: boolean; status: string };
}

const done = (): ActionResult => { revalidatePath('/admin/demo'); revalidatePath('/circle'); revalidatePath('/sessions'); return { ok: true }; };

export async function seedDemoData(): Promise<ActionResult<{ count: number }>> {
  try {
    await requireAdmin();
    const r = await seedDemo(supabaseAdmin);
    done();
    return { ok: true, count: r.circles.length };
  } catch (e) { return fail(e, 'We couldn’t create the demo Circles.'); }
}

export async function resetDemoData(): Promise<ActionResult> {
  try {
    await requireAdmin();
    await resetDemo(supabaseAdmin);
    return done();
  } catch (e) { return fail(e, 'We couldn’t remove the demo data.'); }
}

export async function addDemoMemberTo(circleId: string): Promise<ActionResult> {
  try {
    await demoCircle(circleId);
    const { count } = await supabaseAdmin.from('circle_seats').select('user_id', { count: 'exact', head: true }).eq('circle_id', circleId).eq('role', 'member');
    if ((count ?? 0) >= 8) throw new Error('This Circle is full.');
    const joiner = await addDemoMember(supabaseAdmin, circleId);
    const c = await demoCircle(circleId);
    const { count: now } = await supabaseAdmin.from('circle_seats').select('user_id', { count: 'exact', head: true }).eq('circle_id', circleId).eq('role', 'member');
    const { data: who } = await supabaseAdmin.from('profiles').select('full_name').eq('id', joiner).maybeSingle();
    const title = c.interest ? `${c.interest} · Circle ${c.number}` : `${c.name} · Circle ${c.number}`;
    void rxNotify(await circleAudience(circleId, { except: joiner }), {
      kind: 'circle_new_member', actorId: joiner, entityId: circleId, url: `/circle?c=${circleId}`,
      title: (now ?? 0) === 6 ? `${title} now has 6 members` : `${((who?.full_name as string | undefined) ?? 'Someone').split(' ')[0]} joined ${title}`,
      body: (now ?? 0) === 6 ? 'Weekly calls and the 90-day cycle begin. You can now choose a mentor together.' : `${now ?? 0} of 8 seats are filled.`,
    });
    return done();
  } catch (e) { return fail(e); }
}

export async function openDemoVote(circleId: string): Promise<ActionResult> {
  try {
    const c = await demoCircle(circleId);
    const { data: cur } = await supabaseAdmin.from('circle_mentors').select('id').eq('circle_id', circleId).in('status', ['requested', 'scheduling', 'active', 'paused']).maybeSingle();
    if (cur) throw new Error('This Circle already has a mentor.');
    const id = await openRound(circleId, false);
    if (!id) throw new Error('A vote is already open, or there are no demo mentors left to suggest.');
    void rxNotify(await circleAudience(circleId), { kind: 'vote_opened', entityId: id, url: `/sessions?c=${circleId}`, title: `Choose the mentor for ${c.interest ?? c.name} · Circle ${c.number}`, body: 'Up to three mentors are suggested. Vote within 5 days. The highest vote wins.' });
    return done();
  } catch (e) { return fail(e); }
}

/** Makes the demo members who have not voted yet vote, favouring the first candidate. Real members are left alone. */
export async function castDemoVotes(circleId: string): Promise<ActionResult> {
  try {
    await demoCircle(circleId);
    const { data: round } = await supabaseAdmin.from('circle_mentor_rounds').select('id').eq('circle_id', circleId).in('status', ['open', 'tie']).maybeSingle();
    if (!round) throw new Error('There is no open vote.');
    const [{ data: cands }, { data: votes }, { data: seats }, { data: demoUsers }] = await Promise.all([
      supabaseAdmin.from('circle_mentor_candidates').select('mentor_id, score').eq('round_id', round.id).order('score', { ascending: false }),
      supabaseAdmin.from('circle_mentor_votes').select('user_id').eq('round_id', round.id),
      supabaseAdmin.from('circle_seats').select('user_id').eq('circle_id', circleId).eq('role', 'member'),
      supabaseAdmin.from('member_profile').select('user_id').eq('is_demo', true),
    ]);
    const demo = new Set(((demoUsers ?? []) as { user_id: string }[]).map((u) => u.user_id));
    const voted = new Set(((votes ?? []) as { user_id: string }[]).map((v) => v.user_id));
    const candidates = (cands ?? []) as { mentor_id: string }[];
    const todo = ((seats ?? []) as { user_id: string }[]).map((s) => s.user_id).filter((id) => demo.has(id) && !voted.has(id));
    if (!todo.length || !candidates.length) throw new Error('Every demo member has already voted.');
    await supabaseAdmin.from('circle_mentor_votes').insert(todo.map((user_id, i) => ({ round_id: round.id, circle_id: circleId, user_id, mentor_id: candidates[i % 3 === 2 && candidates[1] ? 1 : 0].mentor_id })));
    return done();
  } catch (e) { return fail(e); }
}

export async function closeDemoVote(circleId: string): Promise<ActionResult> {
  try {
    await demoCircle(circleId);
    const { data: round } = await supabaseAdmin.from('circle_mentor_rounds').select('id').eq('circle_id', circleId).in('status', ['open', 'tie']).maybeSingle();
    if (!round) throw new Error('There is no open vote.');
    await supabaseAdmin.from('circle_mentor_rounds').update({ closes_at: new Date(Date.now() - 1000).toISOString() }).eq('id', round.id);
    await settleRound(round.id as string);
    return done();
  } catch (e) { return fail(e); }
}

export async function mentorSaysYes(circleId: string): Promise<ActionResult> {
  try {
    await demoCircle(circleId);
    const { data: cm } = await supabaseAdmin.from('circle_mentors').select('id').eq('circle_id', circleId).eq('status', 'requested').maybeSingle();
    if (!cm) throw new Error('No mentor is waiting to answer.');
    await supabaseAdmin.from('circle_mentors').update({ status: 'scheduling' }).eq('id', cm.id);
    void rxNotify(await circleAudience(circleId), { kind: 'mentor_accepted', entityId: cm.id as string, url: `/sessions?c=${circleId}`, title: 'Your mentor said yes', body: 'Mark the times you can attend so your Circle can pick one. A time works when 6 or more can come.' });
    return done();
  } catch (e) { return fail(e); }
}

/** Takes the time most members marked, tops it up with demo members to reach 6, then books the series like a facilitator would. */
export async function bookBestTime(circleId: string): Promise<ActionResult> {
  try {
    await demoCircle(circleId);
    const { data: cm } = await supabaseAdmin.from('circle_mentors').select('id, mentor_id').eq('circle_id', circleId).eq('status', 'scheduling').maybeSingle();
    if (!cm) throw new Error('This Circle is not picking times right now.');
    const { data: marks } = await supabaseAdmin.from('slot_marks').select('slot_id, user_id').eq('circle_mentor_id', cm.id);
    const tally = new Map<string, string[]>();
    for (const m of (marks ?? []) as { slot_id: string; user_id: string }[]) tally.set(m.slot_id, [...(tally.get(m.slot_id) ?? []), m.user_id]);
    let slotId = [...tally.entries()].sort((a, b) => b[1].length - a[1].length)[0]?.[0];
    if (!slotId) {
      const { data: s } = await supabaseAdmin.from('mentor_slots').select('id').eq('mentor_id', cm.mentor_id).eq('taken', false).gt('starts_at', new Date(Date.now() + 36 * 3600000).toISOString()).order('starts_at').limit(1).maybeSingle();
      if (!s) throw new Error('This mentor has no open times.');
      slotId = s.id as string;
    }
    const marked = new Set(tally.get(slotId) ?? []);
    if (marked.size < MIN_GOING) {
      const [{ data: seats }, { data: demoUsers }] = await Promise.all([
        supabaseAdmin.from('circle_seats').select('user_id').eq('circle_id', circleId).eq('role', 'member'),
        supabaseAdmin.from('member_profile').select('user_id').eq('is_demo', true),
      ]);
      const demo = new Set(((demoUsers ?? []) as { user_id: string }[]).map((u) => u.user_id));
      const add = ((seats ?? []) as { user_id: string }[]).map((s) => s.user_id).filter((id) => demo.has(id) && !marked.has(id)).slice(0, MIN_GOING - marked.size);
      if (add.length) await supabaseAdmin.from('slot_marks').upsert(add.map((user_id) => ({ circle_mentor_id: cm.id, circle_id: circleId, slot_id: slotId, user_id })), { onConflict: 'circle_mentor_id,slot_id,user_id' });
      if (marked.size + add.length < MIN_GOING) throw new Error('Not enough members in this Circle to reach 6. Add demo members first.');
    }
    const { data: slot } = await supabaseAdmin.from('mentor_slots').select('starts_at').eq('id', slotId).maybeSingle();
    if (!slot) throw new Error('That time is no longer free.');
    const first = new Date(slot.starts_at as string);
    const rows = Array.from({ length: SESSIONS_PLANNED }, (_, i) => ({ circle_mentor_id: cm.id, circle_id: circleId, mentor_id: cm.mentor_id, starts_at: new Date(first.getTime() + i * SESSION_GAP_DAYS * 86400000).toISOString(), duration_min: MENTOR_CALL_MINUTES }));
    const { error } = await supabaseAdmin.from('circle_mentor_sessions').insert(rows);
    if (error) throw error;
    await supabaseAdmin.from('mentor_slots').update({ taken: true }).eq('id', slotId);
    await supabaseAdmin.from('circle_mentors').update({ status: 'active', started_at: new Date().toISOString() }).eq('id', cm.id);
    void rxNotify(await circleAudience(circleId), { kind: 'sessions_booked', entityId: cm.id as string, url: `/sessions?c=${circleId}`, title: 'Mentor sessions are booked', body: 'Every two weeks, 20 minutes, audio by default. Say whether you’re going.' });
    return done();
  } catch (e) { return fail(e); }
}

export async function openDemoCall(circleId: string): Promise<ActionResult> {
  try {
    await demoCircle(circleId);
    await supabaseAdmin.from('circles').update({ demo_call_until: new Date(Date.now() + 30 * 60000).toISOString() }).eq('id', circleId);
    return done();
  } catch (e) { return fail(e); }
}

// ── Community ───────────────────────────────────────────────────────────────

export async function seedDemoPosts(): Promise<ActionResult<{ posts: number; comments: number; reactions: number }>> {
  try {
    await requireAdmin();
    const r = await seedDemoCommunity(supabaseAdmin);
    revalidatePath('/community'); done();
    return { ok: true, ...r };
  } catch (e) { return fail(e, 'We couldn’t add the demo posts.'); }
}

/** Demo members react to and comment on the admin's latest post, and the real notification, email and push go out to the admin. */
export async function demoEngageMyPost(): Promise<ActionResult<{ reactions: number; comments: number }>> {
  try {
    const me = await requireAdmin();
    const { data: post } = await supabaseAdmin.from('feed_posts').select('id, body').eq('user_id', me.userId).eq('deleted', false).order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (!post) throw new Error('Write a post in Community first, then come back. Demo members respond to your latest post.');

    const { data: demo } = await supabaseAdmin.from('member_profile').select('user_id').eq('is_demo', true).eq('is_facilitator', false);
    const ids = ((demo ?? []) as { user_id: string }[]).map((d) => d.user_id);
    if (ids.length < 3) throw new Error('Create the demo Circles first. They provide the demo members.');
    const [{ data: prior }, { data: names }] = await Promise.all([
      supabaseAdmin.from('feed_reactions').select('user_id').eq('post_id', post.id),
      supabaseAdmin.from('profiles').select('id, full_name').in('id', ids),
    ]);
    const done0 = new Set(((prior ?? []) as { user_id: string }[]).map((r) => r.user_id));
    const first = (id: string) => (((names ?? []) as { id: string; full_name: string | null }[]).find((n) => n.id === id)?.full_name ?? 'A member').split(' ')[0];

    const reactors = ids.filter((id) => !done0.has(id)).slice(0, 3);
    const kinds = ['like', 'support', 'insight'] as const;
    if (reactors.length) await supabaseAdmin.from('feed_reactions').insert(reactors.map((user_id, i) => ({ post_id: post.id, user_id, kind: kinds[i % 3] })));
    const lines = ['Thank you for sharing this.', 'This is helpful. How did you get started?'];
    const commenters = ids.slice(3, 5).length === 2 ? ids.slice(3, 5) : ids.slice(0, 2);
    for (let i = 0; i < commenters.length; i++) await supabaseAdmin.from('feed_replies').insert({ post_id: post.id, user_id: commenters[i], body: lines[i] });

    const url = `/community/post/${post.id}`;
    const body = excerpt(post.body as string);
    if (reactors.length) void rxNotify(me.userId, { kind: 'post_reaction', actorId: reactors[0], entityId: post.id as string, url, title: reactors.length === 1 ? `${first(reactors[0])} reacted to your post` : `${reactors.length} people reacted to your post`, body });
    for (let i = 0; i < commenters.length; i++) void rxNotify(me.userId, { kind: 'post_comment', actorId: commenters[i], entityId: post.id as string, url, title: `${first(commenters[i])} commented on your post`, body: lines[i] });
    revalidatePath('/community');
    return { ok: true, reactions: reactors.length, comments: commenters.length };
  } catch (e) { return fail(e, 'We couldn’t add demo activity.'); }
}
