import 'server-only';
// lib/summit-access.ts
// Elevation Summit attendees: Ascentor Builder free for 12 months, claimed at /summit-access.
//
//   The approved list is summit_access_grants (one row per email). Rows come from people who emailed
//   joinascentor@gmail.com after the Summit, from scanned check-ins, and from admins (Admin → Registrations → Free year).
//   Claim flow: email (must be on the list) -> 6-digit code to that email -> choose a password -> account created,
//   free year added, signed in. Someone who already has an account only proves the email with the code; the year is
//   added to that account and they sign in as usual.
//   The free year uses the reward machinery (grantMonths): a never-charged plan that ends on its own.

import { createHmac, timingSafeEqual } from 'node:crypto';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { grantMonths } from '@/lib/rewards/access-codes';

export const SUMMIT_GIFT_SOURCE = 'summit_attendee';
export const CLAIM_TOKEN_MINUTES = 20;

export interface Grant {
  email: string; name: string | null; source: string; tier: string; months: number; note: string | null;
  added_at: string; invited_at: string | null; claimed_user_id: string | null; claimed_at: string | null;
  access_until: string | null; revoked_at: string | null;
}

export const cleanEmail = (v: unknown) => String(v ?? '').trim().toLowerCase();

/** The live (not revoked) grant for this email, or null. */
export async function findGrant(email: string): Promise<Grant | null> {
  const { data, error } = await supabaseAdmin.from('summit_access_grants').select('*').eq('email', cleanEmail(email)).is('revoked_at', null).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Grant | null) ?? null;
}

/**
 * Adds the free year to this account and marks the grant claimed. Idempotent: a grant already claimed by this user
 * returns its saved end date without adding time again; one claimed by another account is refused.
 */
export async function claimGrant(email: string, userId: string, now = new Date()): Promise<{ ok: true; until: string; already: boolean } | { ok: false; reason: 'not_listed' | 'taken' }> {
  const g = await findGrant(email);
  if (!g) return { ok: false, reason: 'not_listed' };
  if (g.claimed_user_id) {
    if (g.claimed_user_id !== userId) return { ok: false, reason: 'taken' };
    return { ok: true, until: g.access_until ?? now.toISOString(), already: true };
  }
  // Mark it first (only if still unclaimed), so two quick submits can never add two years.
  const { data: won, error } = await supabaseAdmin.from('summit_access_grants')
    .update({ claimed_user_id: userId, claimed_at: now.toISOString() })
    .eq('email', g.email).is('claimed_user_id', null).is('revoked_at', null).select('email');
  if (error) throw new Error(error.message);
  if (!won?.length) return claimGrant(email, userId, now);
  try {
    const r = await grantMonths(userId, g.tier, g.months, SUMMIT_GIFT_SOURCE, now);
    await supabaseAdmin.from('summit_access_grants').update({ access_until: r.until }).eq('email', g.email);
    return { ok: true, until: r.until, already: false };
  } catch (e) {
    // Undo the mark so they can try again.
    await supabaseAdmin.from('summit_access_grants').update({ claimed_user_id: null, claimed_at: null }).eq('email', g.email).eq('claimed_user_id', userId);
    throw e;
  }
}

// ── Claim token: proves the code was right, for the "choose a password" step. ───────────────────────

const secret = () => {
  const s = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!s) throw new Error('missing server secret');
  return s;
};
const sign = (payload: string) => createHmac('sha256', secret()).update(`summit-access:${payload}`).digest('base64url');

export function makeClaimToken(email: string, now = Date.now()): string {
  const payload = `${cleanEmail(email)}|${now + CLAIM_TOKEN_MINUTES * 60_000}`;
  return `${Buffer.from(payload).toString('base64url')}.${sign(payload)}`;
}

/** The email inside a valid, unexpired token, or null. */
export function readClaimToken(token: unknown, now = Date.now()): string | null {
  if (typeof token !== 'string' || token.length > 600) return null;
  const [b64, mac] = token.split('.');
  if (!b64 || !mac) return null;
  let payload: string;
  try { payload = Buffer.from(b64, 'base64url').toString('utf8'); } catch { return null; }
  const want = Buffer.from(sign(payload));
  const got = Buffer.from(mac);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
  const [email, exp] = payload.split('|');
  if (!email || !(Number(exp) > now)) return null;
  return email;
}
