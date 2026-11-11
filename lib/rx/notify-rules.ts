// lib/rx/notify-rules.ts
// Which member preference each notification obeys, and when an email is allowed. Pure functions, so they are tested
// without a database. The sending itself lives in notifications.ts.

export type NotifKind =
  | 'circle_joined' | 'circle_new_member' | 'vote_opened' | 'vote_cast' | 'vote_won' | 'mentor_chosen'
  | 'mentor_accepted' | 'mentor_declined' | 'sessions_booked' | 'call_tomorrow' | 'session_moved'
  | 'agenda_due' | 'agenda_sent' | 'circle_started' | 'circle_moved' | 'circle_notice' | 'group_notice'
  | 'post_comment' | 'comment_reply' | 'post_reaction' | 'post_share'
  | 'practice_reminder' | 'weekly_digest' | 'lesson_reminder'
  | 'private_booked' | 'private_cancelled';

export const PREF = {
  circle: 'Circle updates',
  community: 'Community comments, replies and shares',
  reactions: 'Community reactions',
  practice: 'Practice reminders',
  digest: 'Weekly summary',
  emailDigest: 'Email: Weekly summary',
  emailCircle: 'Email: Circle updates',
  emailCommunity: 'Email: Community comments and shares',
} as const;

export interface KindSpec {
  /** The in-app and push switch this kind obeys. */
  pref: string;
  /** The email switch, or null when this kind never emails. */
  emailPref: string | null;
  /** Value stored in the legacy `notifications.type` column, which the bell styles by. */
  legacyType: 'community' | 'info' | 'success';
  /** Several of these in a row for the same thing fold into one row. */
  coalesce: boolean;
}

export const KINDS: Record<NotifKind, KindSpec> = {
  circle_joined:     { pref: PREF.circle, emailPref: PREF.emailCircle, legacyType: 'success', coalesce: false },
  circle_new_member: { pref: PREF.circle, emailPref: null,             legacyType: 'info',    coalesce: true },
  vote_opened:       { pref: PREF.circle, emailPref: PREF.emailCircle, legacyType: 'info',    coalesce: false },
  vote_cast:         { pref: PREF.circle, emailPref: null,             legacyType: 'info',    coalesce: false },
  vote_won:          { pref: PREF.circle, emailPref: PREF.emailCircle, legacyType: 'success', coalesce: false },
  mentor_chosen:     { pref: PREF.circle, emailPref: PREF.emailCircle, legacyType: 'success', coalesce: false },
  mentor_accepted:   { pref: PREF.circle, emailPref: PREF.emailCircle, legacyType: 'success', coalesce: false },
  mentor_declined:   { pref: PREF.circle, emailPref: PREF.emailCircle, legacyType: 'info',    coalesce: false },
  sessions_booked:   { pref: PREF.circle, emailPref: PREF.emailCircle, legacyType: 'info',    coalesce: false },
  call_tomorrow:     { pref: PREF.circle, emailPref: PREF.emailCircle, legacyType: 'info',    coalesce: false },
  session_moved:     { pref: PREF.circle, emailPref: PREF.emailCircle, legacyType: 'info',    coalesce: false },
  agenda_due:        { pref: PREF.circle, emailPref: PREF.emailCircle, legacyType: 'info',    coalesce: true },
  agenda_sent:       { pref: PREF.circle, emailPref: PREF.emailCircle, legacyType: 'success', coalesce: false },
  circle_started:    { pref: PREF.circle, emailPref: PREF.emailCircle, legacyType: 'success', coalesce: false },
  circle_moved:      { pref: PREF.circle, emailPref: PREF.emailCircle, legacyType: 'info',    coalesce: false },
  // a message from the Ascentor team to one Circle or one group (Admin → Circles / Groups)
  circle_notice:     { pref: PREF.circle, emailPref: PREF.emailCircle, legacyType: 'info',    coalesce: false },
  group_notice:      { pref: PREF.community, emailPref: PREF.emailCommunity, legacyType: 'community', coalesce: false },
  post_comment:      { pref: PREF.community, emailPref: PREF.emailCommunity, legacyType: 'community', coalesce: true },
  comment_reply:     { pref: PREF.community, emailPref: PREF.emailCommunity, legacyType: 'community', coalesce: true },
  post_reaction:     { pref: PREF.reactions, emailPref: null,                legacyType: 'community', coalesce: true },
  post_share:        { pref: PREF.community, emailPref: PREF.emailCommunity, legacyType: 'community', coalesce: false },
  // one unread reminder at a time: today's replaces yesterday's if it was never opened
  practice_reminder: { pref: PREF.practice, emailPref: null, legacyType: 'info', coalesce: true },
  // a started lesson that was not finished: one unread nudge at a time
  lesson_reminder:   { pref: PREF.practice, emailPref: null, legacyType: 'info', coalesce: true },
  weekly_digest:     { pref: PREF.digest, emailPref: PREF.emailDigest, legacyType: 'info', coalesce: false },
  // Pinnacle private mentor sessions (lib/rx/private-mentor.ts): to the mentor when booked, to the other side when cancelled
  private_booked:    { pref: PREF.circle, emailPref: PREF.emailCircle, legacyType: 'success', coalesce: false },
  private_cancelled: { pref: PREF.circle, emailPref: PREF.emailCircle, legacyType: 'info',    coalesce: false },
};

export const EMAIL_MIN_GAP_MINUTES = 10;
export const EMAIL_DAILY_CAP = 8;

export type Prefs = Record<string, boolean> | null | undefined;

/** A switch counts as on unless the member explicitly turned it off. */
export const isOn = (prefs: Prefs, key: string): boolean => !prefs || prefs[key] !== false;

export interface Decision { inApp: boolean; email: boolean }

/** What a member should get for this kind of event, given their switches. Email also needs the in-app switch on. */
export function decide(kind: NotifKind, prefs: Prefs): Decision {
  const spec = KINDS[kind];
  const inApp = isOn(prefs, spec.pref);
  const email = inApp && !!spec.emailPref && isOn(prefs, spec.emailPref);
  return { inApp, email };
}

/** Email limits so nobody gets a flood: a gap after the last email about the same thing, and a daily cap. */
export function emailAllowed(opts: { sentLast24h: number; minutesSinceSameThing: number | null }): boolean {
  if (opts.sentLast24h >= EMAIL_DAILY_CAP) return false;
  if (opts.minutesSinceSameThing !== null && opts.minutesSinceSameThing < EMAIL_MIN_GAP_MINUTES) return false;
  return true;
}
