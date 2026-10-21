// lib/admin/analysis.ts
// Server-only. The AI behind the console: the AI analysis screen (read member conversations, answer a question) and the
// Platform intel "Run analysis" rows (summaries of platform numbers). Same SDK, key and default model as
// app/api/admin/intel-analyse/route.ts (ANTHROPIC_API_KEY; model claude-sonnet-4-6 unless ANTHROPIC_MODEL is set).
//
// What reaches the model, and what never does:
//   - Only the sources the teammate ticked, only inside the chosen time range, newest first, at most 300 messages per source,
//     each cut to 280 characters, and the whole prompt capped at about 110,000 characters.
//   - Members are labelled M1, M2 ... Names are never sent when "Hide member names" is on (names are replaced with "Member");
//     emails, phone numbers and long digit strings (cards, accounts) are removed ALWAYS.
//   - Authors who have not agreed to chat review (member_profile.chat_consent_at) and demo accounts are left out of the chat sources.
//   - Survey answers: only the admin-built surveys (public.surveys), free-text answers. The private growth surveys are never read.
//   - The model must return strict JSON. It is validated, and every quote is checked against the messages that were actually
//     sent: a quote that is not really there is dropped, never shown.

import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { parseBody } from '@/lib/rx/media';
import { logAccess, type ChatScope } from '@/lib/rx/chats';

export const SOURCES = ['sage', 'dm', 'circle', 'group', 'posts', 'agenda', 'surveys', 'support'] as const;
export type Source = (typeof SOURCES)[number];
export const SOURCE_LABEL: Record<Source, string> = {
  sage: 'Sage chats', dm: 'Direct messages', circle: 'Circle chats', group: 'Group chats',
  posts: 'Posts and replies', agenda: 'Session agendas', surveys: 'Surveys', support: 'Support inbox',
};
export const RANGES = ['Last 7 days', 'Last 30 days', 'Last 90 days', 'All time'] as const;
const REC_TYPES = ['Circle', 'Group', 'City group', 'Lesson', 'Mentor', 'Meetup', 'Fix', 'Wellbeing', 'Shop'] as const;

export interface AnalysisInput { sources: Source[]; range: string; narrow: string; question: string; anonymise: boolean }
export interface AnalysisTheme { label: string; share: number; quote: string | null; who: string | null }
export interface AnalysisResult {
  question: string;
  basis: string;
  summary: string;
  themes: AnalysisTheme[];
  recs: { type: string; title: string }[];
  notes: string[];
  ranAt: string;
  model: string;
}

const MODEL = () => process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';
const PER_SOURCE = 300;
const MSG_CHARS = 280;
const PROMPT_CHARS = 110000;
const DAY = 86400000;

export const aiConfigured = () => !!process.env.ANTHROPIC_API_KEY;
export const NO_KEY_MESSAGE = 'The AI key is not set up on this server (ANTHROPIC_API_KEY). Add it to the environment settings, then try again.';

// ── redaction ───────────────────────────────────────────────────────────────

/** Removes emails, phone numbers and long digit strings (cards, accounts, references). Applied to everything the model sees. */
export function redactPII(text: string): string {
  return text
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email]')
    .replace(/\bhttps?:\/\/\S+/gi, '[link]')
    .replace(/\+?\d[\d\s().-]{7,}\d/g, '[number]')
    .replace(/\d{6,}/g, '[number]');
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function nameScrubber(names: string[]): (t: string) => string {
  const tokens = new Set<string>();
  for (const n of names) {
    const full = n.trim();
    if (full.length >= 3) tokens.add(full);
    for (const part of full.split(/\s+/)) if (part.length >= 3) tokens.add(part);
  }
  if (!tokens.size) return (t) => t;
  const re = new RegExp(`\\b(${[...tokens].sort((a, b) => b.length - a.length).map(escapeRe).join('|')})\\b`, 'gi');
  return (t) => t.replace(re, 'Member');
}

// ── reading the sources ─────────────────────────────────────────────────────

interface Msg { src: Source; uid: string | null; text: string; ctx: string }
interface Author { name: string; consent: boolean; demo: boolean }

const sinceOf = (range: string): string | null => {
  const d = range === 'Last 7 days' ? 7 : range === 'Last 30 days' ? 30 : range === 'Last 90 days' ? 90 : 0;
  return d ? new Date(Date.now() - d * DAY).toISOString() : null;
};

async function authors(ids: string[]): Promise<Map<string, Author>> {
  const out = new Map<string, Author>();
  const uniq = [...new Set(ids)];
  for (let i = 0; i < uniq.length; i += 100) {
    const chunk = uniq.slice(i, i + 100);
    const [{ data: names }, { data: prof }] = await Promise.all([
      supabaseAdmin.from('member_directory').select('id, full_name').in('id', chunk),
      supabaseAdmin.from('member_profile').select('user_id, chat_consent_at, is_demo').in('user_id', chunk),
    ]);
    const n = new Map(((names ?? []) as { id: string; full_name: string | null }[]).map((r) => [r.id, r.full_name?.trim() || 'Member']));
    for (const p of (prof ?? []) as { user_id: string; chat_consent_at: string | null; is_demo: boolean | null }[]) {
      out.set(p.user_id, { name: n.get(p.user_id) ?? 'Member', consent: !!p.chat_consent_at, demo: !!p.is_demo });
    }
  }
  return out;
}

/** The members a "Narrow to" box points at: a Circle, a group, a city, or a member by name. null = not narrowed. */
async function narrowSet(narrow: string): Promise<Set<string> | null> {
  const q = narrow.trim().slice(0, 80);
  if (!q) return null;
  const like = `%${q.replace(/[%_,()]/g, ' ')}%`;
  const num = /circle\s*#?\s*(\d+)/i.exec(q)?.[1];
  const [byName, byCity, circles, groups] = await Promise.all([
    supabaseAdmin.from('member_directory').select('id').ilike('full_name', like).limit(50),
    supabaseAdmin.from('member_profile').select('user_id').ilike('city', like).limit(2000),
    num ? supabaseAdmin.from('circles').select('id').eq('number', Number(num)).limit(5) : supabaseAdmin.from('circles').select('id').ilike('name', like).limit(10),
    supabaseAdmin.from('rx_groups').select('id').ilike('name', like).limit(10),
  ]);
  const ids = new Set<string>();
  for (const r of (byName.data ?? []) as { id: string }[]) ids.add(r.id);
  for (const r of (byCity.data ?? []) as { user_id: string }[]) ids.add(r.user_id);
  const cids = ((circles.data ?? []) as { id: string }[]).map((c) => c.id);
  const gids = ((groups.data ?? []) as { id: string }[]).map((g) => g.id);
  if (cids.length) { const { data } = await supabaseAdmin.from('circle_seats').select('user_id').in('circle_id', cids).limit(2000); for (const r of (data ?? []) as { user_id: string }[]) ids.add(r.user_id); }
  if (gids.length) { const { data } = await supabaseAdmin.from('rx_group_members').select('user_id').in('group_id', gids).limit(2000); for (const r of (data ?? []) as { user_id: string }[]) ids.add(r.user_id); }
  return ids;
}

type Row = Record<string, unknown>;
const str = (v: unknown) => (typeof v === 'string' ? v : '');

async function readSource(src: Source, since: string | null, scope: Set<string> | null): Promise<Msg[]> {
  const fetchN = scope ? 3000 : PER_SOURCE;
  const ranged = <T extends { gte: (c: string, v: string) => T }>(q: T, col: string) => (since ? q.gte(col, since) : q);
  const keep = (rows: Msg[]) => (scope ? rows.filter((m) => m.uid && scope.has(m.uid)) : rows).slice(0, PER_SOURCE);
  const textOf = (body: string) => { const p = parseBody(body); return p.kind === 'text' ? p.text : ''; };

  if (src === 'sage') {
    const { data } = await ranged(supabaseAdmin.from('sage_messages').select('user_id, body, created_at').eq('role', 'user').order('created_at', { ascending: false }).limit(fetchN), 'created_at');
    return keep(((data ?? []) as Row[]).map((r) => ({ src, uid: str(r.user_id) || null, text: str(r.body), ctx: 'Sage' })));
  }
  if (src === 'dm') {
    const { data } = await ranged(supabaseAdmin.from('dm_messages').select('sender_id, body, created_at').order('created_at', { ascending: false }).limit(fetchN), 'created_at');
    return keep(((data ?? []) as Row[]).map((r) => ({ src, uid: str(r.sender_id) || null, text: textOf(str(r.body)), ctx: 'Direct message' })));
  }
  if (src === 'circle') {
    const [{ data }, { data: cs }] = await Promise.all([
      ranged(supabaseAdmin.from('circle_messages').select('user_id, body, circle_id, created_at').not('user_id', 'is', null).order('created_at', { ascending: false }).limit(fetchN), 'created_at'),
      supabaseAdmin.from('circles').select('id, number').limit(1000),
    ]);
    const num = new Map(((cs ?? []) as { id: string; number: number }[]).map((c) => [c.id, c.number]));
    return keep(((data ?? []) as Row[]).map((r) => ({ src, uid: str(r.user_id) || null, text: textOf(str(r.body)), ctx: `Circle ${num.get(str(r.circle_id)) ?? ''}`.trim() })));
  }
  if (src === 'group') {
    const [{ data }, { data: gs }] = await Promise.all([
      ranged(supabaseAdmin.from('rx_group_messages').select('user_id, body, group_id, created_at').order('created_at', { ascending: false }).limit(fetchN), 'created_at'),
      supabaseAdmin.from('rx_groups').select('id, name').limit(1000),
    ]);
    const nm = new Map(((gs ?? []) as { id: string; name: string }[]).map((g) => [g.id, g.name]));
    return keep(((data ?? []) as Row[]).map((r) => ({ src, uid: str(r.user_id) || null, text: textOf(str(r.body)), ctx: nm.get(str(r.group_id)) ?? 'Group' })));
  }
  if (src === 'posts') {
    const half = Math.ceil(fetchN / 2);
    const [{ data: posts }, { data: replies }] = await Promise.all([
      ranged(supabaseAdmin.from('feed_posts').select('user_id, body, created_at').eq('deleted', false).order('created_at', { ascending: false }).limit(scope ? fetchN : half), 'created_at'),
      ranged(supabaseAdmin.from('feed_replies').select('user_id, body, created_at').order('created_at', { ascending: false }).limit(scope ? fetchN : half), 'created_at'),
    ]);
    return keep([
      ...((posts ?? []) as Row[]).map((r) => ({ src, uid: str(r.user_id) || null, text: str(r.body), ctx: 'Post' })),
      ...((replies ?? []) as Row[]).map((r) => ({ src, uid: str(r.user_id) || null, text: str(r.body), ctx: 'Reply' })),
    ]);
  }
  if (src === 'agenda') {
    const [{ data }, { data: cs }] = await Promise.all([
      ranged(supabaseAdmin.from('mentor_questions').select('user_id, text, circle_id, created_at').order('created_at', { ascending: false }).limit(fetchN), 'created_at'),
      supabaseAdmin.from('circles').select('id, number').limit(1000),
    ]);
    const num = new Map(((cs ?? []) as { id: string; number: number }[]).map((c) => [c.id, c.number]));
    return keep(((data ?? []) as Row[]).map((r) => ({ src, uid: str(r.user_id) || null, text: str(r.text), ctx: `Agenda, Circle ${num.get(str(r.circle_id)) ?? ''}`.trim() })));
  }
  if (src === 'surveys') {
    const [{ data: sv }, { data: rs }] = await Promise.all([
      supabaseAdmin.from('surveys').select('id, title, questions').limit(200),
      ranged(supabaseAdmin.from('survey_responses').select('survey_id, user_id, answers, submitted_at').order('submitted_at', { ascending: false }).limit(fetchN), 'submitted_at'),
    ]);
    const meta = new Map(((sv ?? []) as { id: string; title: string; questions: { id?: string; type?: string }[] | null }[]).map((s) => [s.id, s]));
    const out: Msg[] = [];
    for (const r of (rs ?? []) as { survey_id: string; user_id: string | null; answers: Record<string, unknown> | null }[]) {
      const s = meta.get(r.survey_id);
      for (const q of s?.questions ?? []) {
        const a = q.id ? r.answers?.[q.id] : null;
        if ((q.type === 'text' || q.type === 'textarea') && typeof a === 'string' && a.trim()) out.push({ src, uid: r.user_id, text: a, ctx: 'Survey' });
      }
    }
    return keep(out);
  }
  // support: the contact form. Names and emails on it are never read, and it has no member to narrow by.
  if (scope) return [];
  const { data } = await ranged(supabaseAdmin.from('contact_messages').select('subject, message, created_at').order('created_at', { ascending: false }).limit(PER_SOURCE), 'created_at');
  return ((data ?? []) as Row[]).map((r) => ({ src, uid: null, text: `${str(r.subject)}: ${str(r.message)}`, ctx: 'Support inbox' }));
}

const norm = (s: string) => s.toLowerCase().replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, ' ').trim();

interface Corpus { lines: string[]; sent: { text: string; src: Source; ctx: string; uid: string | null }[]; members: number; anonymous: number; perSource: Map<Source, number>; empty: Source[]; trimmed: boolean }

async function buildCorpus(input: AnalysisInput): Promise<Corpus> {
  const since = sinceOf(input.range);
  const scope = await narrowSet(input.narrow);
  const raw = await Promise.all(input.sources.map(async (s) => [s, await readSource(s, since, scope)] as const));

  const ids = raw.flatMap(([, ms]) => ms.map((m) => m.uid).filter((x): x is string => !!x));
  const who = await authors(ids);
  const chatLike = new Set<Source>(['sage', 'dm', 'circle', 'group']);
  const allowed = (m: Msg) => {
    if (!m.uid) return true;
    const a = who.get(m.uid);
    if (!a || a.demo) return false;
    return chatLike.has(m.src) ? a.consent : true;
  };

  const scrub = input.anonymise ? nameScrubber([...who.values()].map((a) => a.name)) : (t: string) => t;
  const budget = Math.floor(PROMPT_CHARS / Math.max(1, input.sources.length));
  const speaker = new Map<string, string>();
  const lines: string[] = [];
  const sent: Corpus['sent'] = [];
  const perSource = new Map<Source, number>();
  const empty: Source[] = [];
  let trimmed = false;

  for (const [src, msgs] of raw) {
    let used = 0;
    let n = 0;
    for (const m of msgs) {
      if (!allowed(m)) continue;
      const text = scrub(redactPII(m.text.replace(/\s+/g, ' ').trim())).slice(0, MSG_CHARS);
      if (text.length < 3) continue;
      if (used + text.length > budget) { trimmed = true; break; }
      used += text.length;
      const sp = m.uid ? (speaker.get(m.uid) ?? (speaker.set(m.uid, `M${speaker.size + 1}`), speaker.get(m.uid)!)) : 'contact form';
      lines.push(`[${lines.length + 1}] (${SOURCE_LABEL[src]}${m.ctx && m.ctx !== SOURCE_LABEL[src] ? `, ${m.ctx}` : ''}; ${sp}) ${text}`);
      sent.push({ text, src, ctx: m.ctx, uid: m.uid });
      n++;
    }
    perSource.set(src, n);
    if (!n) empty.push(src);
    if (n >= PER_SOURCE) trimmed = true;
  }
  return { lines, sent, members: speaker.size, anonymous: sent.filter((m) => !m.uid).length, perSource, empty, trimmed };
}

// ── the model ───────────────────────────────────────────────────────────────

let client: Anthropic | null = null;
const anthropic = () => (client ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }));

async function askModel(system: string, user: string, maxTokens: number): Promise<{ text: string; inTok: number; outTok: number }> {
  const res = await anthropic().messages.create({ model: MODEL(), max_tokens: maxTokens, system, messages: [{ role: 'user', content: user }] }, { timeout: 90000 });
  const text = res.content.filter((b): b is Anthropic.TextBlock => b.type === 'text').map((b) => b.text).join('');
  return { text, inTok: res.usage?.input_tokens ?? 0, outTok: res.usage?.output_tokens ?? 0 };
}

/** Pulls the JSON object out of a reply (the model may wrap it in a code fence). */
export function extractJson(text: string): unknown {
  const clean = text.replace(/```json\s*/gi, '').replace(/```/g, '');
  const a = clean.indexOf('{');
  const b = clean.lastIndexOf('}');
  if (a < 0 || b <= a) throw new Error('no json');
  return JSON.parse(clean.slice(a, b + 1));
}

const SYSTEM = `You are the research analyst for Ascentor, a community platform where members grow through Circles, groups, mentors and an AI coach called Sage. You are given messages members wrote, labelled with their source and an anonymous speaker label (M1, M2 ...). Answer the admin's question using ONLY those messages. Never invent facts, numbers or quotes.
Return ONLY a JSON object, no other text:
{"summary": string (3 to 5 plain sentences answering the question),
 "themes": [{"label": string (under 6 words), "share": integer (your estimate of the percent of the messages read that touch this theme, 0 to 100), "quote": string (copied EXACTLY, word for word, from ONE message above; a short passage under 160 characters)}] (3 to 6 themes, biggest first),
 "recs": [{"type": one of ${REC_TYPES.join(' | ')}, "title": string (a concrete action the team could take, under 100 characters)}] (0 to 5 items)}
If the messages do not support an answer, say so in the summary and return an empty themes array. Do not include names, emails or phone numbers.`;

function validate(raw: unknown): { summary: string; themes: { label: string; share: number; quote: string }[]; recs: { type: string; title: string }[] } {
  if (!raw || typeof raw !== 'object') throw new Error('shape');
  const o = raw as Record<string, unknown>;
  const summary = typeof o.summary === 'string' ? o.summary.trim().slice(0, 1800) : '';
  if (!summary) throw new Error('summary');
  const themes = (Array.isArray(o.themes) ? o.themes : []).flatMap((t) => {
    if (!t || typeof t !== 'object') return [];
    const x = t as Record<string, unknown>;
    const label = typeof x.label === 'string' ? x.label.trim().slice(0, 60) : '';
    const share = typeof x.share === 'number' && isFinite(x.share) ? Math.max(0, Math.min(100, Math.round(x.share))) : NaN;
    if (!label || Number.isNaN(share)) return [];
    return [{ label, share, quote: typeof x.quote === 'string' ? x.quote.trim().slice(0, 240) : '' }];
  }).slice(0, 6).sort((a, b) => b.share - a.share);
  const recs = (Array.isArray(o.recs) ? o.recs : []).flatMap((r) => {
    if (!r || typeof r !== 'object') return [];
    const x = r as Record<string, unknown>;
    const type = typeof x.type === 'string' ? x.type : '';
    const title = typeof x.title === 'string' ? x.title.trim().slice(0, 120) : '';
    return (REC_TYPES as readonly string[]).includes(type) && title ? [{ type, title }] : [];
  }).slice(0, 5);
  return { summary, themes, recs };
}

/** Finds a quote in the messages that were really sent. Returns where it came from, or null if it is not there. */
function locate(quote: string, sent: Corpus['sent']) {
  const q = norm(quote.replace(/^["'“‘]+|["'”’]+$/g, '').replace(/(\.\.\.|…)$/g, '').replace(/^(\.\.\.|…)/, ''));
  if (q.length < 8) return null;
  return sent.find((m) => norm(m.text).includes(q)) ?? null;
}

export async function runAnalysis(input: AnalysisInput, staffUserId: string): Promise<{ ok: true; result: AnalysisResult } | { ok: false; error: string }> {
  if (!aiConfigured()) return { ok: false, error: NO_KEY_MESSAGE };
  const question = redactPII(input.question.trim()).slice(0, 500);
  if (!question) return { ok: false, error: 'Write a question first.' };
  const sources = [...new Set(input.sources)].filter((s): s is Source => (SOURCES as readonly string[]).includes(s));
  if (!sources.length) return { ok: false, error: 'Choose at least one thing to read.' };
  const range = (RANGES as readonly string[]).includes(input.range) ? input.range : 'Last 30 days';
  const narrow = input.narrow.trim().slice(0, 80);

  const corpus = await buildCorpus({ ...input, sources, range, narrow, question });
  if (!corpus.sent.length) {
    return { ok: false, error: `There was nothing to read for that choice${narrow ? ` (narrowed to ${narrow})` : ''}. Try more sources or a longer time.` };
  }

  // Reading private chats is recorded in the chat access log, like every other admin view of them.
  const scopes: Partial<Record<Source, ChatScope>> = { sage: 'sage', dm: 'dm', circle: 'circle', group: 'group' };
  await Promise.all(sources.filter((s) => scopes[s] && (corpus.perSource.get(s) ?? 0) > 0).map((s) => logAccess(staffUserId, 'view', scopes[s]!, null, undefined, { via: 'ai_analysis', range, messages: corpus.perSource.get(s) })));

  let parsed: ReturnType<typeof validate>;
  try {
    const prompt = `QUESTION: ${question}\nTIME: ${range.toLowerCase()}\nSCOPE: ${narrow ? 'narrowed by the admin to a subset of members' : 'all members'}\nMESSAGES (${corpus.sent.length}):\n${corpus.lines.join('\n')}`;
    const r = await askModel(SYSTEM, prompt, 2000);
    try { parsed = validate(extractJson(r.text)); }
    catch { return { ok: false, error: 'The AI answered in a form we could not read. Please run it again.' }; }
  } catch (e) {
    console.error('[admin analysis] model call failed:', e instanceof Error ? e.message : e);
    return { ok: false, error: 'The AI service did not respond. Please try again in a moment.' };
  }

  const themes: AnalysisTheme[] = parsed.themes.map((t) => {
    const hit = t.quote ? locate(t.quote, corpus.sent) : null;
    return {
      label: t.label, share: t.share,
      quote: hit ? t.quote.replace(/^["'“‘]+|["'”’]+$/g, '') : null,
      who: hit ? `Member, ${hit.ctx || SOURCE_LABEL[hit.src]}` : null,
    };
  });

  const names = sources.map((s) => SOURCE_LABEL[s].toLowerCase());
  const total = corpus.sent.length;
  const basis = `Read ${total.toLocaleString('en-NG')} ${total === 1 ? 'message' : 'messages'} from ${corpus.members.toLocaleString('en-NG')} ${corpus.members === 1 ? 'member' : 'members'}${corpus.anonymous ? ` and ${corpus.anonymous.toLocaleString('en-NG')} from the contact form` : ''} · ${range.toLowerCase()} · ${names.join(', ')}${narrow ? ` · narrowed to ${narrow}` : ''}.`;
  const notes: string[] = [];
  if (corpus.trimmed) notes.push(`Only the newest messages were read (up to ${PER_SOURCE} per source), so this is a sample.`);
  if (corpus.empty.length) notes.push(`Nothing found for: ${corpus.empty.map((s) => SOURCE_LABEL[s]).join(', ')}.`);
  if (narrow && sources.includes('support')) notes.push('The support inbox is left out when you narrow to people.');
  if (themes.length) notes.push('Shares are the AI’s estimate from the messages it read, not exact counts.');
  if (themes.some((t) => !t.quote)) notes.push('A quote is shown only when it is found word for word in the messages that were read.');
  if (!input.anonymise) notes.push('Names are hidden from the AI either way; they are only shown here when you turn the toggle off.');

  return { ok: true, result: { question, basis, summary: parsed.summary, themes, recs: parsed.recs, notes, ranAt: new Date().toISOString(), model: MODEL() } };
}

/** The result as a Markdown file (Export). */
export function toMarkdown(r: AnalysisResult): string {
  const out: string[] = [`# ${r.question}`, '', `_${r.basis}_`, '', r.summary, ''];
  if (r.themes.length) {
    out.push('## Themes, by estimated share of conversations', '');
    for (const t of r.themes) out.push(`- **${t.label}** (${t.share}%)${t.quote ? `: "${t.quote}" (${t.who})` : ''}`);
    out.push('');
  }
  if (r.recs.length) { out.push('## What to do about it', ''); for (const x of r.recs) out.push(`- ${x.type}: ${x.title}`); out.push(''); }
  for (const n of r.notes) out.push(`> ${n}`);
  out.push('', `Run ${r.ranAt} with ${r.model}.`);
  return out.join('\n');
}

/** Re-checks a result sent back from the browser before it is turned into a file. */
export function cleanResult(raw: unknown): AnalysisResult | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const s = (v: unknown, n: number) => (typeof v === 'string' ? v.slice(0, n) : '');
  if (!s(o.question, 500) || !s(o.summary, 1800)) return null;
  const themes = (Array.isArray(o.themes) ? o.themes : []).slice(0, 6).map((t) => {
    const x = (t ?? {}) as Record<string, unknown>;
    return { label: s(x.label, 60), share: typeof x.share === 'number' ? Math.max(0, Math.min(100, Math.round(x.share))) : 0, quote: x.quote ? s(x.quote, 240) : null, who: x.who ? s(x.who, 80) : null };
  });
  const recs = (Array.isArray(o.recs) ? o.recs : []).slice(0, 5).map((r) => { const x = (r ?? {}) as Record<string, unknown>; return { type: s(x.type, 20), title: s(x.title, 120) }; });
  const notes = (Array.isArray(o.notes) ? o.notes : []).slice(0, 8).map((n) => s(n, 300));
  return { question: s(o.question, 500), basis: s(o.basis, 600), summary: s(o.summary, 1800), themes, recs, notes, ranAt: s(o.ranAt, 40), model: s(o.model, 60) };
}

// ── Platform intel: summaries of the platform's own numbers ─────────────────

export interface PlatformAnalysis { id: string; label: string; covers: string }
export const PLATFORM_ANALYSES: PlatformAnalysis[] = [
  { id: 'overview', label: 'Platform overview', covers: 'Everything' },
  { id: 'behaviour', label: 'Member behaviour', covers: 'Sign-ups, check-ins, lessons' },
  { id: 'community', label: 'Community health', covers: 'Circles, groups, reports' },
  { id: 'coaching', label: 'Coaching analysis', covers: 'Sage conversations (anonymised)' },
  { id: 'content', label: 'Content performance', covers: 'Lessons and posts' },
  { id: 'revenue', label: 'Revenue intelligence', covers: 'Plans, payments, churn' },
  { id: 'surveys', label: 'Survey insights', covers: 'Baseline and 3-month surveys' },
];

async function count(table: string, f?: (q: any) => any): Promise<number> { // eslint-disable-line @typescript-eslint/no-explicit-any
  try {
    let q = supabaseAdmin.from(table).select('*', { count: 'exact', head: true });
    if (f) q = f(q);
    const { count: n } = await q;
    return n ?? 0;
  } catch { return 0; }
}

async function platformData(id: string): Promise<Record<string, unknown>> {
  const iso = (d: number) => new Date(Date.now() - d * DAY).toISOString();
  const d7 = iso(7), d30 = iso(30), d60 = iso(60);
  const group = async (table: string, col: string, f?: (q: any) => any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
    try {
      let q = supabaseAdmin.from(table).select(col).limit(20000);
      if (f) q = f(q);
      const { data } = await q;
      const m: Record<string, number> = {};
      for (const r of (data ?? []) as unknown as Record<string, unknown>[]) { const k = String(r[col] ?? 'none'); m[k] = (m[k] ?? 0) + 1; }
      return m;
    } catch { return {}; }
  };
  const overview = async () => ({
    members: await count('profiles'), joined_last_7_days: await count('profiles', (q) => q.gte('created_at', d7)), joined_last_30_days: await count('profiles', (q) => q.gte('created_at', d30)), joined_previous_30_days: await count('profiles', (q) => q.gte('created_at', d60).lt('created_at', d30)),
    onboarded: await count('member_profile', (q) => q.not('onboarded_at', 'is', null).eq('is_demo', false)),
    circles_by_status: await group('circles', 'status', (q) => q.eq('is_demo', false)),
    messages_last_7_days: { circle: await count('circle_messages', (q) => q.gte('created_at', d7)), group: await count('rx_group_messages', (q) => q.gte('created_at', d7)), direct: await count('dm_messages', (q) => q.gte('created_at', d7)), sage_member_messages: await count('sage_messages', (q) => q.eq('role', 'user').gte('created_at', d7)) },
    checkins_last_7_days: await count('practice_checkins', (q) => q.gte('created_at', d7)),
    paying_subscribers: await count('profiles', (q) => q.eq('subscription_status', 'active')),
  });
  if (id === 'overview') return overview();
  if (id === 'behaviour') return {
    joined_last_7_days: await count('profiles', (q) => q.gte('created_at', d7)), joined_previous_7_days: await count('profiles', (q) => q.gte('created_at', iso(14)).lt('created_at', d7)),
    checkins_last_7_days: await count('practice_checkins', (q) => q.gte('created_at', d7)), checkins_last_30_days: await count('practice_checkins', (q) => q.gte('created_at', d30)),
    lessons_completed_last_30_days: await count('rx_lesson_progress', (q) => q.not('completed_at', 'is', null).gte('completed_at', d30)),
    members_by_stage: await group('member_profile', 'stage', (q) => q.eq('is_demo', false)), members_by_city: await group('member_profile', 'city', (q) => q.eq('is_demo', false)),
    onboarding_completed: await count('profiles', (q) => q.eq('onboarding_completed', true)), members: await count('profiles'),
  };
  if (id === 'community') return {
    circles_by_status: await group('circles', 'status', (q) => q.eq('is_demo', false)), circles_without_facilitator: await count('circles', (q) => q.is('facilitator_id', null).eq('is_demo', false)),
    circle_weekly_reports_last_30_days: await count('circle_reports', (q) => q.gte('created_at', d30)), circle_reports_kept_commitment: await count('circle_reports', (q) => q.gte('created_at', d30).eq('kept', true)),
    group_messages_last_7_days: await count('rx_group_messages', (q) => q.gte('created_at', d7)), groups_active: await count('rx_groups', (q) => q.eq('status', 'active')),
    member_reports_open: await count('rx_reports', (q) => q.eq('status', 'open')), flags_open: await count('rx_flags', (q) => q.eq('status', 'open')),
    call_attendance_sessions_last_30_days: await count('call_attendance', (q) => q.gte('joined_at', d30)),
  };
  if (id === 'coaching') return {
    conversations_started_last_30_days: await count('sage_conversations', (q) => q.gte('started_at', d30)), member_messages_last_30_days: await count('sage_messages', (q) => q.eq('role', 'user').gte('created_at', d30)),
    conversations_by_topic: await group('sage_conversations', 'topic', (q) => q.gte('started_at', d30)), conversations_all_time: await count('sage_conversations'),
  };
  if (id === 'content') {
    const { data: lessons } = await supabaseAdmin.from('rx_lessons').select('id, title, dimension, published').limit(500);
    const { data: done } = await supabaseAdmin.from('rx_lesson_progress').select('lesson_id').not('completed_at', 'is', null).gte('completed_at', d30).limit(20000);
    const c: Record<string, number> = {};
    for (const r of (done ?? []) as { lesson_id: string }[]) c[r.lesson_id] = (c[r.lesson_id] ?? 0) + 1;
    const { data: blog } = await supabaseAdmin.from('blog_posts').select('title, views').eq('is_published', true).order('views', { ascending: false }).limit(10);
    return {
      lessons_published: ((lessons ?? []) as { published: boolean }[]).filter((l) => l.published).length,
      top_lessons_by_completions_last_30_days: ((lessons ?? []) as { id: string; title: string; dimension: string | null }[]).map((l) => ({ title: l.title, dimension: l.dimension, completions: c[l.id] ?? 0 })).sort((a, b) => b.completions - a.completions).slice(0, 8),
      top_blog_posts_by_views: blog ?? [], posts_last_30_days: await count('feed_posts', (q) => q.eq('deleted', false).gte('created_at', d30)),
    };
  }
  if (id === 'revenue') return {
    plans_of_active_subscribers: await group('profiles', 'subscription_plan', (q) => q.eq('subscription_status', 'active')), subscription_status_counts: await group('profiles', 'subscription_status'),
    successful_payments_last_30_days: await count('payment_attempts', (q) => q.eq('status', 'success').gte('paid_at', d30)), failed_payments_last_30_days: await count('payment_attempts', (q) => q.eq('status', 'failed').gte('created_at', d30)),
    abandoned_checkouts_last_30_days: await count('payment_attempts', (q) => q.eq('status', 'abandoned').gte('created_at', d30)), cancellations_last_30_days: await count('subscriptions', (q) => q.gte('cancelled_at', d30)),
    note: 'Billing is pay now, get 7 extra days. There is no free trial.',
  };
  if (id === 'surveys') {
    const out: Record<string, unknown> = { admin_surveys: await count('surveys'), admin_survey_responses: await count('survey_responses') };
    const { data } = await supabaseAdmin.from('private_growth_scores').select('kind, flourishing, purpose, initiative').limit(20000);
    const by: Record<string, { n: number; f: number; p: number; i: number }> = {};
    for (const r of (data ?? []) as { kind: string; flourishing: number; purpose: number; initiative: number }[]) { const e = (by[r.kind] ??= { n: 0, f: 0, p: 0, i: 0 }); e.n++; e.f += r.flourishing; e.p += r.purpose; e.i += r.initiative; }
    // Averages are only shown for waves with at least 5 members, so no individual can be picked out.
    out.growth_survey_waves = Object.fromEntries(Object.entries(by).map(([k, e]) => [k, e.n >= 5 ? { members: e.n, flourishing_avg: +(e.f / e.n).toFixed(2), purpose_avg: +(e.p / e.n).toFixed(2), initiative_avg: +(e.i / e.n).toFixed(2) } : { members: e.n, note: 'too few to average' }]));
    return out;
  }
  throw new Error('Unknown analysis.');
}

const PLATFORM_SYSTEM = `You are the business analyst for Ascentor, a community platform in Nigeria (all money is in naira). You are given aggregate counts from the platform. Use ONLY these numbers; never invent figures. If a number is zero or too small to say anything, say so plainly.
Return ONLY JSON: {"summary": string (3 to 5 plain sentences), "highlights": string[] (2 to 5 short facts taken from the data), "watch": string[] (0 to 4 things that look wrong or risky), "next": string[] (0 to 4 concrete next steps)}.`;

export interface PlatformSummary { id: string; label: string; summary: string; highlights: string[]; watch: string[]; next: string[]; generatedAt: string }

/** Runs one Platform intel analysis for real and stores it (platform_snapshots, generated_by "console:<id>"). Returns an error unless it truly ran. */
export async function runPlatformAnalysis(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const def = PLATFORM_ANALYSES.find((a) => a.id === id);
  if (!def) return { ok: false, error: 'Unknown analysis.' };
  if (!aiConfigured()) return { ok: false, error: NO_KEY_MESSAGE };
  const t0 = Date.now();
  let data: Record<string, unknown>;
  try { data = await platformData(id); } catch { return { ok: false, error: 'We could not read the platform numbers. Please try again.' }; }
  let parsed: { summary: string; highlights: string[]; watch: string[]; next: string[] };
  let tok = { inTok: 0, outTok: 0 };
  try {
    const r = await askModel(PLATFORM_SYSTEM, `ANALYSIS: ${def.label} (${def.covers})\nTODAY: ${new Date().toISOString().slice(0, 10)}\nDATA:\n${JSON.stringify(data)}`, 1200);
    tok = r;
    const o = extractJson(r.text) as Record<string, unknown>;
    const list = (v: unknown, n: number) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').map((x) => x.trim().slice(0, 300)).filter(Boolean).slice(0, n) : []);
    const summary = typeof o.summary === 'string' ? o.summary.trim().slice(0, 1800) : '';
    if (!summary) throw new Error('summary');
    parsed = { summary, highlights: list(o.highlights, 5), watch: list(o.watch, 4), next: list(o.next, 4) };
  } catch (e) {
    console.error('[platform intel] run failed:', e instanceof Error ? e.message : e);
    return { ok: false, error: 'The AI did not return a usable summary. Please try again.' };
  }
  const { error } = await supabaseAdmin.from('platform_snapshots').insert({
    generated_by: `console:${id}`, raw_data: data, ai_report: { id, title: def.label, ...parsed }, token_cost: { input_tokens: tok.inTok, output_tokens: tok.outTok }, duration_ms: Date.now() - t0,
  });
  if (error) return { ok: false, error: 'The analysis ran but could not be saved. Please try again.' };
  return { ok: true };
}

/** The newest saved summary for each analysis. */
export async function latestPlatformSummaries(): Promise<Map<string, PlatformSummary>> {
  const out = new Map<string, PlatformSummary>();
  try {
    const { data } = await supabaseAdmin.from('platform_snapshots').select('generated_at, generated_by, ai_report').like('generated_by', 'console:%').order('generated_at', { ascending: false }).limit(60);
    for (const r of (data ?? []) as { generated_at: string; generated_by: string; ai_report: Record<string, unknown> | null }[]) {
      const id = r.generated_by.slice('console:'.length);
      const def = PLATFORM_ANALYSES.find((a) => a.id === id);
      const rep = r.ai_report;
      if (!def || out.has(id) || !rep || typeof rep.summary !== 'string') continue;
      const arr = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
      out.set(id, { id, label: def.label, summary: rep.summary, highlights: arr(rep.highlights), watch: arr(rep.watch), next: arr(rep.next), generatedAt: r.generated_at });
    }
  } catch { /* table unreadable: no summaries */ }
  return out;
}
