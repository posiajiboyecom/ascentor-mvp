import 'server-only';
// lib/rewards/access-codes.ts
// Reward codes: one-use codes that give a member a paid plan for N months with no card and no charge.
// Used for the Elevation Summit referral prize: everyone with REFERRAL_GOAL (10) confirmed referrals wins
// Builder for 2 months; people an admin marks "above and beyond" get 3 months.
//
// How a reward is stored: a member_subscriptions row in state 'cancelled' with period_end in the future and
// gift_source set. The access rules give 'cancelled' full access until period_end and light access after it,
// and the billing engine only ever processes trial / active / grace rows, so a reward can never be charged.

import { randomInt } from 'crypto';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getSubscription, syncProfile } from '@/lib/billing/subscriptions';
import { logBillingEvent } from '@/lib/billing/events';
import { REFERRAL_GOAL } from '@/lib/summitReferralPublicTypes';

export const SUMMIT_SOURCE = 'summit_referral';
export const WINNER_MONTHS = 2;
export const ABOVE_MONTHS = 3;
export const REWARD_TIER = 'builder' as const;
/** Codes can be used until the end of March 2027 (Lagos time). */
export const REDEEM_BY = '2027-03-31T22:59:59Z';

// No 0/O, 1/I/L: easy to read out on stage or type from an email.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const block = (n: number) => Array.from({ length: n }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');
export const newCode = () => `TES-${block(4)}-${block(4)}`;
/** "tes abcd efgh" / "TES-ABCD-EFGH" -> "TES-ABCD-EFGH". */
export function cleanCode(raw: string | null | undefined): string {
  const s = String(raw ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return s.length === 11 && s.startsWith('TES') ? `TES-${s.slice(3, 7)}-${s.slice(7)}` : s;
}

export function addMonths(from: Date, months: number): Date {
  const d = new Date(from.getTime());
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return d;
}

export interface AccessCodeRow {
  id: string; code: string; tier: string; months: number; source: string; registration_id: string | null;
  recipient_name: string | null; recipient_email: string | null; above_and_beyond: boolean;
  emailed_at: string | null; emailed_months: number | null; redeem_by: string | null; redeemed_by: string | null; redeemed_at: string | null;
}

// ── Summit winners ─────────────────────────────────────────────────────────────────────────────────

export interface Winner {
  registrationId: string; name: string; email: string; confirmed: number;
  code: AccessCodeRow | null;
}

/** Everyone with REFERRAL_GOAL or more confirmed referrals, most first, with their reward code if one exists. */
export async function listSummitWinners(): Promise<Winner[]> {
  const { data: refs, error } = await supabaseAdmin.from('summit_referrals').select('referrer_id').eq('status', 'verified').limit(20000);
  if (error) throw new Error(error.message);
  const counts = new Map<string, number>();
  for (const r of refs ?? []) counts.set(r.referrer_id as string, (counts.get(r.referrer_id as string) ?? 0) + 1);
  const ids = [...counts.entries()].filter(([, n]) => n >= REFERRAL_GOAL).map(([id]) => id);
  if (!ids.length) return [];
  const [{ data: regs }, { data: codes }] = await Promise.all([
    supabaseAdmin.from('summit_registrations').select('id, full_name, email').in('id', ids).eq('payment_status', 'paid'),
    supabaseAdmin.from('access_codes').select('*').in('registration_id', ids),
  ]);
  const byReg = new Map(((codes ?? []) as AccessCodeRow[]).map((c) => [c.registration_id, c]));
  return ((regs ?? []) as { id: string; full_name: string | null; email: string | null }[])
    .map((r) => ({ registrationId: r.id, name: (r.full_name || '').trim() || 'Summit guest', email: (r.email || '').trim(), confirmed: counts.get(r.id) ?? 0, code: byReg.get(r.id) ?? null }))
    .sort((a, b) => b.confirmed - a.confirmed || a.name.localeCompare(b.name));
}

/** The winner's code, created on first ask. Months follow the "above and beyond" flag. */
export async function ensureWinnerCode(w: { registrationId: string; name: string; email: string }, aboveAndBeyond?: boolean): Promise<AccessCodeRow> {
  const { data: have } = await supabaseAdmin.from('access_codes').select('*').eq('registration_id', w.registrationId).maybeSingle();
  if (have) return have as AccessCodeRow;
  for (let i = 0; i < 5; i++) {
    const above = !!aboveAndBeyond;
    const { data, error } = await supabaseAdmin.from('access_codes').insert({
      code: newCode(), tier: REWARD_TIER, months: above ? ABOVE_MONTHS : WINNER_MONTHS, source: SUMMIT_SOURCE,
      registration_id: w.registrationId, recipient_name: w.name, recipient_email: w.email, above_and_beyond: above, redeem_by: REDEEM_BY,
    }).select('*').maybeSingle();
    if (data) return data as AccessCodeRow;
    if (error?.code !== '23505') throw new Error(error?.message || 'Could not create a code.');
    // 23505: the code itself clashed (try another) or another press created this winner's code (use it).
    const { data: again } = await supabaseAdmin.from('access_codes').select('*').eq('registration_id', w.registrationId).maybeSingle();
    if (again) return again as AccessCodeRow;
  }
  throw new Error('Could not create a unique code. Please try again.');
}

/** Marks or unmarks a winner as "above and beyond" (3 months instead of 2). Not allowed once the code is used. */
export async function setAboveAndBeyond(w: { registrationId: string; name: string; email: string }, on: boolean): Promise<AccessCodeRow> {
  const code = await ensureWinnerCode(w, on);
  if (code.redeemed_at) throw new Error('This code has already been used, so its length can’t change.');
  const { data, error } = await supabaseAdmin.from('access_codes')
    .update({ above_and_beyond: on, months: on ? ABOVE_MONTHS : WINNER_MONTHS, updated_at: new Date().toISOString() })
    .eq('id', code.id).is('redeemed_at', null).select('*').maybeSingle();
  if (error || !data) throw new Error('Could not update this reward. Please try again.');
  return data as AccessCodeRow;
}

// ── Redeeming ──────────────────────────────────────────────────────────────────────────────────────

export type RedeemResult =
  | { ok: true; tier: string; months: number; until: string; extendedPaidPlan: boolean }
  | { ok: false; error: string };

const PLAN_CODE: Record<string, string> = { explorer: 'seeker_solo_monthly', builder: 'builder_solo_monthly', pinnacle: 'pinnacle_solo_monthly' };
const TIER_NAME: Record<string, string> = { explorer: 'Seeker', builder: 'Builder', pinnacle: 'Pinnacle' };
export const tierName = (t: string) => TIER_NAME[t] ?? 'Builder';

/** Uses a code for this member. One use per code; a member can use more than one code (the months add up). */
export async function redeemCode(userId: string, raw: string, now = new Date()): Promise<RedeemResult> {
  const code = cleanCode(raw);
  if (!code) return { ok: false, error: 'Type your code.' };

  const { data: found } = await supabaseAdmin.from('access_codes').select('*').eq('code', code).maybeSingle();
  const row = found as AccessCodeRow | null;
  if (!row) return { ok: false, error: 'That code isn’t right. Check it and try again.' };
  if (row.redeemed_at) return { ok: false, error: row.redeemed_by === userId ? 'You’ve already used this code. Your reward is on your plan.' : 'This code has already been used.' };
  if (row.redeem_by && new Date(row.redeem_by).getTime() < now.getTime()) return { ok: false, error: 'This code has expired.' };

  // Claim it first, so two presses (or two people) can never both use it.
  const stamp = now.toISOString();
  const { data: claimed } = await supabaseAdmin.from('access_codes')
    .update({ redeemed_by: userId, redeemed_at: stamp, updated_at: stamp })
    .eq('id', row.id).is('redeemed_at', null).select('id').maybeSingle();
  if (!claimed) return { ok: false, error: 'This code has already been used.' };

  try {
    const out = await grantMonths(userId, row.tier, row.months, row.source, now);
    await logBillingEvent(userId, 'reward_redeemed', { code_id: row.id, tier: row.tier, months: row.months, source: row.source, until: out.until, extended_paid_plan: out.extendedPaidPlan });
    return { ok: true, tier: row.tier, months: row.months, until: out.until, extendedPaidPlan: out.extendedPaidPlan };
  } catch (e) {
    // Give the code back so it can be tried again.
    await supabaseAdmin.from('access_codes').update({ redeemed_by: null, redeemed_at: null, updated_at: new Date().toISOString() }).eq('id', row.id);
    console.error('[rewards] grant failed:', e instanceof Error ? e.message : 'unknown');
    return { ok: false, error: 'We couldn’t add your reward just now. Your code still works: please try again.' };
  }
}

async function grantMonths(userId: string, tier: string, months: number, source: string, now: Date): Promise<{ until: string; extendedPaidPlan: boolean }> {
  const sub = await getSubscription(userId);
  const stamp = now.toISOString();

  // Already paying: push the next charge back by the free months and keep their plan as it is.
  if (sub && (sub.state === 'active' || sub.state === 'grace') && !sub.cancelAtPeriodEnd) {
    const from = sub.periodEnd && sub.periodEnd > now ? sub.periodEnd : now;
    const until = addMonths(from, months);
    const nextCharge = addMonths(sub.nextChargeAt && sub.nextChargeAt > now ? sub.nextChargeAt : from, months);
    const { error } = await supabaseAdmin.from('member_subscriptions').update({
      state: 'active', period_end: until.toISOString(), next_charge_at: nextCharge.toISOString(),
      failed_count: 0, last_failed_at: null, grace_ends_at: null, updated_at: stamp,
    }).eq('user_id', userId);
    if (error) throw error;
    await syncProfile(userId, now);
    return { until: until.toISOString(), extendedPaidPlan: true };
  }

  // Everyone else (no plan, trial, cancelled, lapsed, an earlier reward): a reward period that is never charged.
  // An unexpired reward is extended from its end date, so two codes add up.
  const from = sub?.state === 'cancelled' && sub.periodEnd && sub.periodEnd > now ? sub.periodEnd : now;
  const until = addMonths(from, months);
  const keepHigher = sub?.state === 'cancelled' && sub.periodEnd && sub.periodEnd > now && sub.tier === 'pinnacle' ? 'pinnacle' : tier;
  const { error } = await supabaseAdmin.from('member_subscriptions').upsert({
    user_id: userId, plan_code: PLAN_CODE[keepHigher] ?? PLAN_CODE.builder, tier: keepHigher, price_type: 'solo', cycle: 'monthly',
    currency: sub?.currency ?? 'NGN', state: 'cancelled', trial_ends_at: null, next_charge_at: null, period_end: until.toISOString(),
    failed_count: 0, last_failed_at: null, grace_ends_at: null, cancel_at_period_end: true,
    started_at: sub?.startedAt?.toISOString() ?? stamp, gift_source: source, updated_at: stamp,
  }, { onConflict: 'user_id' });
  if (error) throw error;
  await syncProfile(userId, now);
  return { until: until.toISOString(), extendedPaidPlan: false };
}
