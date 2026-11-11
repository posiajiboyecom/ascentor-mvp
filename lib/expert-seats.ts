// lib/expert-seats.ts
// Live expert sessions: who may take a seat. Pure (no I/O, `now` passed in). Tested in scripts/plans-tests/expert-seats.test.ts.
//
//   Plan gate:    the session's plan_tier (lib/planTier.ts canAccess). Free sessions are open to everyone.
//   Monthly cap:  paid sessions count against the plan's expertSessions a month (lib/session-limits.ts):
//                 Seeker 1, Builder 2, Pinnacle 4. Free sessions never count.
//   Held seats:   Pinnacle members get first claim. The last 20% of seats (at least 1, for sessions of 5 or more seats)
//                 are held for Pinnacle until HOLD_RELEASE_HOURS before the start, then open to everyone.

export const HELD_SHARE = 0.2;
export const HOLD_RELEASE_HOURS = 48;

export function heldSeats(capacity: number | null | undefined): number {
  if (!capacity || capacity < 5) return 0;
  return Math.max(1, Math.floor(capacity * HELD_SHARE));
}

export interface SeatCheck {
  capacity: number | null | undefined;
  taken: number;
  isPinnacle: boolean;
  startsAt: Date;
  now: Date;
}

/** null when a seat is available to this member, otherwise the reason. */
export function seatProblem(c: SeatCheck): string | null {
  if (!c.capacity) return null; // no limit set
  if (c.taken >= c.capacity) return 'This session is full.';
  const released = c.startsAt.getTime() - c.now.getTime() <= HOLD_RELEASE_HOURS * 3_600_000;
  const open = released || c.isPinnacle ? c.capacity : c.capacity - heldSeats(c.capacity);
  if (c.taken >= open) return `The remaining seats are held for Pinnacle members until ${HOLD_RELEASE_HOURS / 24} days before the session. Check back then.`;
  return null;
}
