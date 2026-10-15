// lib/rx/audience.ts
// Who a broadcast goes to. Pure, so the rules are tested without a database.
// An audience is "everyone", or one group: a stage, a city, a language, or one Circle.

export const STAGES = ['Seeking', 'Building', 'Leading'] as const;

export type Audience =
  | { kind: 'all' }
  | { kind: 'stage'; value: string }
  | { kind: 'city'; value: string }
  | { kind: 'language'; value: string }
  | { kind: 'circle'; value: string };

export const AUDIENCE_KINDS: { kind: Audience['kind']; label: string; needsValue: boolean }[] = [
  { kind: 'all', label: 'Everyone', needsValue: false },
  { kind: 'stage', label: 'A stage', needsValue: true },
  { kind: 'city', label: 'A city', needsValue: true },
  { kind: 'language', label: 'A language', needsValue: true },
  { kind: 'circle', label: 'One Circle', needsValue: true },
];

const UUID = /^[0-9a-f-]{36}$/i;

/** Turns whatever was stored or submitted into a valid audience, or null when it is not one. */
export function parseAudience(raw: unknown): Audience | null {
  if (!raw || typeof raw !== 'object') return null;
  const { kind, value } = raw as { kind?: unknown; value?: unknown };
  if (kind === 'all') return { kind: 'all' };
  const v = typeof value === 'string' ? value.trim().slice(0, 80) : '';
  if (!v) return null;
  if (kind === 'stage') return (STAGES as readonly string[]).includes(v) ? { kind, value: v } : null;
  if (kind === 'city' || kind === 'language') return { kind, value: v };
  if (kind === 'circle') return UUID.test(v) ? { kind, value: v } : null;
  return null;
}

export function audienceLabel(a: Audience, circleName?: string): string {
  switch (a.kind) {
    case 'all': return 'Everyone';
    case 'stage': return `Members at the ${a.value} stage`;
    case 'city': return `Members in ${a.value}`;
    case 'language': return `Members who use ${a.value}`;
    case 'circle': return circleName ? `Members of ${circleName}` : 'Members of one Circle';
  }
}

export interface MemberFacts { stage?: string | null; city?: string | null; language?: string | null; circleIds?: string[] }

const norm = (s: string | null | undefined) => (s ?? '').trim().toLowerCase();

/** Whether one member belongs to an audience. Used to decide who sees a pinned card. */
export function matches(a: Audience, m: MemberFacts): boolean {
  switch (a.kind) {
    case 'all': return true;
    case 'stage': return norm(m.stage) === norm(a.value);
    case 'city': return norm(m.city) === norm(a.value);
    case 'language': return norm(m.language) === norm(a.value);
    case 'circle': return (m.circleIds ?? []).includes(a.value);
  }
}

export interface BroadcastInput {
  title: string; body: string; linkUrl?: string | null; linkLabel?: string | null;
  channel: 'in_app' | 'email' | 'both'; audience: unknown; pinCard?: boolean; pinUntil?: string | null;
}

export interface CleanBroadcast {
  title: string; body: string; linkUrl: string | null; linkLabel: string | null;
  channel: 'in_app' | 'email' | 'both'; audience: Audience; pinCard: boolean; pinUntil: string | null;
}

export const TITLE_MAX = 80;
export const BODY_MAX = 600;

/** A link may point inside the app (/path) or to a secure web address. Nothing else, so a message cannot carry a script link. */
export function cleanLink(raw: string | null | undefined): string | null {
  const v = (raw ?? '').trim();
  if (!v) return null;
  if (/^\/(?!\/)[\w\-./?=&%#]*$/.test(v)) return v;
  try { const u = new URL(v); return u.protocol === 'https:' ? u.toString() : null; } catch { return null; }
}

export function validateBroadcast(i: BroadcastInput, now: Date = new Date()): { ok: true; value: CleanBroadcast } | { ok: false; error: string } {
  const title = (i.title ?? '').replace(/\s+/g, ' ').trim();
  const body = (i.body ?? '').replace(/\r\n/g, '\n').trim();
  if (title.length < 3) return { ok: false, error: 'Give the message a title of at least 3 characters.' };
  if (title.length > TITLE_MAX) return { ok: false, error: `Keep the title under ${TITLE_MAX} characters.` };
  if (body.length < 3) return { ok: false, error: 'Write the message.' };
  if (body.length > BODY_MAX) return { ok: false, error: `Keep the message under ${BODY_MAX} characters.` };
  if (!['in_app', 'email', 'both'].includes(i.channel)) return { ok: false, error: 'Choose how to send it: in the app, by email, or both.' };
  const audience = parseAudience(i.audience);
  if (!audience) return { ok: false, error: 'Choose who it goes to.' };

  const rawLink = (i.linkUrl ?? '').trim();
  const link = cleanLink(rawLink);
  if (rawLink && !link) return { ok: false, error: 'The link must be a path inside the app (like /community) or a secure https address.' };
  const label = (i.linkLabel ?? '').trim().slice(0, 24) || (link ? 'Open' : null);

  let pinUntil: string | null = null;
  if (i.pinCard && i.pinUntil) {
    const d = new Date(i.pinUntil);
    if (Number.isNaN(d.getTime())) return { ok: false, error: 'That end date for the card is not valid.' };
    if (d.getTime() <= now.getTime()) return { ok: false, error: 'The card’s end date must be in the future.' };
    pinUntil = d.toISOString();
  }
  if (i.channel === 'email' && i.pinCard) return { ok: false, error: 'A sidebar card shows in the app. Choose “In the app” or “Both”.' };

  return { ok: true, value: { title, body, linkUrl: link, linkLabel: link ? label : null, channel: i.channel, audience, pinCard: !!i.pinCard, pinUntil } };
}

/** Which of the places a message reaches a member in, given their switches. Members can mute announcements or just their emails. */
export function deliveryPlan(channel: 'in_app' | 'email' | 'both', prefs: { annMuted?: boolean; emailOff?: boolean }): { inApp: boolean; push: boolean; email: boolean; skipped: string | null } {
  const wantsApp = channel === 'in_app' || channel === 'both';
  const wantsEmail = channel === 'email' || channel === 'both';
  const muted = !!prefs.annMuted;
  const email = wantsEmail && !muted && !prefs.emailOff;
  const push = wantsApp && !muted;
  const inApp = wantsApp;
  const skipped = wantsEmail && !email && !inApp ? (muted ? 'announcements muted' : 'announcement emails off') : null;
  return { inApp, push, email, skipped };
}
