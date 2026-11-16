// Shared, browser-safe pieces of the public Summit referral leaderboard.
export const REFERRAL_GOAL = 10;
export interface PublicLeader { rank: number; name: string; confirmed: number; reached: boolean }
export interface PublicWinner { name: string; confirmed: number }
export interface PublicBoard { leaders: PublicLeader[]; reachedCount: number; totalConfirmed: number; referrers: number; /** Everyone who reached the goal, most first. */ winners: PublicWinner[] }
/** The referral page turns into the winners' celebration from midnight on Summit day (Lagos time). */
export const CELEBRATE_FROM = '2026-11-19T00:00:00+01:00';
