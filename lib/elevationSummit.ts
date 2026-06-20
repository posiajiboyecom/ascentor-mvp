// lib/elevationSummit.ts
// Single source of truth for Elevation Summit countdown logic.
// Used by app/(app)/layout.tsx (rail mini-card) and the dashboard
// page (full banner) so the date and the day-count math can't drift.

export const SUMMIT_DATE = new Date('2027-02-01T00:00:00Z');

export function daysUntilSummit(): number {
  const ms = SUMMIT_DATE.getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}
