// lib/rx/digest.ts
// The weekly summary: a short, kind note on the week behind and the week ahead. Pure, so it is tested without a database.
// Tone rule from the product: no streaks, no rankings, no comparisons. Progress is "kept 3 of 5", never a score against others.

export interface DigestInput {
  firstName: string;
  /** Last week's practice, or null when no plan was set. */
  lastWeek: { kept: number; checkedIn: number } | null;
  /** This week's lesson title, once the member's Circle cycle has a week. */
  lessonTitle: string | null;
  lessonWeek: number | null;
  /** One plain-language line per Circle, from circleState, for example "Vote open, closes in 4 days". */
  circleLines: string[];
  /** New comments and replies on the member's posts in the last 7 days. */
  newComments: number;
  /** Notifications not yet opened. */
  unread: number;
  practiceSetThisWeek: boolean;
}

export interface Digest { title: string; body: string; lines: string[] }

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function buildDigest(i: DigestInput): Digest {
  const lines: string[] = [];

  if (i.lastWeek && i.lastWeek.checkedIn > 0) {
    lines.push(`Last week you kept your practice ${i.lastWeek.kept} of ${i.lastWeek.checkedIn} ${i.lastWeek.checkedIn === 1 ? 'day' : 'days'} you checked in. A missed day doesn't reset anything.`);
  } else if (i.lastWeek) {
    lines.push('Last week had no check-ins. That is fine. This week is a fresh start.');
  }

  if (i.lessonTitle) lines.push(`This week's lesson${i.lessonWeek ? ` (week ${i.lessonWeek} of 12)` : ''}: ${i.lessonTitle}.`);
  if (!i.practiceSetThisWeek) lines.push('You have not set this week\'s plan yet. Tie one small practice to something you already do.');

  for (const c of i.circleLines.slice(0, 3)) lines.push(c);

  if (i.newComments > 0) lines.push(`${plural(i.newComments, 'new comment', 'new comments')} on your posts this week.`);
  if (i.unread > 0) lines.push(`${plural(i.unread, 'notification', 'notifications')} waiting for you.`);

  const body = lines.length ? lines[0] : 'Here is your week at a glance.';
  return { title: `Your week, ${i.firstName}`, body, lines };
}

/** True when it is Monday and between 8:00 and 8:59 in the member's own time. Hourly job, so each member matches once a week. */
export function isDigestMoment(tz: string, now: Date = new Date()): boolean {
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short', hour: 'numeric', hourCycle: 'h23' }).formatToParts(now);
    const weekday = parts.find((p) => p.type === 'weekday')?.value;
    const hour = Number(parts.find((p) => p.type === 'hour')?.value);
    return weekday === 'Mon' && hour === 8;
  } catch { return false; }
}

/** True during the given local hour (0 to 23) in the member's time zone. */
export function isLocalHour(tz: string, hour: number, now: Date = new Date()): boolean {
  try {
    return Number(new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', hourCycle: 'h23' }).format(now)) === hour;
  } catch { return false; }
}

/** The daily practice nudge: 8 in the morning, and 7 in the evening for members who chose two reminders a day. */
export function isMorningNudge(tz: string, now: Date = new Date()): boolean { return isLocalHour(tz, 8, now); }
export function isEveningNudge(tz: string, now: Date = new Date()): boolean { return isLocalHour(tz, 19, now); }
