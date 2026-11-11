// lib/rx/private-mentor-rules.ts
// Pinnacle private mentor sessions: the rules, as pure functions (no I/O, `now` passed in). Tested in
// scripts/rx-tests/private-mentor.test.ts. The database work lives in lib/rx/private-mentor.ts and
// app/(app)/sessions/private/actions.ts.
//
//   One live session per calendar month (UTC month of the session's start). A cancelled session frees its month.
//   Book at least BOOK_AHEAD_HOURS ahead (the agenda goes to the mentor with the booking) and at most BOOK_WINDOW_DAYS ahead.
//   The member may cancel or edit the agenda until MEMBER_CHANGE_HOURS before the start; the mentor may cancel any time before it.

export const PRIVATE_SESSION_MINUTES = 20;
export const BOOK_AHEAD_HOURS = 48;
export const BOOK_WINDOW_DAYS = 60;
export const MEMBER_CHANGE_HOURS = 24;
export const AGENDA_MIN = 10;
export const AGENDA_MAX = 1200;

const HOUR = 3_600_000;

/** "2026-11" for any moment in November 2026, UTC. */
export function monthKey(d: Date | string): string {
  const x = new Date(d);
  return `${x.getUTCFullYear()}-${String(x.getUTCMonth() + 1).padStart(2, '0')}`;
}

export interface BookingCheck {
  slotStartsAt: Date;
  /** Start times of the member's sessions that are not cancelled. */
  liveSessionStarts: Date[];
  agenda: string;
  now: Date;
}

/** null when the booking is allowed, otherwise the reason to show the member. */
export function bookingProblem(c: BookingCheck): string | null {
  const t = c.slotStartsAt.getTime();
  if (t < c.now.getTime() + BOOK_AHEAD_HOURS * HOUR) return `Pick a time at least ${BOOK_AHEAD_HOURS / 24} days away, so your mentor has your agenda in good time.`;
  if (t > c.now.getTime() + BOOK_WINDOW_DAYS * 24 * HOUR) return `You can book up to ${BOOK_WINDOW_DAYS} days ahead.`;
  const month = monthKey(c.slotStartsAt);
  if (c.liveSessionStarts.some((s) => monthKey(s) === month)) return 'You already have your private session for that month. Pick a time in another month, or cancel the one you have.';
  const len = c.agenda.trim().length;
  if (len < AGENDA_MIN) return 'Write what you want to talk about first. Your mentor reads it before the session.';
  if (len > AGENDA_MAX) return `Keep the agenda under ${AGENDA_MAX} characters.`;
  return null;
}

/** May the member still cancel, or change the agenda? */
export function memberCanChange(startsAt: Date, now: Date): boolean {
  return startsAt.getTime() - now.getTime() >= MEMBER_CHANGE_HOURS * HOUR;
}

/** May the mentor still cancel? Any time before the session starts. */
export function mentorCanCancel(startsAt: Date, now: Date): boolean {
  return startsAt.getTime() > now.getTime();
}

/** Has this month's session been used? (A booked or held session in the month of `now`.) */
export function usedThisMonth(liveSessionStarts: Date[], now: Date): boolean {
  const m = monthKey(now);
  return liveSessionStarts.some((s) => monthKey(s) === m);
}
