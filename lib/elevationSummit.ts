// lib/elevationSummit.ts
// Single source of truth for Elevation Summit date/time logic. Used by
// app/(app)/layout.tsx (rail mini-card), the dashboard page (full banner),
// components/SummitCountdown.tsx, the livestream watch page and its emails,
// so the date, the exact start time and the day-count math can never drift
// between one place and another.

// Confirmed start time: Thursday 19 November 2026, 10:00am WAT (UTC+1).
export const SUMMIT_START_INSTANT = new Date('2026-11-19T10:00:00+01:00');

// Midnight on the event day (UTC). Kept for the existing day-level countdown
// used elsewhere in the app; use SUMMIT_START_INSTANT for anything that needs
// the exact minute the programme starts (the livestream gate, in particular).
export const SUMMIT_DATE = new Date('2026-11-19T00:00:00Z');

// Full, unambiguous labels for anything user-facing (email, the watch page).
// Never abbreviate this to just "19 November" in new copy.
export const SUMMIT_DATE_LABEL = 'Thursday, 19th November 2026';
export const SUMMIT_DATETIME_LABEL = 'Thursday, 19th November 2026 at 10:00am WAT';

export function daysUntilSummit(): number {
  const ms = SUMMIT_DATE.getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

/** True once the programme has actually started (server-clock based). */
export function hasSummitStarted(): boolean {
  return Date.now() >= SUMMIT_START_INSTANT.getTime();
}
