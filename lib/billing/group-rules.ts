// lib/billing/group-rules.ts
// ─────────────────────────────────────────────────────────────────────────────
// Billing v2 GROUP JOIN rules. PURE: no I/O, no Date.now(), no randomness of its own (callers pass `now` and a random
// source). Unit tested in scripts/billing-tests/groups.test.ts. Group COMPLETENESS (3 active) lives in rules.ts
// (countActiveMembers, isGroupComplete); this file is about who may join, codes, switching and abuse flags.
//
// Exports
//   GROUP_SWITCH_DAYS, GROUP_CODE_VALID_DAYS, GROUP_CODE_MAX_USES, GROUP_FLAG_WINDOW_MINUTES
//   CODE_ALPHABET, makeGroupCode(rand), normaliseGroupCode(raw)
//   codeExpiresAt(createdAt), switchLockedUntil(history, now)
//   checkJoin(input)                     -> { ok:true, already } | { ok:false, reason, message, canSwitchAt? }
//   detectGroupFlags(members)            -> GroupFlagFinding[]   (stable keys so an admin clearing a flag sticks)
//   nextGroupStatus(activeCount, prev)   -> 'forming' | 'active' | 'broken'
//   describeStatus(status, activeCount)  -> plain words for the member
// ─────────────────────────────────────────────────────────────────────────────

import { addDays, GROUP_MAX, GROUP_MIN, isGroupComplete } from './rules';

export const GROUP_SWITCH_DAYS = 90;
/** A group code (and link) stops accepting new members this many days after the group was created. */
export const GROUP_CODE_VALID_DAYS = 45;
/** Each code can be used at most this many times in total (leavers still count, so it cannot be recycled endlessly). */
export const GROUP_CODE_MAX_USES = 10;
/** Accounts created within this many minutes of each other are flagged for admin review. */
export const GROUP_FLAG_WINDOW_MINUTES = 10;

/** No I, L, O, 0 or 1, so a code read out loud or off a poster is not mistyped. */
export const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/** ASC-7K2Q. `rand(n)` returns an integer in [0, n). */
export function makeGroupCode(rand: (n: number) => number): string {
  let s = '';
  for (let i = 0; i < 4; i++) s += CODE_ALPHABET[rand(CODE_ALPHABET.length)];
  return `ASC-${s}`;
}

/** "asc 7k2q", "ASC7K2Q" and "ASC-7K2Q" all become "ASC-7K2Q". Anything else is null. */
export function normaliseGroupCode(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const t = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!/^ASC[A-Z0-9]{4}$/.test(t)) return null;
  const tail = t.slice(3);
  for (const ch of tail) if (!CODE_ALPHABET.includes(ch)) return null;
  return `ASC-${tail}`;
}

export function codeExpiresAt(createdAt: Date): Date {
  return addDays(createdAt, GROUP_CODE_VALID_DAYS);
}

export interface MembershipHistoryRow {
  joinedAt: Date;
  /** True when at least one OTHER person was ever in that group. Leaving a group you were alone in is not a "switch". */
  hadOthers: boolean;
}

/** Null when the member may join a group now; otherwise the date they can switch (last real join + 90 days). */
export function switchLockedUntil(history: MembershipHistoryRow[], now: Date): Date | null {
  let last: Date | null = null;
  for (const h of history) if (h.hadOthers && (!last || h.joinedAt.getTime() > last.getTime())) last = h.joinedAt;
  if (!last) return null;
  const until = addDays(last, GROUP_SWITCH_DAYS);
  return until.getTime() > now.getTime() ? until : null;
}

export type JoinRefusal = 'in_group' | 'expired' | 'full' | 'code_used_up' | 'switch_locked';

export type JoinCheck =
  | { ok: true; already: boolean }
  | { ok: false; reason: JoinRefusal; message: string; canSwitchAt?: Date };

const fmtDate = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

export function checkJoin(i: {
  now: Date;
  /** The group the member is in right now, if any. */
  currentGroupId: string | null;
  targetGroupId: string;
  targetCreatedAt: Date;
  /** Members in the target group right now (left_at is null). */
  targetActiveRows: number;
  /** Every membership row the target group has ever had, leavers included. */
  targetTotalRows: number;
  history: MembershipHistoryRow[];
}): JoinCheck {
  if (i.currentGroupId === i.targetGroupId) return { ok: true, already: true };
  if (i.currentGroupId) {
    return { ok: false, reason: 'in_group', message: 'You are already in a group. Leave it first, then you can join another.' };
  }
  const lock = switchLockedUntil(i.history, i.now);
  if (lock) {
    return {
      ok: false, reason: 'switch_locked', canSwitchAt: lock,
      message: `You joined a group recently. You can switch groups once every ${GROUP_SWITCH_DAYS} days, so you can join another from ${fmtDate(lock)}.`,
    };
  }
  if (codeExpiresAt(i.targetCreatedAt).getTime() <= i.now.getTime()) {
    return { ok: false, reason: 'expired', message: 'This group code or link has expired. Ask your friend for a new one.' };
  }
  if (i.targetActiveRows >= GROUP_MAX) {
    return { ok: false, reason: 'full', message: `This group is full. A group can have up to ${GROUP_MAX} members.` };
  }
  if (i.targetTotalRows >= GROUP_CODE_MAX_USES) {
    return { ok: false, reason: 'code_used_up', message: 'This group code has been used the most times it can be. Ask your friend to start a new group.' };
  }
  return { ok: true, already: false };
}

// ── Abuse flags ──────────────────────────────────────────────────────────────

export interface FlagMember {
  userId: string;
  /** When the ACCOUNT was created. */
  createdAt: Date;
  /** Paystack card signatures of the member's saved cards. */
  cardSignatures: string[];
  /** A one-way hash of network and browser, recorded when the member joined. Never an IP address. */
  device?: string | null;
}

export interface GroupFlagFinding {
  /** Stable for the same two people and the same kind, so a finding an admin already cleared is not raised again. */
  key: string;
  kind: 'created_close' | 'shared_card' | 'shared_device';
  reason: string;
}

const pairKey = (kind: string, a: string, b: string) => `${kind}:${[a, b].sort().join('+')}`;

export function detectGroupFlags(members: FlagMember[]): GroupFlagFinding[] {
  const out: GroupFlagFinding[] = [];
  const windowMs = GROUP_FLAG_WINDOW_MINUTES * 60_000;
  for (let x = 0; x < members.length; x++) {
    for (let y = x + 1; y < members.length; y++) {
      const a = members[x];
      const b = members[y];
      if (Math.abs(a.createdAt.getTime() - b.createdAt.getTime()) <= windowMs) {
        out.push({ key: pairKey('created_close', a.userId, b.userId), kind: 'created_close', reason: `Two accounts were created within ${GROUP_FLAG_WINDOW_MINUTES} minutes of each other.` });
      }
      if (a.cardSignatures.some((s) => s && b.cardSignatures.includes(s))) {
        out.push({ key: pairKey('shared_card', a.userId, b.userId), kind: 'shared_card', reason: 'Two members saved the same card.' });
      }
      if (a.device && b.device && a.device === b.device) {
        out.push({ key: pairKey('shared_device', a.userId, b.userId), kind: 'shared_device', reason: 'Two members joined from the same device and network.' });
      }
    }
  }
  return out;
}

// ── Status ───────────────────────────────────────────────────────────────────

export type GroupStatus = 'forming' | 'active' | 'broken';

/** forming = never reached 3. active = 3 or more active now. broken = had reached 3 and is below it again. */
export function nextGroupStatus(activeCount: number, prev: GroupStatus): GroupStatus {
  if (isGroupComplete(activeCount)) return 'active';
  return prev === 'forming' ? 'forming' : 'broken';
}

export function describeStatus(status: GroupStatus, activeCount: number, flagged = false): string {
  if (flagged) return 'Your group is being checked by our team before the group price applies. You do not need to do anything.';
  if (status === 'active') return `Your group is complete. ${activeCount} members are active, so everyone gets the group price.`;
  const need = Math.max(0, GROUP_MIN - activeCount);
  if (status === 'broken') return `Your group has fewer than ${GROUP_MIN} active members. You have 14 days to bring in ${need} more before prices move back to solo.`;
  return `Your group is forming. ${need} more ${need === 1 ? 'friend' : 'friends'} need to start their trial to reach ${GROUP_MIN}.`;
}
