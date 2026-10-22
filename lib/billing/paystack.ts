// lib/billing/paystack.ts
// ─────────────────────────────────────────────────────────────────────────────
// Thin SERVER-ONLY Paystack client for billing v2. Every call returns a typed
// result ({ ok: true, data } or { ok: false, error, ... }) and never throws, so a
// Paystack outage can not crash a cron run or a route. Secrets, authorization
// codes and card data are never logged.
//
// Exports
//   PaystackResult<T>                       { ok:true; data:T } | { ok:false; error:string; status?:number; transient:boolean }
//   PaystackAuthorization, PaystackTx       payload shapes we read
//   isTestMode()                            true when the secret key starts with sk_test_
//   initializeTransaction({email, amountKobo, reference?, callbackUrl, purpose, metadata?})
//        card channel only; metadata.purpose = 'card_verify' | 'subscription_charge'
//   verifyTransaction(reference)
//   chargeAuthorization({email, amountKobo, authorizationCode, reference, metadata?})
//        idempotent: reusing a reference never charges twice (Paystack rejects duplicates);
//        a duplicate-reference reply is resolved by verifying that reference.
//   refund({transaction, amountKobo?})      transaction = reference or numeric id
// ─────────────────────────────────────────────────────────────────────────────

import 'server-only';

const BASE = 'https://api.paystack.co';

export type PaystackResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status?: number; transient: boolean };

export interface PaystackAuthorization {
  authorization_code: string;
  bin?: string | null;
  last4?: string | null;
  exp_month?: string | null;
  exp_year?: string | null;
  channel?: string | null;
  card_type?: string | null;
  bank?: string | null;
  country_code?: string | null;
  brand?: string | null;
  reusable?: boolean;
  signature?: string | null;
}

export interface PaystackTx {
  id: number;
  status: string; // success | failed | abandoned | ongoing | pending | reversed
  reference: string;
  amount: number;
  currency: string;
  channel?: string | null;
  paid_at?: string | null;
  fees?: number | null;
  gateway_response?: string | null;
  message?: string | null;
  metadata?: Record<string, unknown> | string | null;
  authorization?: PaystackAuthorization | null;
  customer?: { email?: string; customer_code?: string } | null;
}

export type BillingPurpose = 'card_verify' | 'subscription_charge';

function secretKey(): string | null {
  const k = process.env.PAYSTACK_SECRET_KEY;
  return k && k.trim() ? k.trim() : null;
}

export function isTestMode(): boolean {
  return (secretKey() ?? '').startsWith('sk_test_');
}

async function call<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<PaystackResult<T>> {
  const key = secretKey();
  if (!key) return { ok: false, error: 'Paystack is not configured', transient: false };
  try {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers: { Authorization: `Bearer ${key}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store',
      signal: AbortSignal.timeout(20_000),
    });
    const json = (await res.json().catch(() => null)) as { status?: boolean; message?: string; data?: T } | null;
    if (res.ok && json?.status && json.data !== undefined) return { ok: true, data: json.data };
    return {
      ok: false,
      error: String(json?.message ?? `Paystack returned ${res.status}`),
      status: res.status,
      // 5xx and rate limits are worth retrying; a 4xx refusal is final.
      transient: res.status >= 500 || res.status === 429,
    };
  } catch (e) {
    // Never include the request (it carries the key header): only the error name and message.
    const msg = e instanceof Error ? `${e.name}: ${e.message}` : 'network error';
    console.error('[billing/paystack] request failed:', method, path.replace(/\/verify\/.*/, '/verify/<ref>'), msg);
    return { ok: false, error: 'Could not reach Paystack', transient: true };
  }
}

export function initializeTransaction(i: {
  email: string;
  amountKobo: number;
  reference?: string;
  callbackUrl: string;
  purpose: BillingPurpose;
  metadata?: Record<string, unknown>;
}): Promise<PaystackResult<{ authorization_url: string; access_code: string; reference: string }>> {
  return call('POST', '/transaction/initialize', {
    email: i.email,
    amount: i.amountKobo,
    currency: 'NGN',
    ...(i.reference ? { reference: i.reference } : {}),
    callback_url: i.callbackUrl,
    channels: ['card'],
    metadata: { ...(i.metadata ?? {}), purpose: i.purpose },
  });
}

export function verifyTransaction(reference: string): Promise<PaystackResult<PaystackTx>> {
  return call('GET', `/transaction/verify/${encodeURIComponent(reference)}`);
}

/**
 * Charges a saved card. `reference` makes it idempotent: Paystack refuses a reference it has already seen, in which
 * case we look the original up and return ITS outcome instead of an error, so a repeated cron run never double charges.
 */
export async function chargeAuthorization(i: {
  email: string;
  amountKobo: number;
  authorizationCode: string;
  reference: string;
  metadata?: Record<string, unknown>;
}): Promise<PaystackResult<PaystackTx>> {
  const r = await call<PaystackTx>('POST', '/transaction/charge_authorization', {
    email: i.email,
    amount: i.amountKobo,
    currency: 'NGN',
    authorization_code: i.authorizationCode,
    reference: i.reference,
    metadata: { ...(i.metadata ?? {}), purpose: 'subscription_charge' },
  });
  if (!r.ok && /duplicate/i.test(r.error)) {
    const v = await verifyTransaction(i.reference);
    if (v.ok) return v;
  }
  return r;
}

export function refund(i: { transaction: string | number; amountKobo?: number }): Promise<PaystackResult<{ id?: number; status?: string; amount?: number }>> {
  return call('POST', '/refund', {
    transaction: i.transaction,
    ...(i.amountKobo ? { amount: i.amountKobo } : {}),
  });
}
