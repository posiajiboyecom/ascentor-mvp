// lib/admin/screens/mentorship.ts
// Circles · Mentor sessions, backed by circle_mentor_sessions (Booked = scheduled and upcoming, Held, Cancelled), circle_mentor_rounds
// (an open or tied vote shows as Voting), circle_mentors, circle_mentor_votes, mentor_questions and human_mentors.
// Agenda: the agenda is the members' questions for the session (mentor_questions): none = No agenda, under AGENDA_MIN_QUESTIONS
// = Agenda draft, otherwise Ready. A separate "goal" is not stored per session, so only the question count is checked.
import 'server-only';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { AGENDA_MIN_QUESTIONS } from '@/lib/rx/cmentor';
import { rxNotify, circleAudience } from '@/lib/rx/notifications';
import type { ScreenModule, ScreenSpec, ActionResult, RowData } from '@/lib/admin/types';

export const spec: ScreenSpec = {
  area: "mentorship",
  group: "Circles",
  title: "Mentor sessions",
  sub: "A session only starts once the Circle’s agenda is ready (goal plus at least 3 questions).",
  cols: [
    "Circle",
    "Mentor",
    "Date",
    "Votes",
    "Agenda",
    "Status"
  ],
  statusCol: 5,
  actions: [
    {
      id: "nudge-the-circle",
      label: "Nudge the Circle",
      when: "Booked",
      done: "Reminder sent to finish the agenda.",
      keep: true
    },
    {
      id: "cancel-session",
      label: "Cancel session",
      col: 5,
      to: "Cancelled",
      confirm: "The Circle and mentor get a message. They can book again."
    }
  ],
  quick: 0
};

const LIST_CAP = 200;
const DAY = 86400000;
const TZ = 'Africa/Lagos';

const when = (iso: string) => {
  const d = new Date(iso);
  const day = d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: TZ });
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: TZ });
  return `${day}, ${time}`;
};
const circleName = (c?: { name: string; number: number; interest: string | null }) => (c ? `${c.interest || c.name} · Circle ${c.number}` : '-');

interface Sess { id: string; circle_id: string; circle_mentor_id: string; mentor_id: string | null; starts_at: string; status: string }
const statusOf = (s: Sess) => (s.status === 'cancelled' ? 'Cancelled' : s.status === 'held' || new Date(s.starts_at).getTime() < Date.now() ? 'Held' : 'Booked');

// ── Pinnacle private sessions (private_mentor_sessions), listed alongside Circle sessions ──────────────────
async function privateSessionRows(): Promise<RowData[]> {
  const { data } = await supabaseAdmin.from('private_mentor_sessions').select('id, member_id, starts_at, status, human_mentors(name)').order('starts_at', { ascending: false }).limit(LIST_CAP);
  const list = (data ?? []) as unknown as { id: string; member_id: string; starts_at: string; status: string; human_mentors: { name: string } | null }[];
  if (!list.length) return [];
  const { data: ps } = await supabaseAdmin.from('profiles').select('id, full_name').in('id', [...new Set(list.map((r) => r.member_id))]);
  const name = new Map(((ps ?? []) as { id: string; full_name: string | null }[]).map((p) => [p.id, p.full_name ?? 'Member']));
  return list.map((r) => {
    const st = r.status === 'cancelled' ? 'Cancelled' : new Date(r.starts_at).getTime() < Date.now() ? 'Held' : 'Booked';
    return { id: `private:${r.id}`, cells: [`Private · ${name.get(r.member_id) ?? 'Member'} (Pinnacle)`, r.human_mentors?.name ?? '-', when(r.starts_at), '-', st === 'Booked' ? 'Ready' : '-', st] };
  });
}

async function actOnPrivate(actionId: string, id: string): Promise<ActionResult> {
  if (actionId === 'nudge-the-circle') return { ok: false, error: 'Private sessions are booked with an agenda, so there is nothing to nudge.' };
  const { data } = await supabaseAdmin.from('private_mentor_sessions').select('id, member_id, starts_at, status, slot_id, human_mentors(user_id)').eq('id', id).maybeSingle();
  const s = data as unknown as { id: string; member_id: string; starts_at: string; status: string; slot_id: string | null; human_mentors: { user_id: string | null } | null } | null;
  if (!s) return { ok: false, error: 'That session no longer exists.' };
  if (s.status !== 'scheduled' || new Date(s.starts_at).getTime() < Date.now()) return { ok: false, error: 'Only upcoming booked sessions can be changed.' };
  const now = new Date().toISOString();
  const { error } = await supabaseAdmin.from('private_mentor_sessions').update({ status: 'cancelled', cancelled_by: 'admin', cancel_reason: 'Cancelled by admin', cancelled_at: now, updated_at: now }).eq('id', id).eq('status', 'scheduled');
  if (error) throw error;
  if (s.slot_id) await supabaseAdmin.from('mentor_slots').update({ taken: false }).eq('id', s.slot_id);
  const ids = [s.member_id, ...(s.human_mentors?.user_id ? [s.human_mentors.user_id] : [])];
  await rxNotify(ids, { kind: 'private_cancelled', entityId: id, url: '/sessions/private', title: 'A private mentor session was cancelled', body: `The session on ${when(s.starts_at)} was cancelled by the Ascentor team. The member can book another time.` });
  return { ok: true, message: 'Session cancelled. The member and mentor have been told.' };
}

const screen: ScreenModule = {
  spec,

  async load() {
    const [{ data: ss }, { data: rounds }] = await Promise.all([
      supabaseAdmin.from('circle_mentor_sessions').select('id, circle_id, circle_mentor_id, mentor_id, starts_at, status').order('starts_at', { ascending: false }).limit(LIST_CAP),
      supabaseAdmin.from('circle_mentor_rounds').select('id, circle_id, closes_at').in('status', ['open', 'tie']),
    ]);
    const sessions = (ss ?? []) as Sess[];
    const open = (rounds ?? []) as { id: string; circle_id: string; closes_at: string }[];
    const privateRows = await privateSessionRows();
    if (!sessions.length && !open.length && !privateRows.length) return { rows: [], note: 'No mentor sessions yet. They appear once a Circle has chosen a mentor and booked a time.' };

    const circleIds = [...new Set([...sessions.map((s) => s.circle_id), ...open.map((r) => r.circle_id)])];
    const mentorIds = [...new Set(sessions.map((s) => s.mentor_id).filter((x): x is string => !!x))];
    const cmIds = [...new Set(sessions.map((s) => s.circle_mentor_id))];
    const [{ data: cs }, { data: ms }, { data: cms }, { data: qs }, { data: seats }] = await Promise.all([
      supabaseAdmin.from('circles').select('id, name, number, interest').in('id', circleIds),
      mentorIds.length ? supabaseAdmin.from('human_mentors').select('id, name').in('id', mentorIds) : Promise.resolve({ data: [] }),
      cmIds.length ? supabaseAdmin.from('circle_mentors').select('id, round_id').in('id', cmIds) : Promise.resolve({ data: [] }),
      sessions.length ? supabaseAdmin.from('mentor_questions').select('session_id').in('session_id', sessions.map((s) => s.id)).limit(50000) : Promise.resolve({ data: [] }),
      supabaseAdmin.from('circle_seats').select('circle_id').in('circle_id', circleIds).eq('role', 'member'),
    ]);
    const circ = new Map(((cs ?? []) as { id: string; name: string; number: number; interest: string | null }[]).map((c) => [c.id, c]));
    const mentor = new Map(((ms ?? []) as { id: string; name: string | null }[]).map((m) => [m.id, m.name ?? '-']));
    const roundOf = new Map(((cms ?? []) as { id: string; round_id: string | null }[]).map((c) => [c.id, c.round_id]));
    const qn = new Map<string, number>();
    for (const q of (qs ?? []) as { session_id: string }[]) qn.set(q.session_id, (qn.get(q.session_id) ?? 0) + 1);
    const size = new Map<string, number>();
    for (const s of (seats ?? []) as { circle_id: string }[]) size.set(s.circle_id, (size.get(s.circle_id) ?? 0) + 1);

    const roundIds = [...new Set([...open.map((r) => r.id), ...[...roundOf.values()].filter((x): x is string => !!x)])];
    const { data: votes } = roundIds.length ? await supabaseAdmin.from('circle_mentor_votes').select('round_id').in('round_id', roundIds).limit(50000) : { data: [] };
    const vn = new Map<string, number>();
    for (const v of (votes ?? []) as { round_id: string }[]) vn.set(v.round_id, (vn.get(v.round_id) ?? 0) + 1);
    const votesCell = (roundId: string | null | undefined, circleId: string) => (roundId ? `${vn.get(roundId) ?? 0} of ${size.get(circleId) ?? 0}` : '-');

    const rows: RowData[] = [...privateRows];
    for (const r of open) rows.push({ id: `round:${r.id}`, cells: [circleName(circ.get(r.circle_id)), '-', '-', votesCell(r.id, r.circle_id), '-', 'Voting'] });
    for (const s of sessions) {
      const st = statusOf(s);
      const n = qn.get(s.id) ?? 0;
      const agenda = st !== 'Booked' ? '-' : n === 0 ? 'No agenda' : n >= AGENDA_MIN_QUESTIONS ? 'Ready' : 'Agenda draft';
      rows.push({ id: s.id, cells: [circleName(circ.get(s.circle_id)), mentor.get(s.mentor_id ?? '') ?? '-', when(s.starts_at), votesCell(roundOf.get(s.circle_mentor_id), s.circle_id), agenda, st] });
    }
    return { rows, note: sessions.length >= LIST_CAP ? `Showing the ${LIST_CAP} newest sessions.` : undefined };
  },

  async act(_ctx, actionId, rowId): Promise<ActionResult> {
    if (actionId !== 'nudge-the-circle' && actionId !== 'cancel-session') return { ok: false, error: 'Unknown action.' };
    if (rowId.startsWith('round:')) return { ok: false, error: 'This Circle is still voting. There is no session to change yet.' };
    if (rowId.startsWith('private:')) return actOnPrivate(actionId, rowId.slice('private:'.length));
    const { data } = await supabaseAdmin.from('circle_mentor_sessions').select('id, circle_id, circle_mentor_id, mentor_id, starts_at, status').eq('id', rowId).maybeSingle();
    const s = data as Sess | null;
    if (!s) return { ok: false, error: 'That session no longer exists.' };
    if (statusOf(s) !== 'Booked') return { ok: false, error: 'Only upcoming booked sessions can be changed.' };

    if (actionId === 'nudge-the-circle') {
      const since = new Date(Date.now() - DAY).toISOString();
      const { data: prior } = await supabaseAdmin.from('notifications').select('id').eq('kind', 'agenda_nudge').eq('entity_id', s.id).gte('created_at', since).limit(1);
      if (prior?.length) return { ok: false, error: 'This Circle was already nudged in the last 24 hours.' };
      const ids = await circleAudience(s.circle_id, { membersOnly: true });
      if (!ids.length) return { ok: false, error: 'This Circle has no members to nudge.' };
      const { data: real } = await supabaseAdmin.from('member_profile').select('user_id').in('user_id', ids).eq('is_demo', false);
      const targets = ((real ?? []) as { user_id: string }[]).map((r) => r.user_id);
      if (!targets.length) return { ok: false, error: 'This Circle has no members to nudge.' };
      const { error } = await supabaseAdmin.from('notifications').insert(targets.map((user_id) => ({
        user_id, type: 'info', kind: 'agenda_nudge', entity_id: s.id,
        title: 'Finish your mentor session agenda',
        message: `Your mentor session on ${when(s.starts_at)} starts once the agenda has a goal and at least ${AGENDA_MIN_QUESTIONS} questions. Add yours now.`,
        link: `/sessions?c=${s.circle_id}`,
      })));
      if (error) throw error;
      return { ok: true, message: 'Reminder sent to finish the agenda.' };
    }

    // cancel-session: this one session only; the Circle's mentor and any later sessions are left as they are.
    const { error } = await supabaseAdmin.from('circle_mentor_sessions').update({ status: 'cancelled', cancel_reason: 'Cancelled by admin' }).eq('id', s.id).eq('status', 'scheduled');
    if (error) throw error;
    const ids = await circleAudience(s.circle_id);
    if (s.mentor_id) {
      const { data: m } = await supabaseAdmin.from('human_mentors').select('user_id').eq('id', s.mentor_id).maybeSingle();
      if (m?.user_id) ids.push(m.user_id as string);
    }
    await rxNotify(ids, { kind: 'session_moved', entityId: s.id, url: `/sessions?c=${s.circle_id}`, title: 'A mentor session was cancelled', body: `The session on ${when(s.starts_at)} was cancelled. You can book again from the Sessions page.` });
    return { ok: true, message: 'Session cancelled. The Circle and mentor have been told.' };
  },
};

export default screen;
