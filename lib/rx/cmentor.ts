import 'server-only';
// lib/rx/cmentor.ts
// Circle mentorship (Model A). Mentors are recommended for the whole Circle; members vote; the highest vote becomes the
// Circle's mentor. The Circle then picks a time from the mentor's published slots, meets for 20 minutes every two weeks
// as an audio call, and keeps one shared agreement. A mentor sees the agreement, questions and first names, never the
// Circle chat, weekly reports or survey answers.

import { supabaseAdmin } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { getMe, getMyCircle, namesFor, type MyCircle } from './server';
import { MENTOR_CALL_MINUTES } from './calls';

export const VOTE_DAYS = 5;
export const TIE_FALLBACK_DAYS = 2;
export const MIN_GOING = 6;
export const SESSION_GAP_DAYS = 14;
export const SESSIONS_PLANNED = 6;
export const MAX_AGREEMENT_GOALS = 3;
export const READY_MEMBERS = 6;

export interface MentorLite { id: string; user_id: string | null; name: string; headline: string | null; bio: string | null; tags: string[]; langs: string[]; formats: string[]; avatar_url: string | null; capacity: number; accepting: boolean }
export const MENTOR_COLS = 'id, user_id, name, headline, bio, tags, langs, formats, avatar_url, capacity, accepting';

const norm = (s: string) => s.trim().toLowerCase();
const CURRENT = ['requested', 'scheduling', 'active', 'paused'];

// ── recommendations for a Circle ────────────────────────────────────────────

export interface Recommendation { mentor: MentorLite; why: string; score: number }

/** Up to three mentors who fit the Circle as a group (shared interests, language, open capacity), best first. */
export async function recommendForCircle(circleId: string, exclude: string[] = []): Promise<Recommendation[]> {
  const { data: seats } = await supabaseAdmin.from('circle_seats').select('user_id').eq('circle_id', circleId).eq('role', 'member');
  const ids = ((seats ?? []) as { user_id: string }[]).map((s) => s.user_id);
  const [{ data: profiles }, { data: goals }, { data: mentors }, { data: load }, { data: circle }] = await Promise.all([
    ids.length ? supabaseAdmin.from('member_profile').select('interests, language').in('user_id', ids) : Promise.resolve({ data: [] }),
    ids.length ? supabaseAdmin.from('user_goals').select('goal_text').in('user_id', ids) : Promise.resolve({ data: [] }),
    supabaseAdmin.from('human_mentors').select(MENTOR_COLS).eq('active', true).eq('accepting', true),
    supabaseAdmin.from('circle_mentors').select('mentor_id').in('status', CURRENT),
    supabaseAdmin.from('circles').select('language').eq('id', circleId).maybeSingle(),
  ]);

  const count = new Map<string, number>(); // interest -> number of members who chose it
  for (const p of (profiles ?? []) as { interests: string[] }[]) for (const i of new Set(p.interests.map(norm))) count.set(i, (count.get(i) ?? 0) + 1);
  const goalWords = new Set(((goals ?? []) as { goal_text: string }[]).flatMap((g) => g.goal_text.toLowerCase().split(/[^a-z0-9+]+/).filter((w) => w.length > 3)));
  const lang = norm((circle?.language as string | undefined) ?? 'English');
  const busy = new Map<string, number>();
  for (const l of (load ?? []) as { mentor_id: string }[]) busy.set(l.mentor_id, (busy.get(l.mentor_id) ?? 0) + 1);
  const total = ids.length || 1;

  const out: Recommendation[] = [];
  for (const m of (mentors ?? []) as MentorLite[]) {
    if (exclude.includes(m.id) || (busy.get(m.id) ?? 0) >= m.capacity) continue;
    const hits = m.tags.map((t) => ({ t, n: count.get(norm(t)) ?? 0 })).filter((x) => x.n > 0).sort((a, b) => b.n - a.n);
    const goalHits = m.tags.filter((t) => [...goalWords].some((w) => norm(t).includes(w) || w.includes(norm(t))));
    const shareLang = m.langs.some((l) => norm(l) === lang);
    const score = hits.reduce((n, x) => n + x.n * 3, 0) + goalHits.length * 2 + (shareLang ? 2 : 0);
    let why: string;
    if (hits.length) { const top = hits.slice(0, 2); why = `Fits ${Math.max(...top.map((x) => x.n))} of your ${total} members on ${top.map((x) => x.t).join(' and ')}.`; }
    else if (goalHits.length) why = `Works in areas your Circle’s goals mention: ${goalHits.slice(0, 2).join(' and ')}.`;
    else if (shareLang) why = `Speaks ${(circle?.language as string | undefined) ?? 'your Circle’s language'}.`;
    else why = 'Has open capacity for a new Circle.';
    out.push({ mentor: m, why, score });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, 3);
}

// ── rounds ──────────────────────────────────────────────────────────────────

export async function openRound(circleId: string, isSwap: boolean, exclude: string[] = []): Promise<string | null> {
  const recs = await recommendForCircle(circleId, exclude);
  if (!recs.length) return null;
  const { data: round, error } = await supabaseAdmin.from('circle_mentor_rounds').insert({ circle_id: circleId, is_swap: isSwap, closes_at: new Date(Date.now() + VOTE_DAYS * 86400000).toISOString() }).select('id').single();
  if (error || !round) return null; // a round is already open
  await supabaseAdmin.from('circle_mentor_candidates').insert(recs.map((r) => ({ round_id: round.id, circle_id: circleId, mentor_id: r.mentor.id, why: r.why, score: r.score })));
  return round.id as string;
}

async function startRequest(circleId: string, mentorId: string, roundId: string, swapUsed: boolean) {
  await supabaseAdmin.from('circle_mentor_rounds').update({ status: 'closed', winner_mentor_id: mentorId }).eq('id', roundId);
  await supabaseAdmin.from('circle_mentors').insert({ circle_id: circleId, mentor_id: mentorId, round_id: roundId, status: 'requested', swap_used: swapUsed });
}

/** Closes a round when everyone has voted or the window ended. Ties wait for the facilitator, then fall back to best fit. */
export async function settleRound(roundId: string): Promise<void> {
  const { data: round } = await supabaseAdmin.from('circle_mentor_rounds').select('id, circle_id, status, closes_at, is_swap').eq('id', roundId).maybeSingle();
  if (!round || (round.status !== 'open' && round.status !== 'tie')) return;
  const [{ data: votes }, { data: cands }, { count: members }] = await Promise.all([
    supabaseAdmin.from('circle_mentor_votes').select('mentor_id').eq('round_id', roundId),
    supabaseAdmin.from('circle_mentor_candidates').select('mentor_id, score').eq('round_id', roundId).order('score', { ascending: false }),
    supabaseAdmin.from('circle_seats').select('user_id', { count: 'exact', head: true }).eq('circle_id', round.circle_id).eq('role', 'member'),
  ]);
  const tally = new Map<string, number>();
  for (const v of (votes ?? []) as { mentor_id: string }[]) tally.set(v.mentor_id, (tally.get(v.mentor_id) ?? 0) + 1);
  const everyone = (votes?.length ?? 0) >= (members ?? 0) && (members ?? 0) > 0;
  const due = new Date(round.closes_at as string).getTime() <= Date.now();
  if (!everyone && !due) return;

  const ranked = ((cands ?? []) as { mentor_id: string; score: number }[]).map((c) => ({ ...c, votes: tally.get(c.mentor_id) ?? 0 })).sort((a, b) => b.votes - a.votes || b.score - a.score);
  if (!ranked.length) { await supabaseAdmin.from('circle_mentor_rounds').update({ status: 'cancelled' }).eq('id', roundId); return; }
  const top = ranked[0];
  const tied = ranked.filter((r) => r.votes === top.votes);
  const { data: prior } = await supabaseAdmin.from('circle_mentors').select('swap_used').eq('circle_id', round.circle_id).eq('swap_used', true).limit(1);
  const swapUsed = !!round.is_swap || !!prior?.length;

  if (tied.length > 1 && top.votes > 0) {
    // The facilitator breaks the tie. If nobody does within two days, the best fit wins.
    if (round.status === 'open') { await supabaseAdmin.from('circle_mentor_rounds').update({ status: 'tie', closes_at: new Date(Date.now() + TIE_FALLBACK_DAYS * 86400000).toISOString() }).eq('id', roundId); return; }
    if (new Date(round.closes_at as string).getTime() > Date.now()) return;
  }
  await startRequest(round.circle_id as string, top.mentor_id, roundId, swapUsed);
}

// ── the member-facing state ─────────────────────────────────────────────────

export interface CandidateView { mentor: MentorLite; why: string; votes: number; mine: boolean }
export interface SlotView { id: string; startsAt: string; marks: number; mine: boolean }
export interface SessionView { id: string; startsAt: string; durationMin: number; status: string; going: number; myRsvp: 'going' | 'cannot' | null; myQuestion: string | null; questions: { name: string; text: string }[] }
export interface AgreementView {
  goals: { id: string; text: string }[];
  tasks: { id: string; task: string; ownerId: string; ownerName: string; due: string | null; ownerConfirmed: boolean; mentorConfirmed: boolean }[];
}

export type MentorshipState =
  | { kind: 'none'; reason: 'nocircle' | 'notready' | 'nomentors' }
  | { kind: 'idle' }
  | { kind: 'voting'; roundId: string; candidates: CandidateView[]; voted: number; total: number; closesAt: string; isSwap: boolean }
  | { kind: 'tie'; roundId: string; candidates: CandidateView[]; tied: string[]; canBreak: boolean }
  | { kind: 'requested'; cmId: string; mentor: MentorLite }
  | { kind: 'scheduling'; cmId: string; mentor: MentorLite; slots: SlotView[]; total: number }
  | { kind: 'active' | 'paused'; cmId: string; mentor: MentorLite; sessions: SessionView[]; next: SessionView | null; agreement: AgreementView; canSwap: boolean; swapUsed: boolean };

export interface Mentorship { circle: MyCircle; isFacilitator: boolean; state: MentorshipState }

export async function getMentorship(): Promise<Mentorship | null> {
  const me = await getMe();
  if (!me) return null;
  let circle = await getMyCircle();
  let isFacilitator = false;
  if (!circle) { circle = await getMyCircle('facilitator'); isFacilitator = !!circle; }
  if (!circle) return { circle: null as unknown as MyCircle, isFacilitator: false, state: { kind: 'none', reason: 'nocircle' } };
  if (circle.memberCount < READY_MEMBERS) return { circle, isFacilitator, state: { kind: 'none', reason: 'notready' } };

  const cid = circle.circle.id;
  const db = await createClient();

  // settle anything due before reading
  const { data: open } = await supabaseAdmin.from('circle_mentor_rounds').select('id').eq('circle_id', cid).in('status', ['open', 'tie']);
  for (const r of (open ?? []) as { id: string }[]) await settleRound(r.id);

  const { data: cmRow } = await supabaseAdmin.from('circle_mentors').select('id, mentor_id, status, swap_used, round_id').eq('circle_id', cid).in('status', CURRENT).maybeSingle();
  if (cmRow) {
    const { data: mentor } = await supabaseAdmin.from('human_mentors').select(MENTOR_COLS).eq('id', cmRow.mentor_id).maybeSingle();
    if (!mentor) return { circle, isFacilitator, state: { kind: 'idle' } };
    const m = mentor as MentorLite;
    if (cmRow.status === 'requested') return { circle, isFacilitator, state: { kind: 'requested', cmId: cmRow.id as string, mentor: m } };

    if (cmRow.status === 'scheduling') {
      const [{ data: slots }, { data: marks }] = await Promise.all([
        supabaseAdmin.from('mentor_slots').select('id, starts_at').eq('mentor_id', m.id).eq('taken', false).gt('starts_at', new Date(Date.now() + 36 * 3600000).toISOString()).order('starts_at').limit(60),
        db.from('slot_marks').select('slot_id, user_id').eq('circle_mentor_id', cmRow.id),
      ]);
      const by = new Map<string, number>(); const mine = new Set<string>();
      for (const k of (marks ?? []) as { slot_id: string; user_id: string }[]) { by.set(k.slot_id, (by.get(k.slot_id) ?? 0) + 1); if (k.user_id === me.userId) mine.add(k.slot_id); }
      const views = ((slots ?? []) as { id: string; starts_at: string }[]).map((s) => ({ id: s.id, startsAt: s.starts_at, marks: by.get(s.id) ?? 0, mine: mine.has(s.id) }));
      views.sort((a, b) => Number(b.marks >= MIN_GOING) - Number(a.marks >= MIN_GOING) || b.marks - a.marks || a.startsAt.localeCompare(b.startsAt));
      return { circle, isFacilitator, state: { kind: 'scheduling', cmId: cmRow.id as string, mentor: m, slots: views, total: circle.memberCount } };
    }

    // active or paused
    const [{ data: sessions }, { data: rsvps }, { data: qs }, { data: goals }, { data: tasks }] = await Promise.all([
      db.from('circle_mentor_sessions').select('id, starts_at, duration_min, status').eq('circle_mentor_id', cmRow.id).order('starts_at'),
      db.from('session_rsvps').select('session_id, user_id, status').eq('circle_id', cid),
      db.from('mentor_questions').select('session_id, user_id, text').eq('circle_id', cid),
      db.from('agreement_goals').select('id, text, position').eq('circle_mentor_id', cmRow.id).order('position'),
      db.from('agreement_tasks').select('id, task, owner_id, due, owner_confirmed, mentor_confirmed').eq('circle_mentor_id', cmRow.id).order('created_at'),
    ]);
    const qUsers = ((qs ?? []) as { user_id: string }[]).map((q) => q.user_id);
    const owners = ((tasks ?? []) as { owner_id: string }[]).map((t) => t.owner_id);
    const names = await namesFor(db, [...qUsers, ...owners]);
    const sess: SessionView[] = ((sessions ?? []) as { id: string; starts_at: string; duration_min: number; status: string }[]).map((s) => {
      const r = ((rsvps ?? []) as { session_id: string; user_id: string; status: 'going' | 'cannot' }[]).filter((x) => x.session_id === s.id);
      const q = ((qs ?? []) as { session_id: string; user_id: string; text: string }[]).filter((x) => x.session_id === s.id);
      return { id: s.id, startsAt: s.starts_at, durationMin: s.duration_min, status: s.status, going: r.filter((x) => x.status === 'going').length, myRsvp: r.find((x) => x.user_id === me.userId)?.status ?? null, myQuestion: q.find((x) => x.user_id === me.userId)?.text ?? null, questions: q.map((x) => ({ name: x.user_id === me.userId ? 'You' : names.get(x.user_id)?.name.split(' ')[0] ?? 'Member', text: x.text })) };
    });
    const nowMs = Date.now();
    const next = sess.find((s) => s.status === 'scheduled' && new Date(s.startsAt).getTime() + s.durationMin * 60000 > nowMs) ?? null;
    const first = sess[0];
    const firstHeld = !!first && new Date(first.startsAt).getTime() + first.durationMin * 60000 < nowMs;
    const { data: used } = await supabaseAdmin.from('circle_mentors').select('swap_used').eq('circle_id', cid).eq('swap_used', true).limit(1);
    const swapUsed = !!used?.length;
    const agreement: AgreementView = {
      goals: ((goals ?? []) as { id: string; text: string }[]).map((g) => ({ id: g.id, text: g.text })),
      tasks: ((tasks ?? []) as { id: string; task: string; owner_id: string; due: string | null; owner_confirmed: boolean; mentor_confirmed: boolean }[]).map((t) => ({ id: t.id, task: t.task, ownerId: t.owner_id, ownerName: t.owner_id === me.userId ? 'You' : names.get(t.owner_id)?.name.split(' ')[0] ?? 'Member', due: t.due, ownerConfirmed: t.owner_confirmed, mentorConfirmed: t.mentor_confirmed })),
    };
    return { circle, isFacilitator, state: { kind: cmRow.status as 'active' | 'paused', cmId: cmRow.id as string, mentor: m, sessions: sess, next, agreement, canSwap: firstHeld && !swapUsed, swapUsed } };
  }

  // no current mentor: an open round?
  const { data: round } = await supabaseAdmin.from('circle_mentor_rounds').select('id, status, closes_at, is_swap').eq('circle_id', cid).in('status', ['open', 'tie']).maybeSingle();
  if (round) {
    const [{ data: cands }, { data: votes }] = await Promise.all([
      supabaseAdmin.from('circle_mentor_candidates').select('mentor_id, why, score').eq('round_id', round.id),
      supabaseAdmin.from('circle_mentor_votes').select('mentor_id, user_id').eq('round_id', round.id),
    ]);
    const ids = ((cands ?? []) as { mentor_id: string }[]).map((c) => c.mentor_id);
    const { data: ms } = ids.length ? await supabaseAdmin.from('human_mentors').select(MENTOR_COLS).in('id', ids) : { data: [] };
    const byId = new Map(((ms ?? []) as MentorLite[]).map((m) => [m.id, m]));
    const v = (votes ?? []) as { mentor_id: string; user_id: string }[];
    const candidates: CandidateView[] = ((cands ?? []) as { mentor_id: string; why: string; score: number }[]).filter((c) => byId.has(c.mentor_id)).sort((a, b) => b.score - a.score)
      .map((c) => ({ mentor: byId.get(c.mentor_id) as MentorLite, why: c.why, votes: v.filter((x) => x.mentor_id === c.mentor_id).length, mine: v.some((x) => x.mentor_id === c.mentor_id && x.user_id === me.userId) }));
    if (round.status === 'tie') {
      const top = Math.max(...candidates.map((c) => c.votes));
      return { circle, isFacilitator, state: { kind: 'tie', roundId: round.id as string, candidates, tied: candidates.filter((c) => c.votes === top).map((c) => c.mentor.id), canBreak: isFacilitator || circle.isFacilitator } };
    }
    return { circle, isFacilitator, state: { kind: 'voting', roundId: round.id as string, candidates, voted: v.length, total: circle.memberCount, closesAt: round.closes_at as string, isSwap: !!round.is_swap } };
  }
  return { circle, isFacilitator, state: { kind: 'idle' } };
}

// ── mentor side ─────────────────────────────────────────────────────────────

export interface MentorCircleCard {
  cmId: string; circleId: string; status: string; circleName: string; members: number; language: string | null;
  stages: Record<string, number>; zones: string[]; topInterests: { tag: string; n: number }[];
  nextSession: { id: string; startsAt: string; durationMin: number; going: number; questions: { name: string; text: string }[] } | null;
  agreement: AgreementView | null;
  slots: SlotView[];
}

/** Circles assigned to a mentor, with aggregated Circle information only (never individual survey data or chats). */
export async function mentorCircles(mentorId: string): Promise<MentorCircleCard[]> {
  const { data: cms } = await supabaseAdmin.from('circle_mentors').select('id, circle_id, status').eq('mentor_id', mentorId).in('status', CURRENT);
  const out: MentorCircleCard[] = [];
  for (const cm of (cms ?? []) as { id: string; circle_id: string; status: string }[]) {
    const [{ data: circle }, { data: seats }] = await Promise.all([
      supabaseAdmin.from('circles').select('name, number, language').eq('id', cm.circle_id).maybeSingle(),
      supabaseAdmin.from('circle_seats').select('user_id').eq('circle_id', cm.circle_id).eq('role', 'member'),
    ]);
    const ids = ((seats ?? []) as { user_id: string }[]).map((s) => s.user_id);
    const { data: prof } = ids.length ? await supabaseAdmin.from('member_profile').select('stage, timezone, interests').in('user_id', ids) : { data: [] };
    const stages: Record<string, number> = {}; const zones = new Set<string>(); const tags = new Map<string, number>();
    for (const p of (prof ?? []) as { stage: string | null; timezone: string | null; interests: string[] }[]) {
      if (p.stage) stages[p.stage] = (stages[p.stage] ?? 0) + 1;
      if (p.timezone) zones.add(p.timezone);
      for (const t of new Set(p.interests)) tags.set(t, (tags.get(t) ?? 0) + 1);
    }
    let nextSession: MentorCircleCard['nextSession'] = null; let agreement: AgreementView | null = null;
    if (cm.status === 'active' || cm.status === 'paused') {
      const { data: ss } = await supabaseAdmin.from('circle_mentor_sessions').select('id, starts_at, duration_min').eq('circle_mentor_id', cm.id).eq('status', 'scheduled').order('starts_at');
      const s = ((ss ?? []) as { id: string; starts_at: string; duration_min: number }[]).find((x) => new Date(x.starts_at).getTime() + x.duration_min * 60000 > Date.now());
      if (s) {
        const [{ data: r }, { data: q }] = await Promise.all([supabaseAdmin.from('session_rsvps').select('status').eq('session_id', s.id), supabaseAdmin.from('mentor_questions').select('user_id, text').eq('session_id', s.id)]);
        const names = await namesFor(await createClient(), ((q ?? []) as { user_id: string }[]).map((x) => x.user_id));
        nextSession = { id: s.id, startsAt: s.starts_at, durationMin: s.duration_min, going: ((r ?? []) as { status: string }[]).filter((x) => x.status === 'going').length, questions: ((q ?? []) as { user_id: string; text: string }[]).map((x) => ({ name: names.get(x.user_id)?.name.split(' ')[0] ?? 'Member', text: x.text })) };
      }
      const [{ data: g }, { data: t }] = await Promise.all([supabaseAdmin.from('agreement_goals').select('id, text').eq('circle_mentor_id', cm.id).order('position'), supabaseAdmin.from('agreement_tasks').select('id, task, owner_id, due, owner_confirmed, mentor_confirmed').eq('circle_mentor_id', cm.id).order('created_at')]);
      const nm = await namesFor(await createClient(), ((t ?? []) as { owner_id: string }[]).map((x) => x.owner_id));
      agreement = { goals: ((g ?? []) as { id: string; text: string }[]), tasks: ((t ?? []) as { id: string; task: string; owner_id: string; due: string | null; owner_confirmed: boolean; mentor_confirmed: boolean }[]).map((x) => ({ id: x.id, task: x.task, ownerId: x.owner_id, ownerName: nm.get(x.owner_id)?.name.split(' ')[0] ?? 'Member', due: x.due, ownerConfirmed: x.owner_confirmed, mentorConfirmed: x.mentor_confirmed })) };
    }
    let slotViews: SlotView[] = [];
    if (cm.status === 'scheduling') {
      const [{ data: sl }, { data: mk }] = await Promise.all([
        supabaseAdmin.from('mentor_slots').select('id, starts_at').eq('mentor_id', mentorId).eq('taken', false).gt('starts_at', new Date(Date.now() + 36 * 3600000).toISOString()).order('starts_at').limit(60),
        supabaseAdmin.from('slot_marks').select('slot_id').eq('circle_mentor_id', cm.id),
      ]);
      const by = new Map<string, number>();
      for (const k of (mk ?? []) as { slot_id: string }[]) by.set(k.slot_id, (by.get(k.slot_id) ?? 0) + 1);
      slotViews = ((sl ?? []) as { id: string; starts_at: string }[]).map((x) => ({ id: x.id, startsAt: x.starts_at, marks: by.get(x.id) ?? 0, mine: false }))
        .sort((a, b) => Number(b.marks >= MIN_GOING) - Number(a.marks >= MIN_GOING) || b.marks - a.marks || a.startsAt.localeCompare(b.startsAt));
    }
    out.push({ cmId: cm.id, circleId: cm.circle_id, status: cm.status, circleName: `${circle?.name ?? 'Circle'} · Circle ${circle?.number ?? ''}`, members: ids.length, language: (circle?.language as string | null) ?? null, stages, zones: [...zones], topInterests: [...tags.entries()].filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([tag, n]) => ({ tag, n })), nextSession, agreement, slots: slotViews });
  }
  return out;
}

export { MENTOR_CALL_MINUTES };
