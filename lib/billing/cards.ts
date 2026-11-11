// lib/billing/cards.ts
// ─────────────────────────────────────────────────────────────────────────────
// Payment-method service (table payment_methods). Server-only.
// Authorization codes are secrets: encrypted with lib/crypto.ts, never returned to the
// client, never logged. Lists expose SAFE fields only. Every change writes a
// billing_events row and calls notify (which never throws).
//
// Exports
//   SafeCard                                  { id, brand, last4, expMonth, expYear, bank, isDefault, currency }
//   VERIFY_AMOUNT                             { NGN: 5000 (₦50), USD: 100 ($1) }, refunded straight after it verifies
//   A card belongs to the currency it was checked in, and is only ever charged in that currency.
//   addFromVerifiedTransaction(userId, tx)    -> { ok, card, added } | { ok:false, error }   (reusable card-channel only, dedupe by signature)
//   listCards(userId)                         -> SafeCard[] (default first)
//   setDefaultCard(userId, cardId)            -> { ok } | { ok:false, error }
//   removeCard(userId, cardId)                -> { ok } | { ok:false, error }   (soft delete; last card protected while trial/active/grace)
//   startCardVerification(userId, email, returnTo, currency) -> { ok, authorizationUrl, reference } | { ok:false, error }
//   completeCardVerification(userId, ref)     -> { ok, card, added, refund } | { ok:false, error }   (verify, save, refund the check; idempotent)
//   getChargeableCard(userId, currency)       -> { id, authorizationCode, brand, last4 } | null   (SERVER ONLY, for the engine;
//                                                null when the default card is in another currency)
// ─────────────────────────────────────────────────────────────────────────────

import 'server-only';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { encryptSecret, decryptSecret } from '@/lib/crypto';
import { initializeTransaction, verifyTransaction, refund, type PaystackTx } from './paystack';
import { logBillingEvent } from './events';
import { notifyCardAdded, notifyCardRemoved, notifyCardDefaultChanged } from './notify';
import { isCurrency, type Currency } from './catalog';

/** The refunded card-check charge, in minor units of each currency. */
export const VERIFY_AMOUNT: Record<Currency, number> = { NGN: 5_000, USD: 100 };
/** Kept for older imports: the naira card check. */
export const VERIFY_AMOUNT_KOBO = VERIFY_AMOUNT.NGN;

export interface SafeCard {
  id: string;
  brand: string | null;
  last4: string | null;
  expMonth: string | null;
  expYear: string | null;
  bank: string | null;
  isDefault: boolean;
  currency: Currency;
}

type Row = {
  id: string; brand: string | null; last4: string | null; exp_month: string | null; exp_year: string | null;
  bank: string | null; is_default: boolean; created_at?: string; currency?: string | null;
};
const SAFE_COLUMNS = 'id, brand, last4, exp_month, exp_year, bank, is_default, created_at, currency';

const toSafe = (r: Row): SafeCard => ({
  id: r.id, brand: r.brand, last4: r.last4, expMonth: r.exp_month, expYear: r.exp_year, bank: r.bank, isDefault: !!r.is_default,
  currency: isCurrency(r.currency) ? r.currency : 'NGN',
});

const siteUrl = () => process.env.NEXT_PUBLIC_URL || 'https://joinascentor.com';

function txMetadata(tx: PaystackTx): Record<string, unknown> {
  const m = tx.metadata;
  if (!m) return {};
  if (typeof m === 'string') { try { return JSON.parse(m) as Record<string, unknown>; } catch { return {}; } }
  return m;
}

export async function listCards(userId: string): Promise<SafeCard[]> {
  const { data, error } = await supabaseAdmin
    .from('payment_methods').select(SAFE_COLUMNS).eq('user_id', userId).is('removed_at', null)
    .order('is_default', { ascending: false }).order('created_at', { ascending: false });
  if (error) { console.error('[billing/cards] list failed:', error.message); return []; }
  return ((data ?? []) as Row[]).map(toSafe);
}

export async function addFromVerifiedTransaction(
  userId: string,
  tx: PaystackTx,
): Promise<{ ok: true; card: SafeCard; added: boolean } | { ok: false; error: string }> {
  if (tx.status !== 'success') return { ok: false, error: 'The card check did not go through.' };
  const meta = txMetadata(tx);
  if (meta.user_id && meta.user_id !== userId) return { ok: false, error: 'This card check belongs to another account.' };
  const a = tx.authorization;
  if (!a || !a.authorization_code) return { ok: false, error: 'We could not save this card.' };
  if ((a.channel ?? tx.channel) !== 'card') return { ok: false, error: 'Only debit or credit cards can be saved.' };
  if (a.reusable !== true) return { ok: false, error: 'This card cannot be saved for repeat payments. Please try another card.' };

  if (!isCurrency(tx.currency)) return { ok: false, error: 'We could not save this card.' };
  const currency: Currency = tx.currency;
  const existing = await listCards(userId);
  if (a.signature) {
    const { data: dup } = await supabaseAdmin
      .from('payment_methods').select(SAFE_COLUMNS).eq('user_id', userId).eq('signature', a.signature).is('removed_at', null).maybeSingle();
    if (dup) return { ok: true, card: toSafe(dup as Row), added: false };
  }

  const insert = {
    user_id: userId,
    paystack_customer_code: tx.customer?.customer_code ?? null,
    auth_enc: encryptSecret(a.authorization_code),
    signature: a.signature ?? null,
    brand: a.brand ?? a.card_type ?? null,
    last4: a.last4 ?? null,
    exp_month: a.exp_month ?? null,
    exp_year: a.exp_year ?? null,
    bank: a.bank ?? null,
    card_type: a.card_type ?? null,
    country_code: a.country_code ?? null,
    reusable: true,
    currency,
    is_default: false,
  };
  const takeOver = await shouldBecomeDefault(userId, existing, currency);
  if (takeOver.unsetId) {
    // One default per member is enforced by a partial unique index, so the old default is unset before the insert.
    const off = await supabaseAdmin.from('payment_methods').update({ is_default: false }).eq('id', takeOver.unsetId).eq('user_id', userId);
    if (off.error) takeOver.makeDefault = false;
  }
  insert.is_default = takeOver.makeDefault;
  const { data, error } = await supabaseAdmin.from('payment_methods').insert(insert).select(SAFE_COLUMNS).single();
  if ((error || !data) && takeOver.unsetId && takeOver.makeDefault) {
    await supabaseAdmin.from('payment_methods').update({ is_default: true }).eq('id', takeOver.unsetId).eq('user_id', userId);
  }
  if (error || !data) {
    if (error?.code === '23505' && a.signature) {
      // Two requests (callback and webhook) raced: the other one saved it.
      const { data: dup } = await supabaseAdmin
        .from('payment_methods').select(SAFE_COLUMNS).eq('user_id', userId).eq('signature', a.signature).is('removed_at', null).maybeSingle();
      if (dup) return { ok: true, card: toSafe(dup as Row), added: false };
    }
    console.error('[billing/cards] insert failed:', error?.message);
    return { ok: false, error: 'We could not save this card. Please try again.' };
  }
  const card = toSafe(data as Row);
  await syncSubscriptionCard(userId);
  await logBillingEvent(userId, 'card_added', { card_id: card.id, brand: card.brand, last4: card.last4, is_default: card.isDefault });
  await notifyCardAdded(userId, { brand: card.brand, last4: card.last4 });
  return { ok: true, card, added: true };
}

/**
 * A new card becomes the default when there is none, or when the current default is in another currency and the member
 * is not paying a subscription in that other currency (a member now billed in USD can always make their new USD card the
 * one that is charged). `unsetId` is the old default to switch off first.
 */
async function shouldBecomeDefault(userId: string, existing: SafeCard[], currency: Currency): Promise<{ makeDefault: boolean; unsetId: string | null }> {
  const def = existing.find((c) => c.isDefault);
  if (!def) return { makeDefault: true, unsetId: null };
  if (def.currency === currency) return { makeDefault: false, unsetId: null };
  const { data } = await supabaseAdmin.from('member_subscriptions').select('currency').eq('user_id', userId).maybeSingle();
  const subCurrency = (data as { currency?: string } | null)?.currency;
  if (subCurrency && subCurrency !== currency) return { makeDefault: false, unsetId: null };
  return { makeDefault: true, unsetId: def.id };
}

/** Keeps member_subscriptions.payment_method_id pointing at the current default card. */
async function syncSubscriptionCard(userId: string): Promise<void> {
  const { data: def } = await supabaseAdmin
    .from('payment_methods').select('id').eq('user_id', userId).eq('is_default', true).is('removed_at', null).maybeSingle();
  await supabaseAdmin.from('member_subscriptions')
    .update({ payment_method_id: (def as { id: string } | null)?.id ?? null, updated_at: new Date().toISOString() })
    .eq('user_id', userId);
}

export async function setDefaultCard(userId: string, cardId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: card } = await supabaseAdmin
    .from('payment_methods').select(SAFE_COLUMNS).eq('id', cardId).eq('user_id', userId).is('removed_at', null).maybeSingle();
  if (!card) return { ok: false, error: 'Card not found.' };
  if ((card as Row).is_default) return { ok: true };
  const { data: subRow } = await supabaseAdmin.from('member_subscriptions').select('currency, state').eq('user_id', userId).maybeSingle();
  const sub = subRow as { currency?: string; state?: string } | null;
  const cardCurrency = isCurrency((card as Row).currency) ? (card as Row).currency : 'NGN';
  if (sub?.currency && sub.currency !== cardCurrency && ['trial', 'active', 'grace'].includes(sub.state ?? '')) {
    return { ok: false, error: `Your plan is billed in ${sub.currency === 'USD' ? 'US dollars' : 'naira'}, so the card it charges must be one you added in ${sub.currency === 'USD' ? 'US dollars' : 'naira'}.` };
  }
  // Unset first: at most one default per member is enforced by a partial unique index.
  const off = await supabaseAdmin.from('payment_methods').update({ is_default: false }).eq('user_id', userId).eq('is_default', true).is('removed_at', null);
  if (off.error) return { ok: false, error: 'We could not change your default card.' };
  const on = await supabaseAdmin.from('payment_methods').update({ is_default: true }).eq('id', cardId).eq('user_id', userId);
  if (on.error) return { ok: false, error: 'We could not change your default card.' };
  await syncSubscriptionCard(userId);
  const c = card as Row;
  await logBillingEvent(userId, 'card_default_changed', { card_id: c.id, brand: c.brand, last4: c.last4 });
  await notifyCardDefaultChanged(userId, { brand: c.brand, last4: c.last4 });
  return { ok: true };
}

export async function removeCard(userId: string, cardId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const cards = await listCards(userId);
  const card = cards.find((c) => c.id === cardId);
  if (!card) return { ok: false, error: 'Card not found.' };

  if (cards.length === 1) {
    const { data: sub } = await supabaseAdmin
      .from('member_subscriptions').select('state, cancel_at_period_end').eq('user_id', userId).maybeSingle();
    const s = sub as { state: string; cancel_at_period_end: boolean } | null;
    if (s && ['trial', 'active', 'grace'].includes(s.state) && !s.cancel_at_period_end) {
      return { ok: false, error: 'This is your only card and your subscription needs one. Add another card first, or cancel your subscription.' };
    }
  }

  // The stored authorization is overwritten, not just hidden: a removed card can never be charged again.
  const { error } = await supabaseAdmin
    .from('payment_methods').update({ removed_at: new Date().toISOString(), is_default: false, auth_enc: 'removed' }).eq('id', cardId).eq('user_id', userId).is('removed_at', null);
  if (error) return { ok: false, error: 'We could not remove this card.' };

  if (card.isDefault) {
    const next = cards.filter((c) => c.id !== cardId)[0]; // list is default-first then newest-first, so [0] is the newest remaining
    if (next) await supabaseAdmin.from('payment_methods').update({ is_default: true }).eq('id', next.id).eq('user_id', userId);
  }
  await syncSubscriptionCard(userId);
  await logBillingEvent(userId, 'card_removed', { card_id: card.id, brand: card.brand, last4: card.last4 });
  await notifyCardRemoved(userId, { brand: card.brand, last4: card.last4 });
  return { ok: true };
}

export async function startCardVerification(
  userId: string,
  email: string,
  returnTo: 'settings' | 'checkout' = 'settings',
  currency: Currency = 'NGN',
): Promise<{ ok: true; authorizationUrl: string; reference: string } | { ok: false; error: string }> {
  const reference = `cv_${userId.replace(/-/g, '').slice(0, 12)}_${Date.now().toString(36)}`;
  const r = await initializeTransaction({
    email,
    amountKobo: VERIFY_AMOUNT[currency],
    currency,
    reference,
    callbackUrl: `${siteUrl()}${returnTo === 'checkout' ? '/checkout' : '/settings/billing'}?card=verify`,
    purpose: 'card_verify',
    metadata: { user_id: userId },
  });
  if (!r.ok) return { ok: false, error: 'We could not start the card check. Please try again.' };
  return { ok: true, authorizationUrl: r.data.authorization_url, reference: r.data.reference };
}

/**
 * Verifies the card check (₦50 or $1) with Paystack (never trusts the client or a webhook body), saves the card in that
 * currency, and refunds the check. Safe to call twice (callback + webhook): the card is deduped by signature and the refund
 * is recorded once.
 */
export async function completeCardVerification(
  userId: string,
  reference: string,
): Promise<
  | { ok: true; card: SafeCard; added: boolean; refund: 'refunded' | 'already_refunded' | 'failed' }
  | { ok: false; error: string; retryable?: boolean }
> {
  if (!reference || reference.length > 200) return { ok: false, error: 'Invalid reference.' };
  const v = await verifyTransaction(reference);
  if (!v.ok) return { ok: false, error: 'We could not confirm the card check yet. Please try again in a moment.', retryable: v.transient };
  const tx = v.data;
  const meta = txMetadata(tx);
  if (meta.purpose !== 'card_verify' || meta.user_id !== userId) return { ok: false, error: 'This is not a card check for your account.' };
  if (!isCurrency(tx.currency) || tx.amount !== VERIFY_AMOUNT[tx.currency]) return { ok: false, error: 'Unexpected card check amount.' };

  // Once refunded, Paystack may report the transaction as 'reversed'. The webhook and the browser callback can arrive in either
  // order, so if this reference was already processed, answer with the saved card instead of an error.
  const sig = tx.authorization?.signature;
  if (sig && (await refundAlreadyRecorded(userId, reference))) {
    const { data: saved } = await supabaseAdmin
      .from('payment_methods').select(SAFE_COLUMNS).eq('user_id', userId).eq('signature', sig).is('removed_at', null).maybeSingle();
    if (saved) return { ok: true, card: toSafe(saved as Row), added: false, refund: 'already_refunded' };
  }
  if (tx.status !== 'success') return { ok: false, error: 'The card check did not go through.' };

  const added = await addFromVerifiedTransaction(userId, tx);
  // Whether or not the card could be saved, the check amount goes back.
  const refundState = await refundVerification(userId, tx);
  if (!added.ok) return added;
  return { ok: true, card: added.card, added: added.added, refund: refundState };
}

async function refundAlreadyRecorded(userId: string, reference: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from('billing_events').select('id').eq('user_id', userId).eq('type', 'card_verify_refunded').contains('data', { reference }).limit(1);
  return !!(data && data.length);
}

async function refundVerification(userId: string, tx: PaystackTx): Promise<'refunded' | 'already_refunded' | 'failed'> {
  if (await refundAlreadyRecorded(userId, tx.reference)) return 'already_refunded';
  const r = await refund({ transaction: tx.reference, amountKobo: tx.amount });
  if (!r.ok) {
    console.error('[billing/cards] verification refund failed:', tx.reference, r.error);
    await logBillingEvent(userId, 'card_verify_refund_failed', { reference: tx.reference, error: r.error });
    return 'failed';
  }
  await logBillingEvent(userId, 'card_verify_refunded', { reference: tx.reference, amount_kobo: tx.amount, status: r.data.status ?? null });
  return 'refunded';
}

/**
 * SERVER ONLY. The default card's decrypted authorization code, for the renewal engine. Never return this to a client or log it.
 * Returns null when the default card was checked in another currency: a card is never charged in a currency it was not saved in.
 */
export async function getChargeableCard(userId: string, currency: Currency = 'NGN'): Promise<{ id: string; authorizationCode: string; brand: string | null; last4: string | null } | null> {
  const { data } = await supabaseAdmin
    .from('payment_methods').select('id, auth_enc, brand, last4, currency').eq('user_id', userId).eq('is_default', true).is('removed_at', null).maybeSingle();
  const row = data as { id: string; auth_enc: string; brand: string | null; last4: string | null; currency: string | null } | null;
  if (!row) return null;
  if ((row.currency ?? 'NGN') !== currency) {
    console.error('[billing/cards] default card currency does not match the subscription (card', row.id, ')');
    return null;
  }
  try {
    return { id: row.id, authorizationCode: decryptSecret(row.auth_enc), brand: row.brand, last4: row.last4 };
  } catch {
    console.error('[billing/cards] could not decrypt a stored authorization (card', row.id, ')');
    return null;
  }
}
