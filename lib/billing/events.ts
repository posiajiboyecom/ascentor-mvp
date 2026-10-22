// lib/billing/events.ts
// ─────────────────────────────────────────────────────────────────────────────
// Writes the billing audit log (table billing_events). Server-only. Never throws:
// a logging failure must not break a charge. Never put secrets, authorization
// codes or full card data in `data`.
//
// Exports
//   BillingEventType              every type we log (see docs/billing-v2-design.md)
//   logBillingEvent(userId, type, data?)  -> Promise<void>
// ─────────────────────────────────────────────────────────────────────────────

import 'server-only';
import { supabaseAdmin } from '@/lib/supabase/admin';

export type BillingEventType =
  | 'trial_started' | 'first_charge' | 'renewal_succeeded' | 'renewal_failed' | 'grace_started' | 'lapsed' | 'reactivated'
  | 'group_joined' | 'group_left' | 'group_price_applied' | 'group_price_removed' | 'group_below_min' | 'group_restored' | 'group_warning_sent' | 'group_flagged' | 'group_at_minimum'
  | 'credit_earned' | 'credit_used' | 'credit_expired' | 'credit_cancelled'
  | 'card_added' | 'card_removed' | 'card_default_changed'
  | 'would_charge' | 'charge_retry' | 'charge_skipped_credit' | 'first_charge_extended'
  | 'card_verify_refunded' | 'card_verify_refund_failed' | 'subscription_cancelled' | 'subscription_resumed' | 'plan_change_scheduled' | 'trial_ending_sent' | 'seat_release_pending'
  | 'seat_released' | 'seat_restored' | 'circle_waiting' | 'would_release_seat'
  | 'leader_cycle_ended' | 'would_end_leader_cycle'
  | 'group_admin_alert_sent' | 'would_alert_group' | 'would_warn_group';

export async function logBillingEvent(userId: string | null, type: BillingEventType, data: Record<string, unknown> = {}): Promise<void> {
  try {
    const { error } = await supabaseAdmin.from('billing_events').insert({ user_id: userId, type, data });
    if (error) console.error('[billing/events] insert failed:', type, error.message);
  } catch (e) {
    console.error('[billing/events] insert threw:', type, e instanceof Error ? e.message : 'unknown');
  }
}
