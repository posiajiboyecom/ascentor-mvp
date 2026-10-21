// lib/admin/screens/circles.ts
// Circles · Circles, backed by circles, circle_seats, call_attendance and member_profile.
// Mirrors setFacilitator / assignFacilitator / updateCircleMeeting in app/admin/circles/actions.ts. Those are tied to the
// signed-in member session (requireAdmin), so the same writes are repeated here under the console's own access check.
//
// Health (first rule that matches wins):
//   1. circles.health_override = 'healthy' (set by "Mark healthy")        -> Healthy
//   2. no facilitator                                                      -> Needs facilitator
//   3. cycle not started, or fewer than CIRCLE_MIN_TO_START members        -> Forming
//   4. under 60% of members on the call in at least 2 of the last 4 weeks  -> Low quorum
//        (a week only counts from the first week that has any call_attendance on record, so Circles are not blamed for
//         weeks before calls were tracked; attendance = distinct members who joined a circle call that week)
//   5. otherwise                                                           -> Healthy
import 'server-only';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { CIRCLE_MIN_TO_START, CYCLE_WEEKS } from '@/lib/rx/constants';
import { cycleWeek, localISODate, DEFAULT_TZ } from '@/lib/rx/dates';
import { rxNotify } from '@/lib/rx/notifications';
import { isMissingSchema, count } from '@/lib/admin/revenue-util';
import type { ScreenModule, ScreenSpec, ActionResult, RowData } from '@/lib/admin/types';

export const spec: ScreenSpec = {
  area: "circles",
  group: "Circles",
  title: "Circles",
  sub: "Each Circle runs a 90-day cycle. Calls start when 60% of members have joined.",
  cols: [
    "Circle",
    "Facilitator",
    "Members",
    "Week",
    "Meeting",
    "Attendance",
    "Health"
  ],
  statusCol: 6,
  actions: [
    {
      id: "assign-facilitator",
      label: "Assign facilitator",
      col: 1,
      to: "Ngozi Obi",
      when: "Needs facilitator",
      done: "Ngozi Obi is now the facilitator. She’ll get an email."
    },
    {
      id: "mark-healthy",
      label: "Mark healthy",
      col: 6,
      to: "Healthy"
    },
    {
      id: "move-meeting-to-thu-7-00-pm",
      label: "Move meeting to Thu 7:00 PM",
      col: 4,
      to: "Thu 7:00 PM"
    }
  ],
  quick: 0,
  buttons: [
    {
      id: "new-circle",
      label: "New Circle",
      href: "/admin/circles"
    }
  ]
};

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEK_MS = 7 * 86400000;
const LOW = 0.6;

interface CircleRow {
  id: string; name: string; number: number; status: string; interest: string | null; facilitator_id: string | null; language: string | null;
  cycle_start: string | null; meeting_dow: number; meeting_time: string; health_override?: string | null;
}

const title = (c: { name: string; number: number; interest: string | null }) => `${c.interest || c.name} · Circle ${c.number}`;
const meeting = (dow: number, time: string) => {
  const [h, m] = time.slice(0, 5).split(':').map(Number);
  return `${DAYS[dow] ?? '-'} ${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
};

async function readCircles(): Promise<{ rows: CircleRow[]; hasOverride: boolean }> {
  const cols = 'id, name, number, status, interest, facilitator_id, language, cycle_start, meeting_dow, meeting_time';
  const a = await supabaseAdmin.from('circles').select(`${cols}, health_override`).eq('is_demo', false).neq('status', 'completed').order('number');
  if (!a.error) return { rows: (a.data ?? []) as unknown as CircleRow[], hasOverride: true };
  if (!isMissingSchema(a.error)) throw a.error;
  const b = await supabaseAdmin.from('circles').select(cols).eq('is_demo', false).neq('status', 'completed').order('number');
  if (b.error) throw b.error;
  return { rows: (b.data ?? []) as unknown as CircleRow[], hasOverride: false };
}

function kpis(running: number, avg: number | null, needFac: number, lowQ: number) {
  return [
    { label: 'Circles running', value: count(running) },
    { label: 'Average attendance', value: avg == null ? '-' : `${Math.round(avg * 100)}%`, note: 'Last 4 weeks' },
    { label: 'Need a facilitator', value: count(needFac) },
    { label: 'Low quorum', value: count(lowQ) },
  ];
}

const screen: ScreenModule = {
  spec,

  async load() {
    const { rows: circles } = await readCircles();
    if (!circles.length) return { rows: [], kpis: kpis(0, null, 0, 0), note: 'No Circles yet. They are created automatically as members finish onboarding.' };
    const ids = circles.map((c) => c.id);
    const since = new Date(Date.now() - 4 * WEEK_MS).toISOString();
    const [{ data: seats }, { data: att }] = await Promise.all([
      supabaseAdmin.from('circle_seats').select('circle_id, user_id, role').in('circle_id', ids),
      supabaseAdmin.from('call_attendance').select('circle_id, user_id, joined_at').in('circle_id', ids).eq('kind', 'circle').gte('joined_at', since).limit(50000),
    ]);
    const facIds = [...new Set(circles.map((c) => c.facilitator_id).filter((x): x is string => !!x))];
    const { data: names } = facIds.length ? await supabaseAdmin.from('member_directory').select('id, full_name').in('id', facIds) : { data: [] };
    const nameOf = new Map(((names ?? []) as { id: string; full_name: string | null }[]).map((n) => [n.id, n.full_name?.trim() || 'Member']));

    const members = new Map<string, number>();
    const seatFac = new Map<string, string>();
    for (const s of (seats ?? []) as { circle_id: string; user_id: string; role: string }[]) {
      if (s.role === 'member') members.set(s.circle_id, (members.get(s.circle_id) ?? 0) + 1);
      else if (s.role === 'facilitator') seatFac.set(s.circle_id, s.user_id);
    }
    // distinct attendees per circle per week bucket (0 = the most recent 7 days)
    const buckets = new Map<string, Map<number, Set<string>>>();
    for (const a of (att ?? []) as { circle_id: string; user_id: string; joined_at: string }[]) {
      const w = Math.min(3, Math.floor((Date.now() - new Date(a.joined_at).getTime()) / WEEK_MS));
      const m = buckets.get(a.circle_id) ?? new Map<number, Set<string>>();
      const set = m.get(w) ?? new Set<string>();
      set.add(a.user_id); m.set(w, set); buckets.set(a.circle_id, m);
    }

    const today = localISODate(DEFAULT_TZ);
    let running = 0, needFac = 0, lowQ = 0; const pcts: number[] = [];
    const rows: RowData[] = circles.map((c) => {
      const n = members.get(c.id) ?? 0;
      const facId = c.facilitator_id ?? seatFac.get(c.id) ?? null;
      const started = !!c.cycle_start;
      const wk = started ? cycleWeek(c.cycle_start, today) : null;
      const b = buckets.get(c.id);
      let attendance = '-'; let lowWeeks = 0;
      if (b && b.size && n > 0) {
        const rates = [0, 1, 2, 3].map((w) => Math.min(1, (b.get(w)?.size ?? 0) / n));
        const counted = rates.slice(0, Math.max(...b.keys()) + 1);
        const avg = counted.reduce((x, y) => x + y, 0) / counted.length;
        attendance = `${Math.round(avg * 100)}%`;
        pcts.push(avg);
        lowWeeks = counted.filter((r) => r < LOW).length;
      }
      let health: string;
      if (c.health_override === 'healthy') health = 'Healthy';
      else if (!facId) health = 'Needs facilitator';
      else if (!started || n < CIRCLE_MIN_TO_START) health = 'Forming';
      else if (lowWeeks >= 2) health = 'Low quorum';
      else health = 'Healthy';
      if (started && c.status === 'active') running++;
      if (health === 'Needs facilitator') needFac++;
      if (health === 'Low quorum') lowQ++;
      return { id: c.id, cells: [title(c), facId ? nameOf.get(facId) ?? 'Member' : '-', String(n), wk ? `${wk} of ${CYCLE_WEEKS}` : '-', meeting(c.meeting_dow, c.meeting_time), attendance, health] };
    });
    const avgAll = pcts.length ? pcts.reduce((x, y) => x + y, 0) / pcts.length : null;
    return { rows, kpis: kpis(running, avgAll, needFac, lowQ) };
  },

  async act(_ctx, actionId, rowId) {
    const { rows, hasOverride } = await readCircles();
    const c = rows.find((r) => r.id === rowId);
    if (!c) return { ok: false, error: 'That Circle no longer exists or has finished.' };

    if (actionId === 'move-meeting-to-thu-7-00-pm') {
      const { error } = await supabaseAdmin.from('circles').update({ meeting_dow: 4, meeting_time: '19:00' }).eq('id', c.id);
      if (error) throw error;
      return { ok: true, message: `${title(c)} now meets on Thu 7:00 PM.` };
    }

    if (actionId === 'mark-healthy') {
      if (!hasOverride) return { ok: false, error: 'This needs the Circle health update applied first. Ask the developer to apply migration 20261024d.' };
      const { error } = await supabaseAdmin.from('circles').update({ health_override: 'healthy' }).eq('id', c.id);
      if (error) throw error;
      return { ok: true, message: `${title(c)} is marked healthy.` };
    }

    if (actionId === 'assign-facilitator') return assign(c);
    return { ok: false, error: 'Unknown action.' };
  },
};

/** Assigns the next eligible facilitator: flagged is_facilitator, not demo, not facilitating a live Circle, preferring the Circle's language, then city. */
async function assign(c: CircleRow): Promise<ActionResult> {
  if (c.facilitator_id) return { ok: false, error: 'This Circle already has a facilitator.' };
  const [{ data: flagged }, { data: live }, { data: seats }] = await Promise.all([
    supabaseAdmin.from('member_profile').select('user_id, language, city').eq('is_facilitator', true).eq('is_demo', false),
    supabaseAdmin.from('circles').select('facilitator_id').not('facilitator_id', 'is', null).neq('status', 'completed'),
    supabaseAdmin.from('circle_seats').select('user_id, role').eq('circle_id', c.id),
  ]);
  const busy = new Set(((live ?? []) as { facilitator_id: string }[]).map((x) => x.facilitator_id));
  const inCircle = new Set(((seats ?? []) as { user_id: string }[]).map((s) => s.user_id));
  const memberIds = ((seats ?? []) as { user_id: string; role: string }[]).filter((s) => s.role === 'member').map((s) => s.user_id);
  const { data: mcity } = memberIds.length ? await supabaseAdmin.from('member_profile').select('city').in('user_id', memberIds) : { data: [] };
  const tally = new Map<string, number>();
  for (const m of (mcity ?? []) as { city: string | null }[]) if (m.city) tally.set(m.city.toLowerCase(), (tally.get(m.city.toLowerCase()) ?? 0) + 1);
  const topCity = [...tally.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  const pool = ((flagged ?? []) as { user_id: string; language: string | null; city: string | null }[])
    .filter((f) => !busy.has(f.user_id) && !inCircle.has(f.user_id))
    .map((f) => ({ ...f, score: ((f.language ?? 'English') === (c.language ?? 'English') ? 2 : 0) + (topCity && f.city?.toLowerCase() === topCity ? 1 : 0) }))
    .sort((a, b) => b.score - a.score);
  const pick = pool[0];
  if (!pick) return { ok: false, error: 'No facilitator is available. Make a member a Leader first (People > Members).' };

  await supabaseAdmin.from('circle_seats').delete().eq('circle_id', c.id).eq('role', 'facilitator');
  await supabaseAdmin.from('circle_seats').upsert({ circle_id: c.id, user_id: pick.user_id, role: 'facilitator' }, { onConflict: 'circle_id,user_id' });
  const { error } = await supabaseAdmin.from('circles').update({ facilitator_id: pick.user_id }).eq('id', c.id);
  if (error) throw error;
  const { data: nm } = await supabaseAdmin.from('member_directory').select('full_name').eq('id', pick.user_id).maybeSingle();
  const name = (nm?.full_name as string | null)?.trim() || 'A facilitator';
  await rxNotify(pick.user_id, { kind: 'circle_joined', entityId: c.id, url: `/circle?c=${c.id}`, title: `You are now facilitating ${title(c)}`, body: 'Open the Circle to say hello and see when it meets.' });
  return { ok: true, message: `${name} is now the facilitator of ${title(c)}.` };
}

export default screen;
