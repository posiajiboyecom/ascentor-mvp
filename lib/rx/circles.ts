import 'server-only';
// lib/rx/circles.ts
// All of a member's Circles at a glance, and the Circles they can still join. Reads use the member's own session to find
// their seats, then the service role for the facts about those Circles (counts, votes, mentor), after membership is known.

import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getMe } from './server';
import { CIRCLE_MAX, CIRCLE_MIN_TO_START } from './constants';
import { nextWeekdayAt, whenLabel } from './dates';
import { circleState, type CircleState, type MentorPhase, type RoundPhase } from './circle-state';

export interface SeatPreview { userId: string; name: string; avatarUrl: string | null }

export interface CircleCard {
  id: string; name: string; number: number; interest: string | null; isDemo: boolean; role: 'member' | 'facilitator'; isHome: boolean;
  members: number; seats: SeatPreview[]; facilitatorName: string | null; language: string | null;
  ready: boolean; week: number | null; nextCallLabel: string | null; callOpenNow: boolean; state: CircleState;
}

export interface OpenCircle {
  id: string; name: string; number: number; interest: string | null; members: number; seatsLeft: number; language: string | null;
  isDemo: boolean; reason: string; facilitatorName: string | null; ready: boolean;
}

const CURRENT = ['requested', 'scheduling', 'active', 'paused'];

export const circleTitle = (c: { name: string; number: number; interest: string | null }) => (c.interest ? `${c.interest} · Circle ${c.number}` : `${c.name} · Circle ${c.number}`);

export async function getMyCircles(): Promise<CircleCard[]> {
  const me = await getMe();
  if (!me) return [];
  const db = await createClient();
  const { data: mine } = await db.from('circle_seats').select('circle_id, role, joined_at').eq('user_id', me.userId).order('joined_at', { ascending: true });
  const seatsOf = (mine ?? []) as { circle_id: string; role: 'member' | 'facilitator'; joined_at: string }[];
  if (!seatsOf.length) return [];
  const ids = seatsOf.map((s) => s.circle_id);
  const homeId = seatsOf.find((s) => s.role === 'member')?.circle_id ?? null;

  const [{ data: circles }, { data: allSeats }, { data: rounds }, { data: mentors }] = await Promise.all([
    supabaseAdmin.from('circles').select('id, name, number, status, language, timezone, cycle_start, meeting_dow, meeting_time, interest, is_demo, demo_call_until, facilitator_id').in('id', ids),
    supabaseAdmin.from('circle_seats').select('circle_id, user_id, role, joined_at').in('circle_id', ids).order('joined_at'),
    supabaseAdmin.from('circle_mentor_rounds').select('id, circle_id, status, closes_at').in('circle_id', ids).in('status', ['open', 'tie']),
    supabaseAdmin.from('circle_mentors').select('id, circle_id, status, human_mentors(name)').in('circle_id', ids).in('status', CURRENT),
  ]);
  const roundRows = (rounds ?? []) as { id: string; circle_id: string; status: 'open' | 'tie'; closes_at: string }[];
  const roundIds = roundRows.map((r) => r.id);
  const mentorRows = (mentors ?? []) as unknown as { id: string; circle_id: string; status: MentorPhase; human_mentors: { name: string } | null }[];
  const cmIds = mentorRows.filter((m) => m.status === 'active' || m.status === 'paused').map((m) => m.id);

  const [{ data: votes }, { data: sessions }] = await Promise.all([
    roundIds.length ? supabaseAdmin.from('circle_mentor_votes').select('round_id, user_id').in('round_id', roundIds) : Promise.resolve({ data: [] }),
    cmIds.length ? supabaseAdmin.from('circle_mentor_sessions').select('circle_mentor_id, starts_at, duration_min').in('circle_mentor_id', cmIds).eq('status', 'scheduled').gt('starts_at', new Date().toISOString()).order('starts_at') : Promise.resolve({ data: [] }),
  ]);
  const voteRows = (votes ?? []) as { round_id: string; user_id: string }[];
  const sessionRows = (sessions ?? []) as { circle_mentor_id: string; starts_at: string }[];

  const seatUserIds = [...new Set(((allSeats ?? []) as { user_id: string }[]).map((s) => s.user_id))];
  const { data: people } = seatUserIds.length ? await supabaseAdmin.from('member_directory').select('id, full_name, avatar_url').in('id', seatUserIds) : { data: [] };
  const byId = new Map(((people ?? []) as { id: string; full_name: string | null; avatar_url: string | null }[]).map((p) => [p.id, p]));

  const cards: CircleCard[] = [];
  for (const c of (circles ?? []) as { id: string; name: string; number: number; language: string | null; timezone: string | null; cycle_start: string | null; meeting_dow: number; meeting_time: string; interest: string | null; is_demo: boolean; demo_call_until: string | null; facilitator_id: string | null }[]) {
    const seat = seatsOf.find((s) => s.circle_id === c.id)!;
    const rows = ((allSeats ?? []) as { circle_id: string; user_id: string; role: string }[]).filter((s) => s.circle_id === c.id);
    const members = rows.filter((r) => r.role === 'member');
    const preview: SeatPreview[] = members.map((m) => ({ userId: m.user_id, name: byId.get(m.user_id)?.full_name?.trim() || 'Member', avatarUrl: byId.get(m.user_id)?.avatar_url ?? null }));
    const facId = c.facilitator_id ?? rows.find((r) => r.role === 'facilitator')?.user_id ?? null;
    const started = !!c.cycle_start;
    const ready = started && members.length >= CIRCLE_MIN_TO_START;

    const round = roundRows.find((r) => r.circle_id === c.id);
    const roundVotes = round ? voteRows.filter((v) => v.round_id === round.id) : [];
    const mentor = mentorRows.find((m) => m.circle_id === c.id);
    const nextSession = mentor ? sessionRows.find((s) => s.circle_mentor_id === mentor.id) : undefined;

    const callOpenNow = !!c.demo_call_until && new Date(c.demo_call_until).getTime() > Date.now();
    const nextCall = ready ? nextWeekdayAt(c.meeting_dow, c.meeting_time.slice(0, 5), c.timezone) : null;
    const nextCallLabel = callOpenNow ? 'is open now' : nextCall ? whenLabel(nextCall, me.tz) : null;

    cards.push({
      id: c.id, name: c.name, number: c.number, interest: c.interest, isDemo: c.is_demo, role: seat.role, isHome: c.id === homeId,
      members: members.length, seats: preview, facilitatorName: facId ? byId.get(facId)?.full_name?.trim() ?? null : null, language: c.language,
      ready, week: null, nextCallLabel, callOpenNow,
      state: circleState({
        members: members.length, started, round: (round?.status as RoundPhase) ?? null, roundClosesAt: round?.closes_at ?? null,
        votesCast: roundVotes.length, iVoted: roundVotes.some((v) => v.user_id === me.userId),
        mentorPhase: (mentor?.status as MentorPhase) ?? null, mentorName: mentor?.human_mentors?.name ?? null,
        nextSessionLabel: nextSession ? whenLabel(nextSession.starts_at, me.tz) : null,
        nextCallLabel: callOpenNow ? 'is open now' : nextCallLabel,
      }),
    });
  }
  // Home Circle first, then by when they joined.
  const order = new Map(seatsOf.map((s, i) => [s.circle_id, i]));
  return cards.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
}

/** Interest Circles with a free seat that this member is not in. Demo Circles are shown to staff testers only. */
export async function findCircles(): Promise<OpenCircle[]> {
  const me = await getMe();
  if (!me) return [];
  const [{ data: mine }, { data: circles }, { data: seats }] = await Promise.all([
    supabaseAdmin.from('circle_seats').select('circle_id').eq('user_id', me.userId),
    supabaseAdmin.from('circles').select('id, name, number, status, language, interest, is_demo, cycle_start, facilitator_id').neq('status', 'completed').not('interest', 'is', null),
    supabaseAdmin.from('circle_seats').select('circle_id, role'),
  ]);
  const have = new Set(((mine ?? []) as { circle_id: string }[]).map((s) => s.circle_id));
  const count = new Map<string, number>();
  for (const s of (seats ?? []) as { circle_id: string; role: string }[]) if (s.role === 'member') count.set(s.circle_id, (count.get(s.circle_id) ?? 0) + 1);
  const facIds = ((circles ?? []) as { facilitator_id: string | null }[]).map((c) => c.facilitator_id).filter((x): x is string => !!x);
  const { data: facs } = facIds.length ? await supabaseAdmin.from('member_directory').select('id, full_name').in('id', facIds) : { data: [] };
  const facName = new Map(((facs ?? []) as { id: string; full_name: string | null }[]).map((f) => [f.id, f.full_name?.trim() ?? null]));
  const interests = new Set((me.profile?.interests ?? []).map((i) => i.toLowerCase()));

  const out: (OpenCircle & { score: number })[] = [];
  for (const c of (circles ?? []) as { id: string; name: string; number: number; language: string | null; interest: string | null; is_demo: boolean; cycle_start: string | null; facilitator_id: string | null }[]) {
    if (have.has(c.id) || (c.is_demo && !me.isStaff)) continue;
    const n = count.get(c.id) ?? 0;
    if (n >= CIRCLE_MAX) continue;
    const match = !!c.interest && interests.has(c.interest.toLowerCase());
    const sameLang = (c.language ?? 'English') === (me.profile?.language ?? 'English');
    out.push({
      id: c.id, name: c.name, number: c.number, interest: c.interest, members: n, seatsLeft: CIRCLE_MAX - n, language: c.language, isDemo: c.is_demo,
      reason: match ? `Because you chose ${c.interest}.` : sameLang ? '' : `Meets in ${c.language ?? 'English'}.`,
      facilitatorName: c.facilitator_id ? facName.get(c.facilitator_id) ?? null : null, ready: !!c.cycle_start && n >= CIRCLE_MIN_TO_START,
      score: (match ? 10 : 0) + (sameLang ? 2 : 0) + (n >= 3 ? 1 : 0),
    });
  }
  return out.sort((a, b) => b.score - a.score || a.number - b.number).map((c) => ({ id: c.id, name: c.name, number: c.number, interest: c.interest, members: c.members, seatsLeft: c.seatsLeft, language: c.language, isDemo: c.isDemo, reason: c.reason, facilitatorName: c.facilitatorName, ready: c.ready }));
}
