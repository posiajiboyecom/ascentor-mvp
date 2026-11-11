// lib/billing/currency.ts
// The currency a member is billed in. Server-only.
//
//   1. A member with a subscription (any state) keeps that subscription's currency, wherever they are now. Renewals,
//      reactivation, plan changes and card checks all use it, so a member who travels is never switched.
//   2. Otherwise it is where they are right now (lib/geo.ts): naira in Nigeria, US dollars everywhere else.

import 'server-only';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { isCurrency, type Currency } from './catalog';

export async function subscriptionCurrency(userId: string): Promise<Currency | null> {
  const { data } = await supabaseAdmin.from('member_subscriptions').select('currency').eq('user_id', userId).maybeSingle();
  const c = (data as { currency?: string } | null)?.currency;
  return isCurrency(c) ? c : null;
}

export async function billingCurrencyFor(userId: string, visitor: Currency): Promise<Currency> {
  return (await subscriptionCurrency(userId)) ?? visitor;
}
