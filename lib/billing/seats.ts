import 'server-only';
// lib/billing/seats.ts
// ─────────────────────────────────────────────────────────────────────────────
// Circle seats for billing v2 (handoff, Proposed): the seat is released when the 7 day grace ends, and the member's record is
// kept so coming back is easy. Reactivation re-seats them if the seat is still free, else they wait for a Circle.
//
// The repo's seat model: public.circle_seats (circle_id, user_id, role, joined_at, pledged_at). A member seat is released by
// deleting that row; joining goes through the rx_join_circle SQL function (locks the Circle, caps eight seats and three Circles
// per member, and starts the 90 day cycle at four members). Nothing else about the member is touched: their Circle messages,
// reports, check-ins and growth record all stay.
//
// Exports
//   seatsToRelease(userId)          -> the member seats that WOULD be released (read only)
//   releaseSeats(userId)            -> deletes the member seats, logs 'seat_released' with what is needed to restore them
//   restoreSeats(userId)            -> re-seats a reactivated member: 'restored' | 'waiting' | 'none'
//   Both mutating calls are for BILLING_V2_CHARGING=live only: the caller checks the mode (dry mode logs and never calls them).
// ─────────────────────────────────────────────────────────────────────────────

import { supabaseAdmin } from '@/lib/supabase/admin';
import { CIRCLES_PER_MEMBER } from '@/lib/rx/constants';
import { logBillingEvent } from './events';

export interface SeatRecord { circle_id: string; joined_at: string; pledged_at: string | null }

export async function seatsToRelease(userId: string): Promise<SeatRecord[]> {
  const { data } = await supabaseAdmin.from('circle_seats').select('circle_id, joined_at, pledged_at').eq('user_id', userId).eq('role', 'member').order('joined_at', { ascending: true });
  return (data ?? []) as SeatRecord[];
}

export async function releaseSeats(userId: string): Promise<{ released: number }> {
  const seats = await seatsToRelease(userId);
  if (!seats.length) return { released: 0 };
  const { error } = await supabaseAdmin.from('circle_seats').delete().eq('user_id', userId).eq('role', 'member').in('circle_id', seats.map((s) => s.circle_id));
  if (error) throw new Error(`seat release failed: ${error.message}`);
  await logBillingEvent(userId, 'seat_released', { reason: 'grace_ended', seats });
  return { released: seats.length };
}

async function lastEvent(userId: string, types: string[]): Promise<{ type: string; data: Record<string, unknown>; created_at: string } | null> {
  const { data } = await supabaseAdmin.from('billing_events').select('type, data, created_at').eq('user_id', userId).in('type', types).order('created_at', { ascending: false }).limit(1);
  return ((data ?? [])[0] as { type: string; data: Record<string, unknown>; created_at: string } | undefined) ?? null;
}

/**
 * A reactivated member gets each released seat back when the Circle still has room (same Circle, same join date, same pledge).
 * A seat that is gone (full, finished, or over the three Circle limit) leaves the member in "Waiting for a Circle": they have no
 * seat, are told so, and can be placed from the Circle page. Safe to call twice: it acts on the latest release only once.
 */
export async function restoreSeats(userId: string): Promise<'restored' | 'waiting' | 'none'> {
  const last = await lastEvent(userId, ['seat_released', 'seat_restored', 'circle_waiting']);
  if (!last || last.type !== 'seat_released') return 'none';
  const seats = ((last.data.seats ?? []) as SeatRecord[]).filter((s) => s && typeof s.circle_id === 'string');
  if (!seats.length) return 'none';

  const restored: string[] = [];
  const waiting: string[] = [];
  for (const s of seats) {
    const { data: res, error } = await supabaseAdmin.rpc('rx_join_circle', { p_user: userId, p_circle: s.circle_id, p_max: CIRCLES_PER_MEMBER });
    if (!error && (res === 'ok' || res === 'already')) {
      restored.push(s.circle_id);
      // Keep the original join date (the first Circle joined is the member's home Circle) and the pledge they already made.
      await supabaseAdmin.from('circle_seats').update({ joined_at: s.joined_at, pledged_at: s.pledged_at }).eq('circle_id', s.circle_id).eq('user_id', userId);
    } else {
      waiting.push(s.circle_id);
    }
  }
  if (restored.length) await logBillingEvent(userId, 'seat_restored', { circle_ids: restored, waiting_circle_ids: waiting });
  if (waiting.length) {
    await logBillingEvent(userId, 'circle_waiting', { circle_ids: waiting });
    await supabaseAdmin.from('notifications').insert({
      user_id: userId, type: 'billing', title: 'Waiting for a Circle',
      message: 'Welcome back. Your old Circle seat was taken while your plan was paused, so you are waiting for a new Circle. Open Circles and choose Place me in a Circle.',
      link: '/circle',
    }).then(({ error }) => { if (error) console.error('[billing/seats] waiting notice failed:', error.message); });
  }
  return waiting.length && !restored.length ? 'waiting' : 'restored';
}
