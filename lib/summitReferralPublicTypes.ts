// Shared, browser-safe pieces of the public Summit referral leaderboard.
export const REFERRAL_GOAL = 10;
export interface PublicLeader { rank: number; name: string; confirmed: number; reached: boolean }
export interface PublicBoard { leaders: PublicLeader[]; reachedCount: number; totalConfirmed: number; referrers: number }
