// lib/admin/recommendations.ts
// Server-only. Recommendations are worked out live from real member signals with plain queries (no AI). Nothing here is sample data.
//
// Signals and what each one becomes:
//   Circle      members onboarded but not yet placed in a Circle, grouped by stage and city.
//   Group       (a) interests members chose that no active group covers (the same rule as the Groups screen, lib/rx/admin.ts),
//               (b) group suggestions members typed in (rx_group_requests), grouped by identical text.
//   City group  cities members live in that have no active city group.
//   Fix         Circles with no facilitator; mentor calls this fortnight with fewer than AGENDA_MIN_QUESTIONS questions;
//               members with repeated failed payments (an aggregate, never named).
//   Group       quiet groups (fewer than 5 posts in 7 days, not new). A quiet city group becomes a Meetup suggestion.
//   Wellbeing   Circles whose call attendance over the last 28 days is under 50%.
//
// Confidence thresholds (n = the members or signals behind the recommendation):
//   Circle ............. High n >= 8,  Medium n >= 5,  Low n >= 3 (a Circle can start at 6 members)
//   Group (interest) ... High picks >= 40, otherwise Medium (the Groups screen only suggests from 20 picks)
//   Group (requests) ... High n >= 5,  Medium n >= 2,  Low n = 1
//   City group ......... High n >= 10, Medium n >= 3,  Low n = 2
//   No facilitator ..... High when the Circle is active, Medium when forming with 6+ members, else Low
//   Missing agenda ..... High when the call is within 3 days, Medium within 7, else Low
//   Failed payments .... High n >= 5 members, Medium n >= 2, Low n = 1 (only members with 2+ failures in 30 days)
//   Quiet group ........ High 20+ members, Medium 8+, else Low
//   Low attendance ..... High under 35% over 3+ calls, Medium under 50% over 3+ calls (or under 35% over 2), else Low
//
// Each recommendation has a stable id (hash of its type and subject), so a decision survives a refresh. Decisions are stored in
// public.admin_recommendation_state (migration 20261024c); until that is applied Create and Dismiss say so instead of pretending.

import 'server-only';
import { createHash } from 'node:crypto';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { computeSuggestions } from '@/lib/rx/admin';
import { cleanText } from '@/lib/rx/safety';
import { DIMENSIONS } from '@/lib/rx/constants';
import { redactPII } from '@/lib/admin/analysis';
import { AGENDA_MIN_QUESTIONS } from '@/lib/rx/cmentor';

export const REC_TYPES = ['Circle', 'Group', 'City group', 'Lesson', 'Mentor', 'Meetup', 'Fix', 'Wellbeing', 'Shop'] as const;
export type RecType = (typeof REC_TYPES)[number];
export type RecAct = 'create-group' | 'open-city' | 'ask-checkin' | 'link';
export type RecState = 'created' | 'dismissed';

export interface Rec {
  id: string;
  type: RecType;
  title: string;
  why: string;
  evidence: string;
  serves: string;
  conf: 'High' | 'Medium' | 'Low';
  quotes: { who: string; text: string }[];
  cta: string;
  act: RecAct;
  /** Where "link" CTAs go, and where "Open" goes once something was created. */
  href: string;
  /** "See conversations" target, when conversations are relevant. */
  seeHref?: string;
  /** What a creation acts on (interest, city name or Circle id). The server re-derives the recommendation from its id; the browser's copy is never trusted. */
  subject?: string;
  doneLine: string;
}

export interface RecsResult {
  recs: Rec[];
  state: Record<string, RecState>;
  /** False while the migration is not applied. */
  stateAvailable: boolean;
}

const hash = (type: string, subject: string) => createHash('sha1').update(`${type}|${subject.toLowerCase()}`).digest('hex').slice(0, 12);
export const recId = (type: RecType, subject: string) => `${type.toLowerCase().replace(/\s+/g, '-')}-${hash(type, subject)}`;
const slugify = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_]+/g, '-').slice(0, 60);
const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString('en-NG')} ${n === 1 ? one : many}`;
const titleCase = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase().replace(/(^|[\s-])([a-z])/g, (_m, a, b) => a + b.toUpperCase());
const DAY = 86400000;
const TZ = 'Africa/Lagos';

interface MemberRow { user_id: string; stage: string | null; city: string | null; interests: string[] | null; onboarded_at: string | null; is_demo: boolean | null }
interface CircleRow { id: string; name: string; number: number; status: string; facilitator_id: string | null; is_demo: boolean | null }
interface GroupRow { id: string; slug: string; name: string; status: string; is_city: boolean; is_general: boolean; is_facilitators: boolean; is_new: boolean; created_at: string }

const safe = async <T,>(p: PromiseLike<{ data: T | null; error: unknown }>, fallback: T): Promise<T> => {
  try { const r = await p; return r.error ? fallback : (r.data ?? fallback); } catch { return fallback; }
};

/** Computes every open signal. Each part is independent: one failing query drops only its own recommendations. */
export async function computeRecommendations(): Promise<Rec[]> {
  const now = Date.now();
  const [members, seats, circles, groups, stats, reqs, suggestions] = await Promise.all([
    safe<MemberRow[]>(supabaseAdmin.from('member_profile').select('user_id, stage, city, interests, onboarded_at, is_demo').limit(20000), []),
    safe<{ user_id: string; circle_id: string; role: string }[]>(supabaseAdmin.from('circle_seats').select('user_id, circle_id, role').limit(20000), []),
    safe<CircleRow[]>(supabaseAdmin.from('circles').select('id, name, number, status, facilitator_id, is_demo').limit(1000), []),
    safe<GroupRow[]>(supabaseAdmin.from('rx_groups').select('id, slug, name, status, is_city, is_general, is_facilitators, is_new, created_at').limit(1000), []),
    safe<{ group_id: string; member_count: number; posts_7d: number }[]>(supabaseAdmin.from('rx_group_stats').select('group_id, member_count, posts_7d').limit(1000), []),
    safe<{ text: string }[]>(supabaseAdmin.from('rx_group_requests').select('text').order('created_at', { ascending: false }).limit(2000), []),
    computeSuggestions().catch(() => []),
  ]);

  const real = members.filter((m) => !m.is_demo);
  const realIds = new Set(real.map((m) => m.user_id));
  const out: Rec[] = [];

  // ── Circle: members waiting to be placed ────────────────────────────────
  const placed = new Set(seats.map((s) => s.user_id));
  const waiting = real.filter((m) => m.onboarded_at && !placed.has(m.user_id));
  const byCell = new Map<string, MemberRow[]>();
  for (const m of waiting) {
    const k = `${(m.stage ?? '').trim()}|${titleCase(m.city ?? '')}`;
    byCell.set(k, [...(byCell.get(k) ?? []), m]);
  }
  for (const [k, list] of byCell) {
    if (list.length < 3) continue;
    const [stage, city] = k.split('|');
    const counts = new Map<string, number>();
    for (const m of list) for (const i of m.interests ?? []) counts.set(i, (counts.get(i) ?? 0) + 1);
    const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
    const label = [stage && `${stage}`, city && `in ${city}`].filter(Boolean).join(' ');
    const n = list.length;
    out.push({
      id: recId('Circle', k), type: 'Circle',
      title: `A new Circle ${label ? `for ${label}` : 'for waiting members'}`.replace('for in', 'in'),
      why: `${plural(n, 'member is', 'members are')} waiting to be placed${stage || city ? ` with the same ${[stage && 'stage', city && 'city'].filter(Boolean).join(' and ')}` : ''}.${top && top[1] >= 2 ? ` ${top[0]} is the interest most of them share (${top[1]}).` : ''}`,
      evidence: `${plural(n, 'member')} waiting${stage ? ` · stage ${stage}` : ''}${city ? ` · ${city}` : ''}`,
      serves: `${plural(n, 'member')}${stage ? ` · ${stage}` : ''}${city ? ` · ${city}` : ''}`,
      conf: n >= 8 ? 'High' : n >= 5 ? 'Medium' : 'Low', quotes: [],
      cta: 'Create Circle', act: 'link', href: '/admin/c/circles', seeHref: '/admin/c/matching', doneLine: 'Open Circles to finish it.',
    });
  }

  // ── Group: uncovered interests (same rule as the Groups screen) ─────────
  for (const s of suggestions) {
    out.push({
      id: recId('Group', `interest:${s.key}`), type: 'Group', title: `A ${s.name} group`,
      why: `${plural(s.picks, 'member')} chose ${s.name} as an interest and no active group covers it.${s.requests ? ` ${plural(s.requests, 'member')} also asked for it.` : ''}`,
      evidence: `${plural(s.picks, 'interest pick')} · ${plural(s.posts, 'post')} · ${plural(s.requests, 'group request')}`,
      serves: `${plural(s.picks, 'member')} · all cities`,
      conf: s.picks >= 40 ? 'High' : 'Medium', quotes: [],
      subject: s.key, cta: 'Create group', act: 'create-group', href: '/admin/groups', seeHref: '/admin/c/chats', doneLine: 'Created. It is on Groups, ready to finish.',
    });
  }

  // ── Group: suggestions members typed in ─────────────────────────────────
  const asked = new Map<string, { text: string; n: number }>();
  for (const r of reqs) {
    const t = cleanText(r.text, 300);
    if (t.length < 4) continue;
    const key = t.toLowerCase().replace(/\s+/g, ' ');
    const e = asked.get(key) ?? { text: t, n: 0 };
    e.n++; asked.set(key, e);
  }
  for (const [key, e] of asked) {
    out.push({
      id: recId('Group', `request:${key}`), type: 'Group', title: 'A group members asked for',
      why: `${plural(e.n, 'member')} suggested this in their own words. Read it and decide whether a group fits.`,
      evidence: `${plural(e.n, 'group request')}`, serves: `${plural(e.n, 'member')} · all cities`,
      conf: e.n >= 5 ? 'High' : e.n >= 2 ? 'Medium' : 'Low', quotes: [{ who: 'Member, group suggestion', text: redactPII(e.text) }],
      cta: 'Create group', act: 'link', href: '/admin/groups', doneLine: 'Open Groups to finish it.',
    });
  }

  // ── City group: member cities with no active city group ─────────────────
  const cityGroups = new Set(groups.filter((g) => g.is_city && g.status === 'active').map((g) => g.slug));
  const cityCount = new Map<string, { name: string; n: number }>();
  for (const m of real) {
    const c = titleCase(m.city ?? '');
    if (!c || c.length > 60) continue;
    const slug = `city-${slugify(c)}`;
    if (cityGroups.has(slug)) continue;
    const e = cityCount.get(slug) ?? { name: c, n: 0 };
    e.n++; cityCount.set(slug, e);
  }
  for (const [slug, e] of cityCount) {
    if (e.n < 2) continue;
    out.push({
      id: recId('City group', slug), type: 'City group', title: `Open a ${e.name} city group`,
      why: `${plural(e.n, 'member')} live in ${e.name} and there is no city group for it yet.`,
      evidence: `${plural(e.n, 'member')} in ${e.name}`, serves: `${plural(e.n, 'member')} · ${e.name}`,
      conf: e.n >= 10 ? 'High' : e.n >= 3 ? 'Medium' : 'Low', quotes: [],
      subject: e.name, cta: 'Open city group', act: 'open-city', href: '/admin/c/cities', doneLine: 'Opened. It is on City groups.',
    });
  }

  // ── Fix: Circles without a facilitator ──────────────────────────────────
  const memberSeats = new Map<string, number>();
  for (const s of seats) if (s.role === 'member' && realIds.has(s.user_id)) memberSeats.set(s.circle_id, (memberSeats.get(s.circle_id) ?? 0) + 1);
  const liveCircles = circles.filter((c) => !c.is_demo && (c.status === 'forming' || c.status === 'active'));
  for (const c of liveCircles) {
    if (c.facilitator_id) continue;
    const n = memberSeats.get(c.id) ?? 0;
    out.push({
      id: recId('Fix', `nofacilitator:${c.id}`), type: 'Fix', title: `Circle ${c.number} (${c.name}) needs a facilitator`,
      why: `This ${c.status} Circle has ${plural(n, 'member')} and nobody facilitating it.`,
      evidence: `${plural(n, 'member')} · ${c.status} · no facilitator`, serves: `Circle ${c.number} · ${plural(n, 'member')}`,
      conf: c.status === 'active' ? 'High' : n >= 6 ? 'Medium' : 'Low', quotes: [],
      cta: 'Assign facilitator', act: 'link', href: '/admin/c/circles', seeHref: '/admin/c/chats', doneLine: 'Open Circles to assign one.',
    });
  }

  // ── Fix: mentor calls without a ready agenda ────────────────────────────
  const soon = new Date(now + 14 * DAY).toISOString();
  const sessions = await safe<{ id: string; circle_id: string; starts_at: string }[]>(
    supabaseAdmin.from('circle_mentor_sessions').select('id, circle_id, starts_at').eq('status', 'scheduled').gte('starts_at', new Date(now).toISOString()).lte('starts_at', soon).limit(200), []);
  if (sessions.length) {
    const qs = await safe<{ session_id: string }[]>(supabaseAdmin.from('mentor_questions').select('session_id').in('session_id', sessions.map((s) => s.id)).limit(5000), []);
    const qn = new Map<string, number>();
    for (const q of qs) qn.set(q.session_id, (qn.get(q.session_id) ?? 0) + 1);
    const cById = new Map(circles.map((c) => [c.id, c]));
    for (const s of sessions) {
      const c = cById.get(s.circle_id);
      if (!c || c.is_demo) continue;
      const have = qn.get(s.id) ?? 0;
      if (have >= AGENDA_MIN_QUESTIONS) continue;
      const when = new Date(s.starts_at);
      const days = (when.getTime() - now) / DAY;
      const label = when.toLocaleDateString('en-GB', { timeZone: TZ, weekday: 'short', day: 'numeric', month: 'short' });
      out.push({
        id: recId('Fix', `agenda:${s.id}`), type: 'Fix', title: `Circle ${c.number} has a mentor call on ${label} with no ready agenda`,
        why: `A mentor call needs at least ${AGENDA_MIN_QUESTIONS} member questions. This one has ${have}.`,
        evidence: `${have} of ${AGENDA_MIN_QUESTIONS} questions · call ${label}`, serves: `Circle ${c.number} · ${plural(memberSeats.get(c.id) ?? 0, 'member')}`,
        conf: days <= 3 ? 'High' : days <= 7 ? 'Medium' : 'Low', quotes: [],
        cta: 'Draft an announcement', act: 'link', href: '/admin/c/announcements', seeHref: '/admin/c/chats', doneLine: 'Open Announcements to finish it.',
      });
    }
  }

  // ── Fix: repeated failed payments (aggregate only) ──────────────────────
  const failed = await safe<{ user_id: string | null; email: string | null }[]>(
    supabaseAdmin.from('payment_attempts').select('user_id, email').eq('status', 'failed').gte('created_at', new Date(now - 30 * DAY).toISOString()).limit(5000), []);
  if (failed.length) {
    const per = new Map<string, number>();
    for (const f of failed) { const k = f.user_id ?? f.email ?? ''; if (k) per.set(k, (per.get(k) ?? 0) + 1); }
    const repeat = [...per.values()].filter((v) => v >= 2);
    const total = repeat.reduce((a, b) => a + b, 0);
    if (repeat.length) {
      out.push({
        id: recId('Fix', 'repeated-failed-payments'), type: 'Fix', title: `${plural(repeat.length, 'member')} had repeated failed payments`,
        why: 'Each of them failed to pay two or more times in the last 30 days. A clearer message or a nudge may recover them.',
        evidence: `${plural(total, 'failed attempt')} in 30 days by ${plural(repeat.length, 'member')}`, serves: `${plural(repeat.length, 'member')} · paying members`,
        conf: repeat.length >= 5 ? 'High' : repeat.length >= 2 ? 'Medium' : 'Low', quotes: [],
        cta: 'Open Payments', act: 'link', href: '/admin/c/payments?filter=Failed', doneLine: 'Open Payments to follow up.',
      });
    }
  }

  // ── Quiet groups (Group), and quiet city groups (Meetup) ────────────────
  const st = new Map(stats.map((s) => [s.group_id, s]));
  for (const g of groups) {
    if (g.status !== 'active' || g.is_facilitators) continue;
    const s = st.get(g.id);
    const n = s?.member_count ?? 0;
    const posts = s?.posts_7d ?? 0;
    const fresh = g.is_new && now - new Date(g.created_at).getTime() < 14 * DAY;
    if (fresh || posts >= 5 || n < 3) continue;
    const conf: Rec['conf'] = n >= 20 ? 'High' : n >= 8 ? 'Medium' : 'Low';
    if (g.is_city) {
      out.push({
        id: recId('Meetup', `quiet:${g.id}`), type: 'Meetup', title: `A meetup for ${g.name} members`,
        why: `${g.name} has ${plural(n, 'member')} but only ${plural(posts, 'post')} in the last 7 days. A meetup could get people talking.`,
        evidence: `${plural(posts, 'post')} in 7 days · ${plural(n, 'member')}`, serves: `${plural(n, 'member')} · ${g.name}`,
        conf, quotes: [], cta: 'Suggest to city hosts', act: 'link', href: '/admin/c/meetups', seeHref: '/admin/c/chats', doneLine: 'Open Meetups to finish it.',
      });
    } else if (!g.is_general) {
      out.push({
        id: recId('Group', `quiet:${g.id}`), type: 'Group', title: `${g.name} has gone quiet`,
        why: `${plural(posts, 'post')} in the last 7 days across ${plural(n, 'member')}. Post a prompt, merge it into a close group, or archive it.`,
        evidence: `${plural(posts, 'post')} in 7 days · ${plural(n, 'member')}`, serves: `${plural(n, 'member')} · ${g.name}`,
        conf, quotes: [], cta: 'Open Groups', act: 'link', href: '/admin/groups?tab=groups', seeHref: '/admin/c/chats', doneLine: 'Open Groups to follow up.',
      });
    }
  }

  // ── Wellbeing: Circles with low call attendance ─────────────────────────
  const since = new Date(now - 28 * DAY).toISOString();
  const att = await safe<{ circle_id: string; user_id: string; joined_at: string }[]>(
    supabaseAdmin.from('call_attendance').select('circle_id, user_id, joined_at').eq('kind', 'circle').gte('joined_at', since).limit(20000), []);
  if (att.length) {
    const byCircle = new Map<string, Map<string, Set<string>>>();
    for (const a of att) {
      const d = new Date(a.joined_at).toLocaleDateString('en-CA', { timeZone: TZ });
      const days = byCircle.get(a.circle_id) ?? new Map<string, Set<string>>();
      const set = days.get(d) ?? new Set<string>();
      set.add(a.user_id); days.set(d, set); byCircle.set(a.circle_id, days);
    }
    for (const c of liveCircles.filter((x) => x.status === 'active')) {
      const days = byCircle.get(c.id);
      const n = memberSeats.get(c.id) ?? 0;
      if (!days || days.size < 2 || n < 3) continue;
      const attended = [...days.values()].reduce((a, s) => a + s.size, 0);
      const pct = attended / (days.size * n);
      if (pct >= 0.5) continue;
      const shown = Math.round(pct * 100);
      out.push({
        id: recId('Wellbeing', `attendance:${c.id}`), type: 'Wellbeing', title: `Check in on Circle ${c.number}: attendance is ${shown}%`,
        why: `Across ${plural(days.size, 'call')} in the last 28 days, an average of ${shown}% of the ${plural(n, 'member')} joined.${c.facilitator_id ? '' : ' The Circle has no facilitator to ask.'}`,
        evidence: `${shown}% attendance · ${plural(days.size, 'call')} · 28 days`, serves: `Circle ${c.number} · ${plural(n, 'member')}`,
        conf: pct < 0.35 && days.size >= 3 ? 'High' : days.size >= 3 || pct < 0.35 ? 'Medium' : 'Low', quotes: [],
        subject: c.id, cta: 'Ask the facilitator to check in', act: 'ask-checkin', href: '/admin/c/circles', seeHref: '/admin/c/chats', doneLine: 'Done. The facilitator has been asked to check in.',
      });
    }
  }

  const rank = { High: 0, Medium: 1, Low: 2 } as const;
  return out.sort((a, b) => rank[a.conf] - rank[b.conf]);
}

/** Decisions, or { available:false } while the migration is not applied. */
export async function loadRecState(): Promise<{ available: boolean; state: Record<string, RecState> }> {
  try {
    const { data, error } = await supabaseAdmin.from('admin_recommendation_state').select('id, state').limit(5000);
    if (error) return { available: false, state: {} };
    const state: Record<string, RecState> = {};
    for (const r of (data ?? []) as { id: string; state: string }[]) if (r.state === 'created' || r.state === 'dismissed') state[r.id] = r.state;
    return { available: true, state };
  } catch {
    return { available: false, state: {} };
  }
}

export async function getRecommendations(): Promise<RecsResult> {
  const [recs, st] = await Promise.all([computeRecommendations(), loadRecState()]);
  return { recs, state: st.state, stateAvailable: st.available };
}

let badgeCache: { at: number; n: number } | null = null;
/** Open recommendations for the menu badge. Cached for two minutes so the menu never waits on the full computation. */
export async function openRecommendationCount(): Promise<number> {
  if (badgeCache && Date.now() - badgeCache.at < 120000) return badgeCache.n;
  const r = await getRecommendations();
  const n = r.recs.filter((x) => !r.state[x.id]).length;
  badgeCache = { at: Date.now(), n };
  return n;
}
export function resetRecommendationBadge() { badgeCache = null; }

// ── doing it ────────────────────────────────────────────────────────────────

export const MIGRATION_MESSAGE = 'Run the admin recommendations migration first.';

export async function recordState(id: string, state: RecState | 'open', userId: string): Promise<void> {
  const { error } = await supabaseAdmin.from('admin_recommendation_state').upsert({ id, state, by_user: userId, updated_at: new Date().toISOString() }, { onConflict: 'id' });
  if (error) throw new Error(MIGRATION_MESSAGE);
}

/** Creates the group for an interest recommendation: same rows as the Groups screen's Create, written with the service role. */
export async function createInterestGroup(userId: string, key: string): Promise<void> {
  const name = cleanText(key, 60);
  if (!name) throw new Error('Give the group a name.');
  const dimension = (DIMENSIONS as string[]).includes('Community') ? 'Community' : DIMENSIONS[0];
  let slug = slugify(name) || 'group';
  const { data: clash } = await supabaseAdmin.from('rx_groups').select('id').eq('slug', slug).maybeSingle();
  if (clash) slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`;
  const dim = (await dimensionFor(name)) ?? dimension;
  const { error } = await supabaseAdmin.from('rx_groups').insert({
    slug, name, description: `Members who want to grow in ${name.toLowerCase()}, together.`, dimension: dim, fit: [name],
    is_new: true, created_by: userId, prompt: 'Introduce yourself and what you hope to get from this group.',
  });
  if (error) throw new Error('We could not create that group. Please try again.');
  await supabaseAdmin.from('rx_group_suggestion_state').upsert({ key: name, status: 'created', decided_by: userId }, { onConflict: 'key' });
}

async function dimensionFor(item: string): Promise<string | null> {
  const { dimensionOf } = await import('@/lib/rx/constants');
  return dimensionOf(item) ?? null;
}

export async function openCityGroup(cityName: string): Promise<void> {
  const name = titleCase(cleanText(cityName, 60));
  const slug = `city-${slugify(name)}`;
  if (!name || slug === 'city-') throw new Error('That city name is not valid.');
  const { data: have } = await supabaseAdmin.from('rx_groups').select('id, status').eq('slug', slug).maybeSingle();
  if (have) throw new Error(have.status === 'active' ? `${name} already has a city group.` : `${name} already has a city group that is not active. Reopen it on City groups.`);
  const { error } = await supabaseAdmin.from('rx_groups').insert({
    slug, name, description: `Members in ${name}.`, dimension: 'Community', is_city: true, prompt: 'Introduce yourself and what you are building.',
  });
  if (error) throw new Error('We could not open that city group. Please try again.');
}

export async function askFacilitatorToCheckIn(circleId: string): Promise<void> {
  const { data: c } = await supabaseAdmin.from('circles').select('id, name, number, facilitator_id').eq('id', circleId).maybeSingle();
  if (!c) throw new Error('That Circle no longer exists.');
  if (!c.facilitator_id) throw new Error('This Circle has no facilitator yet. Assign one on Circles first.');
  const { error } = await supabaseAdmin.from('notifications').insert({
    user_id: c.facilitator_id, type: 'community', title: `A quick check-in on Circle ${c.number}`,
    message: 'Attendance in your Circle has been low lately. Could you check in with your members this week?', link: '/circle',
  });
  if (error) throw new Error('We could not send that. Please try again.');
}

/** Ids carry the subject only as a hash, so the server re-computes the recommendation to know what to create. */
export async function findRec(id: string): Promise<Rec | null> {
  return (await computeRecommendations()).find((r) => r.id === id) ?? null;
}
