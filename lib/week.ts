// lib/week.ts
// ─────────────────────────────────────────────────────────────────────────
// Single source of truth for "which week is it" in The Circle's ritual.
//
// A check-in is stamped with the Monday of its week (checkin_week, a DATE).
// Both the server component (app/(app)/community/page.tsx) and the check-in
// API route (app/api/community/checkin/route.ts) call mondayOf() so the value
// they compare / write is always identical. Postgres date_trunc('week', ...)
// is also Monday-based, so the SQL seed and this helper agree.
//
// We work in UTC deliberately: checkin_week is a calendar bucket, not a moment
// in time. Using UTC avoids a member in Lagos and a member in Los Angeles
// landing in two different "weeks" for the same Monday.

/**
 * Returns the Monday of the given date's week as an ISO date string
 * (`YYYY-MM-DD`), computed in UTC.
 *
 * mondayOf(new Date('2026-07-02')) // Thu → '2026-06-29' (that week's Monday)
 */
export function mondayOf(d: Date = new Date()): string {
  // getUTCDay(): 0 = Sunday, 1 = Monday, ... 6 = Saturday.
  // Shift Sunday (0) to 7 so the week always starts on Monday.
  const day = d.getUTCDay() || 7;
  const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  monday.setUTCDate(monday.getUTCDate() - (day - 1));
  return monday.toISOString().slice(0, 10);
}

/** Milliseconds in one week — for stepping back through consecutive weeks. */
export const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Given the set of Mondays a user has checked in on (ISO date strings),
 * returns the current streak: how many consecutive weeks ending at THIS week
 * (or last week, so the streak doesn't drop to 0 the instant a new week
 * starts before they've checked in) they have a check-in.
 *
 * Honest and derived — there is no cached streak column to drift out of sync.
 */
export function streakFromWeeks(weeks: string[], today: Date = new Date()): number {
  const set = new Set(weeks);
  if (set.size === 0) return 0;

  const thisMonday = mondayOf(today);
  const lastMonday = mondayOf(new Date(today.getTime() - WEEK_MS));

  // Start counting from this week if present, else last week (grace period),
  // else the streak is 0.
  let cursor: string;
  if (set.has(thisMonday)) cursor = thisMonday;
  else if (set.has(lastMonday)) cursor = lastMonday;
  else return 0;

  let count = 0;
  while (set.has(cursor)) {
    count++;
    cursor = mondayOf(new Date(new Date(cursor + 'T00:00:00Z').getTime() - WEEK_MS));
  }
  return count;
}
