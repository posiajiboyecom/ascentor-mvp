// lib/admin/overview.ts
// Server-only. Everything the console Overview shows, from the real database. Each tile is one cheap query and a failed query
// never blocks the page: the tile falls back to zero (or is left out).
import 'server-only';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getSettings, asInt } from '@/lib/admin/settings';
import { listAudit, type AuditRow } from '@/lib/admin/audit';

export interface OverviewKpi { label: string; value: string; note: string }
export interface AttnItem { n: number; tone: 'bad' | 'warn'; text: string; hint: string; area: string; filter: string }
export interface WeekBar { x: string; v: number }
export interface PlanBar { label: string; v: number }
export interface OverviewData {
  eyebrow: string;
  kpis: OverviewKpi[];
  attn: AttnItem[];
  weeks: WeekBar[];
  plans: PlanBar[];
  recent: AuditRow[];
}

const TZ = 'Africa/Lagos';
const DAY = 864e5;
const num = (n: number) => n.toLocaleString('en-US');
const PAID_PLANS = ['explorer', 'builder', 'pinnacle'];

async function count(q: PromiseLike<{ count: number | null; error: unknown }>): Promise<number> {
  try { const r = await q; return r.error ? 0 : r.count ?? 0; } catch { return 0; }
}
const head = (table: string) => supabaseAdmin.from(table).select('*', { count: 'exact', head: true });

/** Monday 00:00 in Lagos (UTC+1, no daylight saving) of the week containing `t`, as a UTC timestamp. */
function lagosWeekStart(t: number): number {
  const shifted = new Date(t + 3600e3);
  const dow = (shifted.getUTCDay() + 6) % 7;
  return Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate() - dow) - 3600e3;
}

async function circleCounts(): Promise<{ running: number; noFac: number }> {
  try {
    const { data } = await supabaseAdmin.from('circles').select('status, facilitator_id, is_demo').neq('status', 'closed').limit(5000);
    const rows = (data ?? []).filter((c) => !c.is_demo);
    return { running: rows.filter((c) => c.status === 'active').length, noFac: rows.filter((c) => !c.facilitator_id).length };
  } catch { return { running: 0, noFac: 0 }; }
}

async function mentorSessionsWithoutAgenda(min: number): Promise<number> {
  try {
    const { data: sess } = await supabaseAdmin.from('circle_mentor_sessions').select('id').eq('status', 'scheduled').gt('starts_at', new Date().toISOString()).limit(500);
    const ids = (sess ?? []).map((s) => s.id as string);
    if (!ids.length) return 0;
    const { data: qs } = await supabaseAdmin.from('mentor_questions').select('session_id').in('session_id', ids).limit(20000);
    const by = new Map<string, number>();
    for (const q of qs ?? []) by.set(q.session_id as string, (by.get(q.session_id as string) ?? 0) + 1);
    return ids.filter((id) => (by.get(id) ?? 0) < min).length;
  } catch { return 0; }
}

async function waitingForCircle(): Promise<number> {
  try {
    const [{ data: ps }, { data: seats }] = await Promise.all([
      supabaseAdmin.from('profiles').select('id').eq('onboarding_completed', true).eq('role', 'member').limit(20000),
      supabaseAdmin.from('circle_seats').select('user_id').limit(50000),
    ]);
    const seated = new Set((seats ?? []).map((s) => s.user_id as string));
    return (ps ?? []).filter((p) => !seated.has(p.id as string)).length;
  } catch { return 0; }
}

export async function getOverview(canView: (area: string) => boolean): Promise<OverviewData> {
  const now = Date.now();
  const weekAgo = new Date(now - 7 * DAY).toISOString();
  const lastMonday = lagosWeekStart(now);
  const firstMonday = lastMonday - 7 * 7 * DAY;
  const settings = await getSettings();
  const agendaMin = asInt(settings['mentor.agenda_questions'], 3, 1, 50);

  const [members, newWeek, paying, trialing, light, seeker, builder, pinnacle, leader, failed, flagsOpen, reportsOpen, cityReqs, toPack, mentorsPending, circ, noAgenda, waiting] = await Promise.all([
    count(head('profiles')),
    count(head('profiles').gte('created_at', weekAgo)),
    count(head('profiles').eq('subscription_status', 'active').in('subscription_plan', PAID_PLANS)),
    count(head('profiles').eq('subscription_status', 'trialing')),
    count(head('profiles').eq('subscription_status', 'free')),
    count(head('profiles').eq('subscription_status', 'active').eq('subscription_plan', 'explorer')),
    count(head('profiles').eq('subscription_status', 'active').eq('subscription_plan', 'builder')),
    count(head('profiles').eq('subscription_status', 'active').eq('subscription_plan', 'pinnacle')),
    count(head('profiles').eq('subscription_status', 'active').eq('subscription_plan', 'leader')),
    count(head('payment_attempts').eq('status', 'failed')),
    count(head('rx_flags').eq('status', 'open')),
    count(head('rx_reports').eq('status', 'open')),
    count(head('rx_group_requests')),
    count(head('shop_orders').eq('status', 'paid')),
    count(head('mentor_applications').eq('status', 'pending')),
    circleCounts(),
    mentorSessionsWithoutAgenda(agendaMin),
    waitingForCircle(),
  ]);

  // Active this week: share of members with at least one check-in in the last 7 days.
  let active = 0;
  try {
    const since = new Date(now - 7 * DAY).toLocaleDateString('en-CA', { timeZone: TZ });
    const { data } = await supabaseAdmin.from('practice_checkins').select('user_id').gte('day', since).limit(50000);
    active = new Set((data ?? []).map((r) => r.user_id as string)).size;
  } catch { /* zero */ }

  // New members per week, last 8 weeks (Monday starts, Lagos).
  const buckets = Array.from({ length: 8 }, () => 0);
  try {
    const { data } = await supabaseAdmin.from('profiles').select('created_at').gte('created_at', new Date(firstMonday).toISOString()).limit(50000);
    for (const r of data ?? []) {
      const i = Math.floor((new Date(r.created_at as string).getTime() - firstMonday) / (7 * DAY));
      if (i >= 0 && i < 8) buckets[i] += 1;
    }
  } catch { /* zeros */ }
  const weeks = buckets.map((v, i) => { const d = new Date(firstMonday + i * 7 * DAY + 12 * 3600e3); return { x: `${d.toLocaleDateString('en-GB', { timeZone: TZ, day: 'numeric' })} ${d.toLocaleDateString('en-GB', { timeZone: TZ, month: 'long' }).slice(0, 3)}`, v }; });

  const plans: PlanBar[] = [{ label: 'Seeker', v: seeker }, { label: 'Builder', v: builder }, { label: 'Pinnacle', v: pinnacle }, { label: 'Leaders (free)', v: leader }];
  plans.push({ label: 'First period', v: trialing }, { label: 'Light access', v: light });

  const items: AttnItem[] = [
    { n: failed, tone: 'bad', text: 'failed payments', hint: 'Retry the charge or contact the member', area: 'payments', filter: 'Failed' },
    { n: flagsOpen + reportsOpen, tone: 'bad', text: 'open reports', hint: 'Remove, dismiss or block messaging', area: 'moderation', filter: 'Open' },
    { n: circ.noFac, tone: 'warn', text: 'Circles without a facilitator', hint: 'Assign one so meetings can run', area: 'circles', filter: 'Needs facilitator' },
    { n: noAgenda, tone: 'warn', text: 'mentor sessions without a ready agenda', hint: 'The call can’t start until it’s ready', area: 'mentorship', filter: 'Booked' },
    { n: waiting, tone: 'warn', text: 'members waiting for a Circle', hint: 'Place them so they can start', area: 'matching', filter: 'Waiting' },
    { n: cityReqs, tone: 'warn', text: 'cities asked for by members', hint: 'Open a city group when it’s ready', area: 'cities', filter: 'Requested' },
    { n: toPack, tone: 'warn', text: 'orders to pack', hint: 'Paid and waiting to be sent', area: 'orders', filter: 'Paid' },
    { n: mentorsPending, tone: 'warn', text: 'mentors waiting for approval', hint: 'Review their applications', area: 'mentors', filter: 'Pending' },
  ];
  const attn = items.filter((a) => a.n > 0 && canView(a.area));

  const pct = members > 0 ? Math.round((active / members) * 100) : 0;
  const kpis: OverviewKpi[] = [
    { label: 'Members', value: num(members), note: `+${num(newWeek)} this week` },
    { label: 'Active this week', value: `${pct}%`, note: 'Checked in at least once' },
    { label: 'Paying members', value: num(paying), note: 'On a paid plan now' },
    { label: 'Circles running', value: num(circ.running), note: `${num(circ.noFac)} need a facilitator` },
  ];

  return {
    eyebrow: new Date(now).toLocaleDateString('en-GB', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long' }).replace(',', ''),
    kpis, attn, weeks, plans,
    recent: await listAudit({ limit: 5 }),
  };
}
